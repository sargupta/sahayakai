import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/i18n/locale_provider.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/voice/audio_player_service.dart';
import '../../../shared/voice/audio_recorder_service.dart';
import '../../../shared/voice/mic_permission_service.dart';
import '../data/dto/assistant_request.dart';
import '../data/dto/assistant_response.dart';
import '../data/dto/chat_message.dart';
import '../data/dto/vidya_action.dart';
import '../data/dto/vidya_profile.dart';
import '../data/dto/vidya_session.dart';
import '../data/tts_repository.dart';
import '../data/vidya_profile_repository.dart';
import '../data/vidya_repository.dart';
import '../data/vidya_session_repository.dart';
import '../data/voice_to_text_repository.dart';

part 'vidya_controller.g.dart';

// ─── VAD / capture thresholds (ported from the web, SPEC §A.4 / §C.2) ────────

/// Normalised (0..1) input level that counts as speech (the recorder maps dBFS
/// to 0..1; a quiet room sits well under this).
const double kSpeechOnsetLevel = 0.18;

/// Trailing silence after speech began that auto-stops the capture, so the
/// teacher never has to press stop.
const Duration kTrailingSilence = Duration(milliseconds: 2500);

/// Silence before any speech that abandons the capture (a mis-tap).
const Duration kInitialSilence = Duration(milliseconds: 5000);

/// Hard failsafe cap on a single capture.
const Duration kMaxCapture = Duration(seconds: 30);

/// A capture under this many bytes is silence / a mis-tap — not worth paying
/// for STT (SPEC §A.4 `MIN_AUDIO_BYTES`).
const int kMinAudioBytes = 2000;

/// The same-screen + recency window that decides whether the prior turns are
/// carried as `chatHistory` (SPEC §A.6 fresh-classification rule). Beyond it,
/// each utterance is a fresh intent and history is dropped.
const Duration kFreshClassificationWindow = Duration(minutes: 5);

/// Conversation turns kept for `chatHistory` on the next `/api/assistant` call
/// (SPEC §A.7 — the web keeps the last 20).
const int kChatHistoryCap = 20;

// ─── Language mapping (SPEC §A.5, the client owns this) ──────────────────────

/// STT 2-letter code → TTS BCP-47 tag. Note `mr` borrows the Hindi voice and
/// `or` has no native voice so it falls to English (SPEC §A.5 `LANG_TO_BCP47`).
const Map<String, String> kLangToBcp47 = {
  'en': 'en-IN',
  'hi': 'hi-IN',
  'bn': 'bn-IN',
  'ta': 'ta-IN',
  'te': 'te-IN',
  'kn': 'kn-IN',
  'ml': 'ml-IN',
  'gu': 'gu-IN',
  'pa': 'pa-IN',
  'mr': 'hi-IN',
  'or': 'en-IN',
};

/// Full English names / Sarvam aliases → the supported ISO-2 code.
const Map<String, String> _kLangAliases = {
  'od': 'or', 'ori': 'or', 'oriya': 'or', 'odia': 'or',
  'english': 'en', 'hindi': 'hi', 'kannada': 'kn', 'tamil': 'ta',
  'telugu': 'te', 'marathi': 'mr', 'bengali': 'bn', 'bangla': 'bn',
  'gujarati': 'gu', 'punjabi': 'pa', 'panjabi': 'pa', 'malayalam': 'ml',
};

/// Normalise a classifier / STT language hint to a supported ISO-2 code, or
/// null when unknown. Handles Sarvam's `od`→`or`, full English names
/// (`Hindi`→`hi`), casing, and region suffixes (`hi-IN`→`hi`). This is half the
/// fix for the "form shows English, output Hindi" bug (SPEC §A.8); the other
/// half is [_learnProfile] never persisting an utterance's language.
String? normaliseVidyaLanguage(String? raw) {
  if (raw == null) return null;
  var s = raw.trim().toLowerCase();
  if (s.isEmpty) return null;
  s = s.split(RegExp(r'[-_]')).first; // hi-IN / hi_IN → hi
  s = _kLangAliases[s] ?? s;
  return kLangToBcp47.containsKey(s) ? s : null;
}

