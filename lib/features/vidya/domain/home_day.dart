import 'package:flutter/foundation.dart';

import '../../attendance/domain/attendance_date.dart';

/// Where one class stands today, from its saved register.
enum ClassDayState {
  /// No register saved for today yet.
  toMark,

  /// Saved, and at least one student is absent.
  absences,

  /// Saved, everyone present (or late).
  marked,
}

/// One of the teacher's classes on Home's Today card.
@immutable
class TodayClass {
  const TodayClass({
    required this.classId,
    required this.name,
    required this.subject,
    required this.state,
    this.absent = 0,
  });

  final String classId;
  final String name;
  final String subject;
  final ClassDayState state;

  /// Students marked absent in today's saved register.
  final int absent;

  @override
  bool operator ==(Object other) =>
      other is TodayClass &&
      other.classId == classId &&
      other.name == name &&
      other.subject == subject &&
      other.state == state &&
      other.absent == absent;

  @override
  int get hashCode => Object.hash(classId, name, subject, state, absent);
}

/// One day on the This week strip.
enum WeekDayMark {
  /// The teacher made something or marked a register that day.
  done,

  /// Today, with nothing done yet.
  todayOpen,

  /// An earlier day this week with nothing done.
  missed,

  /// Later this week.
  ahead,
}

/// Monday to Saturday of the current IST week, and the run of days in a row.
@immutable
class WeekStreak {
  const WeekStreak({
    required this.days,
    required this.todayIndex,
    required this.run,
  });

  /// Six marks, Monday first. On a Sunday the strip shows the week just
  /// finished, so [todayIndex] is -1 and every day is past.
  final List<WeekDayMark> days;

  /// 0 for Monday … 5 for Saturday; -1 on a Sunday.
  final int todayIndex;

  /// Days in a row ending today, or ending yesterday while today is still
  /// open (a streak is not lost until the day is over). Counts across the
  /// week boundary.
  final int run;

  bool get doneToday => todayIndex >= 0 && days[todayIndex] == WeekDayMark.done;

  @override
  bool operator ==(Object other) =>
      other is WeekStreak &&
      listEquals(other.days, days) &&
      other.todayIndex == todayIndex &&
      other.run == run;

  @override
  int get hashCode => Object.hash(Object.hashAll(days), todayIndex, run);
}

/// Builds the strip for [today] from the IST days on which something was
/// made or a register was saved.
WeekStreak buildWeekStreak(AttendanceDate today, Set<AttendanceDate> active) {
  // DateTime.utc keeps weekday arithmetic free of the handset's zone.
  final weekday = DateTime.utc(today.year, today.month, today.day).weekday;
  final monday = today.addDays(1 - weekday);
  final todayIndex = weekday == DateTime.sunday ? -1 : weekday - 1;

  final days = <WeekDayMark>[
    for (var i = 0; i < 6; i++)
      if (active.contains(monday.addDays(i)))
        WeekDayMark.done
      else if (i == todayIndex)
        WeekDayMark.todayOpen
      else if (todayIndex == -1 || i < todayIndex)
        WeekDayMark.missed
      else
        WeekDayMark.ahead,
  ];

  var cursor = active.contains(today) ? today : today.addDays(-1);
  var run = 0;
  // Bounded: a run longer than a year is still shown as a number, but the
  // loop never walks further than that.
  while (run < 366 && active.contains(cursor)) {
    run++;
    cursor = cursor.addDays(-1);
  }
  return WeekStreak(days: days, todayIndex: todayIndex, run: run);
}
