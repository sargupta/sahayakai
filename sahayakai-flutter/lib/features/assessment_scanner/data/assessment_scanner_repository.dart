import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../domain/assessment_scan.dart';
import 'assessment_scanner_dtos.dart';

part 'assessment_scanner_repository.g.dart';

/// Data-layer gateway for the Assessment Scanner tool. Presentation talks to the
/// controller, the controller to this repository, and only this repository
/// touches [ApiClient]. Errors surface as the typed `ApiException` the client
/// maps from Dio — including the route's 401 (no identity), 403 (plan gate),
/// 429 (quota / daily-image budget), 422 (unreadable / empty extraction) and
/// 5xx (provider outage) — which the error view branches on.
class AssessmentScannerRepository {
  const AssessmentScannerRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/ai/assessment-scanner';

  Future<AssessmentResult> grade(AssessmentScanRequest request) {
    return _client.post<AssessmentResult>(
      _path,
      data: AssessmentScannerRequestDto.fromDomain(request).toJson(),
      decode: (json) =>
          AssessmentScannerResponseDto.fromJson(json).toDomain(),
    );
  }
}

@riverpod
AssessmentScannerRepository assessmentScannerRepository(Ref ref) {
  return AssessmentScannerRepository(ref.watch(apiClientProvider));
}