/// The TTS BCP-47 tag VIDYA should speak a reply in, defaulting to `en-IN`.
String vidyaTtsBcp47(String? lang) =>
    kLangToBcp47[normaliseVidyaLanguage(lang) ?? 'en'] ?? 'en-IN';

/// Guards against a Gemini STT refusal ("I'm sorry, I cannot process the
/// audio") leaking into the transcript as a fake teacher turn (SPEC §A.4
/// `isLikelyTranscriptionRefusal`). Deliberately narrow — it only matches the
/// audio-processing refusal shape, never ordinary speech.
@visibleForTesting
bool isLikelyTranscriptionRefusal(String text) {
  final t = text.trim().toLowerCase();
  if (t.isEmpty) return false;
  const refusals = [
    'cannot process the audio',
    "can't process the audio",
    'unable to process the audio',
    'cannot transcribe',
    'could not understand the audio',
    "couldn't understand the audio",
    'no discernible speech',
    'no audio to transcribe',
  ];
  return refusals.any(t.contains);
}

// ─── State ───────────────────────────────────────────────────────────────────

/// The voice-machine phase the home and the Seal Mic render (SPEC §A.6). The
/// happy path is `idle → requestingPermission → listening → transcribing →
/// thinking → speaking → idle`; the terminal error phases ([micDenied],
/// [signedOut], [limitReached], [failed]) each own a dignified recovery state.
enum VidyaStatus {
  idle,
  requestingPermission,
  micDenied,
  listening,
  transcribing,
  thinking,
  speaking,
  signedOut,
  limitReached,
  failed,
}

/// Who authored a conversation block. The register is a composed transcript of
/// document blocks, never a chat thread (SPEC §B.3).
enum ConversationRole { teacher, vidya }

/// One inked block in the conversation register: the teacher's transcript or a
/// VIDYA reply. A VIDYA block carries [directives] only when the reply was a
/// compound intent (2–3 actions) that renders confirm chips; a single-action
/// intent auto-navigates instead (via [VidyaState.pendingNavigation]) and
/// leaves no chip.
@immutable
class ConversationBlock {
  const ConversationBlock({
    required this.role,
    required this.text,
    this.directives = const [],
  });

  final ConversationRole role;
  final String text;
  final List<VidyaDirective> directives;

  @override
  bool operator ==(Object other) =>
      other is ConversationBlock &&
      other.role == role &&
      other.text == text &&
      listEquals(other.directives, directives);

  @override
  int get hashCode => Object.hash(role, text, Object.hashAll(directives));
}

const Object _unset = Object();

/// The single VIDYA store, mirroring the web `useJarvisStore` (SPEC §C.5). Held
/// by a top-level Riverpod provider so it follows the teacher across every
/// screen.
@immutable
class VidyaState {
  const VidyaState({
    this.status = VidyaStatus.idle,
    this.conversation = const [],
    this.amplitude = 0,
    this.chatHistory = const [],
    this.profile,
    this.sessionId,
    this.screenPath,
    this.screenUiState,
    this.lastQueryAtMs,
    this.lastQueryPath,
    this.pendingNavigation,
    this.errorMessage,
  });

  /// The current machine phase.
  final VidyaStatus status;

  /// The inked transcript, oldest first.
  final List<ConversationBlock> conversation;

  /// Live 0..1 input level while [VidyaStatus.listening] (drives the ring).
  final double amplitude;

  /// The last [kChatHistoryCap] turns, sent as `chatHistory` when the fresh
  /// window still holds.
  final List<ChatMessage> chatHistory;

  /// The teacher's learned grade/subject profile (never their utterance
  /// language — SPEC §A.7 poisoning guard).
  final VidyaProfile? profile;

  /// The persisted session id, minted on the first turn.
  final String? sessionId;

  /// The screen VIDYA is reasoning about (`currentScreenContext.path`).
  final String? screenPath;

  /// The live form fields of that screen (`currentScreenContext.uiState`).
  final Map<String, dynamic>? screenUiState;

