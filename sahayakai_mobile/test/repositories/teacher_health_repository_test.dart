import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/impact/data/teacher_health_repository.dart';
import '../helpers/mocks.dart';

void main() {
  late TeacherHealthRepository repo;
  late MockDio mockDio;

  setUp(() {
    mockDio = createMockDio();
    repo = TeacherHealthRepository(dio: mockDio);
  });

  group('TeacherHealthRepository', () {
    group('getHealthScore', () {
      test('returns health score with all fields', () async {
        when(() => mockDio.get('/analytics/teacher-health/user-123'))
            .thenAnswer((_) async => successResponse({
                  'healthScore': 85.5,
                  'breakdown': {
                    'activity': 90,
                    'contentCreation': 80,
                    'engagement': 86,
                  },
                  'tier': 'active',
                }));

        final result = await repo.getHealthScore('user-123');

        expect(result.healthScore, 85.5);
        expect(result.breakdown, isNotNull);
        expect(result.breakdown!['activity'], 90);
        expect(result.tier, 'active');
      });

      test('returns score with minimal fields', () async {
        when(() => mockDio.get('/analytics/teacher-health/user-456'))
            .thenAnswer((_) async => successResponse({
                  'healthScore': 20,
                }));

        final result = await repo.getHealthScore('user-456');

        expect(result.healthScore, 20.0);
        expect(result.breakdown, isNull);
        expect(result.tier, isNull);
      });

      test('handles at-risk tier', () async {
        when(() => mockDio.get('/analytics/teacher-health/user-789'))
            .thenAnswer((_) async => successResponse({
                  'healthScore': 30.0,
                  'tier': 'at-risk',
                }));

        final result = await repo.getHealthScore('user-789');

        expect(result.tier, 'at-risk');
      });

      test('handles dormant tier', () async {
        when(() => mockDio.get('/analytics/teacher-health/user-000'))
            .thenAnswer((_) async => successResponse({
                  'healthScore': 5.0,
                  'tier': 'dormant',
                }));

        final result = await repo.getHealthScore('user-000');

        expect(result.tier, 'dormant');
      });

      test('handles null fields with defaults', () async {
        when(() => mockDio.get('/analytics/teacher-health/user-x'))
            .thenAnswer((_) async => successResponse(<String, dynamic>{}));

        final result = await repo.getHealthScore('user-x');

        expect(result.healthScore, 0.0);
        expect(result.breakdown, isNull);
        expect(result.tier, isNull);
      });

      test('interpolates userId into URL path', () async {
        when(() => mockDio.get(any()))
            .thenAnswer((_) async => successResponse({
                  'healthScore': 50,
                }));

        await repo.getHealthScore('special-user-id');

        verify(() =>
            mockDio.get('/analytics/teacher-health/special-user-id')).called(1);
      });

      test('throws on non-200 status code', () async {
        when(() => mockDio.get('/analytics/teacher-health/user-x'))
            .thenAnswer((_) async => successResponse(null, statusCode: 404));

        expect(
          () => repo.getHealthScore('user-x'),
          throwsException,
        );
      });

      test('throws on DioException', () async {
        when(() => mockDio.get('/analytics/teacher-health/user-x'))
            .thenThrow(dioError(statusCode: 500));

        expect(
          () => repo.getHealthScore('user-x'),
          throwsA(isA<DioException>()),
        );
      });
    });
  });
}
