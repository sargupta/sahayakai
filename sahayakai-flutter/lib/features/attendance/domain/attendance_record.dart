import 'package:flutter/foundation.dart';

import 'attendance_date.dart';

/// How a student was marked on a given day. Wire values mirror
/// `src/types/attendance.ts` → `AttendanceStatus` EXACTLY:
///
///   'present' | 'absent' | 'late'
///
/// **[fromWire] is nullable, and that is a deliberate departure from the
/// tolerant-default convention** used by `parent_hotline`'s enums
/// (`CallStatus.fromWire` → `failed`, `ParentSentiment.fromWire` →
/// `indifferent`). Those defaults describe a model-written *summary*, where an
/// unrecognised adjective must not stop a sheet from rendering.
///
/// An attendance status is a claim about a specific child on a specific day,
/// and it is the input to a phone call to that child's parent. Defaulting an
/// unreadable token to `present` invents a day the child was in school;
/// defaulting it to `absent` invents one they missed. Neither is a safe
/// fallback, so there is none: an unrecognised status decodes to null, and the
/// student reads as **not yet marked** — which is exactly how the server treats
/// a missing key (`if (!status) continue;` in `getStudentSummaries`).
enum AttendanceStatus {
  present('present'),
  absent('absent'),
  late('late');

  const AttendanceStatus(this.wire);

  /// The exact token `POST .../records` expects and the register doc stores.
  final String wire;

  /// Strict decode: null / unknown → null ("not marked"). Never throws, and
  /// never guesses a status. See the class doc for why.
  static AttendanceStatus? fromWire(String? wire) {
    for (final status in AttendanceStatus.values) {
      if (status.wire == wire) return status;
    }
    return null;
  }
}

/// One day's register for one class — the domain view of
/// `attendance/{classId}/records/{YYYY-MM-DD}` (`src/types/attendance.ts` →
/// `DailyAttendanceRecord`), as `GET .../records?date=` returns it.
///
/// `teacherUid` is not modelled, for the same reason `AttendanceClass` omits
/// it: ownership is decided server-side on every route.
@immutable
class DailyAttendance {
  const DailyAttendance({
    required this.classId,
    required this.date,
    this.statuses = const <String, AttendanceStatus>{},
    this.submittedAt,
    this.isFinalized = false,
  });

  final String classId;
  final AttendanceDate date;

  /// studentId → status. A student absent from this map is **unmarked**, not
  /// present: the register is sparse until the teacher finishes it.
  final Map<String, AttendanceStatus> statuses;

  /// ISO-8601 string of when the register was last written, as sent by the
  /// server.
  final String? submittedAt;

  /// The server writes `false` today; no route flips it yet. Modelled because
  /// the stored document carries it and a client that drops the field would
  /// silently overwrite a finalized register once one exists.
  final bool isFinalized;

  /// The student's mark, or null when they are not yet marked.
  AttendanceStatus? statusFor(String studentId) => statuses[studentId];

  int get presentCount => _countOf(AttendanceStatus.present);
  int get absentCount => _countOf(AttendanceStatus.absent);
  int get lateCount => _countOf(AttendanceStatus.late);

  /// How many students carry any mark at all — the numerator of a "12 of 34
  /// marked" progress line.
  int get markedCount => statuses.length;

  int _countOf(AttendanceStatus status) =>
      statuses.values.where((s) => s == status).length;

  @override
  bool operator ==(Object other) =>
      other is DailyAttendance &&
      other.classId == classId &&
      other.date == date &&
      mapEquals(other.statuses, statuses) &&
      other.submittedAt == submittedAt &&
      other.isFinalized == isFinalized;

  @override
  int get hashCode => Object.hash(
        classId,
        date,
        Object.hashAllUnordered(
          statuses.entries.map((e) => Object.hash(e.key, e.value)),
        ),
        submittedAt,
        isFinalized,
      );
}

/// One student's monthly rollup, computed server-side and never stored
/// (`src/types/attendance.ts` → `StudentAttendanceSummary`), as
/// `GET .../summaries?year=&month=` returns it.
///
/// The arithmetic stays on the server: it is the same rollup the web app reads,
/// and recomputing it on the handset from a partial month would produce a
/// second, quietly different number on the same screen.
@immutable
class StudentAttendanceSummary {
  const StudentAttendanceSummary({
    required this.studentId,
    required this.studentName,
    required this.rollNumber,
    this.totalDays = 0,
    this.presentDays = 0,
    this.absentDays = 0,
    this.lateDays = 0,
    this.attendanceRate = 100,
    this.consecutiveAbsences = 0,
  });

  final String studentId;
  final String studentName;
  final int rollNumber;

  /// Days with any mark — present + absent + late.
  final int totalDays;
  final int presentDays;
  final int absentDays;
  final int lateDays;

  /// 0–100, rounded server-side. 100 when the month holds no marks at all
  /// (the server's own default), so an empty month never reads as 0% attended.
  final int attendanceRate;

  /// The longest run of consecutive absent days inside the month — the signal
  /// the parent-hotline `consecutive_absences` reason is raised on.
  final int consecutiveAbsences;

  @override
  bool operator ==(Object other) =>
      other is StudentAttendanceSummary &&
      other.studentId == studentId &&
      other.studentName == studentName &&
      other.rollNumber == rollNumber &&
      other.totalDays == totalDays &&
      other.presentDays == presentDays &&
      other.absentDays == absentDays &&
      other.lateDays == lateDays &&
      other.attendanceRate == attendanceRate &&
      other.consecutiveAbsences == consecutiveAbsences;

  @override
  int get hashCode => Object.hash(
        studentId,
        studentName,
        rollNumber,
        totalDays,
        presentDays,
        absentDays,
        lateDays,
        attendanceRate,
        consecutiveAbsences,
      );
}
