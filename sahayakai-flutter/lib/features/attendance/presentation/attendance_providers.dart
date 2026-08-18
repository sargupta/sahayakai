import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/attendance_repository.dart';
import '../domain/attendance_class.dart';
import '../domain/attendance_date.dart';
import '../domain/attendance_record.dart';
import '../domain/roster_student.dart';

/// The read side of Attendance, as five hand-written providers.
///
/// WHY THESE ARE PLAIN PROVIDERS AND NOT `@riverpod`
///
/// The same reason `attendanceRepositoryProvider` and `attendance_dtos.dart`
/// are hand-written: this unit must not run `build_runner` (the parent
/// serialises codegen), and a hand-written `.g.dart` that build_runner would
/// later regenerate is a merge conflict waiting to happen. A plain
/// [FutureProvider] composes the identical seams a generated one would and is
/// overridden in a test with `overrideWith` exactly the same way.
///
/// WHY NONE OF THEM IS `autoDispose`
///
/// Every one of these is invalidated EXPLICITLY after the write that
/// invalidates it (create class, add student, save register), so a cached
/// entry is never stale for a reason the app cannot see. Keeping them alive
/// also means the add-student form can read the roster the roster screen
/// already fetched — including its FAILURE — instead of firing a second
/// request for a list the app has just been told it may not have. The families
/// are keyed by classId (and a date or a month), so the cache is bounded by
/// the number of classes a teacher actually opens.
///
/// The WRITE side deliberately has no provider. All three writes are premium
/// gated, and `AttendanceWriteBlockedByPlan` arrives as a VALUE that the
/// screen renders as an upsell in place of its form; that is per-screen state,
/// not shared state, so each form calls
/// `ref.read(attendanceRepositoryProvider)` directly and holds the outcome
/// itself. See `domain/attendance_write_result.dart`.

/// The teacher's own classes, newest first. Read-only, so no plan gate.
///
/// Invalidated after a successful `createClass`.
final attendanceClassesProvider = FutureProvider<List<AttendanceClass>>(
  (ref) => ref.watch(attendanceRepositoryProvider).listClasses(),
);

/// One class's roster in the **masked** projection.
///
/// This is the provider that currently FAILS, on purpose: `listRoster` throws
/// `RosterProjectionUnavailableException` until the masked
/// `?projection=roster` endpoint (draft PR #124) merges, because production
/// still answers with unmasked parent phone numbers and the repository refuses
/// to decode them. A screen watching this must render that one error as its
/// own dignified state, NOT as a generic failure — see
/// `attendance_roster_screen.dart`.
///
/// Invalidated after a successful `addStudent`.
final attendanceRosterProvider =
    FutureProvider.family<List<RosterStudent>, String>(
      (ref, classId) =>
          ref.watch(attendanceRepositoryProvider).listRoster(classId),
    );

/// One day's register for one class, or null when that day is unmarked.
///
/// The key is a record, so two identical (classId, date) pairs are the same
/// family entry without a hand-written key class.
///
/// Invalidated after a successful `saveAttendance` for that day.
final dailyRegisterProvider =
    FutureProvider.family<
      DailyAttendance?,
      ({String classId, AttendanceDate date})
    >(
      (ref, key) => ref
          .watch(attendanceRepositoryProvider)
          .attendanceOn(key.classId, key.date),
    );

/// Per-student monthly rollups, computed server-side.
///
/// This is also **the register's student list**, and that is a deliberate
/// choice rather than a shortcut. The roster route cannot be read yet (see
/// [attendanceRosterProvider]), but a summary carries exactly the three fields
/// a register row needs — `studentId`, `studentName`, `rollNumber` — and
/// carries no contact detail at all, so it is both available today and the
/// safer of the two sources. The server includes every student in the class,
/// marked or not (an unmarked month defaults to a 100% rate rather than being
/// omitted), so the list is complete rather than "whoever has been marked".
///
/// Invalidated after a successful `saveAttendance` in that month.
final monthlySummariesProvider =
    FutureProvider.family<
      List<StudentAttendanceSummary>,
      ({String classId, int year, int month})
    >(
      (ref, key) => ref
          .watch(attendanceRepositoryProvider)
          .studentSummaries(key.classId, year: key.year, month: key.month),
    );

/// The dates one student was marked absent, newest first.
///
/// [AbsenceQuery.limitDays] is computed by the caller from the month on
/// screen: the route counts back from today, so a month the teacher has
/// scrolled back to needs a longer reach than the route's 30-day default, and
/// the caller filters the reply down to the month it asked about.
final studentAbsencesProvider =
    FutureProvider.family<List<AttendanceDate>, AbsenceQuery>(
      (ref, query) => ref
          .watch(attendanceRepositoryProvider)
          .absenceDates(
            query.classId,
            query.studentId,
            limitDays: query.limitDays,
          ),
    );

/// The family key for [studentAbsencesProvider].
///
/// A class rather than a record only because it carries a derived
/// [limitDays]; value equality is written out so two equal queries hit one
/// cache entry.
class AbsenceQuery {
  const AbsenceQuery({
    required this.classId,
    required this.studentId,
    required this.limitDays,
  });

  final String classId;
  final String studentId;

  /// How many days back the route should reach. Clamped by the caller so a
  /// far-back month cannot ask the server for an unbounded scan.
  final int limitDays;

  @override
  bool operator ==(Object other) =>
      other is AbsenceQuery &&
      other.classId == classId &&
      other.studentId == studentId &&
      other.limitDays == limitDays;

  @override
  int get hashCode => Object.hash(classId, studentId, limitDays);
}
