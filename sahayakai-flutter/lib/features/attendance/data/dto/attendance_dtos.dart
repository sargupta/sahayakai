/// Wire DTOs for `/api/attendance/*`.
///
/// WHY THESE ARE HAND-WRITTEN AND NOT `@JsonSerializable`
///
/// The sibling `parent_hotline` DTOs use `json_annotation` + a generated
/// `.g.dart`. This unit must not run `build_runner` (the parent serialises
/// codegen), and hand-writing a `.g.dart` that build_runner would later
/// regenerate is a merge conflict waiting to happen. So the codecs are written
/// out here, with no annotations at all — nothing for build_runner to pick up,
/// nothing to regenerate, and the behaviour is identical.
///
/// Two of these codecs are load-bearing rather than mechanical and are worth
/// reading before changing:
///   • [RosterStudentDto.decodeList] — the PII fail-closed guard.
///   • [DailyAttendanceDto] — an unreadable status decodes to "unmarked", never
///     to a guessed present/absent.
library;

import '../../domain/attendance_class.dart';
import '../../domain/attendance_date.dart';
import '../../domain/attendance_record.dart';
import '../../domain/roster_student.dart';
import '../attendance_errors.dart';

// ─── POST /api/attendance/classes ────────────────────────────────────────────

/// Serialises the create-class body. `section` is omitted rather than sent as
/// null when absent, so the server applies its own `|| undefined` handling.
///
/// Pinned against `src/app/api/attendance/classes/route.ts` (`CreateClassSchema`)
/// in `sahayakai-main`.
class CreateClassRequestDto {
  const CreateClassRequestDto({
    required this.name,
    required this.subject,
    required this.gradeLevel,
    required this.academicYear,
    this.section,
  });

  /// Typed builder — trims every field and drops a blank section, mirroring
  /// `CreateOutreachRequestDto.build`.
  factory CreateClassRequestDto.build({
    required String name,
    required String subject,
    required String gradeLevel,
    required String academicYear,
    String? section,
  }) {
    return CreateClassRequestDto(
      name: name.trim(),
      subject: subject.trim(),
      gradeLevel: gradeLevel.trim(),
      academicYear: academicYear.trim(),
      section: _clean(section),
    );
  }

  final String name;
  final String subject;
  final String gradeLevel;
  final String academicYear;
  final String? section;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'name': name,
        'subject': subject,
        'gradeLevel': gradeLevel,
        'academicYear': academicYear,
        if (section != null) 'section': section,
      };
}

/// Decodes the create route's `{ classId }` reply.
class CreateClassResponseDto {
  const CreateClassResponseDto({this.classId});

  factory CreateClassResponseDto.fromJson(Map<String, dynamic> json) =>
      CreateClassResponseDto(classId: json['classId'] as String?);

  final String? classId;

  /// The trimmed id, or empty string when absent — the repository treats an
  /// empty id as a malformed success and throws.
  String get id => classId?.trim() ?? '';
}

// ─── GET /api/attendance/classes ─────────────────────────────────────────────

/// Decodes one `ClassRecord` from the class list or the class-detail route.
///
/// `teacherUid` is read and discarded on purpose: it is a server-trusted
/// ownership field the client can neither choose nor verify, so it is not
/// carried into the domain (see `AttendanceClass`).
class AttendanceClassDto {
  const AttendanceClassDto({
    this.id,
    this.name,
    this.subject,
    this.gradeLevel,
    this.section,
    this.academicYear,
    this.studentCount,
    this.createdAt,
    this.updatedAt,
  });

  factory AttendanceClassDto.fromJson(Map<String, dynamic> json) {
    return AttendanceClassDto(
      id: json['id'] as String?,
      name: json['name'] as String?,
      subject: json['subject'] as String?,
      gradeLevel: json['gradeLevel'] as String?,
      section: json['section'] as String?,
      academicYear: json['academicYear'] as String?,
      studentCount: json['studentCount'] as num?,
      createdAt: json['createdAt'] as String?,
      updatedAt: json['updatedAt'] as String?,
    );
  }

  final String? id;
  final String? name;
  final String? subject;
  final String? gradeLevel;
  final String? section;
  final String? academicYear;
  final num? studentCount;
  final String? createdAt;
  final String? updatedAt;

  AttendanceClass toDomain() => AttendanceClass(
        id: id?.trim() ?? '',
        name: name?.trim() ?? '',
        subject: subject?.trim() ?? '',
        gradeLevel: gradeLevel?.trim() ?? '',
        academicYear: academicYear?.trim() ?? '',
        section: _clean(section),
        studentCount: studentCount?.toInt() ?? 0,
        createdAt: _clean(createdAt),
        updatedAt: _clean(updatedAt),
      );

