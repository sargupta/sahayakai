import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../domain/rubric.dart';
import 'rubric_dtos.dart';

part 'rubric_repository.g.dart';

/// Data-layer gateway for the rubric tool. Presentation talks to the
/// controller, the controller to this repository, and only this repository
/// touches [ApiClient]. Errors surface as the typed `ApiException` the client
/// already maps from Dio.
class RubricRepository {
  const RubricRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/ai/rubric';

  Future<Rubric> generate(RubricRequest request) {
    return _client.post<Rubric>(
      _path,
      data: RubricRequestDto.fromDomain(request).toJson(),
      decode: (json) => RubricResponseDto.fromJson(json).toDomain(),
    );
  }
}

@riverpod
RubricRepository rubricRepository(Ref ref) {
  return RubricRepository(ref.watch(apiClientProvider));
}
