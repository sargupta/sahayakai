import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/core/database/database_service.dart';
import 'package:sahayakai_mobile/src/features/lesson_plan/data/lesson_plan_repository.dart';
import 'package:sahayakai_mobile/src/features/lesson_plan/domain/lesson_plan_models.dart';
import '../helpers/mocks.dart';
import '../helpers/test_utils.dart';

void main() {
  late LessonPlanRepository repo;
  late MockDio mockDio;
  late MockDatabaseService mockDbService;
  late ({MockDio dio, MockApiClient apiClient}) mocks;

  final input = LessonPlanInput(
    topic: 'Photosynthesis',
    language: 'English',
    gradeLevels: ['Grade 7'],
    resourceLevel: 'medium',
  );

  final sampleResponseData = {
    'title': 'Photosynthesis Lesson',
    'subject': 'Science',
    'gradeLevel': 'Grade 7',
    'duration': '40 minutes',
    'objectives': ['Understand photosynthesis', 'Identify parts of a leaf'],
    'materials': ['Textbook', 'Chart'],
    'activities': [
      {
        'name': 'Introduction',
        'description': 'Teacher explains the process',
        'duration': '10 min',
      },
      {
        'name': 'Activity',
        'description': 'Students draw leaf cross-section',
        'duration': '20 min',
      },
    ],
    'assessment': 'Oral quiz on key terms',
  };

  setUp(() {
    mocks = createMockApiClient();
    mockDio = mocks.dio;
    mockDbService = MockDatabaseService();
  });

  /// Build repo with db returning a never-completing Future (for success tests
  /// where _saveToLocal is unawaited — prevents unhandled async errors).
  LessonPlanRepository repoWithHangingDb() {
    // Completer that is never completed → Future hangs forever.
    final neverCompleter = Completer<Isar>();
    when(() => mockDbService.db).thenAnswer(
      (_) => neverCompleter.future,
    );
    return LessonPlanRepository(mocks.apiClient, mockDbService);
  }

  /// Build repo with db returning a Future that fails immediately
  /// (for error-path tests where _fetchLastLocalPlan needs to throw).
  LessonPlanRepository repoWithFailingDb() {
    when(() => mockDbService.db).thenAnswer(
      (_) => Future<Isar>.error(Exception('No Isar in tests')),
    );
    return LessonPlanRepository(mocks.apiClient, mockDbService);
  }

  group('LessonPlanRepository', () {
    group('generateLessonPlan — success path', () {
      test('returns LessonPlanOutput on 200 success', () async {
        repo = repoWithHangingDb();
        when(() => mockDio.post(
              '/ai/lesson-plan',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse(sampleResponseData));

        final result = await repo.generateLessonPlan(input);

        expect(result, isA<LessonPlanOutput>());
        expect(result.title, 'Photosynthesis Lesson');
        expect(result.subject, 'Science');
        expect(result.gradeLevel, 'Grade 7');
        expect(result.duration, '40 minutes');
        expect(result.objectives, hasLength(2));
        expect(result.materials, hasLength(2));
        expect(result.activities, hasLength(2));
        expect(result.activities[0].name, 'Introduction');
        expect(result.assessment, 'Oral quiz on key terms');
      });

      test('sends correct payload to API', () async {
        repo = repoWithHangingDb();
        when(() => mockDio.post(
              '/ai/lesson-plan',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse(sampleResponseData));

        await repo.generateLessonPlan(input);

        verify(() => mockDio.post(
              '/ai/lesson-plan',
              data: {
                'topic': 'Photosynthesis',
                'language': 'English',
                'gradeLevels': ['Grade 7'],
                'resourceLevel': 'medium',
                'useRuralContext': true,
                'difficultyLevel': 'standard',
              },
            )).called(1);
      });
    });

    group('generateLessonPlan — error paths', () {
      test('non-200 falls through to offline fallback which throws',
          () async {
        repo = repoWithFailingDb();
        when(() => mockDio.post(
              '/ai/lesson-plan',
              data: any(named: 'data'),
            )).thenAnswer(
            (_) async => successResponse({'error': 'fail'}, statusCode: 500));

        expect(
          () => repo.generateLessonPlan(input),
          throwsException,
        );
      });

      test('DioException triggers offline fallback path', () async {
        repo = repoWithFailingDb();
        when(() => mockDio.post(
              '/ai/lesson-plan',
              data: any(named: 'data'),
            )).thenThrow(dioError(
          type: DioExceptionType.connectionTimeout,
        ));

        expect(
          () => repo.generateLessonPlan(input),
          throwsException,
        );
      });

      test('DioException with 403 still goes to offline fallback (no rethrow)',
          () async {
        // Unlike ExamPaperRepository, LessonPlanRepository does NOT
        // special-case 403/429 — it catches ALL errors and tries local.
        repo = repoWithFailingDb();
        when(() => mockDio.post(
              '/ai/lesson-plan',
              data: any(named: 'data'),
            )).thenThrow(dioError(statusCode: 403));

        expect(
          () => repo.generateLessonPlan(input),
          throwsException,
        );
      });

      test('DioException with 429 still goes to offline fallback (no rethrow)',
          () async {
        repo = repoWithFailingDb();
        when(() => mockDio.post(
              '/ai/lesson-plan',
              data: any(named: 'data'),
            )).thenThrow(dioError(statusCode: 429));

        expect(
          () => repo.generateLessonPlan(input),
          throwsException,
        );
      });
    });

    group('getAllLessonPlans', () {
      test('throws when Isar is unavailable', () async {
        repo = repoWithFailingDb();
        expect(
          () => repo.getAllLessonPlans(),
          throwsException,
        );
      });
    });
  });
}