  /// When the last utterance was classified, for the fresh-classification
  /// window.
  final int? lastQueryAtMs;

  /// Where the last utterance was classified, for the same-path rule.
  final String? lastQueryPath;

  /// A single valid intent to auto-navigate to; the home consumes it and calls
  /// [VidyaController.consumeNavigation]. Null when there is nothing to route.
  final VidyaDirective? pendingNavigation;

  /// User-safe copy for a terminal error phase.
  final String? errorMessage;

  bool get isBusy =>
      status == VidyaStatus.requestingPermission ||
      status == VidyaStatus.listening ||
      status == VidyaStatus.transcribing ||
      status == VidyaStatus.thinking ||
      status == VidyaStatus.speaking;

  bool get hasConversation => conversation.isNotEmpty;

  VidyaState copyWith({
    VidyaStatus? status,
    List<ConversationBlock>? conversation,
    double? amplitude,
    List<ChatMessage>? chatHistory,
    Object? profile = _unset,
    Object? sessionId = _unset,
    Object? screenPath = _unset,
    Object? screenUiState = _unset,
    Object? lastQueryAtMs = _unset,
    Object? lastQueryPath = _unset,
    Object? pendingNavigation = _unset,
    Object? errorMessage = _unset,
  }) {
    return VidyaState(
      status: status ?? this.status,
      conversation: conversation ?? this.conversation,
      amplitude: amplitude ?? this.amplitude,
      chatHistory: chatHistory ?? this.chatHistory,
      profile: identical(profile, _unset) ? this.profile : profile as VidyaProfile?,
      sessionId:
          identical(sessionId, _unset) ? this.sessionId : sessionId as String?,
      screenPath:
          identical(screenPath, _unset) ? this.screenPath : screenPath as String?,
      screenUiState: identical(screenUiState, _unset)
          ? this.screenUiState
          : screenUiState as Map<String, dynamic>?,
      lastQueryAtMs: identical(lastQueryAtMs, _unset)
          ? this.lastQueryAtMs
          : lastQueryAtMs as int?,
      lastQueryPath: identical(lastQueryPath, _unset)
          ? this.lastQueryPath
          : lastQueryPath as String?,
      pendingNavigation: identical(pendingNavigation, _unset)
          ? this.pendingNavigation
          : pendingNavigation as VidyaDirective?,
      errorMessage: identical(errorMessage, _unset)
          ? this.errorMessage
          : errorMessage as String?,
    );
  }
}

// ─── Controller ──────────────────────────────────────────────────────────────

/// The single VIDYA brain: the coupled capture + conversation state machine
/// (SPEC §A.6) that the home mic and every inline mic feed.
///
/// One mic press runs `capture → STT → VIDYA → TTS → navigate/persist`. Every
/// `await` is guarded by a generation counter ([_stale]) so a cancel or a fresh
/// tap abandons an in-flight trip instead of applying a stale result. Errors are
/// typed: 401 → [VidyaStatus.signedOut] (expected on the stub token until real
/// auth), 429 → [VidyaStatus.limitReached], network/timeout/server →
/// [VidyaStatus.failed].
@Riverpod(keepAlive: true)
class VidyaController extends _$VidyaController {
  int _gen = 0;
  bool _speechDetected = false;
  bool _restored = false;
  bool _restoring = false;
  StreamSubscription<double>? _amplitudeSub;
  Timer? _initialSilenceTimer;
  Timer? _trailingSilenceTimer;
  Timer? _hardCapTimer;

  @override
  VidyaState build() {
    // No eager network here: a session/profile restore is U-V7 (needs real
    // auth). The machine starts idle and only touches the backend on a tap.
    ref.onDispose(_teardownCapture);
    return const VidyaState();
  }

