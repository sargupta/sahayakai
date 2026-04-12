import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/worksheet/data/worksheet_repository.dart';
import '../helpers/mocks.dart';

void main() {
  late WorksheetRepository repo;
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    repo = WorksheetRepository(mocks.apiClient);
  });

  group('WorksheetRepository', () {
    group('generate', () {
      test('returns WorksheetOutput on 200 with all params', () async {
        when(() => mockDio.post(
              '/ai/worksheet',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({
              'title': 'Fractions Worksheet',
              'gradeLevel': 'Class 5',
              'subject': 'Math',
              'learningObjectives': ['Understand fractions', 'Add fractions'],
              'studentInstructions': 'Solve all problems.',
              'activities': [
                {
                  'type': 'fill-in-the-blank',
                  'content': '1/2 + 1/4 = ___',
                  'explanation': 'Find common denominator.',
                  'chalkboardNote': 'LCD = 4',
                },
                {
                  'type': 'word-problem',
                  'content': 'Ram has 3/4 of a cake...',
                  'explanation': 'Subtract fractions.',
                },
              ],
              'answerKey': [
                {'activityIndex': 0, 'answer': '3/4'},
                {'activityIndex': 1, 'answer': '1/4'},
              ],
              'worksheetContent': '# Fractions Worksheet\n...',
            }));

        final result = await repo.generate(
          prompt: 'Create a fractions worksheet',
          imageDataUri: 'data:image/png;base64,abc',
          gradeLevel: 'Class 5',
          language: 'English',
          subject: 'Math',
        );

        expect(result, isA<WorksheetOutput>());
        expect(result.title, 'Fractions Worksheet');
        expect(result.gradeLevel, 'Class 5');
        expect(result.subject, 'Math');
        expect(result.learningObjectives, hasLength(2));
        expect(result.studentInstructions, 'Solve all problems.');
        expect(result.activities.length, 2);
        expect(result.activities[0].type, 'fill-in-the-blank');
        expect(result.activities[0].chalkboardNote, 'LCD = 4');
        expect(result.activities[1].chalkboardNote, isNull);
        expect(result.answerKey.length, 2);
        expect(result.answerKey[0].activityIndex, 0);
        expect(result.answerKey[0].answer, '3/4');
        expect(result.worksheetContent, contains('Fractions'));
      });

      test('sends only required param with empty imageDataUri default', () async {
        when(() => mockDio.post(
              '/ai/worksheet',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({
              'title': '',
              'gradeLevel': '',
              'subject': '',
              'learningObjectives': [],
              'studentInstructions': '',
              'activities': [],
              'answerKey': [],
              'worksheetContent': '',
            }));

        await repo.generate(prompt: 'Make a worksheet');

        verify(() => mockDio.post(
              '/ai/worksheet',
              data: {
                'prompt': 'Make a worksheet',
                'imageDataUri': '',
              },
            )).called(1);
      });

      test('sends all optional params when provided', () async {
        when(() => mockDio.post(
              '/ai/worksheet',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({
              'title': 'W',
              'worksheetContent': '',
            }));

        await repo.generate(
          prompt: 'test',
          imageDataUri: 'data:image/png;base64,xyz',
          gradeLevel: 'Class 8',
          language: 'Hindi',
          subject: 'Science',
        );

        verify(() => mockDio.post(
              '/ai/worksheet',
              data: {
                'prompt': 'test',
                'imageDataUri': 'data:image/png;base64,xyz',
                'gradeLevel': 'Class 8',
                'language': 'Hindi',
                'subject': 'Science',
              },
            )).called(1);
      });

      test('handles missing fields gracefully via fromJson defaults', () async {
        when(() => mockDio.post(
              '/ai/worksheet',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse(<String, dynamic>{}));

        final result = await repo.generate(prompt: 'test');

        expect(result.title, '');
        expect(result.activities, isEmpty);
        expect(result.answerKey, isEmpty);
        expect(result.learningObjectives, isEmpty);
      });

      test('throws on non-200 status', () async {
        when(() => mockDio.post(
              '/ai/worksheet',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse(
              {'error': 'fail'},
              statusCode: 500,
            ));

        expect(
          () => repo.generate(prompt: 'test'),
          throwsException,
        );
      });

      test('throws on DioException', () async {
        when(() => mockDio.post(
              '/ai/worksheet',
              data: any(named: 'data'),
            )).thenThrow(dioError());

        expect(
          () => repo.generate(prompt: 'test'),
          throwsA(isA<DioException>()),
        );
      });
    });
  });
}
