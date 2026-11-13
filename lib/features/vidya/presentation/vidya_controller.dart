import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart' show AppLifecycleListener, Locale;
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/locale_provider.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/voice/audio_player_service.dart';
import '../../../shared/voice/audio_recorder_service.dart';
import '../../../shared/voice/mic_permission_service.dart';
import '../../../shared/voice/os_tts_service.dart';
import '../../../shared/voice/speech_activity.dart';
import '../../../shared/voice/tts_language.dart';
import '../../settings/data/voice_mode_provider.dart';
import '../data/dto/assistant_request.dart';
import '../data/dto/assistant_response.dart';
import '../data/dto/chat_message.dart';
import '../data/dto/vidya_action.dart';
import '../data/dto/vidya_profile.dart';
import '../data/dto/vidya_session.dart';
import '../data/gemini_live_client.dart';
import '../data/tts_repository.dart';
import '../data/vidya_profile_repository.dart';
import '../data/vidya_repository.dart';
import '../data/vidya_session_repository.dart';
import '../data/voice_to_text_repository.dart';
import '../domain/vidya_screen_intent.dart';
import '../domain/vidya_stop_phrase.dart';
import 'vidya_status_ui.dart';
import 'widgets/conversation_block.dart' show vidyaFlowLabel;

// The language→BCP-47 helpers now live in shared voice infra (so the
// read-aloud path resolves the same way); re-exported here for this feature's
// existing call sites (vidya_nav_dispatcher) and tests.
export '../../../shared/voice/tts_language.dart'
    show kLangToBcp47, normaliseVidyaLanguage, vidyaTtsBcp47;

part 'vidya_controller.g.dart';

// ─── VAD / capture thresholds (ported from the web, SPEC §A.4 / §C.2) ────────

/// Trailing silence after speech began that auto-stops the capture, so the
/// teacher never has to press stop: long enough for a pause to think, short
/// enough that VIDYA answers as soon as the teacher has finished.
const Duration kTrailingSilence = Duration(milliseconds: 1800);

/// Silence before any speech that abandons the capture (a mis-tap).
const Duration kInitialSilence = Duration(milliseconds: 8000);

/// In a conversation, the pause after VIDYA stops speaking before the mic
/// reopens, so the tail of her own voice is never captured as the teacher's.
const Duration kConversationEchoGap = Duration(milliseconds: 450);

/// In a conversation, this many turns in a row with nothing heard pause it:
/// a quiet room must not keep the mic open.
const int kQuietTurnsToPause = 2;

/// The longest VIDYA waits, mic shut, for another clip (a read-aloud) to end
/// before she listens again, in case the player never reports the end.
const Duration kMaxYield = Duration(minutes: 10);

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

  /// A 403 `PLAN_UPGRADE_REQUIRED`: cloud voice is a paid feature. Distinct from
  /// [failed] because it is NOT retryable — a retry re-runs the identical paid
  /// call and 403s again, so offering "Try again" here is a dead end that looks
  /// like a bug to the teacher. It gets an upgrade prompt and a pricing link,
  /// matching what every other AI tool screen already does for a 403.
  upgradeRequired,

  /// The capture ended without usable speech (silence, a mis-tap, or words
  /// the speech-to-text could not make out). Said in words, never a silent
  /// bounce back to idle (design guide: honest failure).
  notHeard,

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
    this.timestamp,
  });

  final ConversationRole role;
  final String text;
  final List<VidyaDirective> directives;

  /// When this turn was inked, for a per-group timestamp. Null on restored
  /// history (no reliable capture time) and on seeded test data.
  final DateTime? timestamp;

  @override
  bool operator ==(Object other) =>
      other is ConversationBlock &&
      other.role == role &&
      other.text == text &&
      listEquals(other.directives, directives) &&
      other.timestamp == timestamp;

  @override
  int get hashCode =>
      Object.hash(role, text, Object.hashAll(directives), timestamp);
}

const Object _unset = Object();

/// What the mic level says about the capture in progress, shown in the sheet
/// as a short line of words while listening (never a graph).
enum VidyaMicHint {
  none,

