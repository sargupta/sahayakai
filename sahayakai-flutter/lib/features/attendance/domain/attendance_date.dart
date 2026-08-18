import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/platform/clock.dart';

/// A calendar day in the attendance register, as `YYYY-MM-DD`.
///
/// The wire format is a plain date string with no time and no zone — every
/// attendance route takes and returns it (`?date=`, the `POST records` body,
/// the `attendance/{classId}/records/{YYYY-MM-DD}` doc id, the absence list).
/// It is deliberately NOT a [DateTime]: a `DateTime` carries an instant and a
/// zone, and every conversion between "the teacher's Tuesday" and an instant is
/// a chance to land on the wrong Tuesday. This type holds only the three
/// numbers the server actually stores.
///
/// The one place an instant DOES enter is [AttendanceDate.fromIstInstant], and
/// it converts in **Asia/Kolkata**, never in device-local time. See
/// [AttendanceWindow] for why that is the whole point of this file.
@immutable
class AttendanceDate implements Comparable<AttendanceDate> {
  const AttendanceDate(this.year, this.month, this.day);

  /// The IST calendar day containing [instant].
  ///
  /// India Standard Time is a fixed UTC+05:30 with no daylight saving and no
  /// historical change inside any range this app can address, so a constant
  /// offset is exactly equivalent to the server's
  /// `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })` — and needs
  /// no timezone database on the handset (Dart ships none, and this unit adds
  /// no dependency).
  factory AttendanceDate.fromIstInstant(DateTime instant) {
    final ist = instant.toUtc().add(istOffset);
    return AttendanceDate(ist.year, ist.month, ist.day);
  }

  /// India Standard Time's fixed offset from UTC.
  static const Duration istOffset = Duration(hours: 5, minutes: 30);

  /// Parses a wire `YYYY-MM-DD`, or null if it is absent, malformed, or not a
  /// real day (`2026-02-31` round-trips to March 3 and is rejected rather than
  /// silently shifted).
  static AttendanceDate? tryParse(String? wire) {
    final text = wire?.trim();
    if (text == null || text.length != 10) return null;
    final match = _wirePattern.firstMatch(text);
    if (match == null) return null;

    final year = int.parse(match.group(1)!);
    final month = int.parse(match.group(2)!);
    final day = int.parse(match.group(3)!);

    final roundTrip = DateTime.utc(year, month, day);
    if (roundTrip.year != year ||
        roundTrip.month != month ||
        roundTrip.day != day) {
      return null;
    }
    return AttendanceDate(year, month, day);
  }

  static final RegExp _wirePattern = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$');

  final int year;
  final int month;
  final int day;

  /// The exact `YYYY-MM-DD` token every attendance route expects.
  String get wire =>
      '${_pad(year, 4)}-${_pad(month, 2)}-${_pad(day, 2)}';

  /// The same calendar day shifted by [days]. Computed in UTC, which has no
  /// daylight saving, so a shift can never gain or lose an hour and land on the
  /// wrong day.
  AttendanceDate addDays(int days) {
    final shifted = DateTime.utc(year, month, day).add(Duration(days: days));
    return AttendanceDate(shifted.year, shifted.month, shifted.day);
  }

  /// Whole days from [other] to this date (positive when this is later).
  int differenceInDays(AttendanceDate other) {
    return DateTime.utc(year, month, day)
        .difference(DateTime.utc(other.year, other.month, other.day))
        .inDays;
  }

  /// Lexicographic on the wire form is the same order as chronological for a
  /// zero-padded `YYYY-MM-DD` — which is exactly how the server compares dates
  /// (`date > todayStr`). Compared numerically here so the two can never
  /// disagree on a hand-edited value.
  @override
  int compareTo(AttendanceDate other) {
    if (year != other.year) return year.compareTo(other.year);
    if (month != other.month) return month.compareTo(other.month);
    return day.compareTo(other.day);
  }

  bool isBefore(AttendanceDate other) => compareTo(other) < 0;

  bool isAfter(AttendanceDate other) => compareTo(other) > 0;

  static String _pad(int value, int width) =>
      value.toString().padLeft(width, '0');

  @override
  bool operator ==(Object other) =>
      other is AttendanceDate &&
      other.year == year &&
      other.month == month &&
      other.day == day;

  @override
  int get hashCode => Object.hash(year, month, day);

