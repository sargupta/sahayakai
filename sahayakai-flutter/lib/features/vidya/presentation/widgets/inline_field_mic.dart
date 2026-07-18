import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/voice/audio_recorder_service.dart';
import '../../../../shared/voice/mic_permission_service.dart';
import '../../../../shared/widgets/press_scale.dart';
import '../../data/voice_to_text_repository.dart';
import '../vidya_controller.dart'
    show
        kInitialSilence,
        kMaxCapture,
        kMinAudioBytes,
        kSpeechOnsetLevel,
        kTrailingSilence;

/// The phase the inline mic renders. Deliberately smaller than the home's full
/// [VidyaStatus] machine — the field mic runs STT only (no VIDYA, no TTS, no
/// conversation), so a captured utterance drops straight into one form field.
@visibleForTesting
enum InlineMicPhase { idle, requesting, listening, transcribing }

/// A small "dictate this field" affordance — the secondary voice entry that sits
/// on a tool form's primary text field so a teacher can speak a topic / question
/// without leaving the form (SPEC §C.7.2, web parity `inline-mic-button.tsx`).
///
/// It reuses the SAME injectable voice stack as the home Seal Mic (the recorder,
/// the mic-permission gate, the STT repository), so a test never touches a real
/// microphone. On a captured, usable transcript it calls [onResult] with the
/// text; the host wires that to its `TextEditingController`. It is a compact,
/// SealMic-flavoured press control — NOT the 128dp hero — and it does NOT animate
/// continuously (each state is a composed still), so it never blocks a hosting
/// form's `pumpAndSettle` and is trivially reduce-motion safe.
///
/// Errors are swallowed here by design: the field mic is a convenience, and the
/// home Seal Mic owns the dignified permission / signed-out / limit recovery.
class InlineFieldMic extends ConsumerStatefulWidget {
  const InlineFieldMic({
    super.key,
    required this.onResult,
    this.expectedLanguage,
    this.semanticLabel,
  });

  /// Called with the recognised transcript when a usable capture lands.
  final ValueChanged<String> onResult;

  /// The app's 2-letter locale, sent to bias STT detection (and fire the
  /// script-mismatch retry). Optional.
  final String? expectedLanguage;

  /// Overrides the announced button label; defaults to the localized
  /// "dictate this field" string.
  final String? semanticLabel;

  @override
  ConsumerState<InlineFieldMic> createState() => _InlineFieldMicState();
}

class _InlineFieldMicState extends ConsumerState<InlineFieldMic> {
  InlineMicPhase _phase = InlineMicPhase.idle;

  /// Bumped on every start / cancel so a delayed STT or timer from an abandoned
  /// capture can detect it is stale and drop its result (mirrors the home
  /// controller's generation guard).
  int _gen = 0;
  bool _speechDetected = false;
  StreamSubscription<double>? _amplitudeSub;
  Timer? _initialSilenceTimer;
  Timer? _trailingSilenceTimer;
  Timer? _hardCapTimer;

  AudioRecorderService get _recorder => ref.read(audioRecorderServiceProvider);
  MicPermissionService get _permission => ref.read(micPermissionServiceProvider);
  VoiceToTextRepository get _stt => ref.read(voiceToTextRepositoryProvider);

  bool _stale(int gen) => gen != _gen;

  @override
  void dispose() {
    _teardown();
    super.dispose();
  }

  Future<void> _onTap() async {
    switch (_phase) {
      case InlineMicPhase.idle:
        await _start();
      case InlineMicPhase.listening:
        await _stopAndTranscribe();
      case InlineMicPhase.requesting:
      case InlineMicPhase.transcribing:
        await _cancel();
    }
  }

  Future<void> _start() async {
    final gen = ++_gen;
    _setPhase(InlineMicPhase.requesting);
    final MicPermission perm;
    try {
      perm = await _permission.ensureGranted();
    } catch (_) {
      _resetTo(gen, InlineMicPhase.idle);
      return;
    }
    if (_stale(gen) || !mounted) return;
    if (perm != MicPermission.granted) {
      // A denial returns quietly to idle; the home Seal Mic owns the Settings
      // recovery, so the field mic never pops a raw dialog of its own.
      _setPhase(InlineMicPhase.idle);
      return;
    }
    _speechDetected = false;
    try {
      await _recorder.start();
    } catch (_) {
      _resetTo(gen, InlineMicPhase.idle);
      return;
    }
    if (_stale(gen)) {
      await _recorder.cancel();
      return;
    }
    _setPhase(InlineMicPhase.listening);
    _amplitudeSub = _recorder.amplitude.listen(_onAmplitude);
    _hardCapTimer = Timer(kMaxCapture, () {
      if (!_stale(gen) && _phase == InlineMicPhase.listening) _stopAndTranscribe();
    });
    _initialSilenceTimer = Timer(kInitialSilence, () {
      if (!_stale(gen) &&
          _phase == InlineMicPhase.listening &&
          !_speechDetected) {
        _discard();
      }
    });
  }

