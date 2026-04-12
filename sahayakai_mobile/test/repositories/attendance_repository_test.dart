import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/attendance/data/attendance_repository.dart';
import '../helpers/mocks.dart';

void main() {
  late AttendanceRepository repo;
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    repo = AttendanceRepository(mocks.apiClient);
  });

  group('AttendanceRepository', () {
    test('createOutreach returns outreachId', () async {
      when(() => mockDio.post(
            '/attendance/outreach',
            data: any(named: 'data'),
          )).thenAnswer((_) async => successResponse({
            'outreachId': 'out-123',
          }));

      final id = await repo.createOutreach(
        studentName: 'Rahul',
        parentPhone: '+919876543210',
        message: 'Your child was absent today',
      );

      expect(id, 'out-123');
    });

    test('initiateCall returns call SID', () async {
      when(() => mockDio.post(
            '/attendance/call',
            data: any(named: 'data'),
          )).thenAnswer((_) async => successResponse({
            'callSid': 'CA-xxx',
            'status': 'queued',
          }));

      final result = await repo.initiateCall(
        outreachId: 'out-123',
        to: '+919876543210',
      );

      expect(result.callSid, 'CA-xxx');
      expect(result.status, 'queued');
    });

    test('getCallSummary returns transcript', () async {
      when(() => mockDio.get(
            '/attendance/call-summary',
            queryParameters: any(named: 'queryParameters'),
          )).thenAnswer((_) async => successResponse({
            'status': 'completed',
            'transcript': 'Parent confirmed attendance.',
            'summary': 'Call successful. Parent acknowledged.',
            'duration': 45,
          }));

      final summary = await repo.getCallSummary('out-123');
      expect(summary.status, 'completed');
      expect(summary.transcript, contains('confirmed'));
      expect(summary.duration, 45);
    });
  });
}
