import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/quiz/data/quiz_repository.dart';
import 'package:sahayakai_mobile/src/features/quiz/domain/quiz_models.dart';
import 'package:sahayakai_mobile/src/features/quiz/presentation/providers/quiz_provider.dart';
import '../helpers/mocks.dart';

class FakeQuizConfig extends Fake implements QuizConfig {}

void main() {
  late MockQuizRepository mockRepo;
  late ProviderContainer container;

  final testConfig = QuizConfig(
    topic: 'Fractions',
    numQuestions: 5,
    gradeLevel: '5th Grade',
  );

  final testQuiz = Quiz(
    title: 'Fractions Quiz',
    questions: [
      Question(
        text: 'What is 1/2 + 1/4?',
        type: 'multiple_choice',
        options: ['3/4', '1/3', '2/6', '1/2'],
        correctAnswer: '3/4',
        explanation: 'Common denominator is 4.',
      ),
    ],
  );

  setUpAll(() {
    registerFallbackValue(FakeQuizConfig());
  });

  setUp(() {
    mockRepo = MockQuizRepository();
    container = ProviderContainer(
      overrides: [
        quizRepositoryProvider.overrideWithValue(mockRepo),
      ],
    );
  });

  tearDown(() => container.dispose());

  group('QuizNotifier.createQuiz', () {
    test('sets result on success', () async {
      when(() => mockRepo.generateQuiz(any()))
          .thenAnswer((_) async => testQuiz);

      final ctrl = container.read(quizControllerProvider);
      await ctrl.createQuiz(testConfig);

      expect(container.read(quizResultProvider), isNotNull);
      expect(container.read(quizResultProvider)!.title, 'Fractions Quiz');
      expect(container.read(quizResultProvider)!.questions.length, 1);
      expect(container.read(quizLoadingProvider), false);
      expect(container.read(quizErrorProvider), isNull);
    });

    test('sets loading true during quiz creation and false after', () async {
      when(() => mockRepo.generateQuiz(any())).thenAnswer((_) async {
        expect(container.read(quizLoadingProvider), true);
        return testQuiz;
      });

      final ctrl = container.read(quizControllerProvider);
      await ctrl.createQuiz(testConfig);

      expect(container.read(quizLoadingProvider), false);
    });

    test('clears previous result and error before creating', () async {
      container.read(quizResultProvider.notifier).state = testQuiz;
      container.read(quizErrorProvider.notifier).state = 'old error';

      when(() => mockRepo.generateQuiz(any())).thenAnswer((_) async {
        expect(container.read(quizResultProvider), isNull);
        expect(container.read(quizErrorProvider), isNull);
        return testQuiz;
      });

      final ctrl = container.read(quizControllerProvider);
      await ctrl.createQuiz(testConfig);
    });

    test('sets error on failure', () async {
      when(() => mockRepo.generateQuiz(any()))
          .thenThrow(Exception('Quiz generation failed'));

      final ctrl = container.read(quizControllerProvider);
      await ctrl.createQuiz(testConfig);

      expect(
          container.read(quizErrorProvider), contains('Quiz generation failed'));
      expect(container.read(quizResultProvider), isNull);
      expect(container.read(quizLoadingProvider), false);
    });

    test('sets loading false even on error (finally block)', () async {
      when(() => mockRepo.generateQuiz(any()))
          .thenThrow(Exception('fail'));

      final ctrl = container.read(quizControllerProvider);
      await ctrl.createQuiz(testConfig);

      expect(container.read(quizLoadingProvider), false);
    });
  });
}
