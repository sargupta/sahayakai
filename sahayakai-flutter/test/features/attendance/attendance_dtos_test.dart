import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/attendance/data/attendance_errors.dart';
import 'package:sahayakai/features/attendance/data/dto/attendance_dtos.dart';
import 'package:sahayakai/features/attendance/domain/attendance_date.dart';
import 'package:sahayakai/features/attendance/domain/attendance_record.dart';

/// Wire contracts for `/api/attendance/*`, pinned against the route shells and
/// `src/server/attendance.ts` in `sahayakai-main`.
///
/// The load-bearing group is the last one: the roster projection's fail-closed
/// guard. The masked projection is DRAFT PR #124 and unmerged, so the shape
/// production returns today is the full student document — and the decoder must
/// refuse it rather than hand every parent's phone number to the handset.
void main() {
  group('CreateClassRequestDto', () {
    test('sends the five fields the route schema requires', () {
      final json = CreateClassRequestDto.build(
        name: '  Class 6A  ',
        subject: 'Science',
        gradeLevel: 'Class 6',
        academicYear: '2026-27',
        section: 'A',
      ).toJson();

      expect(json, <String, dynamic>{
        'name': 'Class 6A',
        'subject': 'Science',
        'gradeLevel': 'Class 6',
        'academicYear': '2026-27',
        'section': 'A',
      });
    });

    test('omits a blank section rather than sending null', () {
      final json = CreateClassRequestDto.build(
        name: 'Class 6',
        subject: 'Science',
        gradeLevel: 'Class 6',
        academicYear: '2026-27',
        section: '   ',
      ).toJson();

      expect(json.containsKey('section'), isFalse);
    });
  });

  group('AttendanceClassDto', () {
    test('decodes a class list and drops the server-trusted teacherUid', () {
      final classes = AttendanceClassDto.decodeList(<dynamic>[
        <String, dynamic>{
          'id': 'c1',
          'teacherUid': 'teacher-A',
          'name': 'Class 6A',
          'subject': 'Science',
          'gradeLevel': 'Class 6',
          'section': 'A',
          'academicYear': '2026-27',
          'studentCount': 12,
          'createdAt': '2026-06-01T00:00:00.000Z',
          'updatedAt': '2026-06-02T00:00:00.000Z',
        },
      ]);

      expect(classes, hasLength(1));
      final only = classes.single;
      expect(only.id, 'c1');
      expect(only.name, 'Class 6A');
      expect(only.section, 'A');
      expect(only.studentCount, 12);
      expect(only.isFull, isFalse);
      // teacherUid is not modelled at all — ownership is a server decision.
      expect(only.toString(), isNot(contains('teacher-A')));
    });

    test('tolerates a missing studentCount and a shapeless body', () {
      final classes = AttendanceClassDto.decodeList(<dynamic>[
        <String, dynamic>{'id': 'c1'},
      ]);
      expect(classes.single.studentCount, 0);
      expect(classes.single.isFull, isFalse);

      expect(AttendanceClassDto.decodeList(null), isEmpty);
      expect(AttendanceClassDto.decodeList(<String, dynamic>{}), isEmpty);
    });

    test('drops an entry with no id — it can address no nested route', () {
      expect(
        AttendanceClassDto.decodeList(<dynamic>[
          <String, dynamic>{'name': 'Orphan'},
        ]),
        isEmpty,
      );
    });
  });

  group('AddStudentRequestDto', () {
    test('sends exactly the four fields the schema requires', () {
      final json = AddStudentRequestDto.build(
        name: '  Asha Devi ',
        rollNumber: 7,
        parentPhone: '9876543210',
        parentLanguage: 'Hindi',
      ).toJson();

      expect(json, <String, dynamic>{
        'name': 'Asha Devi',
        'rollNumber': 7,
        'parentPhone': '9876543210',
        'parentLanguage': 'Hindi',
      });
    });

    test('refuses an out-of-range roll number before a request exists', () {
      // The server would 400 with `Roll number must be 1–40`; the point of the
      // client-side rule is that the teacher never waits for that round trip.
      expect(
        () => AddStudentRequestDto.build(
          name: 'Asha',
          rollNumber: 41,
          parentPhone: '9876543210',
          parentLanguage: 'Hindi',
        ),
        throwsA(isA<ArgumentError>()),
      );
      expect(
        () => AddStudentRequestDto.build(
          name: 'Asha',
          rollNumber: 41.5,
          parentPhone: '9876543210',
          parentLanguage: 'Hindi',
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('a whole number arriving as a double is normalised to int', () {
      final json = AddStudentRequestDto.build(
        name: 'Asha',
        rollNumber: 7.0,
        parentPhone: '9876543210',
        parentLanguage: 'Hindi',
      ).toJson();
      expect(json['rollNumber'], 7);
      expect(json['rollNumber'], isA<int>());
    });
  });

  group('SaveAttendanceRequestDto', () {
    test('sends { date, records } with the enum wire tokens', () {
      final json = const SaveAttendanceRequestDto(
        date: AttendanceDate(2026, 8, 19),
        statuses: <String, AttendanceStatus>{
          's1': AttendanceStatus.present,
          's2': AttendanceStatus.absent,
          's3': AttendanceStatus.late,
        },
      ).toJson();

      expect(json['date'], '2026-08-19');
      expect(json['records'], <String, String>{
        's1': 'present',
        's2': 'absent',
        's3': 'late',
      });
    });
  });

  group('DailyAttendanceDto', () {
    test('decodes one day and drops an unreadable status', () {
      final record = DailyAttendanceDto.decodeOne(<String, dynamic>{
        'classId': 'c1',
        'date': '2026-08-19',
        'teacherUid': 'teacher-A',
        'records': <String, dynamic>{
          's1': 'present',
          's2': 'absent',
          // A status this client does not know decodes to "not marked" — never
          // to a guessed present or absent.
          's3': 'excused',
          's4': 42,
        },
        'submittedAt': '2026-08-19T04:00:00.000Z',
        'isFinalized': false,
      });

      expect(record, isNotNull);
      expect(record!.date.wire, '2026-08-19');
      expect(record.statusFor('s1'), AttendanceStatus.present);
      expect(record.statusFor('s2'), AttendanceStatus.absent);
      expect(record.statusFor('s3'), isNull);
      expect(record.statusFor('s4'), isNull);
      expect(record.markedCount, 2);
      expect(record.isFinalized, isFalse);
    });

    test('an unmarked day comes back as JSON null → null', () {
      expect(DailyAttendanceDto.decodeOne(null), isNull);
      expect(DailyAttendanceDto.decodeOne(<dynamic>[]), isNull);
    });

    test('falls back to the requested date when the body omits it', () {
      final record = DailyAttendanceDto.decodeOne(<String, dynamic>{
        'classId': 'c1',
        'records': <String, dynamic>{},
      }, forDate: const AttendanceDate(2026, 8, 19));
      expect(record!.date.wire, '2026-08-19');
    });

    test('decodes a month keyed by the doc-id date', () {
      final month = DailyAttendanceDto.decodeMonth(<String, dynamic>{
        '2026-08-18': <String, dynamic>{
          'classId': 'c1',
          'date': '2026-08-18',
          'records': <String, dynamic>{'s1': 'absent'},
        },
        // The key is the Firestore doc id and therefore authoritative; an entry
        // whose body omits `date` is still placed correctly.
        '2026-08-19': <String, dynamic>{
          'classId': 'c1',
          'records': <String, dynamic>{'s1': 'present'},
        },
        'not-a-date': <String, dynamic>{'records': <String, dynamic>{}},
      });

      expect(month, hasLength(2));
      expect(
        month[const AttendanceDate(2026, 8, 18)]!.statusFor('s1'),
        AttendanceStatus.absent,
      );
      expect(
        month[const AttendanceDate(2026, 8, 19)]!.statusFor('s1'),
        AttendanceStatus.present,
      );
    });
  });

  group('StudentAttendanceSummaryDto', () {
    test('decodes the monthly rollup', () {
      final summaries = StudentAttendanceSummaryDto.decodeList(<dynamic>[
        <String, dynamic>{
          'studentId': 's1',
          'studentName': 'Asha Devi',
          'rollNumber': 1,
          'totalDays': 20,
          'presentDays': 17,
          'absentDays': 2,
          'lateDays': 1,
          'attendanceRate': 85,
          'consecutiveAbsences': 2,
        },
      ]);

      final only = summaries.single;
      expect(only.studentId, 's1');
      expect(only.attendanceRate, 85);
      expect(only.consecutiveAbsences, 2);
    });

    test('an empty month defaults to 100%, not 0% — the server default', () {
      final summaries = StudentAttendanceSummaryDto.decodeList(<dynamic>[
        <String, dynamic>{'studentId': 's1', 'studentName': 'Asha'},
      ]);
      expect(summaries.single.attendanceRate, 100);
      expect(summaries.single.totalDays, 0);
    });
  });

  group('decodeStringList', () {
    test('keeps non-blank strings and drops everything else', () {
      expect(
        decodeStringList(<dynamic>['2026-08-19', '  ', 7, null, ' s2 ']),
        <String>['2026-08-19', 's2'],
      );
      expect(decodeStringList(null), isEmpty);
    });
  });

  // ── The PII gate ───────────────────────────────────────────────────────────

  group('RosterStudentDto — the masked projection fails closed', () {
    /// The exact six-field shape draft PR #124 returns.
    List<Map<String, dynamic>> maskedBody() => <Map<String, dynamic>>[
      <String, dynamic>{
        'id': 's1',
        'name': 'Asha Devi',
        'rollNumber': 1,
        'parentLanguage': 'Hindi',
        'hasParentPhone': true,
        'parentPhoneLast4': '3210',
      },
      <String, dynamic>{
        'id': 's2',
        'name': 'Bikash Roy',
        'rollNumber': 2,
        'parentLanguage': 'Bengali',
        'hasParentPhone': false,
        'parentPhoneLast4': '',
      },
    ];

    /// What production returns TODAY for the same request, because the
    /// `projection` parameter is not merged yet and is therefore ignored: the
    /// whole student document, full E.164 number included.
    List<Map<String, dynamic>> unmaskedBody() => <Map<String, dynamic>>[
      <String, dynamic>{
        'id': 's1',
        'classId': 'c1',
        'name': 'Asha Devi',
        'rollNumber': 1,
        'parentPhone': '+919876543210',
        'parentLanguage': 'Hindi',
        'createdAt': '2026-06-01T00:00:00.000Z',
        'updatedAt': '2026-06-01T00:00:00.000Z',
      },
    ];

    test('decodes the masked shape', () {
      final roster = RosterStudentDto.decodeList(maskedBody());

      expect(roster, hasLength(2));
      expect(roster.first.id, 's1');
      expect(roster.first.rollNumber, 1);
      expect(roster.first.hasParentPhone, isTrue);
      expect(roster.first.parentPhoneLast4, '3210');

      // '' means "nothing safe to show" and is normalised to null, so the UI
      // has one absent case rather than two.
      expect(roster.last.hasParentPhone, isFalse);
      expect(roster.last.parentPhoneLast4, isNull);
    });

    test(
      'REFUSES the unmasked document — the fallback that would leak PII',
      () {
        expect(
          () => RosterStudentDto.decodeList(unmaskedBody()),
          throwsA(isA<RosterProjectionUnavailableException>()),
        );
      },
    );

    test('the thrown error never quotes the body it rejected', () {
      // An error string carrying the numbers is the same leak by a slower
      // route — including through a crash report.
      Object? thrown;
      try {
        RosterStudentDto.decodeList(unmaskedBody());
      } catch (e) {
        thrown = e;
      }
      expect(thrown, isA<RosterProjectionUnavailableException>());
      final text = thrown.toString();
      expect(text, isNot(contains('9876543210')));
      expect(text, isNot(contains('+91')));
      expect(text, isNot(contains('Asha')));
    });

    test('the allowlist rejects ANY extra key, not just parentPhone', () {
      // A denylist would only stop the field someone thought to ban. This is
      // the same discipline the server-side projection uses: name the six
      // fields, reject the rest.
      final body = maskedBody();
      body.first['parentEmail'] = 'guardian@example.com';

      expect(
        () => RosterStudentDto.decodeList(body),
        throwsA(isA<RosterProjectionUnavailableException>()),
      );
    });

    test('a missing projection field is refused too', () {
      final body = maskedBody();
      body.first.remove('hasParentPhone');

      expect(
        () => RosterStudentDto.decodeList(body),
        throwsA(isA<RosterProjectionUnavailableException>()),
      );
    });

    test('a "mask" longer than four digits is not a mask', () {
      final body = maskedBody();
      body.first['parentPhoneLast4'] = '9876543210';

      expect(
        () => RosterStudentDto.decodeList(body),
        throwsA(isA<RosterProjectionUnavailableException>()),
      );
    });

    test('a non-digit mask is refused', () {
      final body = maskedBody();
      body.first['parentPhoneLast4'] = '+321';

      expect(
        () => RosterStudentDto.decodeList(body),
        throwsA(isA<RosterProjectionUnavailableException>()),
      );
    });

    test('a mistyped field is refused rather than coerced', () {
      final body = maskedBody();
      body.first['hasParentPhone'] = 'true';

      expect(
        () => RosterStudentDto.decodeList(body),
        throwsA(isA<RosterProjectionUnavailableException>()),
      );
    });

    test('a non-list body is refused', () {
      expect(
        () => RosterStudentDto.decodeList(<String, dynamic>{'students': []}),
        throwsA(isA<RosterProjectionUnavailableException>()),
      );
      expect(
        () => RosterStudentDto.decodeList(null),
        throwsA(isA<RosterProjectionUnavailableException>()),
      );
    });

    test('one bad entry fails the whole read, never a partial roster', () {
      // A roster that silently dropped the students it could not mask is a
      // roster the teacher would act on as if it were complete.
      final body = <Map<String, dynamic>>[...maskedBody(), ...unmaskedBody()];

      expect(
        () => RosterStudentDto.decodeList(body),
        throwsA(isA<RosterProjectionUnavailableException>()),
      );
    });

    test('an empty class decodes to an empty roster, not an error', () {
      expect(RosterStudentDto.decodeList(<dynamic>[]), isEmpty);
    });

    test('no decoded roster can serialize a full phone number', () {
      // Structural: whatever the masked body held, the domain objects have
      // nowhere to keep an E.164 number.
      final roster = RosterStudentDto.decodeList(maskedBody());
      final serialized = jsonEncode(
        roster
            .map(
              (s) => <String, dynamic>{
                'id': s.id,
                'name': s.name,
                'rollNumber': s.rollNumber,
                'parentLanguage': s.parentLanguage,
                'hasParentPhone': s.hasParentPhone,
                'parentPhoneLast4': s.parentPhoneLast4,
              },
            )
            .toList(),
      );
      expect(serialized, isNot(contains('9876543210')));
      expect(serialized, contains('3210'));
    });
  });
}
