import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../domain/lesson_plan.dart';
import 'lesson_plan_dtos.dart';

part 'lesson_plan_repository.g.dart';

/// Data-layer gateway for the flagship lesson-plan tool. Presentation talks to
/// the controller, the controller to this repository, and only this repository
/// touches [ApiClient]. Errors surface as the typed `ApiException` the client
/// already maps from Dio.
class LessonPlanRepository {
  const LessonPlanRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/ai/lesson-plan';

  Future<LessonPlan> generate(LessonPlanRequest request) {
    return _client.post<LessonPlan>(
      _path,
      data: LessonPlanRequestDto.fromDomain(request).toJson(),
      decode: (json) => LessonPlanResponseDto.fromJson(json).toDomain(),
    );
  }
}

@riverpod
LessonPlanRepository lessonPlanRepository(Ref ref) {
  return LessonPlanRepository(ref.watch(apiClientProvider));
}
