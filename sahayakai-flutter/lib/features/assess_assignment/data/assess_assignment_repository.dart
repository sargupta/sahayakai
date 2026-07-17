import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../domain/assessment.dart';
import 'assess_assignment_dtos.dart';

part 'assess_assignment_repository.g.dart';

/// Data-layer gateway for the Assess Assignment tool. Presentation talks to the
/// controller, the controller to this repository, and only this repository
/// touches [ApiClient]. Errors surface as the typed `ApiException` the client
/// already maps from Dio (incl. the day-budget mapping documented in
/// docs/flutter/HANDOFF.md).
class AssessAssignmentRepository {
  const AssessAssignmentRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/ai/assess-assignment';

  Future<Assessment> assess(AssessAssignmentRequest request) {
    return _client.post<Assessment>(
      _path,
      data: AssessAssignmentRequestDto.fromDomain(request).toJson(),
      decode: (json) => AssessAssignmentResponseDto.fromJson(json).toDomain(),
    );
  }
}

@riverpod
AssessAssignmentRepository assessAssignmentRepository(Ref ref) {
  return AssessAssignmentRepository(ref.watch(apiClientProvider));
}
