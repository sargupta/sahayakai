import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/network/api_exception.dart';
import '../../attendance/data/attendance_repository.dart';
import '../domain/hotline_student.dart';

/// An explicitly SUPPLIED roster, or null when nothing was supplied.
///
/// This is the injection seam, not the data source. Two callers use it:
///   • the attendance hand-off, which already holds the masked roster it just
///     read and should not make the hotline read it a second time;
///   • widget tests, which stand a fixed list behind the picker to exercise the
///     rows, the no-parent-phone disabled row, and the last-4 mask.
///
/// `null` (the default) means "nothing was supplied — go and read it", which is
/// what [hotlineRosterProvider] does. An empty LIST is therefore a real answer
/// ("this teacher has no students"), distinct from "nobody supplied one", which
/// is exactly the distinction a sentinel of `const []` used to destroy.
final hotlineStudentRosterProvider = Provider<List<HotlineStudent>?>(
  (ref) => null,
);

/// The teacher's roster for the Parent Hotline `pickStudent` stage (SPEC §B.1
/// stage 1) — supplied if something supplied it, otherwise read from the real
/// students endpoint.
///
/// WHAT IT READS, AND WHAT IT REFUSES TO READ
///
/// It reads the **masked** projection and only the masked projection:
/// `GET /api/attendance/classes/{classId}/students?projection=roster`, the
/// six-field shape `{ id, name, rollNumber, parentLanguage, hasParentPhone,
/// parentPhoneLast4 }`, decoded by `RosterStudentDto.decodeList` and bridged to
/// [HotlineStudent] by `RosterStudent.toHotlineStudent`. Both already exist in
/// `features/attendance` and are reused verbatim; there is deliberately no
/// second roster DTO here.
///
/// That projection ships in draft PR #124 and is **not merged**. Against
/// `origin/main` today the route is `getStudents(userId, classId)`, which
/// ignores the unknown `projection` parameter and returns the whole student
/// document — every parent's full E.164 `parentPhone`, for every student in the
/// class. The decoder validates the shape it got and throws
/// [RosterProjectionUnavailableException] rather than decode that, so this
/// provider is in an ERROR state on production today, not an empty one. The
/// screen renders it as "the roster needs a server change", which is true;
/// rendering an empty list instead would read as "this teacher has no
/// students", which is a lie the teacher would act on.
///
/// THE CLIENT NEVER NEEDS THE PARENT PHONE (F9-001)
///
/// The masked projection withholds the number, and the hotline does not need
/// it. Both call-path routes resolve it server-side from the ids the client
/// does send, verified against `origin/main`:
///
///   • `POST /api/attendance/outreach` reads
///     `classes/{classId}/students/{studentId}.parentPhone` itself and stores it
///     on the outreach doc — the comment there is explicit that a `parentPhone`
///     in the request body is IGNORED, because trusting it would let a caller
///     dial an arbitrary number through the project's Twilio account.
///   • `POST /api/attendance/call` re-reads `parent_outreach/{id}.parentPhone`
///     off that doc and dials it, after checking `outreach.teacherUid`.
///
/// So the client's whole contribution to placing a call is `{ studentId }` on
/// create and `{ outreachId, parentLanguage }` on dial. There is no path on
/// which the handset needs the number, and therefore no reason to un-mask —
/// this is not a limitation to work around, it is the design.
///
/// WHY THE READS ARE SEQUENTIAL
///
/// The picker filters across all of the teacher's classes, so the roster is the
/// concatenation of one read per class. They run in order rather than in
/// parallel because the first failure is the answer: on production the first
/// class already fails closed, and issuing four more requests to be refused
/// four more times costs a rural connection something and buys nothing. One
/// class failing fails the whole read for the same reason `decodeList` refuses a
/// partial list — a roster missing the students it could not load is a roster
/// the teacher would act on as if it were complete.
final hotlineRosterProvider = FutureProvider<List<HotlineStudent>>((ref) {
  final supplied = ref.watch(hotlineStudentRosterProvider);
  // Returned synchronously (FutureOr), so a supplied roster lands as AsyncData
  // on the first frame instead of flashing a skeleton. A supplied roster also
  // skips the sign-in guard below: it is data the app already holds, not a
  // request that needs a token.
  if (supplied != null) return supplied;

  // A signed-out teacher has nothing to fetch. Refusing here rather than
  // spending a round trip to be told 401 costs a rural connection nothing and
  // reaches the screen as the same auth error the route would have produced —
  // which the screen renders as the sign-in prompt, not as a load failure.
  if (!ref.watch(isSignedInProvider)) {
    throw const ApiException(
      ApiErrorKind.unauthorized,
      'Please sign in again.',
      statusCode: 401,
    );
  }

  return _readMaskedRoster(ref.watch(attendanceRepositoryProvider));
});

Future<List<HotlineStudent>> _readMaskedRoster(
  AttendanceRepository repo,
) async {
  final classes = await repo.listClasses();
  if (classes.isEmpty) return const <HotlineStudent>[];

  final students = <HotlineStudent>[];
  for (final klass in classes) {
    // Throws RosterProjectionUnavailableException when the reply is not the
    // masked shape. Deliberately NOT caught: see the fail-closed note above.
    final roster = await repo.listRoster(klass.id);
    for (final student in roster) {
      students.add(
        // The class identity comes from the class record because the roster
        // projection does not repeat it per student.
        student.toHotlineStudent(classId: klass.id, className: klass.name),
      );
    }
  }
  return List<HotlineStudent>.unmodifiable(students);
}
