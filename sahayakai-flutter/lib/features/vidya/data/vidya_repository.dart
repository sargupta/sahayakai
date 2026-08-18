import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import 'dto/assistant_request.dart';
import 'dto/assistant_response.dart';

part 'vidya_repository.g.dart';

/// VIDYA brain gateway — `POST /api/assistant`. Sends the conversation/session
/// state and returns a [VidyaTurn] whose directives are already guarded against
/// the closed flow enum (unknown flows dropped, SPEC §A.3). Errors surface as
/// the typed `ApiException` (401 on the stub token, 400 `MESSAGE_TOO_LONG`,
/// 500). Auth 401 is expected until real Firebase auth is wired.
class VidyaRepository {
  const VidyaRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/assistant';

  Future<VidyaTurn> ask(AssistantRequest request) {
    return _client.post<VidyaTurn>(
      _path,
      data: request.toJson(),
      decode: (json) => AssistantResponseDto.fromJson(json).toDomain(),
    );
  }
}

@riverpod
VidyaRepository vidyaRepository(Ref ref) =>
    VidyaRepository(ref.watch(apiClientProvider));