  void _onAmplitude(double level) {
    if (_phase != InlineMicPhase.listening) return;
    if (level >= kSpeechOnsetLevel) {
      _speechDetected = true;
      _initialSilenceTimer?.cancel();
      _trailingSilenceTimer?.cancel();
      _trailingSilenceTimer = Timer(kTrailingSilence, () {
        if (_phase == InlineMicPhase.listening) _stopAndTranscribe();
      });
    }
  }

  /// Nothing was said (initial silence elapsed): drop the capture silently.
  Future<void> _discard() async {
    _teardown();
    await _recorder.cancel();
    _setPhase(InlineMicPhase.idle);
  }

  Future<void> _stopAndTranscribe() async {
    final gen = _gen; // same trip; a cancel / fresh tap would have bumped _gen
    _teardown();
    _setPhase(InlineMicPhase.transcribing);

    final Recording? recording;
    try {
      recording = await _recorder.stop();
    } catch (_) {
      _resetTo(gen, InlineMicPhase.idle);
      return;
    }
    if (_stale(gen)) return;
    // Silence / mis-tap reject before paying for STT.
    if (recording == null || recording.byteLength < kMinAudioBytes) {
      _resetTo(gen, InlineMicPhase.idle);
      return;
    }

    try {
      final bytes = await recording.readBytes();
      if (_stale(gen)) return;
      final transcript = await _stt.transcribe(
        audioBytes: bytes,
        expectedLanguage: widget.expectedLanguage,
      );
      if (_stale(gen) || !mounted) return;
      // isUsable already rejects empty / <2-char noise; the field mic accepts
      // the rest and lets the teacher edit it.
      if (transcript.isUsable) widget.onResult(transcript.text);
    } catch (_) {
      // Swallow (401 on the stub token, network, 413…): the field mic is a
      // convenience; the home Seal Mic surfaces the dignified error state.
    }
    _resetTo(gen, InlineMicPhase.idle);
  }

  Future<void> _cancel() async {
    _gen++;
    _teardown();
    await _recorder.cancel();
    _setPhase(InlineMicPhase.idle);
  }

  void _resetTo(int gen, InlineMicPhase phase) {
    if (_stale(gen)) return;
    _setPhase(phase);
  }

  void _setPhase(InlineMicPhase phase) {
    if (!mounted) return;
    setState(() => _phase = phase);
  }

  void _teardown() {
    _initialSilenceTimer?.cancel();
    _trailingSilenceTimer?.cancel();
    _hardCapTimer?.cancel();
    _initialSilenceTimer = null;
    _trailingSilenceTimer = null;
    _hardCapTimer = null;
    unawaited(_amplitudeSub?.cancel());
    _amplitudeSub = null;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    final active = _phase != InlineMicPhase.idle;

    // Saffron (the primary role) only while active — the resting form stays
    // calm and the saffron budget is spent on the home Seal, not the fields.
    final glyphColour =
        active ? scheme.primary : scheme.onSurfaceVariant;
    final fill = active ? scheme.primaryContainer : Colors.transparent;
    final opacity = _phase == InlineMicPhase.transcribing ? 0.6 : 1.0;

    final hint = switch (_phase) {
      InlineMicPhase.listening => l10n.vidyaStateListening,
      InlineMicPhase.requesting => l10n.vidyaStateReady,
      InlineMicPhase.transcribing => l10n.vidyaStateThinking,
      InlineMicPhase.idle => l10n.vidyaFieldMicLabel,
    };

    return Semantics(
      button: true,
      label: widget.semanticLabel ?? l10n.vidyaFieldMicLabel,
      hint: hint,
      onTap: _onTap,
      excludeSemantics: true,
      child: PressableScale(
        child: Tooltip(
          message: widget.semanticLabel ?? l10n.vidyaFieldMicLabel,
          child: InkResponse(
            onTap: _onTap,
            radius: AppSpacing.space6,
            containedInkWell: true,
            customBorder: const CircleBorder(),
            // 48dp keeps the tap target past the a11y floor even though the
            // painted disc is smaller.
            child: SizedBox(
              width: 48,
              height: 48,
              child: Center(
                child: Opacity(
                  opacity: opacity,
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(shape: BoxShape.circle, color: fill),
                    alignment: Alignment.center,
                    child: Icon(
                      LucideIcons.mic,
                      size: AppIconSize.inline,
                      color: glyphColour,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
