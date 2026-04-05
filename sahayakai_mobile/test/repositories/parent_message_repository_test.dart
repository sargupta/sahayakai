import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/attendance/data/parent_message_repository.dart';
import '../helpers/mocks.dart';

void main() {
  late ParentMessageRepository repo;
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    repo = ParentMessageRepository(mocks.apiClient);
  });

  group('ParentMessageRepository', () {
    group('generate', () {
      const fullResponse = {
        'message':
            'Dear Parent, your child Aarav has been absent for 3 consecutive days.',
        'tone': 'empathetic',
        'subject': 'Attendance Update',
      };

      test('returns ParentMessageOutput on success with all fields', () async {
        when(() =>
                mockDio.post('/ai/parent-message', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse(fullResponse));

        final result = await repo.generate(
          context: 'Student absent 3 days',
          studentName: 'Aarav',
          language: 'en',
        );

        expect(result.message, contains('Aarav'));
        expect(result.tone, 'empathetic');
        expect(result.subject, 'Attendance Update');
      });

      test('sends only required field when optionals are absent', () async {
        when(() =>
                mockDio.post('/ai/parent-message', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse(fullResponse));

        await repo.generate(context: 'Low test scores');

        verify(() => mockDio.post('/ai/parent-message', data: {
              'context': 'Low test scores',
            })).called(1);
      });

      test('sends all optional fields when present', () async {
        when(() =>
                mockDio.post('/ai/parent-message', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse(fullResponse));

        await repo.generate(
          context: 'Good performance',
          studentName: 'Priya',
          language: 'hi',
        );

        verify(() => mockDio.post('/ai/parent-message', data: {
              'context': 'Good performance',
              'studentName': 'Priya',
              'language': 'hi',
            })).called(1);
      });

      test('handles response with null optional fields', () async {
        when(() =>
                mockDio.post('/ai/parent-message', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse({
                  'message': 'Simple message',
                }));

        final result = await repo.generate(context: 'test');

        expect(result.message, 'Simple message');
        expect(result.tone, isNull);
        expect(result.subject, isNull);
      });

      test('handles null fields with defaults', () async {
        when(() =>
                mockDio.post('/ai/parent-message', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse(<String, dynamic>{}));

        final result = await repo.generate(context: 'test');

        expect(result.message, '');
        expect(result.tone, isNull);
        expect(result.subject, isNull);
      });

      test('throws on non-200 status code', () async {
        when(() =>
                mockDio.post('/ai/parent-message', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse(null, statusCode: 500));

        expect(
          () => repo.generate(context: 'test'),
          throwsException,
        );
      });

      test('throws on DioException', () async {
        when(() =>
                mockDio.post('/ai/parent-message', data: any(named: 'data')))
            .thenThrow(dioError(statusCode: 503));

        expect(
          () => repo.generate(context: 'test'),
          throwsA(isA<DioException>()),
        );
      });
    });
  });
}
