import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/platform/clock.dart';
import 'package:sahayakai/features/attendance/domain/attendance_date.dart';

/// The IST markable window — the one piece of attendance arithmetic that is
/// wrong by default.
///
/// `saveAttendance` clamps the posted date against a today / seven-days-ago
/// pair computed in `Asia/Kolkata` (forensic fix F9-004). The client has the
/// mirror bug available: between 00:00 and 05:30 IST the *UTC* day is still
/// yesterday, so a client that derives "today" from a UTC instant offers — and
/// permits — the wrong day, and 400s the server for a date it would accept.
///
/// The pinned instant below is **20:00 UTC**, which is 01:30 IST the NEXT day.
/// It is chosen because a naive implementation and a correct one disagree
/// there, and that disagreement is asserted explicitly rather than assumed.
void main() {
  /// 2026-08-18T20:00Z == 2026-08-19T01:30 IST. The teacher's calendar has
  /// already turned over; UTC has not.
  final lateEveningUtc = DateTime.utc(2026, 8, 18, 20);

  group('AttendanceDate.fromIstInstant', () {
    test(
      'resolves 20:00 UTC to the NEXT IST day — the case a naive clock fails',
      () {
        final istToday = AttendanceDate.fromIstInstant(lateEveningUtc);

        expect(istToday.wire, '2026-08-19');

        // The naive implementation, spelled out so the difference is a fact of
        // the test rather than a claim in a comment: reading the calendar
        // fields straight off the instant yields the 18th, one day behind the
        // teacher. A client that did this would grey out the very day the
        // server accepts.
        final naive = AttendanceDate(
          lateEveningUtc.year,
          lateEveningUtc.month,
          lateEveningUtc.day,
        );
        expect(naive.wire, '2026-08-18');
        expect(naive, isNot(istToday));
      },
    );

    test('is an instant conversion, not a field read — local input agrees', () {
      // The same instant expressed in the host's local zone (whatever the CI
      // machine is set to) must resolve to the same IST day. `.toUtc()` inside
      // the factory is what guarantees it; without that call this test fails
      // on any runner not set to UTC.
      final sameInstantLocal = DateTime.fromMillisecondsSinceEpoch(
        lateEveningUtc.millisecondsSinceEpoch,
      );
      expect(sameInstantLocal.isUtc, isFalse);

      expect(
        AttendanceDate.fromIstInstant(sameInstantLocal),
        AttendanceDate.fromIstInstant(lateEveningUtc),
      );
    });

    test('18:29 UTC is still the same IST day; 18:30 UTC is the next', () {
      // The exact boundary: IST is UTC+05:30, so the IST day rolls at 18:30Z.
      expect(
        AttendanceDate.fromIstInstant(DateTime.utc(2026, 8, 18, 18, 29)).wire,
        '2026-08-18',
      );
      expect(
        AttendanceDate.fromIstInstant(DateTime.utc(2026, 8, 18, 18, 30)).wire,
        '2026-08-19',
      );
    });
  });

  group('AttendanceDate parsing and arithmetic', () {
    test('round-trips a wire date', () {
      final parsed = AttendanceDate.tryParse('2026-08-19');
      expect(parsed, const AttendanceDate(2026, 8, 19));
      expect(parsed!.wire, '2026-08-19');
    });

    test('zero-pads single-digit months and days', () {
      expect(const AttendanceDate(2026, 1, 5).wire, '2026-01-05');
    });

    test('rejects a malformed or impossible date instead of shifting it', () {
      // 2026-02-31 would silently become March 3 through DateTime; the server
      // stores the date string as a doc id, so a shifted day writes the wrong
      // register.
      expect(AttendanceDate.tryParse('2026-02-31'), isNull);
      expect(AttendanceDate.tryParse('2026-8-19'), isNull);
      expect(AttendanceDate.tryParse('19-08-2026'), isNull);
      expect(AttendanceDate.tryParse(''), isNull);
      expect(AttendanceDate.tryParse(null), isNull);
    });

    test('addDays crosses month and year boundaries', () {
      expect(const AttendanceDate(2026, 3, 1).addDays(-1).wire, '2026-02-28');
      expect(const AttendanceDate(2026, 1, 1).addDays(-1).wire, '2025-12-31');
      // 2028 is a leap year — the arithmetic is calendar-aware, not 30-day.
      expect(const AttendanceDate(2028, 3, 1).addDays(-1).wire, '2028-02-29');
    });

    test('orders chronologically', () {
      const earlier = AttendanceDate(2026, 8, 12);
      const later = AttendanceDate(2026, 9, 1);
      expect(earlier.isBefore(later), isTrue);
      expect(later.isAfter(earlier), isTrue);
      expect(later.differenceInDays(earlier), 20);
    });
  });

  group('AttendanceWindow', () {
    test('spans [today - 7, today] in IST from a 20:00 UTC instant', () {
      final window = AttendanceWindow.forInstant(lateEveningUtc);

      expect(window.today.wire, '2026-08-19');
      expect(window.earliest.wire, '2026-08-12');
      expect(window.markableDates, hasLength(8));
      expect(window.markableDates.first.wire, '2026-08-19');
      expect(window.markableDates.last.wire, '2026-08-12');
    });

    test('both bounds are inclusive, matching the server comparison', () {
      final window = AttendanceWindow.forInstant(lateEveningUtc);

      // The server rejects `date > todayStr` and `date < sevenDaysAgoStr`, so
      // today and the seventh day back are both markable.
      expect(window.reject(const AttendanceDate(2026, 8, 19)), isNull);
      expect(window.reject(const AttendanceDate(2026, 8, 12)), isNull);

      expect(
        window.reject(const AttendanceDate(2026, 8, 20)),
        AttendanceDateRejection.future,
      );
      expect(
        window.reject(const AttendanceDate(2026, 8, 11)),
        AttendanceDateRejection.tooOld,
      );
    });

    test(
      'accepts the IST today that a UTC-derived window would call the future',
      () {
        // The regression this file exists for. At 01:30 IST the teacher's today
        // is the 19th. A window built from the naive UTC day would top out at
        // the 18th and refuse the 19th as "future" — while the server, which
        // computes in IST, accepts it.
        final correct = AttendanceWindow.forInstant(lateEveningUtc);
        const naiveToday = AttendanceDate(2026, 8, 18);
        final naive = AttendanceWindow(
          today: naiveToday,
          earliest: naiveToday.addDays(-AttendanceWindow.markableDays),
        );

        const teacherToday = AttendanceDate(2026, 8, 19);
        expect(correct.contains(teacherToday), isTrue);
        expect(naive.reject(teacherToday), AttendanceDateRejection.future);
      },
    );

    test('value equality', () {
      expect(
        AttendanceWindow.forInstant(lateEveningUtc),
        AttendanceWindow.forInstant(DateTime.utc(2026, 8, 18, 21)),
      );
    });
  });

  group('attendanceWindowProvider', () {
    test('reads the nowProvider seam, so a test can pin the day', () {
      final container = ProviderContainer(
        overrides: <Override>[
          nowProvider.overrideWithValue(() => lateEveningUtc),
        ],
      );
      addTearDown(container.dispose);

      final window = container.read(attendanceWindowProvider);
      expect(window.today.wire, '2026-08-19');
      expect(window.earliest.wire, '2026-08-12');
    });

    test('unpinned, it still lands on a self-consistent window', () {
      // No override: proves the production wiring composes (the provider reads
      // the real clock) without asserting on a wall-clock date, which would
      // make this suite time-dependent — the exact defect nowProvider exists
      // to prevent.
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final window = container.read(attendanceWindowProvider);
      expect(
        window.today.differenceInDays(window.earliest),
        AttendanceWindow.markableDays,
      );
      expect(window.contains(window.today), isTrue);
    });
  });
}
