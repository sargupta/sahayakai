import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import 'dto/tts_dtos.dart';

part 'tts_repository.g.dart';

/// TTS gateway — `POST /api/tts`. Sends `{ text, targetLang }` and returns the
/// base64 mp3 + soft-cap snapshot. [targetLang] is a **BCP-47** code
/// (`hi-IN`, `bn-IN`, …); the language mapping (STT 2-letter → BCP-47) lives in
/// the controller (U-V3), so this repo takes the resolved code. Errors surface
/// as the typed `ApiException` (401 stub token, 413 over 5000 chars, 429
/// rate-limited, 500).
class TtsRepository {
  const TtsRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/tts';

  Future<TtsResult> synthesize({required String text, String? targetLang}) {
    final lang = targetLang?.trim();
    return _client.post<TtsResult>(
      _path,
      data: {
        'text': text,
        if (lang != null && lang.isNotEmpty) 'targetLang': lang,
      },
      decode: TtsResult.fromJson,
    );
  }
}

@riverpod
TtsRepository ttsRepository(Ref ref) =>
    TtsRepository(ref.watch(apiClientProvider));
