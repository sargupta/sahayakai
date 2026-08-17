import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/lesson_planner/data/lesson_plan_repository.dart';
import 'package:sahayakai/features/lesson_planner/domain/lesson_plan.dart';
import 'package:sahayakai/features/lesson_planner/presentation/lesson_plan_controller.dart';

import '../../support/fake_api_client.dart';

/// Controller-layer gate for the flagship Lesson Plan tool.
///
/// The provider is `AutoDispose` and its route has no pop guard, so a teacher
/// who tabs away during the ~120 s generation used to lose the result: the
/// notifier was torn down the instant its last listener dropped, and the late
/// result had nowhere to land. [LessonPlanController.generate] now pins the
/// provider with `ref.keepAlive()` for the lifetime of the plan; [clear]
/// releases it. These tests drive that exact scenario with a repository double
/// so nothing touches the network.
class _FakeLessonPlanRepository extends LessonPlanRepository {
  _FakeLessonPlanRepository(this._future) : super(FakeApiClient());

  final Future<LessonPlan> _future;

  @override
  Future<LessonPlan> generate(LessonPlanRequest request) => _future;
}

void main() {
  const request = LessonPlanRequest(
    topic: 'Photosynthesis',
    language: 'English',
  );
  const plan = LessonPlan(title: 'Photosynthesis', language: 'English');

  ProviderContainer containerWith(Future<LessonPlan> result) {
    final container = ProviderContainer(
      overrides: [
        lessonPlanRepositoryProvider.overrideWithValue(
          _FakeLessonPlanRepository(result),
        ),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  test(
    'a generated plan survives the screen disposing and being re-read',
    () async {
      final container = containerWith(Future<LessonPlan>.value(plan));

      // The screen subscribes while it is on-route.
      final sub = container.listen(lessonPlanControllerProvider, (_, _) {});

      await container
          .read(lessonPlanControllerProvider.notifier)
          .generate(request);
      expect(
        container.read(lessonPlanControllerProvider).value?.title,
        'Photosynthesis',
      );

      // The teacher tabs away: the only subscription is removed. Give AutoDispose
      // a full event-loop turn to run — without the keepAlive pin held through
      // generate(), the notifier (and its result) would be torn down here.
      sub.close();
      await Future<void>.delayed(const Duration(milliseconds: 10));

      // On return the plan is still there.
      expect(
        container.read(lessonPlanControllerProvider).value?.title,
        'Photosynthesis',
        reason: 'keepAlive kept the generated plan across the dispose gap',
      );
    },
  );

  test(
    'an in-flight generation is not discarded when the screen leaves',
    () async {
      final completer = Completer<LessonPlan>();
      final container = containerWith(completer.future);

      final sub = container.listen(lessonPlanControllerProvider, (_, _) {});

      // Start the long generation; it is still loading.
      final generating = container
          .read(lessonPlanControllerProvider.notifier)
          .generate(request);
      expect(container.read(lessonPlanControllerProvider).isLoading, isTrue);

      // Teacher navigates away mid-generation; let AutoDispose try to run.
      sub.close();
      await Future<void>.delayed(const Duration(milliseconds: 10));

      // The server answers after the teacher has left. Without keepAlive the
      // notifier is gone and writing the result would throw; with it, the result
      // lands cleanly.
      completer.complete(plan);
      await generating;

      expect(
        container.read(lessonPlanControllerProvider).value?.title,
        'Photosynthesis',
      );
    },
  );

  test(
    'clear() releases the keepAlive so the provider disposes again',
    () async {
      final container = containerWith(Future<LessonPlan>.value(plan));

      final sub = container.listen(lessonPlanControllerProvider, (_, _) {});
      await container
          .read(lessonPlanControllerProvider.notifier)
          .generate(request);
      // As after a save: reset to idle and drop the pin.
      container.read(lessonPlanControllerProvider.notifier).clear();
      sub.close();
      await Future<void>.delayed(const Duration(milliseconds: 10));

      // Re-reading returns the idle state, not a stale plan.
      expect(container.read(lessonPlanControllerProvider).value, isNull);
    },
  );
}