  AudioRecorderService get _recorder => ref.read(audioRecorderServiceProvider);
  AudioPlayerService get _player => ref.read(audioPlayerServiceProvider);
  MicPermissionService get _permission => ref.read(micPermissionServiceProvider);
  VoiceToTextRepository get _stt => ref.read(voiceToTextRepositoryProvider);
  VidyaRepository get _vidya => ref.read(vidyaRepositoryProvider);
  TtsRepository get _tts => ref.read(ttsRepositoryProvider);
  VidyaSessionRepository get _session =>
      ref.read(vidyaSessionRepositoryProvider);
  VidyaProfileRepository get _profileRepo =>
      ref.read(vidyaProfileRepositoryProvider);

  /// The one entry point the Seal Mic tap calls. Its meaning depends on the
  /// phase (SPEC §B.2 tap semantics):
  ///   • idle / a terminal error → begin a new capture
  ///   • listening → stop now and process what was said
  ///   • any other in-flight phase → cancel and return to idle
  Future<void> onMicTap() async {
    switch (state.status) {
      case VidyaStatus.listening:
        await _stopAndProcess();
      case VidyaStatus.requestingPermission:
      case VidyaStatus.transcribing:
      case VidyaStatus.thinking:
      case VidyaStatus.speaking:
        await cancel();
      case VidyaStatus.idle:
      case VidyaStatus.micDenied:
      case VidyaStatus.signedOut:
      case VidyaStatus.limitReached:
      case VidyaStatus.failed:
        await _begin();
    }
  }

  /// Abandons whatever is in flight (a fresh generation invalidates every
  /// pending await), stops any capture and any TTS, and returns to idle.
  Future<void> cancel() async {
    _gen++;
    _teardownCapture();
    await _recorder.cancel();
    await _player.stop();
    _set(status: VidyaStatus.idle, amplitude: 0);
  }

  /// The teacher acted on a confirm chip (a compound-intent branch). Routes that
  /// one directive and drops its chip from the block that offered it.
  void dispatchDirective(VidyaDirective directive) {
    final blocks = [
      for (final b in state.conversation)
        b.directives.contains(directive)
            ? ConversationBlock(
                role: b.role,
                text: b.text,
                directives:
                    b.directives.where((d) => d != directive).toList(growable: false),
              )
            : b,
    ];
    _set(conversation: blocks, pendingNavigation: directive);
  }

  /// The home navigated for [VidyaState.pendingNavigation]; clear it so the
  /// same intent is not routed twice.
  void consumeNavigation() {
    if (state.pendingNavigation != null) {
      _set(pendingNavigation: null);
    }
  }

  /// Restores the prior VIDYA session + profile on the first home load, so a
  /// conversation survives a relaunch (SPEC §A.7). Runs at most once and never
  /// clobbers an in-progress conversation. On the stub token the GETs 401 → this
  /// degrades to a fresh empty session gracefully (no crash, no terminal state).
  /// Live restore needs real Firebase auth; the plumbing is testable now.
  Future<void> restoreSession() async {
    if (_restored || _restoring) return;
    _restoring = true;
    try {
      if (state.conversation.isNotEmpty) return; // already talking; leave it
      // Fetch both concurrently (independent reads): both requests are in flight
      // together, so a delayed backend drains in one settle window rather than
      // stranding a pending timer, and `Future.wait` still surfaces the first
      // error (the 401) to the handler below.
      final results = await Future.wait<Object?>([
        _session.fetchLatest(),
        _profileRepo.fetch(),
      ]);
      final session = results[0]! as VidyaSession;
      final profile = results[1] as VidyaProfile?;
      // A tap during the fetch would have inked a block — never overwrite it.
      if (state.conversation.isNotEmpty) return;
      final blocks = [
        for (final m in session.messages)
          ConversationBlock(
            role: m.role == ChatRole.user
                ? ConversationRole.teacher
                : ConversationRole.vidya,
            text: m.text,
          ),
      ];
      final history = session.messages.length <= kChatHistoryCap
          ? session.messages
          : session.messages
              .sublist(session.messages.length - kChatHistoryCap);
      _set(
        conversation: blocks.isEmpty ? null : blocks,
        chatHistory: history.isEmpty ? null : history,
        sessionId: session.sessionId,
        profile: profile ?? state.profile,
      );
    } on ApiException {
      // 401 on the stub token (or any API error) → a fresh empty session. This
      // is the EXPECTED path until real auth is wired.
    } catch (_) {
      // Defensive: a malformed restore must never crash the home.
    } finally {
      _restored = true;
      _restoring = false;
    }
  }

