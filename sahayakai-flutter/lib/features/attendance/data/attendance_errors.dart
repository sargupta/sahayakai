import '../../../core/network/api_exception.dart';
import '../domain/attendance_class.dart';
import '../domain/attendance_date.dart';

/// Typed, branchable domain errors for the Attendance data layer.
///
/// Same shape and same discipline as `parent_hotline_errors.dart`: the
/// repository translates the transport-level [ApiException] (which the shared
/// `ApiClient` already maps from Dio) into one of these wherever a controller
/// needs to branch on the *reason* rather than on a status code and a string.
///
/// HOW THE SERVER SPELLS ITS ERRORS
///
/// `attendanceErrorStatus` in `src/server/attendance.ts` maps thrown `Error`
/// messages to statuses and returns `{ error: <that same message> }`. So for
/// this feature the body's `error` field is simultaneously the user-facing line
/// and the machine code, and `ApiException.errorCode` carries it verbatim.
/// Matching on it is therefore matching on the server's own constants, not on
/// prose the server might reword — but the matches below are anchored to the
/// stable *prefixes* the service's own `VALIDATION_PATTERNS` regexes use, so a
/// reworded tail (or the en-dash in `Roll number must be 1–40`) cannot break
/// them.
///
/// What is and isn't wrapped:
///   • 403 `PREMIUM_REQUIRED` → [PremiumRequiredException]. Note the write
///     paths do not surface this as an error at all — the repository returns
///     `AttendanceWriteBlockedByPlan` instead (see
///     `domain/attendance_write_result.dart`); the type exists so the mapping
///     is expressible and testable in one place.
///   • 403 `Unauthorized` (ownership) → NOT wrapped. Rethrown as the original
///     [ApiException], exactly as `parent_hotline` leaves an ownership 403.
///   • 404 → [ClassNotFoundException] / [StudentNotFoundException] /
///     [TeacherProfileNotFoundException].
///   • 400 → [ClassFullException], [RollNumberOutOfRangeException],
///     [InvalidParentPhoneException], [AttendanceDateOutOfWindowException], or
///     [AttendanceValidationException] for the rest.
///   • [RosterProjectionUnavailableException] is raised by the roster decoder
///     rather than mapped from a status — it is the PII fail-closed guard.
///   • Everything else — including **401 (signed-out / auth)**, 5xx, network
///     and timeout — is rethrown as-is. Auth stays an [ApiException] so the
///     feature's `authStateProvider` gate handles it uniformly with every other
///     repository (`error is ApiException && error.isAuth`).
///
/// [AttendanceException] is `sealed`, so a controller can switch over it
/// exhaustively.
sealed class AttendanceException implements Exception {
  const AttendanceException(this.cause);

  /// The underlying transport error, retained for its user-safe [message], the
  /// raw Dio object, and the status code. Synthesized for the two errors the
  /// client raises before or instead of a request
  /// ([AttendanceDateOutOfWindowException.local],
  /// [RosterProjectionUnavailableException]).
  final ApiException cause;

  /// The server's user-safe message (or a sensible fallback).
  String get message => cause.message;

  @override
  String toString() => '$runtimeType(${cause.statusCode}): $message';

  // ── Mapping factory ────────────────────────────────────────────────────────

  /// Maps an [ApiException] from any `/api/attendance/*` route to a typed
  /// error, or returns null to signal "not a case we specialize — rethrow the
  /// original" (401 auth, ownership 403, 5xx, network…).
  static AttendanceException? fromRoute(ApiException e) {
    final code = e.errorCode?.trim() ?? '';
    switch (e.statusCode) {
      case 403:
        // Only the plan gate is specialized. An ownership `Unauthorized` 403 is
        // a genuine access error and keeps its transport type.
        if (code == premiumRequiredCode) return PremiumRequiredException(e);
        return null;
      case 404:
        return switch (code) {
          'Class not found' => ClassNotFoundException(e),
          'Student not found in this class' => StudentNotFoundException(e),
          'User not found' => TeacherProfileNotFoundException(e),
          _ => null,
        };
      case 400:
        return _fromValidation(e, code);
      default:
        return null;
    }
  }

  static AttendanceException _fromValidation(ApiException e, String code) {
    if (code == 'Maximum $_maxStudents students per class') {
      return ClassFullException(e);
    }
    // Covers both `Roll number must be an integer` and the range message,
    // whose `1–40` uses an en-dash — matched by prefix so the dash never has to
    // survive a round trip through this file.
    if (code.startsWith('Roll number must be')) {
      return RollNumberOutOfRangeException(e);
    }
    if (code.startsWith('Invalid phone number')) {
      return InvalidParentPhoneException(e);
    }
    if (code.startsWith('Cannot mark attendance for future')) {
      return AttendanceDateOutOfWindowException(
        e,
        rejection: AttendanceDateRejection.future,
      );
    }
    if (code.startsWith('Cannot mark attendance older than')) {
      return AttendanceDateOutOfWindowException(
        e,
        rejection: AttendanceDateRejection.tooOld,
      );
    }
    // `Class name is required`, `Academic year is required`, `Student name …`,
    // `Too many attendance entries`, `Unknown student in attendance records`,
    // `Invalid attendance status`, plus the route shells' `Invalid request
    // body` / `Invalid query parameters` / `Invalid date`.
    return AttendanceValidationException(e);
  }

  /// The exact machine string `requireProPlan` throws for a non-advanced plan.
  static const String premiumRequiredCode = 'PREMIUM_REQUIRED';

  static const int _maxStudents = ClassCapacity.maxStudents;
}

/// 403 — the teacher is not on an advanced/premium plan. Every attendance
/// WRITE is gated (`createClass`, `addStudent`, `saveAttendance`); reads are
/// not. Writes surface this as `AttendanceWriteBlockedByPlan` rather than
/// throwing it.
final class PremiumRequiredException extends AttendanceException {
  const PremiumRequiredException(super.cause);
}

