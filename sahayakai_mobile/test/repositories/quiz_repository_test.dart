import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/quiz/data/quiz_repository.dart';
import 'package:sahayakai_mobile/src/features/quiz/domain/quiz_models.dart';
import '../helpers/mocks.dart';

void main() {
  late QuizRepository repo;
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    repo = QuizRepository(mocks.apiClient);
  });

  group('QuizRepository', () {
    group('generateQuiz', () {
      final config = QuizConfig(
        topic: 'Photosynthesis',
        numQuestions: 3,
        gradeLevel: 'Class 7',
        language: 'English',
        questionTypes: ['multiple_choice'],
        bloomsLevels: ['Remember', 'Understand'],
      );

      test('returns Quiz on 200', () async {
        when(() => mockDio.post(
              '/ai/quiz',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({
              'title': 'Photosynthesis Quiz',
              'questions': [
                {
                  'question': 'What is photosynthesis?',
                  'type': 'multiple_choice',
                  'options': ['A', 'B', 'C', 'D'],
                  'answer': 'A',
                  'explanation': 'Because...',
                },
                {
                  'question': 'Where does it occur?',
                  'type': 'multiple_choice',
                  'options': ['X', 'Y'],
                  'answer': 'X',
                  'explanation': 'In leaves.',
                },
              ],
            }));

        final quiz = await repo.generateQuiz(config);

        expect(quiz, isA<Quiz>());
        expect(quiz.title, 'Photosynthesis Quiz');
        expect(quiz.questions.length, 2);
        expect(quiz.questions[0].text, 'What is photosynthesis?');
        expect(quiz.questions[0].correctAnswer, 'A');
      });

      test('sends correct config payload', () async {
        when(() => mockDio.post(
              '/ai/quiz',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({
              'title': 'Q',
              'questions': [],
            }));

        await repo.generateQuiz(config);

        verify(() => mockDio.post(
              '/ai/quiz',
              data: {
                'topic': 'Photosynthesis',
                'numQuestions': 3,
                'gradeLevel': 'Class 7',
                'language': 'English',
                'questionTypes': ['multiple_choice'],
                'bloomsTaxonomyLevels': ['Remember', 'Understand'],
              },
            )).called(1);
      });

      test('throws on non-200 status', () async {
        when(() => mockDio.post(
              '/ai/quiz',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse(
              {'error': 'fail'},
              statusCode: 500,
            ));

        expect(
          () => repo.generateQuiz(config),
          throwsException,
        );
      });

      test('throws on DioException', () async {
        when(() => mockDio.post(
              '/ai/quiz',
              data: any(named: 'data'),
            )).thenThrow(dioError());

        expect(
          () => repo.generateQuiz(config),
          throwsA(isA<DioException>()),
        );
      });
    });
  });
}