  /// Publish the screen VIDYA is reasoning about (the Flutter analogue of the
  /// web's `useVidyaFormSync`); a tool form calls this so a spoken follow-up is
  /// understood against that form's live fields (SPEC §C.6).
  void registerScreenContext(String path, {Map<String, dynamic>? uiState}) {
    _set(screenPath: path, screenUiState: uiState);
  }

  /// Deep-links to OS settings from the permanent-denial state.
  Future<void> openMicSettings() => _permission.openSettings();

  // ── Capture ────────────────────────────────────────────────────────────────

  Future<void> _begin() async {
    final gen = ++_gen;
    _set(status: VidyaStatus.requestingPermission, errorMessage: null);
    final MicPermission perm;
    try {
      perm = await _permission.ensureGranted();
    } catch (_) {
      if (_stale(gen)) return;
      _set(status: VidyaStatus.idle);
      return;
    }
    if (_stale(gen)) return;
    switch (perm) {
      case MicPermission.permanentlyDenied:
        _set(status: VidyaStatus.micDenied);
        return;
      case MicPermission.denied:
        _set(status: VidyaStatus.idle);
        return;
      case MicPermission.granted:
        break;
    }

    _speechDetected = false;
    try {
      await _recorder.start();
    } catch (_) {
      if (_stale(gen)) return;
      _set(status: VidyaStatus.idle);
      return;
    }
    if (_stale(gen)) {
      await _recorder.cancel();
      return;
    }
    _set(status: VidyaStatus.listening, amplitude: 0);
    _amplitudeSub = _recorder.amplitude.listen(_onAmplitude);
    _hardCapTimer = Timer(kMaxCapture, () {
      if (!_stale(gen) && state.status == VidyaStatus.listening) _stopAndProcess();
    });
    _initialSilenceTimer = Timer(kInitialSilence, () {
      if (!_stale(gen) &&
          state.status == VidyaStatus.listening &&
          !_speechDetected) {
        _discardCapture();
      }
    });
  }

  void _onAmplitude(double level) {
    if (state.status != VidyaStatus.listening) return;
    _set(amplitude: level);
    if (level >= kSpeechOnsetLevel) {
      _speechDetected = true;
      _initialSilenceTimer?.cancel();
      _trailingSilenceTimer?.cancel();
      _trailingSilenceTimer = Timer(kTrailingSilence, () {
        if (state.status == VidyaStatus.listening) _stopAndProcess();
      });
    }
  }

  /// Nothing was said (initial silence elapsed): drop the capture silently.
  Future<void> _discardCapture() async {
    _teardownCapture();
    await _recorder.cancel();
    _set(status: VidyaStatus.idle, amplitude: 0);
  }

  Future<void> _stopAndProcess() async {
    final gen = _gen; // same trip; a cancel/new tap would have bumped _gen
    _teardownCapture();
    _set(status: VidyaStatus.transcribing, amplitude: 0);

    final Recording? recording;
    try {
      recording = await _recorder.stop();
    } catch (_) {
      if (_stale(gen)) return;
      _set(status: VidyaStatus.idle);
      return;
    }
    if (_stale(gen)) return;
    // Silence / mis-tap reject before paying for STT.
    if (recording == null || recording.byteLength < kMinAudioBytes) {
      _set(status: VidyaStatus.idle);
      return;
    }

    try {
      final bytes = await recording.readBytes();
      if (_stale(gen)) return;
      final uiLang = _uiLanguage();
      final transcript =
          await _stt.transcribe(audioBytes: bytes, expectedLanguage: uiLang);
      if (_stale(gen)) return;
      if (!transcript.isUsable || isLikelyTranscriptionRefusal(transcript.text)) {
        _set(status: VidyaStatus.idle);
        return;
      }
      await _converse(transcript.text, transcript.language, gen);
    } on ApiException catch (e) {
      if (_stale(gen)) return;
      _handleError(e);
    } catch (_) {
      if (_stale(gen)) return;
      _set(status: VidyaStatus.failed);
    }
  }

