import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final performanceRepositoryProvider = Provider((ref) {
  return PerformanceRepository(ref.read(apiClientProvider));
});

class StudentMark {
  final String studentId;
  final String studentName;
  final int marks;
  final int? maxMarks;

  const StudentMark({
    required this.studentId,
    required this.studentName,
    required this.marks,
    this.maxMarks,
  });

  Map<String, dynamic> toJson() => {
        'studentId': studentId,
        'studentName': studentName,
        'marks': marks,
        if (maxMarks != null) 'maxMarks': maxMarks,
      };
}

class StudentPerformance {
  final String studentId;
  final String studentName;
  final List<Assessment> assessments;

  const StudentPerformance({
    required this.studentId,
    required this.studentName,
    this.assessments = const [],
  });

  factory StudentPerformance.fromJson(Map<String, dynamic> json) =>
      StudentPerformance(
        studentId: json['studentId'] as String? ?? '',
        studentName: json['studentName'] as String? ?? '',
        assessments: (json['assessments'] as List<dynamic>?)
                ?.map((a) => Assessment.fromJson(a as Map<String, dynamic>))
                .toList() ??
            [],
      );
}

class Assessment {
  final String name;
  final int marks;
  final int maxMarks;
  final String? date;

  const Assessment({
    required this.name,
    required this.marks,
    required this.maxMarks,
    this.date,
  });

  factory Assessment.fromJson(Map<String, dynamic> json) => Assessment(
        name: json['name'] as String? ?? '',
        marks: json['marks'] as int? ?? 0,
        maxMarks: json['maxMarks'] as int? ?? 100,
        date: json['date'] as String?,
      );
}

class PerformanceRepository {
  final ApiClient _apiClient;

  PerformanceRepository(this._apiClient);

  /// POST /performance/batch — save student marks for an assessment.
  Future<void> saveBatch({
    required String classId,
    required String assessmentName,
    required List<StudentMark> marks,
  }) async {
    final response = await _apiClient.client.post(
      '/performance/batch',
      data: {
        'classId': classId,
        'assessmentName': assessmentName,
        'marks': marks.map((m) => m.toJson()).toList(),
      },
    );
    if (response.statusCode != 200) {
      throw Exception('Batch save failed: ${response.statusCode}');
    }
  }

  /// GET /performance/student/{studentId} — get student performance trend.
  Future<StudentPerformance> getStudentPerformance(String studentId) async {
    final response = await _apiClient.client.get(
      '/performance/student/$studentId',
    );
    if (response.statusCode == 200) {
      return StudentPerformance.fromJson(
          response.data as Map<String, dynamic>);
    }
    throw Exception('Performance fetch failed: ${response.statusCode}');
  }
}
