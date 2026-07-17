import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../domain/parent_message.dart';
import 'parent_message_dtos.dart';

part 'parent_message_repository.g.dart';

/// Data-layer gateway for the Parent Message tool. Presentation talks to the
/// controller, the controller to this repository, and only this repository
/// touches [ApiClient]. Errors surface as the typed `ApiException` the client
/// already maps from Dio (including the 400 the route returns for a missing
/// required field).
class ParentMessageRepository {
  const ParentMessageRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/ai/parent-message';

  Future<ParentMessage> draft(ParentMessageRequest request) {
    return _client.post<ParentMessage>(
      _path,
      data: ParentMessageRequestDto.fromDomain(request).toJson(),
      decode: (json) => ParentMessageResponseDto.fromJson(json).toDomain(),
    );
  }
}

@riverpod
ParentMessageRepository parentMessageRepository(Ref ref) {
  return ParentMessageRepository(ref.watch(apiClientProvider));
}
