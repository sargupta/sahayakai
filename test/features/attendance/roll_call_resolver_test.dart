import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/attendance/domain/attendance_record.dart';
import 'package:sahayakai/features/attendance/domain/roll_call_resolver.dart';

/// The pure brain behind voice roll call (v3 screen 13): a transcript + roster
/// in, per-student marks out. No audio.

const _roster = <RollCallStudent>[
  (id: 's1', name: 'Aarav Sharma'),
  (id: 's2', name: 'Bhavna Patil'),
  (id: 's3', name: 'Uma Krishnan'),
  (id: 's4', name: 'Dhruv Chauhan'),
];

Map<String, AttendanceStatus> _resolve(String t) =>
    RollCallResolver.resolve(transcript: t, roster: _roster);

void main() {
  test('a bare name marks present', () {
    expect(_resolve('Aarav'), {'s1': AttendanceStatus.present});
  });

  test('present by default; absent and late override per name', () {
    final marks = _resolve('Aarav, Bhavna absent, Uma late');
    expect(marks, {
      's1': AttendanceStatus.present,
      's2': AttendanceStatus.absent,
      's3': AttendanceStatus.late,
    });
  });

  test('a status word only affects the name it follows', () {
    final marks = _resolve('Aarav present Bhavna Uma absent');
    expect(marks['s1'], AttendanceStatus.present);
    expect(marks['s2'], AttendanceStatus.present); // owns nothing but its name
    expect(marks['s3'], AttendanceStatus.absent);
  });

  test('matches a distinctive first name alone', () {
    expect(_resolve('Dhruv is absent today'), {'s4': AttendanceStatus.absent});
  });

  test('is case-insensitive and ignores punctuation', () {
    expect(_resolve('AARAV!!  bhavna...'), {
      's1': AttendanceStatus.present,
      's2': AttendanceStatus.present,
    });
  });

  test('unrecognised names and ambient words mark no one', () {
    expect(_resolve('the class is noisy today'), isEmpty);
    expect(_resolve('Rohit and Kavya'), isEmpty); // not on the roster
  });

  test('an empty transcript is empty', () {
    expect(_resolve(''), isEmpty);
    expect(_resolve('   '), isEmpty);
  });

  test('Devanagari names and status words resolve', () {
    const roster = <RollCallStudent>[
      (id: 'a', name: 'आरव'),
      (id: 'b', name: 'भावना'),
      (id: 'c', name: 'उमा'),
    ];
    final marks = RollCallResolver.resolve(
      transcript: 'आरव, भावना अनुपस्थित, उमा देर',
      roster: roster,
    );
    expect(marks, {
      'a': AttendanceStatus.present,
      'b': AttendanceStatus.absent,
      'c': AttendanceStatus.late,
    });
  });

  test('order of names in the transcript does not matter for status ownership', () {
    final marks = _resolve('Uma late Aarav');
    expect(marks['s3'], AttendanceStatus.late);
    expect(marks['s1'], AttendanceStatus.present);
  });
}