  // ── Conversation ─────────────────────────────────────────────────────────

  Future<void> _converse(String message, String detectedLang, int gen) async {
    // Ink the teacher's words immediately, then think.
    final withUser = [
      ...state.conversation,
      ConversationBlock(role: ConversationRole.teacher, text: message),
    ];
    // The prior history rides only when the fresh-classification window holds.
    final priorHistory = _carryHistory() ? state.chatHistory : const <ChatMessage>[];
    _set(conversation: withUser, status: VidyaStatus.thinking);

    final uiLang = _uiLanguage();
    final request = AssistantRequest(
      message: message,
      chatHistory: priorHistory,
      screenPath: state.screenPath,
      screenUiState: state.screenUiState,
      teacherProfile: state.profile,
      detectedLanguage: detectedLang.isEmpty ? null : detectedLang,
      uiLanguage: uiLang,
    );

    final VidyaTurn turn;
    try {
      turn = await _vidya.ask(request);
    } on ApiException catch (e) {
      if (_stale(gen)) return;
      _handleError(e);
      return;
    } catch (_) {
      if (_stale(gen)) return;
      _set(status: VidyaStatus.failed);
      return;
    }
    if (_stale(gen)) return;

    final compound = turn.directives.length > 1;
    final withVidya = [
      ...state.conversation,
      ConversationBlock(
        role: ConversationRole.vidya,
        text: turn.response,
        directives: compound ? turn.directives : const [],
      ),
    ];
    _set(
      conversation: withVidya,
      chatHistory: _appendHistory(message, turn.response),
      lastQueryAtMs: DateTime.now().millisecondsSinceEpoch,
      lastQueryPath: state.screenPath,
    );
    _learnProfile(turn.directives);

    // Speak the reply. A TTS failure must not break the turn — the text is
    // already inked — so it is swallowed.
    if (turn.response.isNotEmpty) {
      _set(status: VidyaStatus.speaking);
      try {
        final tts = await _tts.synthesize(
          text: turn.response,
          targetLang: vidyaTtsBcp47(uiLang),
        );
        if (_stale(gen)) return;
        if (tts.hasAudio) await _player.playBase64Mp3(tts.audioContent);
      } on ApiException catch (_) {
        // Voice quota / rate limit on TTS alone is non-fatal to the turn.
      }
      if (_stale(gen)) return;
    }

    // 0 actions → speak only · 1 action → auto-navigate · 2–3 → confirm chips.
    final single = turn.directives.length == 1 ? turn.directives.single : null;
    _set(
      status: VidyaStatus.idle,
      pendingNavigation: single,
    );

    _persistTurn(message, turn.response, single);
  }

  /// Whether the prior turns still count as the same conversation (SPEC §A.6).
  bool _carryHistory() {
    final last = state.lastQueryAtMs;
    if (last == null || state.chatHistory.isEmpty) return false;
    final withinWindow = DateTime.now().millisecondsSinceEpoch - last <=
        kFreshClassificationWindow.inMilliseconds;
    return withinWindow && state.lastQueryPath == state.screenPath;
  }

  List<ChatMessage> _appendHistory(String userText, String modelText) {
    final next = [
      ...state.chatHistory,
      ChatMessage(role: ChatRole.user, text: userText),
      ChatMessage(role: ChatRole.model, text: modelText),
    ];
    if (next.length <= kChatHistoryCap) return next;
    return next.sublist(next.length - kChatHistoryCap);
  }