  /// Decodes a class-list body, dropping entries that carry no id (an entry
  /// with no id cannot address any nested route, so keeping it would only
  /// produce a row that 404s when tapped).
  static List<AttendanceClass> decodeList(dynamic json) {
    if (json is! List) return const <AttendanceClass>[];
    return json
        .whereType<Map>()
        .map((e) => AttendanceClassDto.fromJson(e.cast<String, dynamic>()))
        .map((dto) => dto.toDomain())
        .where((c) => c.id.isNotEmpty)
        .toList(growable: false);
  }
}

// ─── POST /api/attendance/classes/{classId}/students ─────────────────────────

/// Serialises the add-student body.
///
/// **This DTO does carry `parentPhone`, and that is not a contradiction of the
/// F9-001 masking rule.** The direction is what matters: here the teacher is
/// *entering* a number the server does not yet have, so it must travel up. What
/// F9-001 forbids is the number travelling back *down* to the handset, which is
/// why the roster projection masks it and [RosterStudentDto] fails closed
/// rather than accept an unmasked reply.
///
/// Pinned against `.../students/route.ts` (`AddStudentSchema`) and the
/// service's range checks.
class AddStudentRequestDto {
  const AddStudentRequestDto({
    required this.name,
    required this.rollNumber,
    required this.parentPhone,
    required this.parentLanguage,
  });

  /// Typed builder that enforces the roll-number rule client-side before the
  /// request is built at all. Throws [ArgumentError] on a roll number the
  /// server would 400 — the caller is expected to have validated with
  /// `ClassCapacity.checkRollNumber` and shown the teacher an inline message
  /// first; reaching this is a programming error, not a user error.
  factory AddStudentRequestDto.build({
    required String name,
    required num rollNumber,
    required String parentPhone,
    required String parentLanguage,
  }) {
    final problem = ClassCapacity.checkRollNumber(rollNumber);
    if (problem != null) {
      throw ArgumentError.value(
        rollNumber,
        'rollNumber',
        'must be a whole number from ${ClassCapacity.minRollNumber} to '
            '${ClassCapacity.maxRollNumber} ($problem)',
      );
    }
    return AddStudentRequestDto(
      name: name.trim(),
      rollNumber: rollNumber.toInt(),
      parentPhone: parentPhone.trim(),
      parentLanguage: parentLanguage.trim(),
    );
  }

  final String name;
  final int rollNumber;

  /// As typed by the teacher. The server normalizes to E.164 and 400s on
  /// anything that is not a 10-digit Indian mobile (with or without `91`).
  final String parentPhone;

  /// Full language name (e.g. `"Kannada"`).
  final String parentLanguage;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'name': name,
        'rollNumber': rollNumber,
        'parentPhone': parentPhone,
        'parentLanguage': parentLanguage,
      };
}

/// Decodes the add-student route's `{ studentId }` reply.
class AddStudentResponseDto {
  const AddStudentResponseDto({this.studentId});

  factory AddStudentResponseDto.fromJson(Map<String, dynamic> json) =>
      AddStudentResponseDto(studentId: json['studentId'] as String?);

  final String? studentId;

  String get id => studentId?.trim() ?? '';
}

// ─── GET .../students?projection=roster ──────────────────────────────────────

/// Decodes the **masked** roster projection — and refuses anything else.
///
/// THE FAIL-CLOSED RULE
///
/// The masked projection is draft PR #124 and is not merged. Against today's
/// production route the `projection` query parameter is unknown and therefore
/// ignored, so the reply is the FULL student document: `parentPhone` in E.164,
/// for every student in the class. Decoding leniently — "take the fields I
/// recognise, ignore the rest" — would put those numbers on the handset the
/// first time this ran against production, silently, with nothing in the app to
/// show for it.
///
/// So [decodeList] validates that what came back is the masked shape and throws
/// [RosterProjectionUnavailableException] when it is not:
///
///   • the body must be a list of objects;
///   • every entry's key set must be **exactly** the six projection fields —
///     an allowlist, not a `parentPhone` denylist, so a PII field added to
///     `Student` later cannot ride along on a name nobody thought to ban
///     (the server-side projection is built the same way, by naming fields);
///   • `id`, `name`, `rollNumber` and `hasParentPhone` must be present and
///     well-typed;
///   • `parentPhoneLast4` must be at most four digits — a longer value means
///     the masking did not happen.
///
/// The thrown error never quotes the body. An error string carrying the phone
/// numbers is the same leak by a slower route.
class RosterStudentDto {
  const RosterStudentDto({
    required this.id,
    required this.name,
    required this.rollNumber,
    required this.parentLanguage,
    required this.hasParentPhone,
    required this.parentPhoneLast4,
  });

  /// The exact six fields `?projection=roster` returns. Anything else in an
  /// entry means this is not the masked projection.
  static const Set<String> rosterFields = <String>{
    'id',
    'name',
    'rollNumber',
    'parentLanguage',
    'hasParentPhone',
    'parentPhoneLast4',
  };

