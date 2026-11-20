import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/platform/clock.dart';
import '../../attendance/domain/attendance_class.dart';
import '../../attendance/domain/attendance_date.dart';
import '../../attendance/domain/attendance_record.dart';
import '../../attendance/presentation/attendance_providers.dart';
import '../domain/home_day.dart';
import 'deliverables_controller.dart';

/// The teacher's day for Home: her classes, today's register for each, and
/// what VIDYA has ready.
///
/// It composes the attendance providers the app already caches (one class
/// list, one register per class for today), so opening Home costs one read
/// per class and every later visit is served from cache until a register is
/// saved (which invalidates it). A failed read is never an error here: that
/// part of the day is just left out and the day is marked incomplete, so
/// Home still opens on the orb and the examples.
///
/// A plain [FutureProvider], like the attendance providers it reads, so no
/// codegen is involved.
final homeDayProvider = FutureProvider<HomeDay>((ref) async {
  final ready = ref.watch(deliverablesControllerProvider);
  final today = AttendanceDate.fromIstInstant(ref.watch(nowProvider)());

  List<AttendanceClass>? classes;
  try {
    classes = await ref.watch(attendanceClassesProvider.future);
  } catch (_) {
    classes = null;
  }

  final registers = <String, DailyAttendance?>{};
  await Future.wait([
    for (final c in classes ?? const <AttendanceClass>[])
      ref
          .watch(dailyRegisterProvider((classId: c.id, date: today)).future)
          .then<void>((r) => registers[c.id] = r)
          .catchError((Object _) {}),
  ]);

  return deriveHomeDay(
    classes: classes,
    registersToday: registers,
    ready: ready,
  );
});
