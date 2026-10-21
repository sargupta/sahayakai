import 'package:flutter/foundation.dart';

/// The outcome of a **premium-gated attendance write**.
///
/// WHY A RESULT TYPE AND NOT JUST AN EXCEPTION
///
/// Every attendance write is gated: `requireProPlan` fronts `createClass`,
/// `addStudent` and `saveAttendance` in `src/server/attendance.ts`. A teacher on
/// the free plan therefore gets a **read-only register** — classes, roster,
/// records, summaries and absences all read fine — and a 403 the instant they
/// mark it.
///
/// That 403 is not a failure. The server itself logs it at WARN, not ERROR,
/// with the note that the client surfaces it as an upsell. The app cannot know
/// the plan in advance (there is no plan claim on the client, and inventing one
/// would be a second source of truth that drifts), so the *only* honest way to
/// learn it is to attempt the write. Modelling that attempt as a thrown error
/// pushes every call site into a try/catch whose interesting branch is the
/// expected one, and makes "blocked" indistinguishable at the type level from
/// "the network dropped".
///
/// So the plan gate is a **value**: [AttendanceWriteBlockedByPlan] is returned,
/// not thrown, and the caller must handle it to get at the success value.
/// Genuine failures — 401, an ownership 403, a validation 400, 5xx, offline —
/// still throw, because those are things that went wrong.
@immutable
sealed class AttendanceWriteResult<T> {
  const AttendanceWriteResult();

  /// The teacher's plan does not permit this write; show the upgrade path.
  bool get isBlockedByPlan => this is AttendanceWriteBlockedByPlan<T>;

  /// The written value, or null when the write was blocked. Prefer an
  /// exhaustive `switch` over this — it exists for the call sites that only
  /// need "did it land".
  T? get valueOrNull => switch (this) {
    AttendanceWriteAccepted<T>(:final value) => value,
    AttendanceWriteBlockedByPlan<T>() => null,
  };
}

/// The server accepted the write. [value] is whatever it returned — a new
/// `classId`, a new `studentId`, or the date whose register was saved.
@immutable
final class AttendanceWriteAccepted<T> extends AttendanceWriteResult<T> {
  const AttendanceWriteAccepted(this.value);

  final T value;

  @override
  bool operator ==(Object other) =>
      other is AttendanceWriteAccepted<T> && other.value == value;

  @override
  int get hashCode => Object.hash(AttendanceWriteAccepted, value);

  @override
  String toString() => 'AttendanceWriteAccepted($value)';
}

/// The write was refused by `requireProPlan` (403 `PREMIUM_REQUIRED`). The
/// register stays readable; only marking is gated.
@immutable
final class AttendanceWriteBlockedByPlan<T> extends AttendanceWriteResult<T> {
  const AttendanceWriteBlockedByPlan({this.serverMessage});

  /// The raw server line, for logs only. The route sends the machine string
  /// `PREMIUM_REQUIRED` as its `error`, which is not user-facing copy — the
  /// upgrade prompt is written in the app's own localized strings, never from
  /// this field.
  final String? serverMessage;

  @override
  bool operator ==(Object other) =>
      other is AttendanceWriteBlockedByPlan<T> &&
      other.serverMessage == serverMessage;

  @override
  int get hashCode => Object.hash(AttendanceWriteBlockedByPlan, serverMessage);

  @override
  String toString() => 'AttendanceWriteBlockedByPlan($serverMessage)';
}
