import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/sarkar/data/sarkar_repository.dart';
import '../helpers/mocks.dart';

void main() {
  late SarkarRepository repo;
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    repo = SarkarRepository(mocks.apiClient);
  });

  group('SarkarRepository', () {
    group('verify', () {
      test('returns verified result with all fields', () async {
        when(() => mockDio.post('/sarkar/verify', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse({
                  'verified': true,
                  'schoolName': 'Govt. High School Bengaluru',
                  'district': 'Bengaluru Urban',
                  'state': 'Karnataka',
                  'message': 'Verification successful',
                }));

        final result = await repo.verify('29190100301');

        expect(result.verified, true);
        expect(result.schoolName, 'Govt. High School Bengaluru');
        expect(result.district, 'Bengaluru Urban');
        expect(result.state, 'Karnataka');
        expect(result.message, 'Verification successful');
      });

      test('returns not-verified result', () async {
        when(() => mockDio.post('/sarkar/verify', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse({
                  'verified': false,
                  'message': 'UDISE code not found',
                }));

        final result = await repo.verify('00000000000');

        expect(result.verified, false);
        expect(result.schoolName, isNull);
        expect(result.district, isNull);
        expect(result.state, isNull);
        expect(result.message, 'UDISE code not found');
      });

      test('sends udiseCode in request body', () async {
        when(() => mockDio.post('/sarkar/verify', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse({
                  'verified': false,
                }));

        await repo.verify('12345678901');

        verify(() => mockDio.post('/sarkar/verify', data: {
              'udiseCode': '12345678901',
            })).called(1);
      });

      test('handles null fields with defaults', () async {
        when(() => mockDio.post('/sarkar/verify', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse(<String, dynamic>{}));

        final result = await repo.verify('test');

        expect(result.verified, false);
        expect(result.schoolName, isNull);
      });

      test('throws on non-200 status code', () async {
        when(() => mockDio.post('/sarkar/verify', data: any(named: 'data')))
            .thenAnswer((_) async => successResponse(null, statusCode: 500));

        expect(
          () => repo.verify('test'),
          throwsException,
        );
      });

      test('throws on DioException', () async {
        when(() => mockDio.post('/sarkar/verify', data: any(named: 'data')))
            .thenThrow(dioError(statusCode: 503));

        expect(
          () => repo.verify('test'),
          throwsA(isA<Exception>()),
        );
      });
    });
  });
}
