import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/lesson_plan_repository.dart';
import '../domain/lesson_plan.dart';

part 'lesson_plan_controller.g.dart';

/// Drives the lesson-plan screen through `AsyncValue<LessonPlan?>`:
///   - `AsyncData(null)`  -> empty / idle (initial),
///   - `AsyncLoading`     -> long-running skeleton (server maxDuration 120 s),
///   - `AsyncError`       -> typed `ApiException` the view maps to the right UI,
///   - `AsyncData(plan)`  -> the rendered plan.
@riverpod
class LessonPlanController extends _$LessonPlanController {
  @override
  FutureOr<LessonPlan?> build() => null;

  Future<void> generate(LessonPlanRequest request) async {
    state = const AsyncValue<LessonPlan?>.loading();
    state = await AsyncValue.guard<LessonPlan?>(
      () => ref.read(lessonPlanRepositoryProvider).generate(request),
    );
  }

  /// Return to the empty/idle state (e.g. after a successful save).
  void clear() => state = const AsyncValue<LessonPlan?>.data(null);
}
