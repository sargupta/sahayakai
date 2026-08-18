import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/attendance/domain/attendance_class.dart';
import 'package:sahayakai/features/attendance/domain/attendance_date.dart';
import 'package:sahayakai/features/attendance/domain/attendance_record.dart';
import 'package:sahayakai/features/attendance/domain/attendance_write_result.dart';
import 'package:sahayakai/features/attendance/domain/roster_student.dart';
import 'package:sahayakai/features/parent_hotline/domain/parent_outreach.dart';

/// The attendance domain rules that exist so the UI can prevent rather than
/// apologise: the 40-student cap, roll numbers 1–40, the strict (never
/// guessed) attendance status, the masked roster, and the premium gate as a
/// value rather than an error.
void main() {
  group('ClassCapacity — the 40-student cap', () {
    test('mirrors the server constants exactly', () {
      expect(ClassCapacity.maxStudents, 40);
      expect(ClassCapacity.minRollNumber, 1);
      expect(ClassCapacity.maxRollNumber, 40);
    });

    test('a class is full at 40, not at 41', () {
      expect(ClassCapacity.isFull(39), isFalse);
      expect(ClassCapacity.isFull(40), isTrue);
      // A count that somehow overshot the cap is still full, never "negative
      // seats left".
      expect(ClassCapacity.isFull(41), isTrue);
      expect(ClassCapacity.remainingSeats(41), 0);
      expect(ClassCapacity.remainingSeats(38), 2);
    });

    test('AttendanceClass exposes the cap so a screen can disable Add', () {
      const nearlyFull = AttendanceClass(
        id: 'c1',
        name: 'Class 6A',
        subject: 'Science',
        gradeLevel: 'Class 6',
        academicYear: '2026-27',
        studentCount: 39,
      );
      expect(nearlyFull.isFull, isFalse);
      expect(nearlyFull.remainingSeats, 1);

      const full = AttendanceClass(
        id: 'c1',
        name: 'Class 6A',
        subject: 'Science',
        gradeLevel: 'Class 6',
        academicYear: '2026-27',
        studentCount: 40,
      );
      expect(full.isFull, isTrue);
      expect(full.remainingSeats, 0);
    });
  });

  group('ClassCapacity — roll numbers 1–40', () {
    test('accepts the inclusive ends', () {
      expect(ClassCapacity.isValidRollNumber(1), isTrue);
      expect(ClassCapacity.isValidRollNumber(40), isTrue);
    });

    test('rejects out-of-range', () {
      expect(ClassCapacity.checkRollNumber(0), RollNumberProblem.outOfRange);
      expect(ClassCapacity.checkRollNumber(41), RollNumberProblem.outOfRange);
      expect(ClassCapacity.checkRollNumber(-1), RollNumberProblem.outOfRange);
    });

    test('rejects non-integers — the exact case the server had to fix', () {
      // The server's Wave 3 note: without an integer check, 41.5 and 0.99
      // coerce through a naive range test. The client must not be the layer
      // that lets them in.
      expect(
        ClassCapacity.checkRollNumber(41.5),
        RollNumberProblem.notAnInteger,
      );
      expect(
        ClassCapacity.checkRollNumber(0.99),
        RollNumberProblem.notAnInteger,
      );
      expect(
        ClassCapacity.checkRollNumber(double.nan),
        RollNumberProblem.notAnInteger,
      );
      expect(
        ClassCapacity.checkRollNumber(double.infinity),
        RollNumberProblem.notAnInteger,
      );
      // A whole number that happens to arrive as a double is fine — JSON has
      // no integer type, so 7.0 is a legitimate wire form of 7.
      expect(ClassCapacity.checkRollNumber(7.0), isNull);
    });

    test('a missing roll number is its own problem, not "out of range"', () {
      expect(ClassCapacity.checkRollNumber(null), RollNumberProblem.missing);
    });

    test('suggests the first free roll number, or none on a full class', () {
      expect(ClassCapacity.firstFreeRollNumber(<int>[]), 1);
      expect(ClassCapacity.firstFreeRollNumber(<int>[1, 2, 4]), 3);
      expect(
        ClassCapacity.firstFreeRollNumber(
          List<int>.generate(40, (i) => i + 1),
        ),
        isNull,
      );
    });
  });

  group('AttendanceStatus — strict, never guessed', () {
    test('decodes the three server tokens', () {
      expect(AttendanceStatus.fromWire('present'), AttendanceStatus.present);
      expect(AttendanceStatus.fromWire('absent'), AttendanceStatus.absent);
      expect(AttendanceStatus.fromWire('late'), AttendanceStatus.late);
    });

    test('an unknown or absent token is "not marked", never a default', () {
      // Deliberately unlike the tolerant parent_hotline enums. Defaulting here
      // would invent a school day for a specific child and feed it into a call
      // to that child's parent.
      expect(AttendanceStatus.fromWire('excused'), isNull);
      expect(AttendanceStatus.fromWire('Present'), isNull);
      expect(AttendanceStatus.fromWire(''), isNull);
      expect(AttendanceStatus.fromWire(null), isNull);
    });
  });

  group('DailyAttendance', () {
    const date = AttendanceDate(2026, 8, 19);
    const register = DailyAttendance(
      classId: 'c1',
      date: date,
      statuses: <String, AttendanceStatus>{
        's1': AttendanceStatus.present,
        's2': AttendanceStatus.absent,
        's3': AttendanceStatus.late,
        's4': AttendanceStatus.present,
      },
    );

    test('counts each status and reports how many are marked', () {
      expect(register.presentCount, 2);
      expect(register.absentCount, 1);
      expect(register.lateCount, 1);
      expect(register.markedCount, 4);
    });

    test('an unlisted student is unmarked, not present', () {
      expect(register.statusFor('s1'), AttendanceStatus.present);
      expect(register.statusFor('s9'), isNull);
    });

    test('value equality covers the statuses map', () {
      expect(
        register,
        const DailyAttendance(
          classId: 'c1',
          date: date,
          statuses: <String, AttendanceStatus>{
            's4': AttendanceStatus.present,
            's3': AttendanceStatus.late,
            's2': AttendanceStatus.absent,
            's1': AttendanceStatus.present,
          },
        ),
      );
      expect(
        register,
        isNot(
          const DailyAttendance(
            classId: 'c1',
            date: date,
            statuses: <String, AttendanceStatus>{'s1': AttendanceStatus.absent},
          ),
        ),
      );
    });
  });

  group('RosterStudent — the masked projection', () {
    const asha = RosterStudent(
      id: 's1',
      name: 'Asha Devi',
      rollNumber: 1,
      parentLanguage: 'Hindi',
      hasParentPhone: true,
      parentPhoneLast4: '3210',
    );

    test('carries no full phone number — there is no field for one', () {
      // A structural assertion: `toString` of the whole object must not be able
      // to produce a number, because the type has nowhere to keep one.
      expect(asha.parentPhoneLast4, '3210');
      expect(asha.parentPhoneLast4!.length, lessThanOrEqualTo(4));
    });

    test('hands off to the parent-hotline picker without un-masking', () {
      final hotline = asha.toHotlineStudent(
        classId: 'c1',
        className: 'Class 6A',
        subject: 'Science',
        suggestedReason: OutreachReason.consecutiveAbsences,
      );

      expect(hotline.id, 's1');
      expect(hotline.name, 'Asha Devi');
      expect(hotline.classId, 'c1');
      expect(hotline.className, 'Class 6A');
      expect(hotline.parentLanguage, 'Hindi');
      expect(hotline.hasParentPhone, isTrue);
      expect(hotline.parentPhoneLast4, '3210');
      expect(hotline.subject, 'Science');
      expect(hotline.suggestedReason, OutreachReason.consecutiveAbsences);
    });

    test('a student with no phone hands off as uncallable', () {
      const bikash = RosterStudent(
        id: 's2',
        name: 'Bikash Roy',
        rollNumber: 2,
        parentLanguage: 'Bengali',
      );
      final hotline = bikash.toHotlineStudent(
        classId: 'c1',
        className: 'Class 6A',
      );

      expect(hotline.hasParentPhone, isFalse);
      expect(hotline.parentPhoneLast4, isNull);
    });
  });

  group('AttendanceWriteResult — the premium gate as a value', () {
    test('an accepted write carries its value', () {
      const result = AttendanceWriteAccepted<String>('class-1');
      expect(result.isBlockedByPlan, isFalse);
      expect(result.valueOrNull, 'class-1');
    });

    test('a blocked write is a value, not an exception, and has no payload', () {
      const result = AttendanceWriteBlockedByPlan<String>(
        serverMessage: 'PREMIUM_REQUIRED',
      );
      expect(result.isBlockedByPlan, isTrue);
      expect(result.valueOrNull, isNull);
      // The raw machine string is kept for logs only — the upgrade copy is the
      // app's own localized string, never this.
      expect(result.serverMessage, 'PREMIUM_REQUIRED');
    });

    test('the sealed type switches exhaustively', () {
      const AttendanceWriteResult<String> blocked =
          AttendanceWriteBlockedByPlan<String>();
      final described = switch (blocked) {
        AttendanceWriteAccepted<String>(:final value) => 'accepted:$value',
        AttendanceWriteBlockedByPlan<String>() => 'blocked',
      };
      expect(described, 'blocked');
    });
  });
}
