import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/core/database/database_service.dart';
import 'package:sahayakai_mobile/src/features/exam_paper/data/exam_paper_repository.dart';
import 'package:sahayakai_mobile/src/features/exam_paper/domain/exam_paper_models.dart';
import '../helpers/mocks.dart';
import '../helpers/test_utils.dart';

void main() {
  late ExamPaperRepository repo;
  late MockDio mockDio;
  late MockDatabaseService mockDbService;

  const input = ExamPaperInput(
    board: 'CBSE',
    gradeLevel: 'Class 10',
    subject: 'Mathematics',
    chapters: ['Quadratic Equations'],
    difficulty: 'mixed',
    language: 'English',
  );

  final sampleResponseData = <String, dynamic>{
    'title': 'CBSE Class 10 Mathematics',
    'board': 'CBSE',
    'subject': 'Mathematics',
    'gradeLevel': 'Class 10',
    'duration': '3 hours',
    'maxMarks': '80',
    'generalInstructions': ['All questions are compulsory'],
    'sections': [
      {
        'name': 'Section A',
        'label': 'MCQ',
        'totalMarks': 20,
        'questions': [
          {
            'text': 'Find the roots of x^2 - 5x + 6 = 0',
            'type': 'multiple_choice',
            'marks': '1',
            'options': ['2,3', '1,6', '3,4', 'None'],
            'answer': '2,3',
          },
        ],
      },
    ],
    'blueprintSummary': {
      'chapterWise': {'Quadratic Equations': 20},
      'difficultyWise': {'easy': 10, 'medium': 5, 'hard': 5},
    },
  };

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    mockDbService = MockDatabaseService();

    // _saveToLocal has its own try-catch so errors are swallowed.
    // _fetchLastLocalPaper also has try-catch and returns null on error.
    // Use Future.error so both paths fail gracefully.
    when(() => mockDbService.db).thenAnswer(
      (_) => Future<Isar>.error(Exception('No Isar in tests')),
    );

    repo = ExamPaperRepository(mocks.apiClient, mockDbService);
  });

  group('ExamPaperRepository', () {
    group('generateExamPaper', () {
      test('returns ExamPaperOutput on 200 success', () async {
        when(() => mockDio.post(
              '/ai/exam-paper',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse(sampleResponseData));

        final result = await repo.generateExamPaper(input);

        expect(result, isA<ExamPaperOutput>());
        expect(result.title, 'CBSE Class 10 Mathematics');
        expect(result.board, 'CBSE');
        expect(result.subject, 'Mathematics');
        expect(result.gradeLevel, 'Class 10');
        expect(result.duration, '3 hours');
        expect(result.maxMarks, '80');
        expect(result.generalInstructions, hasLength(1));
        expect(result.sections, hasLength(1));
        expect(result.sections[0].name, 'Section A');
        expect(result.sections[0].questions, hasLength(1));
        expect(result.blueprintSummary, isNotNull);
        expect(result.blueprintSummary!.chapterWise['Quadratic Equations'], 20);
      });

      test('sends correct payload to API', () async {
        when(() => mockDio.post(
              '/ai/exam-paper',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse(sampleResponseData));

        await repo.generateExamPaper(input);

        verify(() => mockDio.post(
              '/ai/exam-paper',
              data: {
                'board': 'CBSE',
                'gradeLevel': 'Class 10',
                'subject': 'Mathematics',
                'chapters': ['Quadratic Equations'],
                'difficulty': 'mixed',
                'language': 'English',
                'includeAnswerKey': true,
                'includeMarkingScheme': true,
              },
            )).called(1);
      });

      test('throws on non-200 status', () async {
        when(() => mockDio.post(
              '/ai/exam-paper',
              data: any(named: 'data'),
            )).thenAnswer(
            (_) async => successResponse({'error': 'fail'}, statusCode: 500));

        // Non-200 throws Exception('Server error: 500'). errMsg does NOT
        // contain '403' or '429', so it falls to offline. _fetchLastLocalPaper
        // returns null (Isar unavailable) → rethrow original exception.
        expect(
          () => repo.generateExamPaper(input),
          throwsException,
        );
      });

      test('rethrows DioException containing 403 (plan-gating)', () async {
        when(() => mockDio.post(
              '/ai/exam-paper',
              data: any(named: 'data'),
            )).thenThrow(dioError(statusCode: 403));

        expect(
          () => repo.generateExamPaper(input),
          throwsA(isA<DioException>()),
        );
      });

      test('rethrows DioException containing 429 (rate limit)', () async {
        when(() => mockDio.post(
              '/ai/exam-paper',
              data: any(named: 'data'),
            )).thenThrow(dioError(statusCode: 429));

        expect(
          () => repo.generateExamPaper(input),
          throwsA(isA<DioException>()),
        );
      });

      test('generic DioException falls to offline fallback then rethrows',
          () async {
        when(() => mockDio.post(
              '/ai/exam-paper',
              data: any(named: 'data'),
            )).thenThrow(DioException(
          requestOptions: RequestOptions(path: ''),
          type: DioExceptionType.connectionTimeout,
          message: 'Connection timeout',
        ));

        // errMsg won't contain '403' or '429', so it goes to offline.
        // _fetchLastLocalPaper returns null (Isar unavailable) → rethrow.
        expect(
          () => repo.generateExamPaper(input),
          throwsA(isA<DioException>()),
        );
      });
    });

    group('saveToLibrary', () {
      final output = ExamPaperOutput.fromJson(sampleResponseData);

      test('returns contentId on 200', () async {
        when(() => mockDio.put(
              '/ai/exam-paper',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({
              'contentId': 'abc-123',
            }));

        final contentId = await repo.saveToLibrary(output);

        expect(contentId, 'abc-123');
      });

      test('returns null on non-200', () async {
        when(() => mockDio.put(
              '/ai/exam-paper',
              data: any(named: 'data'),
            )).thenAnswer(
            (_) async => successResponse({'ok': false}, statusCode: 500));

        final contentId = await repo.saveToLibrary(output);

        expect(contentId, isNull);
      });

      test('returns null on network error', () async {
        when(() => mockDio.put(
              '/ai/exam-paper',
              data: any(named: 'data'),
            )).thenThrow(dioError(
          type: DioExceptionType.connectionTimeout,
        ));

        final contentId = await repo.saveToLibrary(output);

        expect(contentId, isNull);
      });
    });

    group('getAllLocalPapers', () {
      test('returns empty list when Isar is unavailable', () async {
        final papers = await repo.getAllLocalPapers();

        expect(papers, isEmpty);
      });
    });

    group('saveToLibrary — edge cases', () {
      final output = ExamPaperOutput.fromJson(sampleResponseData);

      test('returns null when contentId is missing from response', () async {
        when(() => mockDio.put(
              '/ai/exam-paper',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse(<String, dynamic>{}));

        final contentId = await repo.saveToLibrary(output);
        expect(contentId, isNull);
      });
    });

    group('generateExamPaper — non-403/429 error with no local', () {
      test('rethrows when error message contains no status code keywords',
          () async {
        when(() => mockDio.post(
              '/ai/exam-paper',
              data: any(named: 'data'),
            )).thenThrow(Exception('Generic network failure'));

        // Exception message does NOT contain '403' or '429',
        // so it falls to offline. _fetchLastLocalPaper returns null → rethrow.
        expect(
          () => repo.generateExamPaper(input),
          throwsException,
        );
      });
    });
  });
}
