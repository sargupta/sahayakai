import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_sound/flutter_sound.dart';
import 'package:path_provider/path_provider.dart';

import '../network/api_config.dart';

/// Maximum text length for a single TTS request.
/// Sarvam chunks at 2500 chars; we keep a safe buffer.
const _maxTTSTextLength = 2500;

/// Text-to-speech service that calls the backend TTS endpoint
/// (Sarvam Bulbul v3 → Google Cloud TTS fallback) and plays audio.
///
/// Singleton — use [TTSService.instance].
class TTSService {
  static TTSService? _instance;
  FlutterSoundPlayer? _player;
  bool _isPlaying = false;
  Completer<void>? _speakLock; // Prevents concurrent speak() calls
  String? _lastTempFilePath;

  // Reuse a single Dio instance for connection pooling.
  final _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 15),
  ));

  TTSService._();

  static TTSService get instance {
    _instance ??= TTSService._();
    return _instance!;
  }

  bool get isPlaying => _isPlaying;

  /// Notifies listeners when playback state changes.
  final _playbackController = StreamController<bool>.broadcast();
  Stream<bool> get playbackState => _playbackController.stream;

  /// Initialize the player. Safe to call multiple times.
  Future<void> _ensurePlayerOpen() async {
    _player ??= FlutterSoundPlayer();
    if (!_player!.isOpen()) {
      try {
        await _player!.openPlayer();
      } catch (_) {
        // If open fails (lifecycle issue), recreate.
        _player = FlutterSoundPlayer();
        await _player!.openPlayer();
      }
    }
  }

  /// Speak the given [text] in the specified [languageCode] (BCP-47, e.g. 'hi-IN').
  ///
  /// Calls POST /tts → receives base64 MP3 → writes to temp file → plays.
  /// Only one speak() call runs at a time; subsequent calls stop the current one.
  Future<void> speak(String text, {String? languageCode}) async {
    if (text.trim().isEmpty) return;

    // Truncate text to prevent backend overload.
    final safeText = text.length > _maxTTSTextLength
        ? '${text.substring(0, _maxTTSTextLength)}...'
        : text;

    // Wait for any in-flight speak() to finish stopping.
    if (_speakLock != null && !_speakLock!.isCompleted) {
      await stop();
      await _speakLock!.future.catchError((_) {});
    }

    _speakLock = Completer<void>();

    try {
      await _ensurePlayerOpen();
      await stop(); // Stop any currently playing audio.

      // Get Firebase auth token (same pattern as ApiClient).
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) {
        throw Exception('Not authenticated.');
      }
      final token = await user.getIdToken();
      if (token == null) {
        throw Exception('Could not retrieve auth token.');
      }

      final response = await _dio.post(
        '${ApiConfig.baseUrl}/tts',
        data: {
          'text': safeText,
          if (languageCode != null) 'targetLang': languageCode,
        },
        options: Options(
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
        ),
      );

      if (response.statusCode == 200) {
        final audioBase64 = response.data['audioContent'] as String?;
        if (audioBase64 == null || audioBase64.isEmpty) {
          throw Exception('TTS returned empty audio');
        }

        // Clean up previous temp file.
        await _cleanupTempFile();

        // Decode base64 → write temp MP3 file → play.
        final Uint8List audioBytes = base64Decode(audioBase64);
        final tempDir = await getTemporaryDirectory();
        final tempFile = File('${tempDir.path}/tts_${DateTime.now().millisecondsSinceEpoch}.mp3');
        await tempFile.writeAsBytes(audioBytes);
        _lastTempFilePath = tempFile.path;

        _isPlaying = true;
        _playbackController.add(true);

        await _player!.startPlayer(
          fromURI: tempFile.path,
          codec: Codec.mp3,
          whenFinished: () {
            _isPlaying = false;
            _playbackController.add(false);
            _cleanupTempFile();
          },
        );
      } else {
        throw Exception('TTS failed: ${response.statusCode}');
      }
    } catch (e) {
      _isPlaying = false;
      _playbackController.add(false);
      rethrow;
    } finally {
      if (!_speakLock!.isCompleted) {
        _speakLock!.complete();
      }
    }
  }

  /// Stop any currently playing audio.
  Future<void> stop() async {
    if (_player != null && _player!.isPlaying) {
      await _player!.stopPlayer();
    }
    _isPlaying = false;
    _playbackController.add(false);
  }

  /// Delete the last temp MP3 file.
  Future<void> _cleanupTempFile() async {
    if (_lastTempFilePath != null) {
      try {
        final file = File(_lastTempFilePath!);
        if (await file.exists()) await file.delete();
      } catch (_) {}
      _lastTempFilePath = null;
    }
  }

  /// Clean up all resources.
  Future<void> dispose() async {
    await stop();
    await _cleanupTempFile();
    if (_player != null && _player!.isOpen()) {
      await _player!.closePlayer();
    }
    _player = null;
    _playbackController.close();
    _instance = null;
  }
}
