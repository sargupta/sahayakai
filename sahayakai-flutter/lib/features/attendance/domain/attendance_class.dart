import 'package:flutter/foundation.dart';

/// The class-size and roll-number constraints the server enforces, mirrored
/// client-side.
///
/// WHY MIRROR A SERVER RULE
///
/// `addStudent` (`src/server/attendance.ts`) enforces both inside a Firestore
/// transaction — forensic fix F9-006 for the 40-cap, Wave 3 for the roll-number
/// integer check — and that transaction stays the authority: it is the only
/// thing that can settle two teachers adding the 40th student at once.
///
/// But a client that knows nothing of the rule can only apologise after the
/// fact: the teacher types a 41st name, waits out a round trip on a rural
/// connection, and gets a red line back. Encoding the same numbers here lets
/// the UI disable "Add student" on a full class and reject roll number 41 while
/// the teacher is still looking at the field. The server check is not
/// redundant — it is the one that is true.
abstract final class ClassCapacity {
  /// `Maximum 40 students per class` — the transactional cap in `addStudent`.
  static const int maxStudents = 40;

  /// `Roll number must be 1–40`, inclusive at both ends.
  static const int minRollNumber = 1;
  static const int maxRollNumber = 40;

  /// Whether a class at [studentCount] can take another student.
  static bool isFull(int studentCount) => studentCount >= maxStudents;

  /// Seats left before the cap, floored at 0 (a class that somehow holds more
  /// than 40 reports 0, never a negative).
  static int remainingSeats(int studentCount) {
    final left = maxStudents - studentCount;
    return left < 0 ? 0 : left;
  }

  /// What is wrong with [rollNumber], or null when it is acceptable.
  ///
  /// Typed as [num] because that is what arrives from a parsed text field and
  /// from JSON: the server's own check exists precisely because JS coerced
  /// `41.5` and `0.99` through a naive range test, and `num` is the client-side
  /// shape of the same hazard.
  static RollNumberProblem? checkRollNumber(num? rollNumber) {
    if (rollNumber == null) return RollNumberProblem.missing;
    // NaN and the infinities are neither integral nor in range, and would throw
    // from truncate(), so they are screened first.
    if (!rollNumber.isFinite) return RollNumberProblem.notAnInteger;
    if (rollNumber != rollNumber.truncate()) {
      return RollNumberProblem.notAnInteger;
    }
    final value = rollNumber.toInt();
    if (value < minRollNumber || value > maxRollNumber) {
      return RollNumberProblem.outOfRange;
    }
    return null;
  }

  /// Whether [rollNumber] would be accepted by `addStudent`.
  static bool isValidRollNumber(num? rollNumber) =>
      checkRollNumber(rollNumber) == null;

  /// The lowest roll number in 1–40 not already in [taken], or null when the
  /// class has used all forty. Lets an "add student" form pre-fill the obvious
  /// next number instead of making the teacher scan the register for a gap.
  static int? firstFreeRollNumber(Iterable<int> taken) {
    final used = taken.toSet();
    for (var roll = minRollNumber; roll <= maxRollNumber; roll++) {
      if (!used.contains(roll)) return roll;
    }
    return null;
  }
}

/// Why a roll number is unacceptable. Mirrors the two distinct 400s
/// `addStudent` raises (`Roll number must be an integer` /
/// `Roll number must be 1–40`) plus the client-only "nothing entered yet".
enum RollNumberProblem { missing, notAnInteger, outOfRange }

/// The domain view of a `classes/{classId}` document
/// (`src/types/attendance.ts` → `ClassRecord`), as
/// `GET /api/attendance/classes` returns it.
///
/// `teacherUid` is deliberately NOT modelled. It is a server-trusted ownership
/// field: every route re-checks `teacherUid === uid` itself, the client can
/// neither choose nor verify it, and a copy on the handset would only invite a
/// screen to make an access decision the server has already made. Same
/// discipline as `parent_outreach`'s server-trusted fields.
@immutable
class AttendanceClass {
  const AttendanceClass({
    required this.id,
    required this.name,
    required this.subject,
    required this.gradeLevel,
    required this.academicYear,
    this.section,
    this.studentCount = 0,
    this.createdAt,
    this.updatedAt,
  });

  /// Firestore doc id — the `classId` every nested route takes.
  final String id;

  /// e.g. `"Class 6A"`.
  final String name;

  /// A `Subject` token, kept as the raw string: the server stores the union
  /// member verbatim and the client has no branch that depends on which one it
  /// is.
  final String subject;

  /// A `GradeLevel` token, kept raw for the same reason as [subject].
  final String gradeLevel;

  /// e.g. `"2025-26"`.
  final String academicYear;

  /// e.g. `"A"`. Absent for an unsectioned class.
  final String? section;

  /// Denormalized member count, maintained transactionally alongside the
  /// 40-cap. This is the number [isFull] reads, so the client's "class is full"
  /// is derived from the same counter the server's transaction guards.
  final int studentCount;

  /// ISO-8601 strings, as written server-side.
  final String? createdAt;
  final String? updatedAt;

  /// The class has hit the 40-student cap; "add student" must be disabled.
  bool get isFull => ClassCapacity.isFull(studentCount);

  /// Seats left before the cap.
  int get remainingSeats => ClassCapacity.remainingSeats(studentCount);

  @override
  bool operator ==(Object other) =>
      other is AttendanceClass &&
      other.id == id &&
      other.name == name &&
      other.subject == subject &&
      other.gradeLevel == gradeLevel &&
      other.academicYear == academicYear &&
      other.section == section &&
      other.studentCount == studentCount &&
      other.createdAt == createdAt &&
      other.updatedAt == updatedAt;

  @override
  int get hashCode => Object.hash(
        id,
        name,
        subject,
        gradeLevel,
        academicYear,
        section,
        studentCount,
        createdAt,
        updatedAt,
      );
}
