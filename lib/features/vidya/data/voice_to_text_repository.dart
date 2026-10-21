import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../../../shared/voice/audio_recorder_service.dart';
import 'dto/transcript.dart';

part 'voice_to_text_repository.g.dart';

/// STT gateway — `POST /api/ai/voice-to-text` (multipart). Uploads the recorded
/// WAV bytes as the `audio` field with the filename + `audio/wav` content type
/// the route keys the Sarvam Saaras v3 Indic fast path on (see
/// `Recording.upload*`). Errors surface as the typed `ApiException` (401 on the
/// stub token, 413 over 10 MB, 400 no audio, 500 INTERNAL_ERROR).
class VoiceToTextRepository {
  const VoiceToTextRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/ai/voice-to-text';

  /// [audioBytes] is the WAV read from the recording (bytes, not a path, so no
  /// filesystem is touched in a unit test). [expectedLanguage] is the app's
  /// 2-letter locale — it biases detection and fires the script-mismatch retry.
  Future<Transcript> transcribe({
    required Uint8List audioBytes,
    String? expectedLanguage,
  }) {
    final form = FormData();
    form.files.add(
      MapEntry(
        'audio',
        MultipartFile.fromBytes(
          audioBytes,
          filename: Recording.uploadFilename,
          contentType: DioMediaType.parse(Recording.uploadContentType),
        ),
      ),
    );
    final lang = expectedLanguage?.trim();
    if (lang != null && lang.isNotEmpty) {
      form.fields.add(MapEntry('expectedLanguage', lang));
    }
    return _client.postMultipart<Transcript>(
      _path,
      data: form,
      decode: Transcript.fromJson,
    );
  }
}

@riverpod
VoiceToTextRepository voiceToTextRepository(Ref ref) =>
    VoiceToTextRepository(ref.watch(apiClientProvider));
