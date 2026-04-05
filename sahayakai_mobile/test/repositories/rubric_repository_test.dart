import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/rubric/data/rubric_repository.dart';
import '../helpers/mocks.dart';

void main() {
  late RubricRepository repo;
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    repo = RubricRepository(mocks.apiClient);
  });

  group('RubricRepository', () {
    group('generate', () {
      const fullResponse = {
        'title': 'Math Problem-Solving Rubric',
        'description': 'Evaluates problem-solving skills',
        'criteria': [
          {
            'name': 'Understanding',
            'description': 'Shows understanding of the problem',
            'levels': [
              {'name': 'Excellent', 'description': 'Full understanding', 'points': 4},
              {'name': 'Good', 'description': 'Partial understanding', 'points': 3},
            ],
          },
          {
            'name': 'Accuracy',
            'description': 'Correct computation',
            'levels': [
              {'name': 'Perfect', 'description': 'No errors', 'points': 5},
            ],
          },
        ],
        'gradeLevel': 'Class 8',
        'subject': 'Mathematics',
      };

      test('returns RubricOutput on success with all fields', () async {
        when(() => mockDio.post('/ai/rubric', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse(fullResponse));

        final result = await repo.generate(
          assignmentDescription: 'Solve quadratic equations',
          gradeLevel: 'Class 8',
          language: 'en',
          subject: 'Mathematics',
        );

        expect(result.title, 'Math Problem-Solving Rubric');
        expect(result.description, 'Evaluates problem-solving skills');
        expect(result.criteria.length, 2);
        expect(result.criteria[0].name, 'Understanding');
        expect(result.criteria[0].levels.length, 2);
        expect(result.criteria[0].levels[0].points, 4);
        expect(result.criteria[1].name, 'Accuracy');
        expect(result.gradeLevel, 'Class 8');
        expect(result.subject, 'Mathematics');
      });

      test('sends only required field when optionals are absent', () async {
        when(() => mockDio.post('/ai/rubric', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse(fullResponse));

        await repo.generate(assignmentDescription: 'Write an essay');

        verify(() => mockDio.post('/ai/rubric', data: {
              'assignmentDescription': 'Write an essay',
            })).called(1);
      });

      test('sends all optional fields when present', () async {
        when(() => mockDio.post('/ai/rubric', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse(fullResponse));

        await repo.generate(
          assignmentDescription: 'Essay',
          gradeLevel: 'Class 10',
          language: 'hi',
          subject: 'Hindi',
        );

        verify(() => mockDio.post('/ai/rubric', data: {
              'assignmentDescription': 'Essay',
              'gradeLevel': 'Class 10',
              'language': 'hi',
              'subject': 'Hindi',
            })).called(1);
      });

      test('handles response with empty criteria list', () async {
        when(() => mockDio.post('/ai/rubric', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse({
                  'title': 'Empty',
                  'description': 'No criteria',
                  'criteria': [],
                }));

        final result =
            await repo.generate(assignmentDescription: 'test');

        expect(result.criteria, isEmpty);
        expect(result.gradeLevel, isNull);
        expect(result.subject, isNull);
      });

      test('handles null fields with defaults', () async {
        when(() => mockDio.post('/ai/rubric', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse(<String, dynamic>{}));

        final result =
            await repo.generate(assignmentDescription: 'test');

        expect(result.title, '');
        expect(result.description, '');
        expect(result.criteria, isEmpty);
      });

      test('throws on non-200 status code', () async {
        when(() => mockDio.post('/ai/rubric', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse(null, statusCode: 500));

        expect(
          () => repo.generate(assignmentDescription: 'test'),
          throwsException,
        );
      });

      test('throws on DioException', () async {
        when(() => mockDio.post('/ai/rubric', data: any(named: 'data')))
            .thenThrow(dioError(statusCode: 429));

        expect(
          () => repo.generate(assignmentDescription: 'test'),
          throwsA(isA<Exception>()),
        );
      });
    });
  });
}
