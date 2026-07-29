import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/i18n/locale_provider.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/voice/audio_player_service.dart';
import '../../../shared/voice/tts_language.dart';
import '../../../shared/voice/audio_recorder_service.dart';
import '../../../shared/voice/mic_permission_service.dart';
import '../../settings/data/voice_mode_provider.dart';
import '../data/gemini_live_client.dart';
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

// The language→BCP-47 helpers now live in shared voice infra (so the
// read-aloud path resolves the same way); re-exported here for this feature's
// existing call sites (vidya_nav_dispatcher) and tests.
export '../../../shared/voice/tts_language.dart'
    show kLangToBcp47, normaliseVidyaLanguage, vidyaTtsBcp47;

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

// ─── Language mapping ────────────────────────────────────────────────────────
// `kLangToBcp47` / `normaliseVidyaLanguage` / `vidyaTtsBcp47` now live in
// `shared/voice/tts_language.dart` (imported above, re-exported at the top of
// this library) so the read-aloud path resolves the same tags.

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
/// [VidyaStatus.failed]. The same [VidyaStatus.failed] dignified state (a
/// title, body copy and a Retry action — see `vidya_status_ui.dart`) is also
/// where an UNEXPECTED capture-side failure lands: the permission plugin
/// throwing, the recorder failing to start, or the recorder failing to stop.
/// None of those are the expected "permission denied" outcome (that is a
/// [MicPermission] return value, handled below and left exactly as-is) — they
/// are plugin hiccups, and silently resetting to [VidyaStatus.idle] for them
/// would be indistinguishable from the pre-tap state (SPEC-adjacent bug class:
/// see `b9a961e3c`/`114bd3d47`, "silently bounced back").
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

  // ── Live session (Gemini Live audio-to-audio, behind the voiceMode flag) ────
  // ADDITIVE: when this is running the turn-based capture above is idle. On any
  // Live failure the machine tears this down and can fall back to `_begin()`.
  bool _liveActive = false;
  StreamSubscription<Uint8List>? _liveMicSub;
  StreamSubscription<Uint8List>? _liveAudioSub;
  StreamSubscription<VidyaDirective>? _liveToolSub;
  StreamSubscription<void>? _liveTurnSub;
  StreamSubscription<void>? _liveInterruptSub;
  StreamSubscription<Object>? _liveErrorSub;

  /// The current model turn's streaming-PCM playback feed. Opened lazily on the
  /// first audio chunk of a turn, closed on turnComplete / barge-in.
  StreamController<Uint8List>? _livePcmController;

  /// Tool-calls buffered within the current model turn, flushed on turnComplete
  /// so a single action auto-navigates and a compound (2–3) offers confirm
  /// chips — the same 0/1/2–3 rule `_converse` applies to the turn-based reply.
  final List<VidyaDirective> _liveTurnDirectives = [];

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
  GeminiLiveClient get _live => ref.read(geminiLiveClientProvider);

  /// The teacher's chosen voice engine. Defensive: a missing preferences plugin
  /// in a plain unit test degrades to the turn-based default rather than
  /// throwing (the Live path is opt-in anyway).
  VoiceMode get _voiceMode {
    try {
      return ref.read(voiceModeControllerProvider);
    } catch (_) {
      return VoiceMode.turnBased;
    }
  }

  /// The one entry point the Seal Mic tap calls. Its meaning depends on the
  /// phase (SPEC §B.2 tap semantics):
  ///   • idle / a terminal error → begin a new capture
  ///   • listening → stop now and process what was said
  ///   • any other in-flight phase → cancel and return to idle
  Future<void> onMicTap() async {
    // A Live session owns the mic continuously (full-duplex): there is no
    // separate "stop and process" — any tap during a Live session ends it.
    if (_liveActive) {
      await cancel();
      return;
    }
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
        await _beginVoice();
    }
  }

  /// Starts a voice interaction using the teacher's chosen engine. In `live`
  /// mode it attempts a Gemini Live session; if the flag is off OR the Live
  /// connect/mic fails, it falls through to the EXISTING turn-based `_begin()`
  /// — the always-available fallback, which is never removed.
  Future<void> _beginVoice() async {
    if (_voiceMode == VoiceMode.live) {
      final handled = await _beginLive();
      if (handled) return;
      // Live could not connect (or the mic would not open) — fall through.
    }
    await _begin();
  }

  /// Abandons whatever is in flight (a fresh generation invalidates every
  /// pending await), stops any capture and any TTS, and returns to idle.
  Future<void> cancel() async {
    _gen++;
    // Tear the Live session down first (awaited, deterministic); a no-op when
    // there is no Live session. `_teardownCapture()` also fires it, guarded.
    await _teardownLive();
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

  /// The manual "Clear conversation" action (U9) — the app-bar analogue of the
  /// web's `resetContext` / Trash2 "Clear Context" button in `omni-orb.tsx`.
  /// Abandons anything in flight, stops capture/playback, and drops the
  /// transcript, chat history, session id, screen context and any pending
  /// navigation — returning to a fresh idle canvas. The learned
  /// [VidyaProfile] is a teacher PREFERENCE, not conversation content; the web
  /// reference deliberately keeps it across a reset, and so does this.
  ///
  /// This is distinct from the full [Ref.invalidate] a sign-out performs on
  /// this whole provider (`AuthController.signOut`): that also wipes the
  /// profile, because a *different* teacher may pick up a shared device next
  /// and must not inherit the outgoing teacher's grade/subject preference
  /// either. This method is the lighter, same-teacher, mid-session reset.
  void clearConversation() {
    _gen++;
    _teardownCapture(); // also tears down any Live session (guarded)
    unawaited(_teardownLive());
    unawaited(_recorder.cancel());
    unawaited(_player.stop());
    state = VidyaState(profile: state.profile);
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
      // The permission plugin itself threw — a hiccup, not the expected
      // "denied" outcome (that's a [MicPermission] value, handled in the
      // switch below and untouched by this fix). Land on the dignified
      // `failed` panel instead of bouncing silently back to idle.
      if (_stale(gen)) return;
      _set(status: VidyaStatus.failed);
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
      // Unexpected (device busy, plugin error) — not a mis-tap. Same
      // dignified-failure treatment as above, never a silent idle bounce.
      if (_stale(gen)) return;
      _set(status: VidyaStatus.failed);
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
      // The recorder failed to stop/flush — unexpected, same treatment: the
      // teacher just spoke, so silence here is exactly the bug this exists
      // to kill.
      if (_stale(gen)) return;
      _set(status: VidyaStatus.failed);
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
    // A Live session, if any, is torn down alongside the capture machinery (a
    // guarded no-op in the turn-based path). This is also the provider-dispose
    // hook (see build()), so a disposed controller never leaks an open socket.
    unawaited(_teardownLive());
  }

  // ── Live session (Gemini Live) ─────────────────────────────────────────────

  /// Attempts a Gemini Live session. Returns **true** when the tap was handled
  /// (a session started, OR a terminal permission state was set), and **false**
  /// only when Live could not connect / the mic would not open — the sole signal
  /// for [_beginVoice] to fall back to the turn-based `_begin()`.
  Future<bool> _beginLive() async {
    final gen = ++_gen;
    _set(status: VidyaStatus.requestingPermission, errorMessage: null);
    final MicPermission perm;
    try {
      perm = await _permission.ensureGranted();
    } catch (_) {
      if (_stale(gen)) return true;
      _set(status: VidyaStatus.failed);
      return true;
    }
    if (_stale(gen)) return true;
    switch (perm) {
      case MicPermission.permanentlyDenied:
        _set(status: VidyaStatus.micDenied);
        return true;
      case MicPermission.denied:
        _set(status: VidyaStatus.idle);
        return true;
      case MicPermission.granted:
        break;
    }

    // Mint the ephemeral token + open the socket. Any failure here is the
    // sanctioned fallback trigger (connect() never throws, but guard anyway).
    final bool connected;
    try {
      connected = await _live.connect(
        teacherProfile: _liveTeacherProfile(),
        screenPath: state.screenPath,
        screenUiState: state.screenUiState,
        detectedLanguage: _uiLanguage(),
      );
    } catch (_) {
      return false;
    }
    if (_stale(gen)) {
      await _live.close();
      return true;
    }
    if (!connected) return false;

    _liveActive = true;
    _wireLiveStreams(gen);

    // Stream mic PCM16@16k up.
    try {
      final micStream = await _recorder.startStream();
      if (_stale(gen)) {
        await _teardownLive();
        return true;
      }
      _liveMicSub = micStream.listen(
        (chunk) {
          if (!_stale(gen)) _live.sendAudioChunk(chunk);
        },
        onError: (Object e) {
          if (!_stale(gen)) _handleLiveError(e);
        },
      );
    } catch (_) {
      // Socket is up but the mic would not open — tear down and fall back.
      await _teardownLive();
      return false;
    }

    _set(status: VidyaStatus.listening, amplitude: 0);
    return true;
  }

  void _wireLiveStreams(int gen) {
    _liveAudioSub = _live.audioOut.listen((chunk) {
      if (_stale(gen) || !_liveActive) return;
      _feedLiveAudio(chunk);
    });
    _liveToolSub = _live.toolCalls.listen((directive) {
      if (_stale(gen) || !_liveActive) return;
      _liveTurnDirectives.add(directive);
    });
    _liveTurnSub = _live.turnComplete.listen((_) {
      if (_stale(gen) || !_liveActive) return;
      _closeLivePcm();
      _flushLiveDirectives();
      _set(status: VidyaStatus.listening);
    });
    _liveInterruptSub = _live.interrupted.listen((_) {
      if (_stale(gen) || !_liveActive) return;
      // Barge-in: flush queued playback immediately.
      _closeLivePcm();
      unawaited(_player.stop());
      _set(status: VidyaStatus.listening);
    });
    _liveErrorSub = _live.errors.listen((e) {
      if (_stale(gen)) return;
      _handleLiveError(e);
    });
    // Partial transcript (`_live.transcript`) is intentionally not inked as a
    // register block yet: an AUDIO-only session's text channel is sparse and
    // inking partials risks duplicated/garbled entries. Captions read from the
    // VidyaStatus phase, which needs no change. (Phase-4 on-device tuning item.)
  }

  /// Feeds one model-audio chunk into the current turn's streaming playback,
  /// opening a fresh feed (and the `speaking` phase) on the turn's first chunk.
  void _feedLiveAudio(Uint8List pcm) {
    var controller = _livePcmController;
    if (controller == null) {
      controller = StreamController<Uint8List>();
      _livePcmController = controller;
      _set(status: VidyaStatus.speaking);
      unawaited(_player.playPcmStream(controller.stream));
    }
    if (!controller.isClosed) controller.add(pcm);
  }

  void _closeLivePcm() {
    final controller = _livePcmController;
    _livePcmController = null;
    if (controller != null && !controller.isClosed) {
      unawaited(controller.close());
    }
  }

  /// Applies the tool-calls buffered during a model turn: 0 → speak-only,
  /// 1 → auto-navigate (`pendingNavigation`), 2–3 → confirm chips — the SAME
  /// rule and the SAME state fields `_converse` sets, so the nav/RUN chain is
  /// reused unchanged.
  void _flushLiveDirectives() {
    if (_liveTurnDirectives.isEmpty) return;
    final directives = List<VidyaDirective>.of(_liveTurnDirectives);
    _liveTurnDirectives.clear();
    if (directives.length == 1) {
      _set(pendingNavigation: directives.single);
      _learnProfile(directives);
    } else {
      _set(conversation: [
        ...state.conversation,
        ConversationBlock(
          role: ConversationRole.vidya,
          text: '',
          directives: directives,
        ),
      ]);
      _learnProfile(directives);
    }
  }

  Map<String, dynamic>? _liveTeacherProfile() {
    final p = state.profile;
    if (p == null || p.isEmpty) return null;
    return {
      if (p.preferredGrade != null) 'preferredGrade': p.preferredGrade,
      if (p.preferredSubject != null) 'preferredSubject': p.preferredSubject,
      if (p.preferredLanguage != null) 'preferredLanguage': p.preferredLanguage,
      if (p.schoolContext != null) 'schoolContext': p.schoolContext,
    };
  }

  /// A Live-session error ends the session and lands on the SAME dignified
  /// panels the turn-based path uses (via [_handleError]).
  void _handleLiveError(Object e) {
    unawaited(_teardownLive());
    if (e is ApiException) {
      _handleError(e);
    } else {
      _set(status: VidyaStatus.failed);
    }
  }

  /// Cancels every Live subscription, closes the mic stream + the socket, and
  /// resets the Live flags. A guarded no-op when no Live session is active — so
  /// it is safe to call from the shared teardown paths without ever touching the
  /// Live client in the turn-based flow.
  Future<void> _teardownLive() async {
    if (!_liveActive &&
        _liveMicSub == null &&
        _liveAudioSub == null &&
        _liveToolSub == null &&
        _liveTurnSub == null &&
        _liveInterruptSub == null &&
        _liveErrorSub == null &&
        _livePcmController == null) {
      return;
    }
    _liveActive = false;
    _liveTurnDirectives.clear();
    await _liveMicSub?.cancel();
    await _liveAudioSub?.cancel();
    await _liveToolSub?.cancel();
    await _liveTurnSub?.cancel();
    await _liveInterruptSub?.cancel();
    await _liveErrorSub?.cancel();
    _liveMicSub = null;
    _liveAudioSub = null;
    _liveToolSub = null;
    _liveTurnSub = null;
    _liveInterruptSub = null;
    _liveErrorSub = null;
    _closeLivePcm();
    await _recorder.cancel();
    await _live.close();
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
