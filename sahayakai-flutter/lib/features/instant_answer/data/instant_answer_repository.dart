import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../domain/instant_answer.dart';
import 'instant_answer_dtos.dart';

part 'instant_answer_repository.g.dart';

/// Data-layer gateway for the Instant Answer tool. Presentation talks to the
/// controller, the controller to this repository, and only this repository
/// touches [ApiClient]. Errors surface as the typed `ApiException` the client
/// already maps from Dio.
class InstantAnswerRepository {
  const InstantAnswerRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/ai/instant-answer';

  Future<InstantAnswer> ask(InstantAnswerRequest request) {
    return _client.post<InstantAnswer>(
      _path,
      data: InstantAnswerRequestDto.fromDomain(request).toJson(),
      decode: (json) => InstantAnswerResponseDto.fromJson(json).toDomain(),
    );
  }
}

@riverpod
InstantAnswerRepository instantAnswerRepository(Ref ref) {
  return InstantAnswerRepository(ref.watch(apiClientProvider));
}
