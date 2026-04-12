import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/export/data/export_repository.dart';
import '../helpers/mocks.dart';

void main() {
  late ExportRepository repo;
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    repo = ExportRepository(mocks.apiClient);
  });

  group('ExportRepository', () {
    group('requestExport', () {
      test('returns ExportResponse with jobId for async export', () async {
        when(() => mockDio.post('/export'))
            .thenAnswer((_) async => successResponse({
                  'jobId': 'job-abc-123',
                  'status': 'pending',
                }));

        final result = await repo.requestExport();

        expect(result.jobId, 'job-abc-123');
        expect(result.status, 'pending');
        expect(result.downloadUrl, isNull);
      });

      test('returns ExportResponse with downloadUrl for inline export',
          () async {
        when(() => mockDio.post('/export'))
            .thenAnswer((_) async => successResponse({
                  'downloadUrl': 'https://storage.googleapis.com/export.zip',
                  'status': 'completed',
                }));

        final result = await repo.requestExport();

        expect(result.downloadUrl, contains('storage.googleapis.com'));
        expect(result.status, 'completed');
        expect(result.jobId, isNull);
      });

      test('handles null fields with defaults', () async {
        when(() => mockDio.post('/export'))
            .thenAnswer((_) async => successResponse(<String, dynamic>{}));

        final result = await repo.requestExport();

        expect(result.jobId, isNull);
        expect(result.downloadUrl, isNull);
        expect(result.status, 'pending');
      });

      test('throws on non-200 status code', () async {
        when(() => mockDio.post('/export'))
            .thenAnswer((_) async => successResponse(null, statusCode: 500));

        expect(() => repo.requestExport(), throwsException);
      });

      test('throws on DioException', () async {
        when(() => mockDio.post('/export'))
            .thenThrow(dioError(statusCode: 500));

        expect(() => repo.requestExport(), throwsA(isA<Exception>()));
      });
    });

    group('getStatus', () {
      test('returns completed status with downloadUrl', () async {
        when(() => mockDio.get(
              '/export/status',
              queryParameters: any(named: 'queryParameters'),
            )).thenAnswer((_) async => successResponse({
              'status': 'completed',
              'downloadUrl': 'https://storage.googleapis.com/export.zip',
              'progress': 100,
            }));

        final result = await repo.getStatus('job-abc-123');

        expect(result.status, 'completed');
        expect(result.downloadUrl, isNotNull);
        expect(result.progress, 100);
      });

      test('returns processing status with progress', () async {
        when(() => mockDio.get(
              '/export/status',
              queryParameters: any(named: 'queryParameters'),
            )).thenAnswer((_) async => successResponse({
              'status': 'processing',
              'progress': 45,
            }));

        final result = await repo.getStatus('job-abc-123');

        expect(result.status, 'processing');
        expect(result.downloadUrl, isNull);
        expect(result.progress, 45);
      });

      test('passes jobId as query parameter', () async {
        when(() => mockDio.get(
              '/export/status',
              queryParameters: any(named: 'queryParameters'),
            )).thenAnswer((_) async => successResponse({
              'status': 'pending',
            }));

        await repo.getStatus('my-job-id');

        verify(() => mockDio.get(
              '/export/status',
              queryParameters: {'jobId': 'my-job-id'},
            )).called(1);
      });

      test('handles null fields with defaults', () async {
        when(() => mockDio.get(
              '/export/status',
              queryParameters: any(named: 'queryParameters'),
            )).thenAnswer((_) async => successResponse(<String, dynamic>{}));

        final result = await repo.getStatus('test');

        expect(result.status, 'pending');
        expect(result.downloadUrl, isNull);
        expect(result.progress, isNull);
      });

      test('throws on non-200 status code', () async {
        when(() => mockDio.get(
              '/export/status',
              queryParameters: any(named: 'queryParameters'),
            )).thenAnswer((_) async => successResponse(null, statusCode: 404));

        expect(() => repo.getStatus('bad-id'), throwsException);
      });

      test('throws on DioException', () async {
        when(() => mockDio.get(
              '/export/status',
              queryParameters: any(named: 'queryParameters'),
            )).thenThrow(dioError(statusCode: 500));

        expect(() => repo.getStatus('test'), throwsA(isA<Exception>()));
      });
    });
  });
}