  final String id;
  final String name;
  final num rollNumber;
  final String parentLanguage;
  final bool hasParentPhone;

  /// `''` on the wire when there is no number, or fewer than four digits.
  final String parentPhoneLast4;

  RosterStudent toDomain() => RosterStudent(
        id: id.trim(),
        name: name.trim(),
        rollNumber: rollNumber.toInt(),
        parentLanguage: parentLanguage.trim(),
        hasParentPhone: hasParentPhone,
        // '' means "nothing safe to show"; normalised to null so the UI has one
        // absent case, not two.
        parentPhoneLast4: _clean(parentPhoneLast4),
      );

  /// Decodes a masked roster body, or throws
  /// [RosterProjectionUnavailableException]. Never returns a partially
  /// validated list: one bad entry fails the whole read, because a roster that
  /// silently dropped the students it could not mask is a roster the teacher
  /// would act on as if it were complete.
  static List<RosterStudent> decodeList(dynamic json) {
    if (json is! List) {
      throw RosterProjectionUnavailableException(reason: 'shape');
    }
    final students = <RosterStudent>[];
    for (final entry in json) {
      if (entry is! Map) {
        throw RosterProjectionUnavailableException(reason: 'shape');
      }
      final map = entry.cast<String, dynamic>();

      // Allowlist: exactly the six fields, no more and no fewer. An unmasked
      // document fails on the extra keys (parentPhone, classId, createdAt…);
      // a truncated one fails on the missing.
      if (map.length != rosterFields.length ||
          !rosterFields.containsAll(map.keys)) {
        throw RosterProjectionUnavailableException(reason: 'unmasked');
      }

      final id = map['id'];
      final name = map['name'];
      final rollNumber = map['rollNumber'];
      final parentLanguage = map['parentLanguage'];
      final hasParentPhone = map['hasParentPhone'];
      final last4 = map['parentPhoneLast4'];

      if (id is! String ||
          name is! String ||
          rollNumber is! num ||
          parentLanguage is! String ||
          hasParentPhone is! bool ||
          last4 is! String) {
        throw RosterProjectionUnavailableException(reason: 'shape');
      }
      // A "mask" longer than four characters, or one holding anything but
      // digits, is not a mask.
      if (last4.length > 4 || !_digitsOnly.hasMatch(last4)) {
        throw RosterProjectionUnavailableException(reason: 'unmasked');
      }

      students.add(
        RosterStudentDto(
          id: id,
          name: name,
          rollNumber: rollNumber,
          parentLanguage: parentLanguage,
          hasParentPhone: hasParentPhone,
          parentPhoneLast4: last4,
        ).toDomain(),
      );
    }
    return List<RosterStudent>.unmodifiable(students);
  }

  static final RegExp _digitsOnly = RegExp(r'^\d*$');
}

// ─── .../records ─────────────────────────────────────────────────────────────

/// Serialises the save-register body: `{ date, records }`, where `records` is
/// `studentId → status`.
///
/// The server re-validates every key against the class's real student ids and
/// every value against the status enum (forensic fix H9) — this DTO does not
/// pretend to be that check, it only guarantees the shape and the tokens.
class SaveAttendanceRequestDto {
  const SaveAttendanceRequestDto({required this.date, required this.statuses});

  final AttendanceDate date;
  final Map<String, AttendanceStatus> statuses;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'date': date.wire,
        'records': <String, String>{
          for (final entry in statuses.entries) entry.key: entry.value.wire,
        },
      };
}

/// Decodes one `DailyAttendanceRecord`.
///
/// An entry whose status is not `present` / `absent` / `late` is DROPPED, not
/// defaulted — the student then reads as unmarked, which is how the server's
/// own rollup treats a missing key. See `AttendanceStatus.fromWire`.
class DailyAttendanceDto {
  const DailyAttendanceDto({
    this.classId,
    this.date,
    this.records,
    this.submittedAt,
    this.isFinalized,
  });

  factory DailyAttendanceDto.fromJson(Map<String, dynamic> json) {
    return DailyAttendanceDto(
      classId: json['classId'] as String?,
      date: json['date'] as String?,
      records: json['records'] is Map
          ? (json['records'] as Map).cast<String, dynamic>()
          : null,
      submittedAt: json['submittedAt'] as String?,
      isFinalized: json['isFinalized'] as bool?,
    );
  }

  final String? classId;
  final String? date;
  final Map<String, dynamic>? records;
  final String? submittedAt;
  final bool? isFinalized;

