import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/lesson_plan/data/lesson_plan_repository.dart';
import 'package:sahayakai_mobile/src/features/lesson_plan/domain/lesson_plan_models.dart';
import 'package:sahayakai_mobile/src/features/lesson_plan/presentation/providers/lesson_plan_provider.dart';
import '../helpers/mocks.dart';

class FakeLessonPlanInput extends Fake implements LessonPlanInput {}

void main() {
  late MockLessonPlanRepository mockRepo;
  late ProviderContainer container;

  final testInput = LessonPlanInput(
    topic: 'Photosynthesis',
    language: 'English',
    gradeLevels: ['Grade 6'],
  );

  final testOutput = LessonPlanOutput(
    title: 'Photosynthesis Lesson',
    gradeLevel: 'Grade 6',
    duration: '45 minutes',
    subject: 'Science',
    objectives: ['Understand photosynthesis'],
    materials: ['Textbook', 'Whiteboard'],
    activities: [
      Activity(name: 'Intro', description: 'Explain concept', duration: '10m'),
    ],
    assessment: 'Written quiz',
  );

  setUpAll(() {
    registerFallbackValue(FakeLessonPlanInput());
  });

  setUp(() {
    mockRepo = MockLessonPlanRepository();
    container = ProviderContainer(
      overrides: [
        lessonPlanRepositoryProvider.overrideWithValue(mockRepo),
      ],
    );
  });

  tearDown(() => container.dispose());

  group('LessonPlanNotifier.generate', () {
    test('sets result on success', () async {
      when(() => mockRepo.generateLessonPlan(any()))
          .thenAnswer((_) async => testOutput);

      final ctrl = container.read(lessonPlanControllerProvider);
      await ctrl.generate(testInput);

      expect(container.read(lessonPlanResultProvider), isNotNull);
      expect(
          container.read(lessonPlanResultProvider)!.title, 'Photosynthesis Lesson');
      expect(container.read(lessonPlanLoadingProvider), false);
      expect(container.read(lessonPlanErrorProvider), isNull);
    });

    test('sets loading true during generation and false after', () async {
      when(() => mockRepo.generateLessonPlan(any())).thenAnswer((_) async {
        expect(container.read(lessonPlanLoadingProvider), true);
        return testOutput;
      });

      final ctrl = container.read(lessonPlanControllerProvider);
      await ctrl.generate(testInput);

      expect(container.read(lessonPlanLoadingProvider), false);
    });

    test('sets error on failure', () async {
      when(() => mockRepo.generateLessonPlan(any()))
          .thenThrow(Exception('Server error'));

      final ctrl = container.read(lessonPlanControllerProvider);
      await ctrl.generate(testInput);

      expect(container.read(lessonPlanErrorProvider), contains('Server error'));
      expect(container.read(lessonPlanLoadingProvider), false);
    });

    test('clears previous error before generating', () async {
      container.read(lessonPlanErrorProvider.notifier).state = 'old error';

      when(() => mockRepo.generateLessonPlan(any()))
          .thenAnswer((_) async {
        expect(container.read(lessonPlanErrorProvider), isNull);
        return testOutput;
      });

      final ctrl = container.read(lessonPlanControllerProvider);
      await ctrl.generate(testInput);
    });
  });

  group('lessonHistoryProvider', () {
    test('returns list from repository', () async {
      when(() => mockRepo.getAllLessonPlans())
          .thenAnswer((_) async => [testOutput]);

      final history = await container.read(lessonHistoryProvider.future);

      expect(history.length, 1);
      expect(history.first.title, 'Photosynthesis Lesson');
    });

    test('returns empty list when repository returns empty', () async {
      when(() => mockRepo.getAllLessonPlans())
          .thenAnswer((_) async => []);

      final history = await container.read(lessonHistoryProvider.future);

      expect(history, isEmpty);
    });

    test('throws when repository throws', () async {
      when(() => mockRepo.getAllLessonPlans())
          .thenThrow(Exception('DB error'));

      expect(
        () => container.read(lessonHistoryProvider.future),
        throwsA(isA<Exception>()),
      );
    });
  });
}
