import 'dart:io';

import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../network/api_config.dart';

/// Result from speech-to-text transcription.
class STTResult {
  final String text;
  final String? language;

  const STTResult({required this.text, this.language});
}

/// Sends a recorded audio file to the backend STT endpoint (Sarvam Saaras v3).
///
/// Uses FirebaseAuth.instance directly for auth (same pattern as ApiClient)
/// to avoid circular dependency with Riverpod providers.
class STTService {
  STTService._();

  // Reuse a single Dio instance for connection pooling.
  static final _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 30), // STT can be slow
  ));

  /// Transcribe an audio file at [filePath] to text.
  ///
  /// Returns [STTResult] with transcribed text and detected language.
  /// Throws on network error, auth failure, or server error.
  static Future<STTResult> transcribe(String filePath) async {
    final file = File(filePath);
    if (!await file.exists()) {
      throw Exception('Audio file not found: $filePath');
    }

    // Get Firebase auth token (same pattern as ApiClient — no AuthRepository dep).
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      throw Exception('Not authenticated. Please sign in first.');
    }

    final token = await user.getIdToken();
    if (token == null) {
      throw Exception('Could not retrieve auth token.');
    }

    final formData = FormData.fromMap({
      'audio': await MultipartFile.fromFile(
        filePath,
        filename: 'recording.ogg', // Must match a Sarvam-supported format
      ),
    });

    final response = await _dio.post(
      '${ApiConfig.baseUrl}/ai/voice-to-text',
      data: formData,
      options: Options(
        headers: {
          'Authorization': 'Bearer $token',
          // Content-Type is auto-set by Dio for FormData (multipart/form-data).
        },
      ),
    );

    if (response.statusCode == 200) {
      final data = response.data as Map<String, dynamic>;
      return STTResult(
        text: data['text'] as String? ?? '',
        language: data['language'] as String?,
      );
    }

    throw Exception(
      'STT failed: ${response.statusCode} — ${response.data}',
    );
  }
}
