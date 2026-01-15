import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/lesson_plan_repository.dart';
import '../../domain/lesson_plan_models.dart';

// State to hold the result
final lessonPlanResultProvider = StateProvider<LessonPlanOutput?>((ref) => null);

// State to hold loading status
final lessonPlanLoadingProvider = StateProvider<bool>((ref) => false);

// State to hold errors
final lessonPlanErrorProvider = StateProvider<String?>((ref) => null);

final lessonHistoryProvider = FutureProvider<List<LessonPlanOutput>>((ref) async {
  final repo = ref.read(lessonPlanRepositoryProvider);
  return repo.getAllLessonPlans();
});

class LessonPlanNotifier {
  final Ref ref;

  LessonPlanNotifier(this.ref);

  Future<void> generate(LessonPlanInput input) async {
    ref.read(lessonPlanLoadingProvider.notifier).state = true;
    ref.read(lessonPlanErrorProvider.notifier).state = null;

    try {
      final repository = ref.read(lessonPlanRepositoryProvider);
      final result = await repository.generateLessonPlan(input);
      ref.read(lessonPlanResultProvider.notifier).state = result;
    } catch (e) {
      ref.read(lessonPlanErrorProvider.notifier).state = e.toString();
    } finally {
      ref.read(lessonPlanLoadingProvider.notifier).state = false;
    }
  }
}

final lessonPlanControllerProvider = Provider((ref) => LessonPlanNotifier(ref));
