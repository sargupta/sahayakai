import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../domain/visual_aid.dart';
import 'visual_aid_dtos.dart';

part 'visual_aid_repository.g.dart';

/// Data-layer gateway for the Visual Aid Designer tool. Presentation talks to
/// the controller, the controller to this repository, and only this repository
/// touches [ApiClient]. Errors surface as the typed `ApiException` the client
/// already maps from Dio — 401 (signed out), 403 (plan upgrade), 429 (daily /
/// monthly limit), 400 (safety violation), 422 (empty generation), 504
/// (timeout) and 5xx all arrive typed, and the error view maps each to the
/// right recovery UI.
class VisualAidRepository {
  const VisualAidRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/ai/visual-aid';

  Future<VisualAid> generate(VisualAidRequest request) {
    return _client.post<VisualAid>(
      _path,
      data: VisualAidRequestDto.fromDomain(request).toJson(),
      decode: (json) => VisualAidResponseDto.fromJson(json).toDomain(),
    );
  }
}

@riverpod
VisualAidRepository visualAidRepository(Ref ref) {
  return VisualAidRepository(ref.watch(apiClientProvider));
}
