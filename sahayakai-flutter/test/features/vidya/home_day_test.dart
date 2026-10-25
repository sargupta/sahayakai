import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/attendance/domain/attendance_date.dart';
import 'package:sahayakai/features/attendance/domain/attendance_record.dart';
import 'package:sahayakai/features/vidya/domain/deliverable.dart';
import 'package:sahayakai/features/vidya/domain/home_day.dart';

import '../../support/home_day_fixtures.dart';

/// Home's day (design system v2 `ScreenHome`: "the headline is the teacher's
/// real day … every count is real"). These pin the honesty rules: counts come
/// only from registers that were read, examples appear only on an empty day,
/// and an unread class makes the whole day incomplete rather than guessed.
void main() {
  const today = AttendanceDate(2026, 10, 25);
  const fractions = Deliverable(
    id: 'd1',
    title: 'Working with Fractions',
    text: 'Lesson plan',
  );

  test('absentees, ready work and unmarked classes, most pressing first', () {
    final day = deriveHomeDay(
      classes: const [sampleClass7, sampleClass5],
      registersToday: {'c7': sampleClass7Register(today), 'c5': null},
      ready: const [fractions],
    );

    expect(day.complete, isTrue);
    expect(day.waitingCount, 3);
    expect(day.waiting.map((i) => i.kind), [
      HomeDayItemKind.callAbsentees,
      HomeDayItemKind.openReady,
      HomeDayItemKind.takeAttendance,
    ]);
    expect(day.waiting.first.count, 4);
    expect(day.waiting.first.className, 'Class 7 Maths');
    expect(day.rows.any((i) => i.isExample), isFalse);
    expect(day.classNames, ['Class 7 Maths', 'Class 5 EVS']);
  });

  test('a fully present class waits for nothing', () {
    final day = deriveHomeDay(
      classes: const [sampleClass5],
      registersToday: {
        'c5': const DailyAttendance(
          classId: 'c5',
          date: today,
          statuses: {'s1': AttendanceStatus.present},
        ),
      },
      ready: const [],
    );

    expect(day.complete, isTrue);
    expect(day.waitingCount, 0);
    expect(day.rows, HomeDayItem.examples);
  });

  test('an unread register leaves its class out and the day incomplete', () {
    final day = deriveHomeDay(
      classes: const [sampleClass7, sampleClass5],
      registersToday: {'c7': sampleClass7Register(today)},
      ready: const [],
    );

    expect(day.complete, isFalse, reason: 'c5 was never read');
    expect(day.waiting.single.classId, 'c7');
  });

  test(
    'no class list at all is an incomplete day, never "nothing waiting"',
    () {
      final day = deriveHomeDay(
        classes: null,
        registersToday: const {},
        ready: const [fractions],
      );

      expect(day.complete, isFalse);
      expect(day.waiting.single.kind, HomeDayItemKind.openReady);
    },
  );

  test('the card shows at most four rows; the count keeps them all', () {
    final day = deriveHomeDay(
      classes: const [],
      registersToday: const {},
      ready: [
        for (var i = 0; i < 6; i++)
          Deliverable(id: 'd$i', title: 'Output $i', text: ''),
      ],
    );

    expect(day.waitingCount, 6);
    expect(day.rows, hasLength(HomeDay.maxRows));
    // Newest ready work first.
    expect(day.rows.first.deliverable?.id, 'd5');
  });
}
