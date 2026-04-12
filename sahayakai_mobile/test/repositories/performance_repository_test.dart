import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/performance/data/performance_repository.dart';
import '../helpers/mocks.dart';

void main() {
  late PerformanceRepository repo;
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    repo = PerformanceRepository(mocks.apiClient);
  });

  group('PerformanceRepository', () {
    test('saveBatch sends correct structure', () async {
      when(() => mockDio.post(
            '/performance/batch',
            data: any(named: 'data'),
          )).thenAnswer((_) async => successResponse({'success': true}));

      await repo.saveBatch(
        classId: 'class-8a',
        assessmentName: 'Unit Test 1',
        marks: [
          const StudentMark(
            studentId: 's1',
            studentName: 'Rahul',
            marks: 85,
          ),
          const StudentMark(
            studentId: 's2',
            studentName: 'Priya',
            marks: 92,
            maxMarks: 100,
          ),
        ],
      );

      final captured = verify(() => mockDio.post(
            '/performance/batch',
            data: captureAny(named: 'data'),
          )).captured.single as Map<String, dynamic>;

      expect(captured['classId'], 'class-8a');
      expect(captured['assessmentName'], 'Unit Test 1');
      expect((captured['marks'] as List).length, 2);
    });

    test('getStudentPerformance parses assessments', () async {
      when(() => mockDio.get('/performance/student/s1'))
          .thenAnswer((_) async => successResponse({
                'studentId': 's1',
                'studentName': 'Rahul Kumar',
                'assessments': [
                  {
                    'name': 'Unit Test 1',
                    'marks': 85,
                    'maxMarks': 100,
                    'date': '2026-03-15',
                  },
                  {
                    'name': 'Mid-Term',
                    'marks': 72,
                    'maxMarks': 100,
                    'date': '2026-02-01',
                  },
                ],
              }));

      final perf = await repo.getStudentPerformance('s1');
      expect(perf.studentName, 'Rahul Kumar');
      expect(perf.assessments.length, 2);
      expect(perf.assessments[0].marks, 85);
    });
  });
}
