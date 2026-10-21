import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shared_preferences/shared_preferences.dart';

part 'voice_mode_provider.g.dart';

const String _kVoiceModeLiveKey = 'voice_mode_live';

/// Which VIDYA voice engine the mic drives.
enum VoiceMode {
  /// The default, always-available pipeline: capture -> STT -> classifier ->
  /// TTS, one turn per mic press. This is the proven fallback and stays the
  /// default until the Live path is verified on real devices.
  turnBased,

  /// Gemini Live audio-to-audio: a continuous streaming session (mic PCM up,
  /// model PCM down, tool-calls over the same socket). Additive and, as of this
  /// change, unverified on-device — so it is opt-in.
  live,
}

/// The persisted VIDYA voice mode, same local-preference shape as
/// [LocaleController] / `NotificationPrefsController`. Kept alive so the choice
/// follows the teacher across every screen, and hydrated from
/// shared_preferences so it survives a relaunch. Defaults to
/// [VoiceMode.turnBased]: the Live surface is opt-in and the turn-based
/// pipeline is always the fallback.
@Riverpod(keepAlive: true)
class VoiceModeController extends _$VoiceModeController {
  @override
  VoiceMode build() {
    _hydrate();
    return VoiceMode.turnBased;
  }

  Future<void> _hydrate() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final live = prefs.getBool(_kVoiceModeLiveKey);
      if (live != null) {
        state = live ? VoiceMode.live : VoiceMode.turnBased;
      }
    } catch (_) {
      // A missing shared_preferences plugin (a plain unit test that did not
      // seed mock values) must never throw out of build's fire-and-forget
      // hydrate — the turn-based default is a safe fallback.
    }
  }

  /// Set and persist the voice mode.
  Future<void> set(VoiceMode mode) async {
    state = mode;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_kVoiceModeLiveKey, mode == VoiceMode.live);
    } catch (_) {
      // Persisting a preference must never crash the settings screen.
    }
  }
}
