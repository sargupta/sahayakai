import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/attendance_models.dart';

final attendanceRepositoryProvider = Provider((ref) {
  return AttendanceRepository(ref.read(apiClientProvider));
});

class CallResponse {
  final String callSid;
  final String status;

  const CallResponse({required this.callSid, required this.status});

  factory CallResponse.fromJson(Map<String, dynamic> json) => CallResponse(
        callSid: json['callSid'] as String? ?? '',
        status: json['status'] as String? ?? '',
      );
}

class CallSummary {
  final String? transcript;
  final String? summary;
  final String status;
  final int? duration;

  const CallSummary({
    this.transcript,
    this.summary,
    required this.status,
    this.duration,
  });

  factory CallSummary.fromJson(Map<String, dynamic> json) => CallSummary(
        transcript: json['transcript'] as String?,
        summary: json['summary'] as String?,
        status: json['status'] as String? ?? 'unknown',
        duration: json['duration'] as int?,
      );
}

class AttendanceRepository {
  final ApiClient _apiClient;

  AttendanceRepository(this._apiClient);

  /// POST /attendance/call — initiate Twilio call to parent.
  Future<CallResponse> initiateCall({
    required String outreachId,
    required String to,
    String parentLanguage = 'en',
  }) async {
    final response = await _apiClient.client.post(
      '/attendance/call',
      data: {
        'outreachId': outreachId,
        'to': to,
        'parentLanguage': parentLanguage,
      },
    );
    if (response.statusCode == 200) {
      return CallResponse.fromJson(response.data as Map<String, dynamic>);
    }
    throw Exception('Call failed: ${response.statusCode}');
  }

  /// GET /attendance/call-summary — get call transcript and AI summary.
  Future<CallSummary> getCallSummary(String outreachId) async {
    final response = await _apiClient.client.get(
      '/attendance/call-summary',
      queryParameters: {'outreachId': outreachId},
    );
    if (response.statusCode == 200) {
      return CallSummary.fromJson(response.data as Map<String, dynamic>);
    }
    throw Exception('Summary fetch failed: ${response.statusCode}');
  }

  // ─────────────────── Class Management ───────────────────

  /// GET /attendance/classes — list all classes for the teacher.
  Future<List<ClassRecord>> getClasses() async {
    final response = await _apiClient.client.get('/attendance/classes');
    if (response.statusCode == 200) {
      final list = response.data['classes'] as List<dynamic>? ?? [];
      return list
          .map((e) => ClassRecord.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    throw Exception('Failed to fetch classes: ${response.statusCode}');
  }

  /// POST /attendance/classes — create a new class.
  Future<ClassRecord> createClass({
    required String name,
    required String subject,
    required String gradeLevel,
    required String section,
    required String academicYear,
  }) async {
    final response = await _apiClient.client.post(
      '/attendance/classes',
      data: {
        'name': name,
        'subject': subject,
        'gradeLevel': gradeLevel,
        'section': section,
        'academicYear': academicYear,
      },
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      return ClassRecord.fromJson(response.data as Map<String, dynamic>);
    }
    throw Exception('Failed to create class: ${response.statusCode}');
  }

  /// DELETE /attendance/classes/:id — delete a class.
  Future<void> deleteClass(String classId) async {
    final response =
        await _apiClient.client.delete('/attendance/classes/$classId');
    if (response.statusCode != 200 && response.statusCode != 204) {
      throw Exception('Failed to delete class: ${response.statusCode}');
    }
  }

  /// GET /attendance/classes/:id — get single class details.
  Future<ClassRecord> getClass(String classId) async {
    final response =
        await _apiClient.client.get('/attendance/classes/$classId');
    if (response.statusCode == 200) {
      return ClassRecord.fromJson(response.data as Map<String, dynamic>);
    }
    throw Exception('Failed to fetch class: ${response.statusCode}');
  }

  // ─────────────────── Student Management ───────────────────

  /// GET /attendance/classes/:id/students — list students in a class.
  Future<List<Student>> getStudents(String classId) async {
    final response = await _apiClient.client
        .get('/attendance/classes/$classId/students');
    if (response.statusCode == 200) {
      final list = response.data['students'] as List<dynamic>? ?? [];
      return list
          .map((e) => Student.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    throw Exception('Failed to fetch students: ${response.statusCode}');
  }

  /// POST /attendance/classes/:id/students — add a student.
  Future<Student> addStudent({
    required String classId,
    required String name,
    required int rollNumber,
    required String parentPhone,
    String parentLanguage = 'hi',
  }) async {
    final response = await _apiClient.client.post(
      '/attendance/classes/$classId/students',
      data: {
        'name': name,
        'rollNumber': rollNumber,
        'parentPhone': parentPhone,
        'parentLanguage': parentLanguage,
      },
    );
    if (response.statusCode == 200 || response.statusCode == 201) {
      return Student.fromJson(response.data as Map<String, dynamic>);
    }
    throw Exception('Failed to add student: ${response.statusCode}');
  }

  /// DELETE /attendance/classes/:classId/students/:studentId
  Future<void> deleteStudent({
    required String classId,
    required String studentId,
  }) async {
    final response = await _apiClient.client
        .delete('/attendance/classes/$classId/students/$studentId');
    if (response.statusCode != 200 && response.statusCode != 204) {
      throw Exception('Failed to delete student: ${response.statusCode}');
    }
  }

  // ─────────────────── Attendance Records ───────────────────

  /// GET /attendance/classes/:id/attendance?date=YYYY-MM-DD
  Future<DailyAttendanceRecord?> getDailyAttendance({
    required String classId,
    required String date,
  }) async {
    final response = await _apiClient.client.get(
      '/attendance/classes/$classId/attendance',
      queryParameters: {'date': date},
    );
    if (response.statusCode == 200) {
      if (response.data == null ||
          (response.data is Map && (response.data as Map).isEmpty)) {
        return null;
      }
      return DailyAttendanceRecord.fromJson(
          response.data as Map<String, dynamic>);
    }
    throw Exception('Failed to fetch attendance: ${response.statusCode}');
  }

  /// POST /attendance/classes/:id/attendance — save daily attendance.
  Future<void> saveDailyAttendance(DailyAttendanceRecord record) async {
    final response = await _apiClient.client.post(
      '/attendance/classes/${record.classId}/attendance',
      data: record.toJson(),
    );
    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('Failed to save attendance: ${response.statusCode}');
    }
  }

  /// GET /attendance/classes/:id/summary?month=YYYY-MM
  Future<List<AttendanceSummary>> getMonthlySummary({
    required String classId,
    required String month,
  }) async {
    final response = await _apiClient.client.get(
      '/attendance/classes/$classId/summary',
      queryParameters: {'month': month},
    );
    if (response.statusCode == 200) {
      final list = response.data['summaries'] as List<dynamic>? ?? [];
      return list
          .map((e) => AttendanceSummary.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    throw Exception('Failed to fetch summary: ${response.statusCode}');
  }

  // ─────────────────── Parent Outreach ───────────────────

  /// POST /attendance/outreach — create parent outreach record.
  Future<String> createOutreach({
    required String studentName,
    required String parentPhone,
    required String message,
    String? language,
  }) async {
    final response = await _apiClient.client.post(
      '/attendance/outreach',
      data: {
        'studentName': studentName,
        'parentPhone': parentPhone,
        'message': message,
        if (language != null) 'language': language,
      },
    );
    if (response.statusCode == 200) {
      return response.data['outreachId'] as String? ?? '';
    }
    throw Exception('Outreach creation failed: ${response.statusCode}');
  }
}
