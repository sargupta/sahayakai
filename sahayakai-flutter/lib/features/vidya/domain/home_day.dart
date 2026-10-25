import 'package:flutter/foundation.dart';

import '../../attendance/domain/attendance_class.dart';
import '../../attendance/domain/attendance_record.dart';
import 'deliverable.dart';

/// What one row of Home's "Say it, I'll open it" card is about.
///
/// The first three are real items of the teacher's day. The `example*` kinds
/// are only ever shown when nothing is waiting: they are things a teacher can
/// say, never facts about her day, so they carry no counts.
enum HomeDayItemKind {
  /// A class marked today with absentees: their parents are waiting for a call.
  callAbsentees,

  /// A class with no register yet today.
  takeAttendance,

  /// Something VIDYA finished that has not been delivered.
  openReady,

  exampleLesson,
  exampleQuiz,
  exampleAnswer,
}

@immutable
class HomeDayItem {
  const HomeDayItem._(
    this.kind, {
    this.count = 0,
    this.className,
    this.classId,
    this.deliverable,
  });

  factory HomeDayItem.callAbsentees(AttendanceClass c, int absent) =>
      HomeDayItem._(
        HomeDayItemKind.callAbsentees,
        count: absent,
        className: c.name,
        classId: c.id,
      );

  factory HomeDayItem.takeAttendance(AttendanceClass c) => HomeDayItem._(
    HomeDayItemKind.takeAttendance,
    className: c.name,
    classId: c.id,
  );

  factory HomeDayItem.openReady(Deliverable d) =>
      HomeDayItem._(HomeDayItemKind.openReady, deliverable: d);

  static const List<HomeDayItem> examples = [
    HomeDayItem._(HomeDayItemKind.exampleLesson),
    HomeDayItem._(HomeDayItemKind.exampleQuiz),
    HomeDayItem._(HomeDayItemKind.exampleAnswer),
  ];

  final HomeDayItemKind kind;

  /// Absentees today ([HomeDayItemKind.callAbsentees] only).
  final int count;
  final String? className;
  final String? classId;
  final Deliverable? deliverable;

  bool get isExample =>
      kind == HomeDayItemKind.exampleLesson ||
      kind == HomeDayItemKind.exampleQuiz ||
      kind == HomeDayItemKind.exampleAnswer;
}

/// The teacher's day as Home tells it: the classes for the subline, every
/// real waiting item for the headline count, and the rows the card shows.
@immutable
class HomeDay {
  const HomeDay({
    required this.classNames,
    required this.waiting,
    required this.complete,
  });

  /// The rows the card has room for.
  static const int maxRows = 4;

  /// The teacher's own class names, for the subline.
  final List<String> classNames;

  /// Every real item waiting today, most pressing first.
  final List<HomeDayItem> waiting;

  /// False when part of the day could not be read (offline, signed out, a
  /// register that failed). The headline then makes no count claim at all:
  /// "2 things waiting" would be a guess when a third class was never read.
  final bool complete;

  int get waitingCount => waiting.length;

  /// What the card shows: the most pressing waiting items, or, when nothing
  /// is waiting, examples of what to say.
  List<HomeDayItem> get rows => waiting.isEmpty
      ? HomeDayItem.examples
      : waiting.take(maxRows).toList(growable: false);
}

/// Builds the day from what the app actually read.
///
/// [registersToday] maps a class id to today's register, or to null when the
/// class is not marked yet. A class whose register could not be read is
/// simply absent from the map: it contributes nothing and marks the day
/// [HomeDay.complete] false — the card never guesses about it.
///
/// Order: calls first (parents are waiting on a real absence), then VIDYA's
/// finished work (newest first), then registers still to take.
HomeDay deriveHomeDay({
  required List<AttendanceClass>? classes,
  required Map<String, DailyAttendance?> registersToday,
  required List<Deliverable> ready,
}) {
  final calls = <HomeDayItem>[];
  final marks = <HomeDayItem>[];
  var complete = classes != null;
  for (final c in classes ?? const <AttendanceClass>[]) {
    if (!registersToday.containsKey(c.id)) {
      complete = false;
      continue;
    }
    final register = registersToday[c.id];
    if (register == null) {
      marks.add(HomeDayItem.takeAttendance(c));
    } else if (register.absentCount > 0) {
      calls.add(HomeDayItem.callAbsentees(c, register.absentCount));
    }
  }
  final opens = [for (final d in ready.reversed) HomeDayItem.openReady(d)];
  return HomeDay(
    classNames: [for (final c in classes ?? const <AttendanceClass>[]) c.name],
    waiting: [...calls, ...opens, ...marks],
    complete: complete,
  );
}
