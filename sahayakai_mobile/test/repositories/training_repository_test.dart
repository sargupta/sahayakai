import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/training/data/training_repository.dart';
import '../helpers/mocks.dart';

void main() {
  late TrainingRepository repo;
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    repo = TrainingRepository(mocks.apiClient);
  });

  group('TrainingRepository', () {
    group('generate', () {
      test('returns TrainingOutput on 200 with all params', () async {
        when(() => mockDio.post(
              '/ai/teacher-training',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({
              'introduction': 'Welcome to the training module.',
              'advice': [
                {
                  'strategy': 'Think-Pair-Share',
                  'pedagogy': 'Collaborative Learning',
                  'explanation': 'Students discuss in pairs before sharing.',
                },
                {
                  'strategy': 'Exit Tickets',
                  'pedagogy': 'Formative Assessment',
                  'explanation': 'Quick check at the end of class.',
                },
              ],
              'conclusion': 'Keep experimenting with these strategies.',
              'gradeLevel': 'Class 5',
              'subject': 'Math',
            }));

        final result = await repo.generate(
          question: 'How to engage students?',
          language: 'English',
          subject: 'Math',
        );

        expect(result, isA<TrainingOutput>());
        expect(result.introduction, 'Welcome to the training module.');
        expect(result.advice.length, 2);
        expect(result.advice[0].strategy, 'Think-Pair-Share');
        expect(result.advice[0].pedagogy, 'Collaborative Learning');
        expect(result.advice[1].explanation, 'Quick check at the end of class.');
        expect(result.conclusion, 'Keep experimenting with these strategies.');
        expect(result.gradeLevel, 'Class 5');
        expect(result.subject, 'Math');
      });

      test('sends only required param when optionals absent', () async {
        when(() => mockDio.post(
              '/ai/teacher-training',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({
              'introduction': '',
              'advice': [],
              'conclusion': '',
            }));

        await repo.generate(question: 'How to teach fractions?');

        verify(() => mockDio.post(
              '/ai/teacher-training',
              data: {
                'question': 'How to teach fractions?',
              },
            )).called(1);
      });

      test('sends all params when optionals provided', () async {
        when(() => mockDio.post(
              '/ai/teacher-training',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({
              'introduction': '',
              'advice': [],
              'conclusion': '',
            }));

        await repo.generate(
          question: 'Classroom management tips',
          language: 'Hindi',
          subject: 'Science',
        );

        verify(() => mockDio.post(
              '/ai/teacher-training',
              data: {
                'question': 'Classroom management tips',
                'language': 'Hindi',
                'subject': 'Science',
              },
            )).called(1);
      });

      test('handles empty advice list', () async {
        when(() => mockDio.post(
              '/ai/teacher-training',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({
              'introduction': 'Intro',
              'conclusion': 'Done',
            }));

        final result = await repo.generate(question: 'test');

        expect(result.advice, isEmpty);
        expect(result.gradeLevel, isNull);
        expect(result.subject, isNull);
      });

      test('throws on non-200 status', () async {
        when(() => mockDio.post(
              '/ai/teacher-training',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse(
              {'error': 'fail'},
              statusCode: 500,
            ));

        expect(
          () => repo.generate(question: 'test'),
          throwsException,
        );
      });

      test('throws on DioException', () async {
        when(() => mockDio.post(
              '/ai/teacher-training',
              data: any(named: 'data'),
            )).thenThrow(dioError());

        expect(
          () => repo.generate(question: 'test'),
          throwsA(isA<DioException>()),
        );
      });
    });
  });
}