  /// The input is clipping: the words get distorted before recognition.
  tooLoud,

  /// The input stays faint: recognition may miss words.
  tooQuiet,
}

/// A 0..1 mic level at or above this is clipping (about −1 dBFS).
const double kMicClipLevel = 0.97;

/// Below this, a reading is room noise rather than a voice.
const double kMicSoundLevel = 0.08;

/// A capture whose loudest reading stays under this is "too quiet".
const double kMicFaintLevel = 0.35;

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
    this.pendingScreen,
    this.conversing = false,
    this.errorMessage,
    this.micHint = VidyaMicHint.none,
    this.heldNavigation,
    this.heldScreen,
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

  /// A screen the teacher asked to go to by name ("take me to my profile");
  /// the shell consumes it and calls [VidyaController.consumeScreen].
  final VidyaScreen? pendingScreen;

  /// A voice conversation is on: after each reply VIDYA listens again, until
  /// the teacher ends it (End, a stop phrase, two quiet turns, or leaving the
  /// app). The sheet, dock and floating orb show "Mic on" and End while true.
  final bool conversing;

  /// User-safe copy for a terminal error phase.
  final String? errorMessage;

  /// Too loud / too quiet, while [VidyaStatus.listening].
  final VidyaMicHint micHint;

  /// A tool VIDYA will open once the teacher confirms what she heard. Only a
  /// SPOKEN request is held: "I heard … — Say it again / Looks right".
  final VidyaDirective? heldNavigation;

  /// A screen VIDYA will open once the teacher confirms (see [heldNavigation]).
  final VidyaScreen? heldScreen;

  /// VIDYA is waiting for "Looks right" before acting on a spoken request.
  bool get awaitingConfirm => heldNavigation != null || heldScreen != null;

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
    Object? pendingScreen = _unset,
    bool? conversing,
    Object? errorMessage = _unset,
    VidyaMicHint? micHint,
    Object? heldNavigation = _unset,
    Object? heldScreen = _unset,
  }) {
    return VidyaState(
      status: status ?? this.status,
      conversation: conversation ?? this.conversation,
      amplitude: amplitude ?? this.amplitude,
      chatHistory: chatHistory ?? this.chatHistory,
      profile: identical(profile, _unset)
          ? this.profile
          : profile as VidyaProfile?,
      sessionId: identical(sessionId, _unset)
          ? this.sessionId
          : sessionId as String?,
      screenPath: identical(screenPath, _unset)
          ? this.screenPath
          : screenPath as String?,
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
      pendingScreen: identical(pendingScreen, _unset)
          ? this.pendingScreen
          : pendingScreen as VidyaScreen?,
      conversing: conversing ?? this.conversing,
      errorMessage: identical(errorMessage, _unset)
          ? this.errorMessage
          : errorMessage as String?,
      micHint: micHint ?? this.micHint,
      heldNavigation: identical(heldNavigation, _unset)
          ? this.heldNavigation
          : heldNavigation as VidyaDirective?,
      heldScreen: identical(heldScreen, _unset)
          ? this.heldScreen
          : heldScreen as VidyaScreen?,
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
  int _activeGen =
      0; // gen captured when listening started (for timer closures)
  bool _speechDetected = false;

  /// Whether the turn being answered was spoken (held for "Looks right") or
  /// typed (acted on at once).
  bool _turnFromVoice = false;

  /// Mic-hint bookkeeping for the capture in progress.
  int _loudRun = 0;
  double _peak = 0;
  DateTime? _captureStart;

  /// This capture's levels against the room: when speech starts and stops.
  final SpeechActivity _speech = SpeechActivity();
  bool _restored = false;
  bool _restoring = false;

  /// Turns in a row, within a conversation, that heard nothing usable.
  int _quietTurns = 0;

  /// Ends a conversation when the app leaves the screen (no background
  /// listening, design guide 02).
  AppLifecycleListener? _lifecycle;
  StreamSubscription<double>? _amplitudeSub;
  Timer? _initialSilenceTimer;
  Timer? _trailingSilenceTimer;
  Timer? _hardCapTimer;

  /// While listening in a conversation: another clip starting (a "your quiz is
  /// ready" summary, a read-aloud) shuts the mic until it ends.
  StreamSubscription<PlaybackProgress>? _playbackSub;

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
    try {
      _lifecycle = AppLifecycleListener(onHide: _onAppHidden);
      ref.onDispose(() => _lifecycle?.dispose());
    } catch (_) {
      // No widgets binding (a plain unit test): nothing can go to the
      // background there, so there is nothing to listen for.
    }
    return const VidyaState();
  }

  AudioRecorderService get _recorder => ref.read(audioRecorderServiceProvider);
  AudioPlayerService get _player => ref.read(audioPlayerServiceProvider);
  MicPermissionService get _permission =>
      ref.read(micPermissionServiceProvider);
  VoiceToTextRepository get _stt => ref.read(voiceToTextRepositoryProvider);
  VidyaRepository get _vidya => ref.read(vidyaRepositoryProvider);
  TtsRepository get _tts => ref.read(ttsRepositoryProvider);
  VidyaSessionRepository get _session =>
      ref.read(vidyaSessionRepositoryProvider);
  VidyaProfileRepository get _profileRepo =>
      ref.read(vidyaProfileRepositoryProvider);
  GeminiLiveClient get _live => ref.read(geminiLiveClientProvider);

  /// Whether a voice turn should open a conversation (Settings > Voice mode).
  /// Defensive like [_voiceMode]: a missing preferences plugin means on.
  bool get _keepListening {
    try {
      return ref.read(keepListeningControllerProvider);
    } catch (_) {
      return true;
    }
  }

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
      // The plan gate is a property of the ACCOUNT, not of this turn: the panel
      // tells the teacher to upgrade, and if they do, the very next tap must
      // work. So the seal keeps starting a capture here rather than going inert
      // — re-running the paid call is exactly the "retry" the panel is careful
      // not to offer as a labelled button, because it only succeeds post-upgrade.
      case VidyaStatus.upgradeRequired:
      case VidyaStatus.notHeard:
      case VidyaStatus.failed:
        await _beginVoice();
    }
  }

  /// Starts a voice interaction using the teacher's chosen engine. In `live`
  /// mode it attempts a Gemini Live session; if the flag is off OR the Live
  /// connect/mic fails, it falls through to the EXISTING turn-based `_begin()`
  /// — the always-available fallback, which is never removed.
  Future<void> _beginVoice() async {
    // A spoken start opens a conversation (when the teacher wants one): from
    // here VIDYA listens again after each reply until it is ended.
    _quietTurns = 0;
    _set(conversing: _keepListening);
    if (_voiceMode == VoiceMode.live) {
      final handled = await _beginLive();
      if (handled) return;
      // Live could not connect (or the mic would not open) — fall through.
    }
    await _begin();
  }

  /// Ends the conversation: whatever is in flight stops and VIDYA goes quiet
  /// until the next tap. The End button and the app going to the background
  /// both land here.
  Future<void> endConversation() => cancel();

  /// Abandons whatever is in flight (a fresh generation invalidates every
  /// pending await), stops any capture and any TTS, ends any conversation,
  /// and returns to idle.
  Future<void> cancel() async {
    _gen++;
    // Tear the Live session down first (awaited, deterministic); a no-op when
    // there is no Live session. `_teardownCapture()` also fires it, guarded.
    await _teardownLive();
    _teardownCapture();
    await _recorder.cancel();
    await _player.stop();
    _quietTurns = 0;
    _set(status: VidyaStatus.idle, amplitude: 0, conversing: false);
  }

  /// The app went to the background (or the screen locked): VIDYA never
  /// listens unseen, so a conversation or an open capture ends here.
  void _onAppHidden() {
    if (state.conversing ||
        state.status == VidyaStatus.listening ||
        state.status == VidyaStatus.requestingPermission) {
      unawaited(cancel());
    }
  }

  /// In a conversation, once VIDYA is idle again: wait out the echo gap, then
  /// listen for the next turn. A no-op when the conversation ended, a newer
  /// turn took over, or VIDYA is not idle (a panel, a fresh tap).
  Future<void> _continueConversation(int gen) async {
    if (!state.conversing || _stale(gen)) return;
    await Future<void>.delayed(kConversationEchoGap);
    if (!state.conversing || _stale(gen)) return;
    if (state.status != VidyaStatus.idle) return;
    await _begin();
  }

  /// Nothing usable was heard. In a conversation the first quiet turn just
  /// listens again; [kQuietTurnsToPause] in a row end it with the "couldn't
  /// hear" panel. Outside one, the panel shows straight away.
  void _onNothingHeard(int gen) {
    if (state.conversing && ++_quietTurns < kQuietTurnsToPause) {
      _set(status: VidyaStatus.idle, amplitude: 0);
      unawaited(_continueConversation(gen));
      return;
    }
    _quietTurns = 0;
    _set(status: VidyaStatus.notHeard, amplitude: 0, conversing: false);
  }

  /// A clip began playing while VIDYA listened in a conversation (a tool's
  /// "your worksheet is ready", a read-aloud): her mic would take it for the
  /// teacher. Drop this capture, wait for the clip to end, then listen again.
  Future<void> _yieldToPlayback(int gen, int session) async {
    if (_stale(gen) || state.status != VidyaStatus.listening) return;
    final next = ++_gen;
    _teardownCapture();
    await _recorder.cancel();
    if (_stale(next)) return;
    _set(status: VidyaStatus.idle, amplitude: 0);
    await _awaitPlaybackEnd(session, '', bound: kMaxYield);
    unawaited(_continueConversation(next));
  }

  /// Waits for the reply clip [session] to finish playing, so the mic never
  /// opens over VIDYA's own voice. Bounded (by the reply's length, or [bound])
  /// in case the player never reports completion.
  Future<void> _awaitPlaybackEnd(
    int session,
    String text, {
    Duration? bound,
  }) async {
    final words = text.trim().split(RegExp(r'\s+')).length;
    bound ??= Duration(seconds: (words * 0.6).ceil().clamp(4, 90));
    try {
      await _player.playback
          .firstWhere((p) => p.session != session || !p.playing)
          .timeout(bound);
    } catch (_) {
      // Timed out, or the stream closed: carry on rather than hang.
    }
  }

  /// Sends a typed message through the SAME turn pipeline as a captured
  /// utterance — v3 screen 04's composer ("Or type what you need…"). A typed
  /// turn supersedes anything in flight: fresh generation, capture and TTS
  /// stopped first, then the message goes straight into [_converse] (which
  /// inks the words immediately and moves to [VidyaStatus.thinking]).
  Future<void> sendText(String message) async {
    final text = message.trim();
    if (text.isEmpty) return;
    debugPrint('[Vidya] sendText: ${text.length} chars');
    _gen++;
    final gen = _gen;
    await _teardownLive(); // no-op without a Live session
    _teardownCapture();
    await _recorder.cancel();
    await _player.stop();
    _turnFromVoice = false;
    _set(heldNavigation: null, heldScreen: null);
    await _converse(text, '', gen);
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
                directives: b.directives
                    .where((d) => d != directive)
                    .toList(growable: false),
                timestamp: b.timestamp,
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

  /// The shell opened [VidyaState.pendingScreen]; clear it so it is not
  /// opened twice.
  void consumeScreen() {
    if (state.pendingScreen != null) {
      _set(pendingScreen: null);
    }
  }

  /// Dismisses a terminal state (mic denied, failed, etc.) so the teacher can
  /// type instead of speaking. Sets status to idle without clearing conversation.
  void dismissTerminal() {
    if (isVidyaTerminal(state.status)) {
      _set(status: VidyaStatus.idle, errorMessage: null);
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
          : session.messages.sublist(session.messages.length - kChatHistoryCap);
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
    _activeGen = gen;
    debugPrint('[Vidya] _begin() started, gen=$_gen');
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
    debugPrint('[Vidya] permission result: $perm');
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
    _speech.reset();
    try {
      await _recorder.start();
      debugPrint('[Vidya] recorder started');
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
    _loudRun = 0;
    _peak = 0;
    _captureStart = DateTime.now();
    _set(
      status: VidyaStatus.listening,
      amplitude: 0,
      micHint: VidyaMicHint.none,
      heldNavigation: null,
      heldScreen: null,
    );
    _amplitudeSub = _recorder.amplitude.listen(_onAmplitude);
    if (state.conversing) {
      _playbackSub = _player.playback.listen((p) {
        if (p.playing) unawaited(_yieldToPlayback(gen, p.session));
      });
    }
    _hardCapTimer = Timer(kMaxCapture, () {
      if (!_stale(gen) && state.status == VidyaStatus.listening) {
        // Normally the trailing silence ends a capture; reaching the cap means
        // the room never fell below the onset (see SpeechActivity).
        debugPrint(
          '[Vidya] hard cap reached (room ${_speech.room.toStringAsFixed(2)}, '
          'onset ${_speech.onset.toStringAsFixed(2)})',
        );
        _stopAndProcess(gen);
      }
    });
    _initialSilenceTimer = Timer(kInitialSilence, () {
      if (!_stale(gen) &&
          state.status == VidyaStatus.listening &&
          !_speechDetected) {
        if (_speech.soundHeard) {
          // Something was said, just quieter than the onset: let the
          // speech-to-text decide rather than throwing the words away.
          debugPrint('[Vidya] no onset, but sound heard - transcribing');
          _stopAndProcess(gen);
        } else {
          debugPrint('[Vidya] initial silence timeout - nothing heard');
          _discardCapture();
        }
      }
    });
  }

  void _onAmplitude(double level) {
    if (_stale(_activeGen)) return;
    if (state.status != VidyaStatus.listening) return;
    _set(amplitude: level);
    _updateMicHint(level);
    if (_speech.add(level)) {
      if (!_speechDetected) {
        debugPrint(
          '[Vidya] speech detected (room ${_speech.room.toStringAsFixed(2)}, '
          'onset ${_speech.onset.toStringAsFixed(2)})',
        );
      }
      _speechDetected = true;
      _initialSilenceTimer?.cancel();
      _trailingSilenceTimer?.cancel();
      _trailingSilenceTimer = Timer(kTrailingSilence, () {
        if (!_stale(_activeGen) && state.status == VidyaStatus.listening) {
          _stopAndProcess(_activeGen);
        }
      });
    }
  }

  /// Too loud: three readings in a row at the top of the scale (clipping).
  /// Too quiet: after 1.5 s of sound the loudest reading is still faint. A
  /// later strong reading clears "too quiet"; "too loud" stays for the take,
  /// because the words already captured are the distorted ones.
  void _updateMicHint(double level) {
    if (level > _peak) _peak = level;
    _loudRun = level >= kMicClipLevel ? _loudRun + 1 : 0;
    final hint = state.micHint;
    if (_loudRun >= 3 && hint != VidyaMicHint.tooLoud) {
      _set(micHint: VidyaMicHint.tooLoud);
      return;
    }
    if (hint == VidyaMicHint.tooLoud) return;
    final started = _captureStart;
    final long =
        started != null &&
        DateTime.now().difference(started) >=
            const Duration(milliseconds: 1500);
    if (hint == VidyaMicHint.none &&
        long &&
        _peak > kMicSoundLevel &&
        _peak < kMicFaintLevel) {
      _set(micHint: VidyaMicHint.tooQuiet);
    } else if (hint == VidyaMicHint.tooQuiet && level >= kMicFaintLevel) {
      _set(micHint: VidyaMicHint.none);
    }
  }

  /// The teacher confirmed what VIDYA heard: carry out the held action.
  void confirmHeard() {
    final nav = state.heldNavigation;
    final screen = state.heldScreen;
    if (nav == null && screen == null) return;
    if (nav != null) {
      _set(heldNavigation: null, heldScreen: null, pendingNavigation: nav);
    } else {
      _set(heldNavigation: null, heldScreen: null, pendingScreen: screen);
    }
  }

  /// Not what she meant: drop the held action and listen again.
  Future<void> retryHeard() async {
    _set(heldNavigation: null, heldScreen: null);
    await onMicTap();
  }

  /// Nothing was said (initial silence elapsed): drop the capture and say so
  /// (or, in a conversation, listen once more; see [_onNothingHeard]).
  Future<void> _discardCapture() async {
    final gen = _activeGen;
    _teardownCapture();
    await _recorder.cancel();
    if (_stale(gen)) return;
    _onNothingHeard(gen);
  }

  Future<void> _stopAndProcess([int? genParam]) async {
    final gen = genParam ?? _activeGen;
    if (_stale(gen)) return;
    debugPrint('[Vidya] _stopAndProcess started gen=$gen');
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
      unawaited(recording?.discard());
      _onNothingHeard(gen);
      return;
    }

    try {
      // Read for upload, then delete: the voice never stays on the device.
      final bytes = await recording.takeBytes();
      if (_stale(gen)) return;
      final uiLang = _uiLanguage();
      final transcript = await _stt.transcribe(
        audioBytes: bytes,
        expectedLanguage: uiLang,
      );
      if (_stale(gen)) return;
      if (!transcript.isUsable ||
          isLikelyTranscriptionRefusal(transcript.text)) {
        _onNothingHeard(gen);
        return;
      }
      _turnFromVoice = true;
      await _converse(transcript.text, transcript.language, gen);
    } on ApiException catch (e) {
      if (_stale(gen)) return;
      debugPrint(
        '[Vidya] STT ApiException: ${e.runtimeType} status=${e.statusCode}',
      );
      _handleError(e);
    } catch (e) {
      if (_stale(gen)) return;
      debugPrint('[Vidya] STT exception: ${e.runtimeType}: $e');
      _set(status: VidyaStatus.failed, errorMessage: e.toString());
    }
  }

  // ── Conversation ─────────────────────────────────────────────────────────

  Future<void> _converse(String message, String detectedLang, int gen) async {
    _quietTurns = 0; // words were heard
    if (_endIfStopPhrase(message)) return;
    if (_openScreenIfAsked(message)) {
      if (!state.awaitingConfirm) unawaited(_continueConversation(gen));
      return;
    }
    // Ink the teacher's words immediately, then think.
    final withUser = [
      ...state.conversation,
      ConversationBlock(
        role: ConversationRole.teacher,
        text: message,
        timestamp: DateTime.now(),
      ),
    ];
    // The prior history rides only when the fresh-classification window holds.
    // Keep only the most recent few turns in the prompt: the full transcript is
    // still shown locally, but shrinking the request keeps the round-trip fast.
    final priorHistory = _carryHistory()
        ? (state.chatHistory.length <= 6
              ? state.chatHistory
              : state.chatHistory.sublist(state.chatHistory.length - 6))
        : const <ChatMessage>[];
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
      // Always through the backend: a model key compiled into the app is
      // readable by anyone holding the APK (P0.6).
      turn = await _vidya.ask(request);
    } on ApiException catch (e) {
      if (_stale(gen)) return;
      debugPrint(
        '[Vidya] _converse ApiException: ${e.runtimeType} status=${e.statusCode} code=${e.errorCode}',
      );
      _handleError(e);
      return;
    } catch (e, st) {
      if (_stale(gen)) return;
      debugPrint('[Vidya] _converse exception: ${e.runtimeType}: $e');
      debugPrint(
        '[Vidya] stack: ${st.toString().split('\\n').take(5).join(' | ')}',
      );
      _set(status: VidyaStatus.failed, errorMessage: e.toString());
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
        timestamp: DateTime.now(),
      ),
    ];
    _set(
      conversation: withVidya,
      chatHistory: _appendHistory(message, turn.response),
      lastQueryAtMs: DateTime.now().millisecondsSinceEpoch,
      lastQueryPath: state.screenPath,
    );
    _learnProfile(turn.directives);

    // 0 actions → speak the reply · 1 action → open the tool now · 2–3 → chips.
    final single = turn.directives.length == 1 ? turn.directives.single : null;
    if (single != null) {
      // The teacher asked for a tool, so the tool is the answer: open it at
      // once (it generates by itself, see VidyaNavDispatcher.prefillFor) and
      // say only "Opening Lesson Plan". Before (2026-11-13) a spoken request
      // had the whole reply read aloud (~20 s), then waited for a "Looks
      // right" tap: the teacher waited and tapped for what she had asked for.
      // Opening a tool ends the conversation, spoken or typed: with the mic
      // left open over a running tool, voices in the room went in as the next
      // request (seen 2026-11-13), and with no confirm step that could open
      // and run a second tool. The teacher taps the orb to talk again.
      _set(
        status: VidyaStatus.idle,
        pendingNavigation: single,
        conversing: false,
      );
      _persistTurn(message, turn.response, single);
      final ui = _localizations(uiLang);
      await _speak(
        ui.vidyaOpeningScreen(vidyaFlowLabel(single.flow, ui)),
        uiLang,
        gen,
      );
      if (_stale(gen)) return;
      if (state.status == VidyaStatus.speaking) {
        _set(status: VidyaStatus.idle);
      }
      return;
    }

    await _speak(turn.response, uiLang, gen);
    if (_stale(gen)) return;
    _set(status: VidyaStatus.idle);

    _persistTurn(message, turn.response, null);
    unawaited(_continueConversation(gen));
  }

  /// Speaks [text]. A TTS failure must not break the turn — the text is
  /// already inked — so it is swallowed, EXCEPT for the plan-gate 403 where
  /// we fall back to OS-level TTS so the free-plan teacher still hears VIDYA.
  Future<void> _speak(String text, String uiLang, int gen) async {
    if (text.isEmpty) return;
    _set(status: VidyaStatus.speaking);
    try {
      // Timebox cloud TTS so a slow synthesis falls back to local speech
      // instead of leaving the teacher waiting for the audio.
      final tts = await _tts
          .synthesize(text: text, targetLang: vidyaTtsBcp47(uiLang))
          .timeout(const Duration(seconds: 4));
      if (_stale(gen)) return;
      if (tts.hasAudio) {
        final session = await _player.playBase64Mp3(tts.audioContent);
        // The player returns once playback STARTS. In a conversation the
        // mic reopens next, so wait for the reply to finish first.
        if (session != null && state.conversing) {
          await _awaitPlaybackEnd(session, text);
        }
      } else {
        throw Exception('No audio');
      }
    } on ApiException catch (e) {
      // Plan-gate 403 → OS TTS fallback (strictly additive, demo-safe).
      if (e.errorCode == 'PLAN_UPGRADE_REQUIRED') {
        if (_stale(gen)) return;
        await _speakOnDevice(text, uiLang);
      }
      // Other TTS errors (rate limit, quota, 500) → swallow, text is inked.
    } on TimeoutException catch (_) {
      if (_stale(gen)) return;
      await _speakOnDevice(text, uiLang);
    } catch (_) {
      // Cloud TTS returned no usable audio — try local speech.
      if (_stale(gen)) return;
      await _speakOnDevice(text, uiLang);
    }
  }

  /// The phone's own voice. A failure here (language unavailable, engine
  /// missing) is swallowed: the text is already inked.
  Future<void> _speakOnDevice(String text, String uiLang) async {
    try {
      await ref.read(osTtsServiceProvider).initialize(vidyaTtsBcp47(uiLang));
      await ref.read(osTtsServiceProvider).speak(text);
    } catch (_) {}
  }

  /// "Stop" / "बस" / "that's all" (see [isVidyaStopPhrase]): inks the words and
  /// VIDYA's goodbye, ends the conversation, and asks no server. Returns false
  /// (changing nothing) for anything else.
  bool _endIfStopPhrase(String message) {
    if (!isVidyaStopPhrase(message)) return false;
    final reply = _localizations(_uiLanguage()).vidyaConversationEnded;
    final now = DateTime.now();
    _quietTurns = 0;
    _set(
      status: VidyaStatus.idle,
      conversing: false,
      amplitude: 0,
      conversation: [
        ...state.conversation,
        ConversationBlock(
          role: ConversationRole.teacher,
          text: message,
          timestamp: now,
        ),
        ConversationBlock(
          role: ConversationRole.vidya,
          text: reply,
          timestamp: now,
        ),
      ],
    );
    return true;
  }

  /// Answers "take me to my profile" on the device: inks the teacher's words
  /// and "Opening Profile", and hands the screen to the shell. Returns false
  /// (and changes nothing) when [message] is not a request to open a screen,
  /// so it goes to the classifier as before. The classifier only knows the AI
  /// tools, so without this a screen request came back as a spoken answer.
  bool _openScreenIfAsked(String message) {
    final ui = _localizations(_uiLanguage());
    final screen = matchVidyaScreen(message, {
      ui,
      _localizations('en'),
      _localizations('hi'),
    });
    if (screen == null) return false;
    final reply = ui.vidyaOpeningScreen(screen.label(ui));
    final now = DateTime.now();
    _set(
      status: VidyaStatus.idle,
      conversation: [
        ...state.conversation,
        ConversationBlock(
          role: ConversationRole.teacher,
          text: message,
          timestamp: now,
        ),
        ConversationBlock(
          role: ConversationRole.vidya,
          text: reply,
          timestamp: now,
        ),
      ],
      chatHistory: _appendHistory(message, reply),
      // Opens at once, spoken or typed: no "Looks right" (see _converse).
      pendingScreen: screen,
      conversing: _turnFromVoice ? false : null,
    );
    return true;
  }

  /// Whether the prior turns still count as the same conversation (SPEC §A.6).
  bool _carryHistory() {
    final last = state.lastQueryAtMs;
    if (last == null || state.chatHistory.isEmpty) return false;
    final withinWindow =
        DateTime.now().millisecondsSinceEpoch - last <=
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
    if (grade == current.preferredGrade &&
        subject == current.preferredSubject) {
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
    final sessionId =
        existing ?? 'sess-${DateTime.now().microsecondsSinceEpoch}';
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
      // Only the plan gate earns the upgrade prompt. A 403 for any other reason
      // (a permission rule, say) is still an ordinary failure, so it keeps the
      // retry rather than sending the teacher to a pricing page that will not
      // help them.
      case ApiErrorKind.forbidden when e.errorCode == 'PLAN_UPGRADE_REQUIRED':
        _set(status: VidyaStatus.upgradeRequired, errorMessage: e.message);
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

  AppLocalizations _localizations(String code) {
    try {
      return lookupAppLocalizations(Locale(code));
    } catch (_) {
      return lookupAppLocalizations(const Locale('en'));
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
    unawaited(_playbackSub?.cancel());
    _playbackSub = null;
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
      _set(
        conversation: [
          ...state.conversation,
          ConversationBlock(
            role: ConversationRole.vidya,
            text: '',
            directives: directives,
            timestamp: DateTime.now(),
          ),
        ],
      );
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
    Object? pendingScreen = _unset,
    bool? conversing,
    Object? errorMessage = _unset,
    VidyaMicHint? micHint,
    Object? heldNavigation = _unset,
    Object? heldScreen = _unset,
  }) {
    // A dead end (signed out, limit, failure, mic off) ends a conversation:
    // listening again could only fail the same way.
    final terminal =
        status == VidyaStatus.micDenied ||
        status == VidyaStatus.signedOut ||
        status == VidyaStatus.limitReached ||
        status == VidyaStatus.upgradeRequired ||
        status == VidyaStatus.failed;
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
      pendingScreen: pendingScreen,
      conversing: terminal ? false : conversing,
      errorMessage: errorMessage,
      micHint: micHint,
      heldNavigation: heldNavigation,
      heldScreen: heldScreen,
    );
  }
}