  /// null when the body carried no usable date — the record is addressed by
  /// date, so one without a readable date cannot be placed in the register.
  DailyAttendance? toDomain({AttendanceDate? fallbackDate}) {
    final on = AttendanceDate.tryParse(date) ?? fallbackDate;
    if (on == null) return null;

    final statuses = <String, AttendanceStatus>{};
    records?.forEach((studentId, raw) {
      final status = AttendanceStatus.fromWire(raw is String ? raw : null);
      if (status != null && studentId.trim().isNotEmpty) {
        statuses[studentId] = status;
      }
    });

    return DailyAttendance(
      classId: classId?.trim() ?? '',
      date: on,
      statuses: Map<String, AttendanceStatus>.unmodifiable(statuses),
      submittedAt: _clean(submittedAt),
      isFinalized: isFinalized ?? false,
    );
  }

  /// Decodes `GET .../records?date=` — the body is the record, or JSON null
  /// when that day has not been marked.
  static DailyAttendance? decodeOne(dynamic json, {AttendanceDate? forDate}) {
    if (json is! Map) return null;
    return DailyAttendanceDto.fromJson(json.cast<String, dynamic>())
        .toDomain(fallbackDate: forDate);
  }

  /// Decodes `GET .../records?year=&month=` — an object keyed by `YYYY-MM-DD`.
  /// The key is the authoritative date (it is the Firestore doc id), so it is
  /// used as the fallback when an entry's `date` field is missing.
  static Map<AttendanceDate, DailyAttendance> decodeMonth(dynamic json) {
    if (json is! Map) return const <AttendanceDate, DailyAttendance>{};
    final byDate = <AttendanceDate, DailyAttendance>{};
    json.forEach((key, value) {
      final on = AttendanceDate.tryParse(key is String ? key : null);
      if (on == null || value is! Map) return;
      final record = DailyAttendanceDto.fromJson(value.cast<String, dynamic>())
          .toDomain(fallbackDate: on);
      if (record != null) byDate[on] = record;
    });
    return Map<AttendanceDate, DailyAttendance>.unmodifiable(byDate);
  }
}

// ─── .../summaries ───────────────────────────────────────────────────────────

/// Decodes one `StudentAttendanceSummary`.
class StudentAttendanceSummaryDto {
  const StudentAttendanceSummaryDto({
    this.studentId,
    this.studentName,
    this.rollNumber,
    this.totalDays,
    this.presentDays,
    this.absentDays,
    this.lateDays,
    this.attendanceRate,
    this.consecutiveAbsences,
  });

  factory StudentAttendanceSummaryDto.fromJson(Map<String, dynamic> json) {
    return StudentAttendanceSummaryDto(
      studentId: json['studentId'] as String?,
      studentName: json['studentName'] as String?,
      rollNumber: json['rollNumber'] as num?,
      totalDays: json['totalDays'] as num?,
      presentDays: json['presentDays'] as num?,
      absentDays: json['absentDays'] as num?,
      lateDays: json['lateDays'] as num?,
      attendanceRate: json['attendanceRate'] as num?,
      consecutiveAbsences: json['consecutiveAbsences'] as num?,
    );
  }

  final String? studentId;
  final String? studentName;
  final num? rollNumber;
  final num? totalDays;
  final num? presentDays;
  final num? absentDays;
  final num? lateDays;
  final num? attendanceRate;
  final num? consecutiveAbsences;

  StudentAttendanceSummary toDomain() => StudentAttendanceSummary(
        studentId: studentId?.trim() ?? '',
        studentName: studentName?.trim() ?? '',
        rollNumber: rollNumber?.toInt() ?? 0,
        totalDays: totalDays?.toInt() ?? 0,
        presentDays: presentDays?.toInt() ?? 0,
        absentDays: absentDays?.toInt() ?? 0,
        lateDays: lateDays?.toInt() ?? 0,
        // The server defaults an empty month to 100, not 0 — an unmarked month
        // must not read as "nobody attended".
        attendanceRate: attendanceRate?.toInt() ?? 100,
        consecutiveAbsences: consecutiveAbsences?.toInt() ?? 0,
      );

  static List<StudentAttendanceSummary> decodeList(dynamic json) {
    if (json is! List) return const <StudentAttendanceSummary>[];
    return json
        .whereType<Map>()
        .map(
          (e) => StudentAttendanceSummaryDto.fromJson(e.cast<String, dynamic>())
              .toDomain(),
        )
        .where((s) => s.studentId.isNotEmpty)
        .toList(growable: false);
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

String? _clean(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}

/// Decodes a bare `string[]` body — used by the absence-dates route (which
/// returns `YYYY-MM-DD` strings) and the behavioural-outreach route (studentIds).
/// Non-strings and blanks are dropped.
List<String> decodeStringList(dynamic json) {
  if (json is! List) return const <String>[];
  return json
      .whereType<String>()
      .map((e) => e.trim())
      .where((e) => e.isNotEmpty)
      .toList(growable: false);
}
