import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sahayakai/features/attendance/domain/attendance_class.dart';
import 'package:sahayakai/features/attendance/domain/attendance_date.dart';
import 'package:sahayakai/features/attendance/domain/attendance_record.dart';
import 'package:sahayakai/features/attendance/presentation/attendance_providers.dart';

/// A teacher's day for Home tests and screenshots: Class 7 Maths marked today
/// with four absentees, Class 5 EVS not yet marked. A sample, labelled as
/// one — never presented as a real teacher.
const sampleClass7 = AttendanceClass(
  id: 'c7',
  name: 'Class 7 Maths',
  subject: 'Mathematics',
  gradeLevel: 'Class 7',
  academicYear: '2026-27',
  studentCount: 38,
);

const sampleClass5 = AttendanceClass(
  id: 'c5',
  name: 'Class 5 EVS',
  subject: 'EVS',
  gradeLevel: 'Class 5',
  academicYear: '2026-27',
  studentCount: 34,
);

/// Today's register for [sampleClass7]: 34 present, 4 absent.
DailyAttendance sampleClass7Register(AttendanceDate date) => DailyAttendance(
  classId: 'c7',
  date: date,
  statuses: {
    for (var i = 0; i < 34; i++) 's$i': AttendanceStatus.present,
    for (var i = 34; i < 38; i++) 's$i': AttendanceStatus.absent,
  },
);

/// Overrides the attendance reads Home composes, so the day is the sample
/// above with no network: [sampleClass7] marked with 4 absentees,
/// [sampleClass5] unmarked.
List<Override> sampleDayOverrides() => [
  attendanceClassesProvider.overrideWith(
    (ref) async => const [sampleClass7, sampleClass5],
  ),
  dailyRegisterProvider.overrideWith(
    (ref, key) async =>
        key.classId == 'c7' ? sampleClass7Register(key.date) : null,
  ),
];
