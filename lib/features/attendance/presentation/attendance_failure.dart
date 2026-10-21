import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/network/api_exception.dart';
import '../data/attendance_errors.dart';
import '../domain/attendance_class.dart';

/// How a failed attendance read or write should be presented.
///
/// The four values are the four different SHAPES a screen renders, not four
/// severities: a sign-in prompt, an offline panel with a retry, the
/// roster-unavailable notice, and an ordinary message. Deriving the shape once
/// here keeps the four screens from each inventing their own branch on
/// `statusCode`.
enum AttendanceFailure {
  /// 401. Offer the way out (sign in), never a retry that would fail
  /// identically.
  signedOut,

  /// A dropped or timed-out connection. Rural connectivity is intermittent:
  /// an expected failure with its own copy and its own retry.
  offline,

  /// The masked roster projection is not being served, so the app refused the
  /// unmasked reply. **Not an error the teacher caused and not a fault in
  /// their class** — see `attendance_roster_screen.dart`.
  rosterUnavailable,

  /// Everything else: render the screen's own message.
  message,
}

/// Which of the four shapes [error] is.
AttendanceFailure attendanceFailureOf(Object error) {
  if (error is RosterProjectionUnavailableException) {
    return AttendanceFailure.rosterUnavailable;
  }
  // A typed attendance error keeps the transport error that produced it, so
  // an offline `listRoster` that got wrapped is still recognisably offline.
  final api = switch (error) {
    ApiException() => error,
    AttendanceException() => error.cause,
    _ => null,
  };
  if (api == null) return AttendanceFailure.message;
  if (api.isAuth) return AttendanceFailure.signedOut;
  if (api.kind == ApiErrorKind.network || api.kind == ApiErrorKind.timeout) {
    return AttendanceFailure.offline;
  }
  return AttendanceFailure.message;
}

/// The localized line to show for [error], or [fallback] when nothing more
/// specific is known.
///
/// **The server's own message is never surfaced.** `attendanceErrorStatus`
/// returns the thrown `Error` message verbatim as the body's `error` field, so
/// `ApiException.message` on this feature is an English string written for a
/// developer (`Invalid query parameters`, `Unknown student in attendance
/// records`). Showing it to a teacher reading the app in Odia would be a
/// language switch in the middle of a sentence, and most of these are contract
/// violations the UI cannot produce anyway. So the branches below map the
/// three errors a teacher CAN actually cause onto the app's own localized
/// copy, and everything else falls back.
String attendanceFailureMessage(
  AppLocalizations l10n,
  Object error, {
  required String fallback,
}) {
  return switch (error) {
    // The 40-student cap moved under the UI (another device added the 40th).
    ClassFullException() => l10n.attendanceClassFullBody(
      ClassCapacity.maxStudents,
    ),
    RollNumberOutOfRangeException() => l10n.attendanceRollNumberInvalid,
    InvalidParentPhoneException() => l10n.attendanceParentPhoneInvalid,
    // Only reachable when the handset clock and the server disagree — the
    // picker offers nothing outside the window.
    AttendanceDateOutOfWindowException() => l10n.attendanceWindowNote,
    ApiException(kind: ApiErrorKind.network || ApiErrorKind.timeout) =>
      l10n.stateOfflineBody,
    _ => fallback,
  };
}