  @override
  String toString() => wire;
}

/// Why a date is outside the markable window. Mirrors the server's two distinct
/// 400s from `saveAttendance` so the UI can say which one it is instead of
/// "invalid date".
enum AttendanceDateRejection {
  /// `Cannot mark attendance for future dates`.
  future,

  /// `Cannot mark attendance older than 7 days`.
  tooOld,
}

/// The window of days a teacher may still mark, `[today - 7, today]` **in IST**.
///
/// WHY THIS EXISTS, AND WHY IT IS NOT `DateTime.now()`
///
/// `saveAttendance` in `src/server/attendance.ts` (forensic fix F9-004) clamps
/// the posted date against a today/seven-days-ago pair computed explicitly in
/// `Asia/Kolkata`, because Cloud Run runs in UTC and between 18:30Z and 24:00Z
/// the server's own `today` is a day behind the teacher's calendar.
///
/// The client has the mirror-image bug available to it. Between 00:00 and 05:30
/// IST the handset's *UTC* day is still yesterday. A client that derives "today"
/// from a UTC instant (or from a device clock a teacher has set to another zone,
/// or from an emulator defaulting to UTC) offers the teacher yesterday's date,
/// or greys out the very day the server would have accepted — and a teacher
/// marking the register at 00:30 IST, which is exactly when a teacher catches up
/// on the day's register, gets a 400 for a date the server considers valid.
///
/// So the window is computed here, in IST, once, and both the register UI and
/// the repository's pre-flight guard read it. Production reads the real clock
/// through [attendanceWindowProvider]; tests pin an instant via `nowProvider`.
@immutable
class AttendanceWindow {
  const AttendanceWindow({required this.earliest, required this.today});

  /// The window containing [instant], resolved in IST.
  factory AttendanceWindow.forInstant(DateTime instant) {
    final today = AttendanceDate.fromIstInstant(instant);
    return AttendanceWindow(
      earliest: today.addDays(-markableDays),
      today: today,
    );
  }

  /// How far back the server lets a teacher reach. The server rejects
  /// `date < todayIst - 7d`, so the seventh day back is itself markable and the
  /// window spans [markableDays] + 1 = 8 days.
  static const int markableDays = 7;

  /// The oldest markable day (inclusive) — `today - 7` in IST.
  final AttendanceDate earliest;

  /// The teacher's today, in IST. NOT the device's today.
  final AttendanceDate today;

  /// Why [date] would be refused, or null when it is markable. Mirrors the
  /// server's comparison exactly, including both inclusive bounds.
  AttendanceDateRejection? reject(AttendanceDate date) {
    if (date.isAfter(today)) return AttendanceDateRejection.future;
    if (date.isBefore(earliest)) return AttendanceDateRejection.tooOld;
    return null;
  }

  /// Whether [date] is inside `[earliest, today]`.
  bool contains(AttendanceDate date) => reject(date) == null;

  /// Every markable day, newest first — the date strip a register screen
  /// renders. Eight entries: today back to `today - 7`.
  List<AttendanceDate> get markableDates => List<AttendanceDate>.unmodifiable(
        <AttendanceDate>[
          for (var back = 0; back <= markableDays; back++) today.addDays(-back),
        ],
      );

  @override
  bool operator ==(Object other) =>
      other is AttendanceWindow &&
      other.earliest == earliest &&
      other.today == today;

  @override
  int get hashCode => Object.hash(earliest, today);

  @override
  String toString() => 'AttendanceWindow(${earliest.wire}..${today.wire})';
}

/// The markable IST window for the current instant.
///
/// This is the only provider in `domain/`, on purpose: the window is a
/// clock-derived *domain value*, not a transport concern, and keeping it beside
/// the arithmetic it exposes is what stops a second, drifting "what is today"
/// from appearing in a screen. It reads the existing `nowProvider` seam, so a
/// test pins the day with `nowProvider.overrideWithValue(() => …)` exactly as
/// the dashboard greeting does.
///
/// A plain [Provider] (not codegen) keeps it trivially overridable and adds no
/// build_runner surface — the same call `hotlineStudentRosterProvider` makes.
final attendanceWindowProvider = Provider<AttendanceWindow>(
  (ref) => AttendanceWindow.forInstant(ref.watch(nowProvider)()),
);
