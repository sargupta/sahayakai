/// Domain models for the Attendance Management feature.
///
/// Covers class records, students, daily attendance, and summaries.

/// Represents a class/section managed by a teacher.
class ClassRecord {
  final String id;
  final String teacherUid;
  final String name;
  final String subject;
  final String gradeLevel;
  final String section;
  final String academicYear;
  final int studentCount;

  const ClassRecord({
    required this.id,
    required this.teacherUid,
    required this.name,
    required this.subject,
    required this.gradeLevel,
    required this.section,
    required this.academicYear,
    this.studentCount = 0,
  });

  factory ClassRecord.fromJson(Map<String, dynamic> json) => ClassRecord(
        id: json['id'] as String? ?? '',
        teacherUid: json['teacherUid'] as String? ?? '',
        name: json['name'] as String? ?? '',
        subject: json['subject'] as String? ?? '',
        gradeLevel: json['gradeLevel'] as String? ?? '',
        section: json['section'] as String? ?? '',
        academicYear: json['academicYear'] as String? ?? '',
        studentCount: json['studentCount'] as int? ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'teacherUid': teacherUid,
        'name': name,
        'subject': subject,
        'gradeLevel': gradeLevel,
        'section': section,
        'academicYear': academicYear,
        'studentCount': studentCount,
      };

  ClassRecord copyWith({
    String? id,
    String? teacherUid,
    String? name,
    String? subject,
    String? gradeLevel,
    String? section,
    String? academicYear,
    int? studentCount,
  }) =>
      ClassRecord(
        id: id ?? this.id,
        teacherUid: teacherUid ?? this.teacherUid,
        name: name ?? this.name,
        subject: subject ?? this.subject,
        gradeLevel: gradeLevel ?? this.gradeLevel,
        section: section ?? this.section,
        academicYear: academicYear ?? this.academicYear,
        studentCount: studentCount ?? this.studentCount,
      );
}

/// A student enrolled in a class.
class Student {
  final String id;
  final String classId;
  final int rollNumber;
  final String name;
  final String parentPhone;
  final String parentLanguage;

  const Student({
    required this.id,
    required this.classId,
    required this.rollNumber,
    required this.name,
    required this.parentPhone,
    this.parentLanguage = 'hi',
  });

  factory Student.fromJson(Map<String, dynamic> json) => Student(
        id: json['id'] as String? ?? '',
        classId: json['classId'] as String? ?? '',
        rollNumber: json['rollNumber'] as int? ?? 0,
        name: json['name'] as String? ?? '',
        parentPhone: json['parentPhone'] as String? ?? '',
        parentLanguage: json['parentLanguage'] as String? ?? 'hi',
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'classId': classId,
        'rollNumber': rollNumber,
        'name': name,
        'parentPhone': parentPhone,
        'parentLanguage': parentLanguage,
      };

  Student copyWith({
    String? id,
    String? classId,
    int? rollNumber,
    String? name,
    String? parentPhone,
    String? parentLanguage,
  }) =>
      Student(
        id: id ?? this.id,
        classId: classId ?? this.classId,
        rollNumber: rollNumber ?? this.rollNumber,
        name: name ?? this.name,
        parentPhone: parentPhone ?? this.parentPhone,
        parentLanguage: parentLanguage ?? this.parentLanguage,
      );
}

/// Attendance status for a single student on a single day.
enum AttendanceStatus {
  present,
  absent,
  late_;

  String get label {
    switch (this) {
      case AttendanceStatus.present:
        return 'Present';
      case AttendanceStatus.absent:
        return 'Absent';
      case AttendanceStatus.late_:
        return 'Late';
    }
  }

  static AttendanceStatus fromString(String value) {
    switch (value) {
      case 'present':
        return AttendanceStatus.present;
      case 'absent':
        return AttendanceStatus.absent;
      case 'late':
      case 'late_':
        return AttendanceStatus.late_;
      default:
        return AttendanceStatus.present;
    }
  }

  String toJsonValue() {
    switch (this) {
      case AttendanceStatus.present:
        return 'present';
      case AttendanceStatus.absent:
        return 'absent';
      case AttendanceStatus.late_:
        return 'late';
    }
  }
}

/// A full day's attendance record for a class.
class DailyAttendanceRecord {
  final String classId;

  /// Date string in YYYY-MM-DD format.
  final String date;
  final String teacherUid;

  /// Map of studentId -> AttendanceStatus.
  final Map<String, AttendanceStatus> records;
  final DateTime? submittedAt;

  const DailyAttendanceRecord({
    required this.classId,
    required this.date,
    required this.teacherUid,
    required this.records,
    this.submittedAt,
  });

  factory DailyAttendanceRecord.fromJson(Map<String, dynamic> json) {
    final rawRecords = json['records'] as Map<String, dynamic>? ?? {};
    final parsedRecords = rawRecords.map(
      (key, value) => MapEntry(
        key,
        AttendanceStatus.fromString(value as String? ?? 'present'),
      ),
    );

    return DailyAttendanceRecord(
      classId: json['classId'] as String? ?? '',
      date: json['date'] as String? ?? '',
      teacherUid: json['teacherUid'] as String? ?? '',
      records: parsedRecords,
      submittedAt: json['submittedAt'] != null
          ? DateTime.tryParse(json['submittedAt'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'classId': classId,
        'date': date,
        'teacherUid': teacherUid,
        'records':
            records.map((key, value) => MapEntry(key, value.toJsonValue())),
        if (submittedAt != null) 'submittedAt': submittedAt!.toIso8601String(),
      };

  DailyAttendanceRecord copyWith({
    String? classId,
    String? date,
    String? teacherUid,
    Map<String, AttendanceStatus>? records,
    DateTime? submittedAt,
  }) =>
      DailyAttendanceRecord(
        classId: classId ?? this.classId,
        date: date ?? this.date,
        teacherUid: teacherUid ?? this.teacherUid,
        records: records ?? this.records,
        submittedAt: submittedAt ?? this.submittedAt,
      );
}

/// Aggregated attendance summary for a student.
class AttendanceSummary {
  final String studentId;
  final int present;
  final int absent;
  final int late_;
  final int streak;
  final int total;

  const AttendanceSummary({
    required this.studentId,
    this.present = 0,
    this.absent = 0,
    this.late_ = 0,
    this.streak = 0,
    this.total = 0,
  });

  double get attendancePercentage =>
      total > 0 ? ((present + late_) / total) * 100 : 0;

  factory AttendanceSummary.fromJson(Map<String, dynamic> json) =>
      AttendanceSummary(
        studentId: json['studentId'] as String? ?? '',
        present: json['present'] as int? ?? 0,
        absent: json['absent'] as int? ?? 0,
        late_: json['late'] as int? ?? json['late_'] as int? ?? 0,
        streak: json['streak'] as int? ?? 0,
        total: json['total'] as int? ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'studentId': studentId,
        'present': present,
        'absent': absent,
        'late': late_,
        'streak': streak,
        'total': total,
      };
}