  /// Learn grade/subject from the action — but NEVER the utterance language
  /// (SPEC §A.7 profile-poisoning guard). Fire-and-forget; the save 401s on the
  /// stub token and that is expected.
  void _learnProfile(List<VidyaDirective> directives) {
    if (directives.isEmpty) return;
    final params = directives.first.params;
    final current = state.profile ?? const VidyaProfile();
    final grade = params.gradeLevel ?? current.preferredGrade;
    final subject = params.subject ?? current.preferredSubject;
    if (grade == current.preferredGrade && subject == current.preferredSubject) {
      return;
    }
    final updated = VidyaProfile(
      preferredGrade: grade,
      preferredSubject: subject,
      // preferredLanguage is DELIBERATELY carried over, never taken from the
      // utterance — a one-off Kannada question must not flip the whole app.
      preferredLanguage: current.preferredLanguage,
      preferredBoard: current.preferredBoard,
      schoolContext: current.schoolContext,
      lastActiveAt: current.lastActiveAt,
    );
    _set(profile: updated);
    unawaited(_profileRepo.save(updated).catchError((_) {}));
  }

  void _persistTurn(String userText, String modelText, VidyaDirective? action) {
    final existing = state.sessionId;
    final isNew = existing == null;
    final sessionId = existing ?? 'sess-${DateTime.now().microsecondsSinceEpoch}';
    if (isNew) _set(sessionId: sessionId);
    unawaited(
      _session
          .save(
            sessionId: sessionId,
            messages: [
              ChatMessage(role: ChatRole.user, text: userText),
              ChatMessage(role: ChatRole.model, text: modelText),
            ],
            actionTriggered: action == null ? null : _actionEvent(action),
            screenPath: state.screenPath,
            isNew: isNew,
          )
          .catchError((_) {}),
    );
  }

  Map<String, dynamic> _actionEvent(VidyaDirective d) => {
        'flow': d.flow.wire,
        'params': {
          if (d.params.topic != null) 'topic': d.params.topic,
          if (d.params.gradeLevel != null) 'gradeLevel': d.params.gradeLevel,
          if (d.params.subject != null) 'subject': d.params.subject,
          if (d.params.language != null) 'language': d.params.language,
        },
      };

  void _handleError(ApiException e) {
    switch (e.kind) {
      case ApiErrorKind.unauthorized:
        _set(status: VidyaStatus.signedOut, errorMessage: e.message);
      case ApiErrorKind.rateLimited:
        _set(status: VidyaStatus.limitReached, errorMessage: e.message);
      case ApiErrorKind.network:
      case ApiErrorKind.timeout:
      case ApiErrorKind.forbidden:
      case ApiErrorKind.notFound:
      case ApiErrorKind.server:
      case ApiErrorKind.badResponse:
      case ApiErrorKind.cancelled:
      case ApiErrorKind.unknown:
        _set(status: VidyaStatus.failed, errorMessage: e.message);
    }
  }

  // ── Plumbing ───────────────────────────────────────────────────────────────

  String _uiLanguage() {
    try {
      return ref.read(localeControllerProvider).code;
    } catch (_) {
      return 'en';
    }
  }

  bool _stale(int gen) => gen != _gen;

  void _teardownCapture() {
    _initialSilenceTimer?.cancel();
    _trailingSilenceTimer?.cancel();
    _hardCapTimer?.cancel();
    _initialSilenceTimer = null;
    _trailingSilenceTimer = null;
    _hardCapTimer = null;
    unawaited(_amplitudeSub?.cancel());
    _amplitudeSub = null;
  }

  void _set({
    VidyaStatus? status,
    List<ConversationBlock>? conversation,
    double? amplitude,
    List<ChatMessage>? chatHistory,
    Object? profile = _unset,
    Object? sessionId = _unset,
    Object? screenPath = _unset,
    Object? screenUiState = _unset,
    Object? lastQueryAtMs = _unset,
    Object? lastQueryPath = _unset,
    Object? pendingNavigation = _unset,
    Object? errorMessage = _unset,
  }) {
    state = state.copyWith(
      status: status,
      conversation: conversation,
      amplitude: amplitude,
      chatHistory: chatHistory,
      profile: profile,
      sessionId: sessionId,
      screenPath: screenPath,
      screenUiState: screenUiState,
      lastQueryAtMs: lastQueryAtMs,
      lastQueryPath: lastQueryPath,
      pendingNavigation: pendingNavigation,
      errorMessage: errorMessage,
    );
  }
}