/// 404 `Class not found` — usually a stale `classId` after the class was
/// deleted on another device. The class list needs a refresh.
final class ClassNotFoundException extends AttendanceException {
  const ClassNotFoundException(super.cause);
}

/// 404 `Student not found in this class` — a stale `studentId`, or a student
/// removed from the roster since it was fetched.
final class StudentNotFoundException extends AttendanceException {
  const StudentNotFoundException(super.cause);
}

/// 404 `User not found` — `requireProPlan` could not read the caller's profile
/// document. Distinct from a 401: the token is valid, the `users/{uid}` doc is
/// missing, which is an onboarding gap rather than a sign-in problem.
final class TeacherProfileNotFoundException extends AttendanceException {
  const TeacherProfileNotFoundException(super.cause);
}

/// 400 `Maximum 40 students per class` — the transactional cap (F9-006) fired.
/// The client mirrors the same number in `ClassCapacity`, so reaching this
/// means the count changed under the UI (another device added the 40th), not
/// that the client forgot to check.
final class ClassFullException extends AttendanceException {
  const ClassFullException(super.cause);

  /// The cap, so a message can name it without re-deriving the constant.
  int get maxStudents => ClassCapacity.maxStudents;
}

/// 400 `Roll number must be an integer` / `Roll number must be 1–40`. The
/// client validates the same rule before sending (`ClassCapacity`), so this is
/// the backstop, not the primary check.
final class RollNumberOutOfRangeException extends AttendanceException {
  const RollNumberOutOfRangeException(super.cause);

  int get minRollNumber => ClassCapacity.minRollNumber;
  int get maxRollNumber => ClassCapacity.maxRollNumber;
}

/// 400 `Invalid phone number — enter a 10-digit Indian mobile number` from the
/// E.164 normalizer when a student is added or updated.
final class InvalidParentPhoneException extends AttendanceException {
  const InvalidParentPhoneException(super.cause);
}

/// 400 — the date is outside the markable window `[today - 7d, today]`
/// **computed in IST** (F9-004). [rejection] says which end it fell off, so the
/// UI can say "that day is not here yet" or "older than a week" instead of
/// "invalid date".
///
/// The repository raises this **locally**, before the request, when the date is
/// already outside `AttendanceWindow` — a round trip on a rural connection to
/// be told what the client could compute is not a good use of the teacher's
/// time. [isLocal] distinguishes the pre-flight refusal from a real 400, which
/// only happens when the two clocks genuinely disagree.
final class AttendanceDateOutOfWindowException extends AttendanceException {
  const AttendanceDateOutOfWindowException(
    super.cause, {
    required this.rejection,
    this.isLocal = false,
  });

  /// The pre-flight form: raised by the client from its own IST window, with no
  /// request sent and no server message to quote.
  factory AttendanceDateOutOfWindowException.local({
    required AttendanceDateRejection rejection,
    required AttendanceDate date,
    required AttendanceWindow window,
  }) {
    return AttendanceDateOutOfWindowException(
      ApiException(
        ApiErrorKind.badResponse,
        switch (rejection) {
          AttendanceDateRejection.future =>
            'Cannot mark attendance for future dates',
          AttendanceDateRejection.tooOld =>
            'Cannot mark attendance older than '
                '${AttendanceWindow.markableDays} days',
        },
        statusCode: 400,
        raw:
            '${date.wire} outside ${window.earliest.wire}..${window.today.wire}',
      ),
      rejection: rejection,
      isLocal: true,
    );
  }

  /// Which bound the date fell outside.
  final AttendanceDateRejection rejection;

  /// True when the client refused before sending; false when the server did.
  final bool isLocal;
}

/// 400 — any other validation the service rejected: a blank class name or
/// academic year, an over-long student name, an oversized or forged records map
/// (`Unknown student in attendance records`, `Invalid attendance status`), or a
/// route shell's `Invalid request body` / `Invalid query parameters`.
///
/// These are contract violations rather than teacher mistakes — the UI cannot
/// produce most of them — so they carry the server's message and no extra
/// structure.
final class AttendanceValidationException extends AttendanceException {
  const AttendanceValidationException(super.cause);
}

/// **The PII fail-closed guard.** The masked `?projection=roster` response was
/// not available, so the roster read was abandoned rather than falling back to
/// the unmasked student documents.
///
/// The masked projection ships in draft PR #124 and is NOT merged. Until it is,
/// `GET .../students?projection=roster` on production simply ignores the
/// unknown query parameter and returns the FULL student documents — every
/// parent's E.164 number, for every student in the class. A client that decoded
/// whatever arrived would leak exactly the data the projection exists to
/// withhold, and would do it silently, on the first run against production.
///
/// So the decoder verifies the shape it got is the masked one and raises this
/// instead when it is not — for an unmasked or unrecognised body, and for the
/// 400 the merged route returns when it does not know the `roster` projection.
/// The offending body is never quoted in the message: an error string that
/// carries the phone numbers is the same leak by a slower route.
final class RosterProjectionUnavailableException extends AttendanceException {
  RosterProjectionUnavailableException({
    this.reason = 'shape',
    ApiException? cause,
  }) : super(cause ?? _fallbackCause);

  /// A short, PII-free tag for logs: which check failed (`shape`, `unmasked`,
  /// `rejected`).
  final String reason;

  static const ApiException _fallbackCause = ApiException(
    ApiErrorKind.badResponse,
    'The class roster is not available in a form this app is allowed to hold.',
    statusCode: 200,
  );

  @override
  String toString() => 'RosterProjectionUnavailableException($reason)';
}
