import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/attendance/domain/attendance_date.dart';
import 'package:sahayakai/features/vidya/domain/home_day.dart';

void main() {
  // 19 Nov 2026 is a Thursday.
  const thu = AttendanceDate(2026, 11, 19);
  const mon = AttendanceDate(2026, 11, 16);

  group('buildWeekStreak', () {
    test('marks done, missed, today and the days ahead', () {
      final streak = buildWeekStreak(thu, {mon, mon.addDays(2)});
      expect(streak.todayIndex, 3);
      expect(streak.days, [
        WeekDayMark.done,
        WeekDayMark.missed,
        WeekDayMark.done,
        WeekDayMark.todayOpen,
        WeekDayMark.ahead,
        WeekDayMark.ahead,
      ]);
      expect(streak.doneToday, isFalse);
    });

    test('an open today keeps yesterday\'s run alive', () {
      final streak = buildWeekStreak(thu, {
        mon,
        mon.addDays(1),
        mon.addDays(2),
      });
      expect(streak.run, 3);
      expect(streak.doneToday, isFalse);
    });

    test('today counts once done, and the run crosses into last week', () {
      final streak = buildWeekStreak(thu, {
        mon.addDays(-1), // Sunday before
        mon,
        mon.addDays(1),
        mon.addDays(2),
        thu,
      });
      expect(streak.run, 5);
      expect(streak.doneToday, isTrue);
    });

    test('a gap ends the run', () {
      final streak = buildWeekStreak(thu, {mon, thu});
      expect(streak.run, 1);
    });

    test('nothing done is a run of zero', () {
      final streak = buildWeekStreak(thu, const {});
      expect(streak.run, 0);
      expect(streak.days.where((d) => d == WeekDayMark.done), isEmpty);
    });

    test('on a Sunday the strip shows the week just finished', () {
      const sun = AttendanceDate(2026, 11, 22);
      final streak = buildWeekStreak(sun, {mon});
      expect(streak.todayIndex, -1);
      expect(streak.days.first, WeekDayMark.done);
      expect(streak.days.skip(1), everyElement(WeekDayMark.missed));
    });
  });
}
