import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/network/api_exception.dart';
import '../../attendance/data/attendance_errors.dart';
import '../../attendance/data/attendance_repository.dart';
import '../../attendance/domain/attendance_class.dart';
import '../domain/hotline_roster.dart';
import '../domain/hotline_student.dart';

/// An explicitly SUPPLIED roster, or null when nothing was supplied.
///
/// This is the injection seam, not the data source. Widget tests stand a fixed
/// list behind the picker with it to exercise the rows, the no-parent-phone
/// disabled row, and the last-4 mask. `null` (the default) means "nothing was
/// supplied — go and read it", which is what [hotlineRosterProvider] does. An
/// empty LIST is a real answer ("this teacher has no students").
final hotlineStudentRosterProvider = Provider<List<HotlineStudent>?>(
  (ref) => null,
);

/// The teacher's classes and their students for the Parent Hotline picker —
/// supplied if something supplied it, otherwise read from the real routes.
///
/// WHAT IT READS
///
/// `GET /api/attendance/classes`, then for every class the **masked**
/// projection `GET /api/attendance/classes/{classId}/students?projection=roster`
/// — the six-field shape `{ id, name, rollNumber, parentLanguage,
/// hasParentPhone, parentPhoneLast4 }` built server-side by `getStudentRoster`.
/// It is decoded by `RosterStudentDto.decodeList`, which still fails closed if
/// a deployment ever answers with the unmasked documents.
///
/// The client never needs the parent phone (F9-001): `POST .../outreach` reads
/// it from the student record and `POST .../call` from the outreach record.
///
/// IN PARALLEL, AND PER CLASS
///
/// The class reads run concurrently, and each one settles on its own: a class
/// whose read fails is returned with its [HotlineClassRoster.error] instead of
/// failing the picker. Two failures are still whole-picker answers, because
/// they are about the teacher or the deployment rather than one class: a 401
/// (signed out), and every class failing closed on the masked projection.
///
/// Each class's `subject` travels with its students, because the message draft
/// requires a subject and a class name is not one.
final hotlineRosterProvider = FutureProvider<List<HotlineClassRoster>>((ref) {
  final supplied = ref.watch(hotlineStudentRosterProvider);
  // Returned synchronously (FutureOr), so a supplied roster lands as AsyncData
  // on the first frame instead of flashing a skeleton.
  if (supplied != null) return groupSuppliedRoster(supplied);

  // A signed-out teacher has nothing to fetch; the screen renders this as the
  // sign-in prompt, never as a load failure (and never shows its text).
  if (!ref.watch(isSignedInProvider)) {
    throw const ApiException(
      ApiErrorKind.unauthorized,
      'signed-out',
      statusCode: 401,
    );
  }

  return _readRosters(ref.watch(attendanceRepositoryProvider));
});

/// A supplied flat list, grouped by class in first-seen order.
List<HotlineClassRoster> groupSuppliedRoster(List<HotlineStudent> students) {
  final order = <String>[];
  final byClass = <String, List<HotlineStudent>>{};
  final names = <String, String>{};
  final subjects = <String, String?>{};
  for (final s in students) {
    if (!byClass.containsKey(s.classId)) {
      order.add(s.classId);
      byClass[s.classId] = <HotlineStudent>[];
      names[s.classId] = s.className;
      subjects[s.classId] = s.subject;
    }
    byClass[s.classId]!.add(s);
  }
  return [
    for (final id in order)
      HotlineClassRoster(
        classId: id,
        className: names[id]!,
        subject: subjects[id],
        students: List<HotlineStudent>.unmodifiable(byClass[id]!),
      ),
  ];
}

Future<List<HotlineClassRoster>> _readRosters(AttendanceRepository repo) async {
  final classes = await repo.listClasses();
  if (classes.isEmpty) return const <HotlineClassRoster>[];

  final rosters = await Future.wait([
    for (final klass in classes) _readClass(repo, klass),
  ]);

  // Whole-picker answers (see the provider doc).
  for (final r in rosters) {
    final e = r.error;
    if (e is ApiException && e.isAuth) throw e;
  }
  if (rosters.every((r) => r.error is RosterProjectionUnavailableException)) {
    throw rosters.first.error!;
  }
  return List<HotlineClassRoster>.unmodifiable(rosters);
}

Future<HotlineClassRoster> _readClass(
  AttendanceRepository repo,
  AttendanceClass klass,
) async {
  final subject = klass.subject.trim().isEmpty ? null : klass.subject.trim();
  try {
    final roster = await repo.listRoster(klass.id);
    return HotlineClassRoster(
      classId: klass.id,
      className: klass.name,
      subject: subject,
      students: List<HotlineStudent>.unmodifiable([
        for (final student in roster)
          // The class identity and subject come from the class record: the
          // roster projection does not repeat them per student.
          student.toHotlineStudent(
            classId: klass.id,
            className: klass.name,
            subject: subject,
          ),
      ]),
    );
  } catch (error) {
    return HotlineClassRoster(
      classId: klass.id,
      className: klass.name,
      subject: subject,
      error: error,
    );
  }
}
