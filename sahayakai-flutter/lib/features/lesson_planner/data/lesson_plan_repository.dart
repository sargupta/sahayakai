import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../../../shared/data/content_id.dart';
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
  static const String _savePath = '/api/content/save';

  Future<LessonPlan> generate(LessonPlanRequest request) {
    return _client.post<LessonPlan>(
      _path,
      // Carry the verbatim body onto the domain so a later Save persists the
      // exact `data: output` the backend flow does.
      decode: (json) =>
          LessonPlanResponseDto.fromJson(json).toDomain(raw: json),
      data: LessonPlanRequestDto.fromDomain(request).toJson(),
    );
  }

  /// Save a generated plan to the teacher's library via
  /// `POST /api/content/save`. The body mirrors the `dbAdapter.saveContent`
  /// call in `sahayakai-main/src/ai/flows/lesson-plan-generator.ts`
  /// field-for-field (`type: 'lesson-plan'`, title `output.title` falling back
  /// to `Lesson Plan: {topic}`, `gradeLevel: input.gradeLevels[0] || 'Class 5'`,
  /// `subject: output.subject || 'Science'`, `data: <the model output>`), so
  /// the Library reads it back through `mapSavedLessonPlan` unchanged. Returns
  /// the new content id the endpoint echoes as `id`. Throws `ApiException` on
  /// failure — including the 401 that is today's expected outcome, since the
  /// route reads `x-user-id` and `tokenProvider` is still the P0.2 stub.
  ///
  /// HONEST NOTE ON DOUBLE-SAVING: that same flow ALSO persists the plan
  /// server-side whenever a `userId` reaches it. Once Firebase auth lands, an
  /// explicit Save on a freshly generated plan will therefore write a SECOND
  /// library row for the same work. That is pre-existing behaviour of the
  /// worksheet and exam-paper Save actions this one follows, not something
  /// introduced here, and it is worth a de-duplication pass (server-side
  /// upsert on the client-supplied id) before the Save action is rolled out to
  /// the remaining tools.
  Future<String> save({required LessonPlan plan, LessonPlanRequest? request}) {
    final topic = request?.topic.trim() ?? '';
    final grades =
        request?.gradeLevels
            .map((g) => g.trim())
            .where((g) => g.isNotEmpty)
            .toList(growable: false) ??
        const <String>[];
    final grade = grades.isEmpty ? null : grades.first;
    final language = (request?.language ?? plan.language).trim();
    final body = <String, dynamic>{
      'id': newContentId(),
      'type': 'lesson-plan',
      'title': plan.title.isNotEmpty
          ? plan.title
          : 'Lesson Plan: ${topic.isEmpty ? 'Untitled' : topic}',
      'gradeLevel': grade ?? plan.gradeLevel ?? 'Class 5',
      'subject': plan.subject ?? request?.subject ?? 'Science',
      'topic': topic.isEmpty ? plan.title : topic,
      'language': language.isEmpty ? 'English' : language,
      'isPublic': false,
      'isDraft': false,
      // The full model output — exactly what the flow persists as `data`.
      'data': plan.raw,
    };
    return _client.post<String>(
      _savePath,
      data: body,
      decode: (json) => (json['id'] as String?)?.trim() ?? '',
    );
  }
}

@riverpod
LessonPlanRepository lessonPlanRepository(Ref ref) {
  return LessonPlanRepository(ref.watch(apiClientProvider));
}
