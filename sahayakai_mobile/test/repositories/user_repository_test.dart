import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/user/data/user_repository.dart';
import '../helpers/mocks.dart';

void main() {
  late UserRepository repo;
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    repo = UserRepository(mocks.apiClient);
  });

  group('UserRepository', () {
    // ── updateProfile ──────────────────────────────────────────────────────

    group('updateProfile', () {
      test('succeeds on 200 with all fields', () async {
        when(() => mockDio.patch('/user/profile', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse({'ok': true}));

        await repo.updateProfile(
          yearsOfExperience: 10,
          administrativeRole: 'Head Teacher',
          qualifications: ['B.Ed', 'M.Ed'],
        );

        verify(() => mockDio.patch('/user/profile', data: {
              'yearsOfExperience': 10,
              'administrativeRole': 'Head Teacher',
              'qualifications': ['B.Ed', 'M.Ed'],
            })).called(1);
      });

      test('sends only provided optional fields', () async {
        when(() => mockDio.patch('/user/profile', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse({'ok': true}));

        await repo.updateProfile(yearsOfExperience: 5);

        verify(() => mockDio.patch('/user/profile', data: {
              'yearsOfExperience': 5,
            })).called(1);
      });

      test('sends empty map when no fields provided', () async {
        when(() => mockDio.patch('/user/profile', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse({'ok': true}));

        await repo.updateProfile();

        verify(() => mockDio.patch('/user/profile', data: <String, dynamic>{}))
            .called(1);
      });

      test('throws on non-200 status code', () async {
        when(() => mockDio.patch('/user/profile', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse(null, statusCode: 400));

        expect(() => repo.updateProfile(yearsOfExperience: -1),
            throwsException);
      });

      test('throws on DioException', () async {
        when(() => mockDio.patch('/user/profile', data: any(named: 'data')))
            .thenThrow(dioError(statusCode: 500));

        expect(() => repo.updateProfile(), throwsA(isA<DioException>()));
      });
    });

    // ── getConsent ─────────────────────────────────────────────────────────

    group('getConsent', () {
      test('returns consent preferences on success', () async {
        when(() => mockDio.get('/user/consent'))
            .thenAnswer((_) async => successResponse({
                  'analytics': true,
                  'community': true,
                  'trainingData': false,
                }));

        final result = await repo.getConsent();

        expect(result.analytics, true);
        expect(result.community, true);
        expect(result.trainingData, false);
      });

      test('handles null fields with defaults (all false)', () async {
        when(() => mockDio.get('/user/consent'))
            .thenAnswer((_) async => successResponse(<String, dynamic>{}));

        final result = await repo.getConsent();

        expect(result.analytics, false);
        expect(result.community, false);
        expect(result.trainingData, false);
      });

      test('throws on non-200 status code', () async {
        when(() => mockDio.get('/user/consent'))
            .thenAnswer((_) async => successResponse(null, statusCode: 401));

        expect(() => repo.getConsent(), throwsException);
      });

      test('throws on DioException', () async {
        when(() => mockDio.get('/user/consent'))
            .thenThrow(dioError(statusCode: 500));

        expect(() => repo.getConsent(), throwsA(isA<DioException>()));
      });
    });

    // ── updateConsent ──────────────────────────────────────────────────────

    group('updateConsent', () {
      test('succeeds on 200', () async {
        when(() => mockDio.post('/user/consent', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse({'ok': true}));

        const prefs = ConsentPreferences(
          analytics: true,
          community: false,
          trainingData: true,
        );
        await repo.updateConsent(prefs);

        verify(() => mockDio.post('/user/consent', data: {
              'analytics': true,
              'community': false,
              'trainingData': true,
            })).called(1);
      });

      test('sends default values when using default constructor', () async {
        when(() => mockDio.post('/user/consent', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse({'ok': true}));

        await repo.updateConsent(const ConsentPreferences());

        verify(() => mockDio.post('/user/consent', data: {
              'analytics': false,
              'community': false,
              'trainingData': false,
            })).called(1);
      });

      test('throws on non-200 status code', () async {
        when(() => mockDio.post('/user/consent', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse(null, statusCode: 500));

        expect(
          () => repo.updateConsent(const ConsentPreferences()),
          throwsException,
        );
      });

      test('throws on DioException', () async {
        when(() => mockDio.post('/user/consent', data: any(named: 'data')))
            .thenThrow(dioError(statusCode: 500));

        expect(
          () => repo.updateConsent(const ConsentPreferences()),
          throwsA(isA<DioException>()),
        );
      });
    });

    // ── deleteAccount ──────────────────────────────────────────────────────

    group('deleteAccount', () {
      test('succeeds on 200', () async {
        when(() => mockDio.post('/user/delete-account'))
            .thenAnswer((_) async => successResponse({'ok': true}));

        await repo.deleteAccount();

        verify(() => mockDio.post('/user/delete-account')).called(1);
      });

      test('throws on non-200 status code', () async {
        when(() => mockDio.post('/user/delete-account'))
            .thenAnswer((_) async => successResponse(null, statusCode: 403));

        expect(() => repo.deleteAccount(), throwsException);
      });

      test('throws on DioException', () async {
        when(() => mockDio.post('/user/delete-account'))
            .thenThrow(dioError(statusCode: 500));

        expect(() => repo.deleteAccount(), throwsA(isA<DioException>()));
      });
    });
  });
}
