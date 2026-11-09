import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'os_tts_service.g.dart';

/// The speech rate VIDYA's on-device voice uses: a touch slower than normal,
/// so a teacher can follow her over classroom noise.
///
/// flutter_tts takes 0.0–1.0 with **0.5 as normal speed** on both platforms:
/// Android doubles the value before handing it to `TextToSpeech` (1.0 is
/// normal there), and iOS's `AVSpeechUtterance` default is 0.5. So 0.45 is
/// about 0.9× normal. (This was 0.85 — about 1.7× normal on Android — which
/// is why VIDYA sounded rushed.)
const double kVidyaOsSpeechRate = 0.45;

/// On-device TTS (Android `TextToSpeech`): VIDYA's voice whenever the cloud
/// `/api/tts` reply cannot be played — the plan-gate 403, no audio in the
/// reply, a synthesis slower than the controller's timebox, or any other
/// failure. The cloud voice is preferred whenever it answers.
class OsTtsService {
  OsTtsService._();

  static final OsTtsService _instance = OsTtsService._();

  static OsTtsService get instance => _instance;

  late final FlutterTts _tts = FlutterTts();
  bool _initialized = false;

  /// Initialize the TTS engine with the given [languageCode] (BCP-47, e.g.
  /// `hi-IN`, `bn-IN`, `en-US`). Returns `true` if the language is available.
  Future<bool> initialize(String languageCode) async {
    if (_initialized) {
      // Re-set language if changed
      return _isAvailable(await _tts.setLanguage(languageCode));
    }

    _initialized = true;

    // Slightly slower than normal, for teacher-facing speech (see the
    // constant for how flutter_tts scales the rate).
    await _tts.setSpeechRate(kVidyaOsSpeechRate);
    await _tts.setVolume(1.0);
    await _tts.setPitch(1.0);

    // Set language (Android TTS uses BCP-47). The plugin answers 1 / 0 on
    // Android (an int, not a bool): reading it as a bool threw on the FIRST
    // initialize, so VIDYA's first on-device reply of a session was silent.
    return _isAvailable(await _tts.setLanguage(languageCode));
  }

  /// flutter_tts's `setLanguage` reply: `1`/`0` on Android, a bool elsewhere.
  static bool _isAvailable(Object? reply) => reply == 1 || reply == true;

  /// Speak [text] with the current language. Returns when utterance completes
  /// or is interrupted.
  Future<void> speak(String text) async {
    if (text.trim().isEmpty) return;

    final Completer<void> completer = Completer<void>();

    _tts.setCompletionHandler(() {
      if (!completer.isCompleted) completer.complete();
    });

    _tts.setErrorHandler((msg) {
      if (!completer.isCompleted) completer.completeError(Exception(msg));
    });

    await _tts.speak(text);
    return completer.future;
  }

  /// Stop any in-progress utterance.
  Future<void> stop() => _tts.stop();

  /// Clean up resources (call on app dispose).
  Future<void> dispose() async {
    await _tts.stop();
    _initialized = false;
  }
}

/// Provider for the OS-TTS service (Riverpod, keep-alive so the engine persists
/// across controller generations — cheap to hold, expensive to re-init).
@Riverpod(keepAlive: true)
OsTtsService osTtsService(Ref ref) {
  final service = OsTtsService.instance;
  ref.onDispose(() => service.dispose());
  return service;
}
