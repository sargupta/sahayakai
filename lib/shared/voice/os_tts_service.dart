import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'os_tts_service.g.dart';

/// OS-level TTS fallback (Android `TextToSpeech`) — used ONLY when the cloud
/// `/api/tts` endpoint returns a `403 PLAN_UPGRADE_REQUIRED` error.
/// Zero impact on paid/upgrade flows; this path is strictly additive.
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
      await _tts.setLanguage(languageCode);
      return true;
    }

    _initialized = true;

    // Configure for speech use-case
    await _tts.setSpeechRate(0.95);
    await _tts.setVolume(1.0);
    await _tts.setPitch(1.0);

    // Set language (Android TTS uses BCP-47)
    final bool available = await _tts.setLanguage(languageCode);
    return available;
  }

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