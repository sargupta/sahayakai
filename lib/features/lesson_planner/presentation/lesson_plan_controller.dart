import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
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
  /// Held for the lifetime of an in-flight generation and the plan it produces.
  ///
  /// The provider is `AutoDispose` and the route is a plain GoRoute with no pop
  /// guard, so without this pin the notifier is torn down the instant the
  /// teacher tabs away — and the ~120 s generation's result is written to a
  /// disposed notifier and silently lost. Pinning on [generate] keeps the
  /// notifier (and the running future) alive across the navigation gap, so the
  /// plan is still on screen when the teacher returns. Released on [clear] (e.g.
  /// after a save), allowing the provider to dispose normally again.
  KeepAliveLink? _link;

  @override
  FutureOr<LessonPlan?> build() => null;

  Future<void> generate(LessonPlanRequest request) async {
    // Pin BEFORE the async gap. Re-pinning closes any prior link first so a
    // second generation never leaks a second link.
    _link?.close();
    _link = ref.keepAlive();
    state = const AsyncValue<LessonPlan?>.loading();
    state = await AsyncValue.guard<LessonPlan?>(
      () => ref.read(lessonPlanRepositoryProvider).generate(request),
    );
  }

  /// Return to the empty/idle state (e.g. after a successful save) and release
  /// the keep-alive so the provider can dispose once nothing is watching.
  void clear() {
    _link?.close();
    _link = null;
    state = const AsyncValue<LessonPlan?>.data(null);
  }
}
