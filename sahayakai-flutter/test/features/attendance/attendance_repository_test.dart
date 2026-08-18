import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/core/platform/clock.dart';
import 'package:sahayakai/features/attendance/data/attendance_errors.dart';
import 'package:sahayakai/features/attendance/data/attendance_repository.dart';
import 'package:sahayakai/features/attendance/data/dto/attendance_dtos.dart';
import 'package:sahayakai/features/attendance/domain/attendance_date.dart';
import 'package:sahayakai/features/attendance/domain/attendance_record.dart';
import 'package:sahayakai/features/attendance/domain/attendance_write_result.dart';

import '../../support/fake_api_client.dart';

/// The attendance route contracts through the repository layer. Nothing opens a
/// socket — [FakeApiClient] stands in.
///
/// Three things this file exists to pin, beyond the plain route shapes:
///
///  1. **The premium gate is a value.** A 403 `PREMIUM_REQUIRED` on a write
///     returns `AttendanceWriteBlockedByPlan`; it does not throw. An ownership
///     403 and a 401 still throw, and stay `ApiException`.
///  2. **The IST window is checked before sending.** The clock is injected as a
///     fixed 20:00 UTC instant — 01:30 IST the next day — where a device-local
///     computation picks the wrong day.
///  3. **The roster read fails closed.** An unmasked reply, or a route that
///     rejects the projection, aborts the read instead of decoding every
///     parent's phone number.
void main() {
  /// 2026-08-18T20:00Z == 2026-08-19T01:30 IST. The teacher's "today" is the
  /// 19th; the UTC day is still the 18th.
  final lateEveningUtc = DateTime.utc(2026, 8, 18, 20);

  AttendanceRepository repo(FakeApiClient client) =>
      AttendanceRepository(client, () => lateEveningUtc);

  const unauthorized = ApiException(
    ApiErrorKind.unauthorized,
    'Please sign in again.',
    statusCode: 401,
  );

  /// The plan gate: `requireProPlan` throws `PREMIUM_REQUIRED`, and
  /// `attendanceErrorStatus` maps it to 403 with the same string as the body's
  /// `error` — which is what `ApiException.errorCode` carries.
  const premiumRequired = ApiException(
    ApiErrorKind.forbidden,
    'PREMIUM_REQUIRED',
    statusCode: 403,
    errorCode: 'PREMIUM_REQUIRED',
  );

  /// The OTHER 403: `Unauthorized`, thrown when the class belongs to a
  /// different teacher. Not a plan problem, and deliberately not specialized.
  const ownershipForbidden = ApiException(
    ApiErrorKind.forbidden,
    'Unauthorized',
    statusCode: 403,
    errorCode: 'Unauthorized',
  );

  ApiException validation(String message) => ApiException(
        ApiErrorKind.badResponse,
        message,
        statusCode: 400,
        errorCode: message,
      );

  ApiException notFound(String message) => ApiException(
        ApiErrorKind.notFound,
        'Not found.',
        statusCode: 404,
        errorCode: message,
      );

  AddStudentRequestDto studentRequest() => AddStudentRequestDto.build(
        name: 'Asha Devi',
        rollNumber: 7,
        parentPhone: '9876543210',
        parentLanguage: 'Hindi',
      );

  List<Map<String, dynamic>> maskedRoster() => <Map<String, dynamic>>[
        <String, dynamic>{
          'id': 's1',
          'name': 'Asha Devi',
          'rollNumber': 1,
          'parentLanguage': 'Hindi',
          'hasParentPhone': true,
          'parentPhoneLast4': '3210',
        },
      ];

  // ── Classes ────────────────────────────────────────────────────────────────

  group('listClasses — GET /api/attendance/classes', () {
    test('hits the route and decodes the list', () async {
      final client = FakeApiClient(
        getResponse: <dynamic>[
          <String, dynamic>{
            'id': 'c1',
            'name': 'Class 6A',
            'subject': 'Science',
            'gradeLevel': 'Class 6',
            'academicYear': '2026-27',
            'studentCount': 39,
          },
        ],
      );

      final classes = await repo(client).listClasses();

      expect(client.gets.single.path, '/api/attendance/classes');
      expect(classes.single.id, 'c1');
      expect(classes.single.remainingSeats, 1);
    });

    test('401 stays an ApiException so the auth gate can handle it', () async {
      final client = FakeApiClient(error: unauthorized);
      await expectLater(
        repo(client).listClasses(),
        throwsA(isA<ApiException>().having((e) => e.isAuth, 'isAuth', isTrue)),
      );
    });

    test('an ownership 403 stays an ApiException, not a plan error', () async {
      final client = FakeApiClient(error: ownershipForbidden);
      await expectLater(
        repo(client).listClasses(),
        throwsA(
          allOf(
            isA<ApiException>(),
            isNot(isA<AttendanceException>()),
          ),
        ),
      );
    });
  });

  group('getClass — GET /api/attendance/classes/{id}', () {
    test('percent-encodes the class id into the path', () async {
      final client = FakeApiClient(getResponse: <String, dynamic>{'id': 'a b'});
      await repo(client).getClass('a b');
      expect(client.gets.single.path, '/api/attendance/classes/a%20b');
    });

    test('a null body means "no such class"', () async {
      final client = FakeApiClient();
      expect(await repo(client).getClass('c1'), isNull);
    });
  });

  group('createClass — POST /api/attendance/classes (premium)', () {
    CreateClassRequestDto request() => CreateClassRequestDto.build(
          name: 'Class 6A',
          subject: 'Science',
          gradeLevel: 'Class 6',
          academicYear: '2026-27',
        );

    test('accepted write returns the new classId', () async {
      final client = FakeApiClient(postResponse: {'classId': 'c1'});

      final result = await repo(client).createClass(request());

      expect(result, isA<AttendanceWriteAccepted<String>>());
      expect(result.valueOrNull, 'c1');
      expect(client.posts.single.path, '/api/attendance/classes');
      expect(
        (client.posts.single.data! as Map<String, dynamic>)['name'],
        'Class 6A',
      );
    });

    test('a 200 with no classId is a malformed success, not an empty id',
        () async {
      final client = FakeApiClient(postResponse: {'classId': ''});
      await expectLater(
        repo(client).createClass(request()),
        throwsA(
          isA<ApiException>()
              .having((e) => e.kind, 'kind', ApiErrorKind.badResponse),
        ),
      );
    });

    test(
      '403 PREMIUM_REQUIRED is RETURNED as a blocked write, not thrown',
      () async {
        // The register stays readable for a free-plan teacher; only the write
        // is gated, and the server itself logs this at WARN as an expected
        // business case. Making the caller catch an exception for the expected
        // path is what this models away.
        final client = FakeApiClient(postError: premiumRequired);

        final result = await repo(client).createClass(request());

        expect(result, isA<AttendanceWriteBlockedByPlan<String>>());
        expect(result.isBlockedByPlan, isTrue);
        expect(result.valueOrNull, isNull);
      },
    );

    test('an ownership 403 still throws — it is not the plan gate', () async {
      final client = FakeApiClient(postError: ownershipForbidden);
      await expectLater(
        repo(client).createClass(request()),
        throwsA(isA<ApiException>()),
      );
    });

    test('401 still throws, as an ApiException', () async {
      final client = FakeApiClient(postError: unauthorized);
      await expectLater(
        repo(client).createClass(request()),
        throwsA(isA<ApiException>().having((e) => e.isAuth, 'isAuth', isTrue)),
      );
    });

    test('400 Class name is required → AttendanceValidationException',
        () async {
      final client = FakeApiClient(
        postError: validation('Class name is required'),
      );
      await expectLater(
        repo(client).createClass(request()),
        throwsA(isA<AttendanceValidationException>()),
      );
    });
  });

  // ── Students ───────────────────────────────────────────────────────────────

  group('addStudent — POST .../students (premium, 40-cap)', () {
    test('accepted write returns the new studentId', () async {
      final client = FakeApiClient(postResponse: {'studentId': 's1'});

      final result = await repo(client).addStudent('c1', studentRequest());

      expect(result.valueOrNull, 's1');
      expect(
        client.posts.single.path,
        '/api/attendance/classes/c1/students',
      );
      final body = client.posts.single.data! as Map<String, dynamic>;
      expect(body['rollNumber'], 7);
      expect(body['parentLanguage'], 'Hindi');
    });

    test('403 PREMIUM_REQUIRED is a blocked write', () async {
      final client = FakeApiClient(postError: premiumRequired);
      final result = await repo(client).addStudent('c1', studentRequest());
      expect(result.isBlockedByPlan, isTrue);
    });

    test('400 Maximum 40 students per class → ClassFullException', () async {
      // The client mirrors the cap, so reaching this means the count moved
      // under the UI — another device added the 40th student.
      final client = FakeApiClient(
        postError: validation('Maximum 40 students per class'),
      );
      await expectLater(
        repo(client).addStudent('c1', studentRequest()),
        throwsA(
          isA<ClassFullException>()
              .having((e) => e.maxStudents, 'maxStudents', 40),
        ),
      );
    });

    test('400 Roll number … → RollNumberOutOfRangeException (either wording)',
        () async {
      // Matched by prefix, so the en-dash in `1–40` never has to survive a
      // round trip through the client.
      for (final message in <String>[
        'Roll number must be 1–40',
        'Roll number must be an integer',
      ]) {
        final client = FakeApiClient(postError: validation(message));
        await expectLater(
          repo(client).addStudent('c1', studentRequest()),
          throwsA(isA<RollNumberOutOfRangeException>()),
        );
      }
    });

    test('400 Invalid phone number → InvalidParentPhoneException', () async {
      final client = FakeApiClient(
        postError: validation(
          'Invalid phone number — enter a 10-digit Indian mobile number',
        ),
      );
      await expectLater(
        repo(client).addStudent('c1', studentRequest()),
        throwsA(isA<InvalidParentPhoneException>()),
      );
    });

    test('404 Class not found → ClassNotFoundException', () async {
      final client = FakeApiClient(postError: notFound('Class not found'));
      await expectLater(
        repo(client).addStudent('c1', studentRequest()),
        throwsA(isA<ClassNotFoundException>()),
      );
    });

    test('404 User not found → TeacherProfileNotFoundException', () async {
      // requireProPlan could not read `users/{uid}` — an onboarding gap, not a
      // sign-in problem, and it must not be mistaken for a missing class.
      final client = FakeApiClient(postError: notFound('User not found'));
      await expectLater(
        repo(client).addStudent('c1', studentRequest()),
        throwsA(isA<TeacherProfileNotFoundException>()),
      );
    });
  });

  // ── Roster: the PII gate ───────────────────────────────────────────────────

  group('listRoster — GET .../students?projection=roster', () {
    test('always asks for the masked projection', () async {
      final client = FakeApiClient(getResponse: maskedRoster());

      final roster = await repo(client).listRoster('c1');

      expect(client.gets.single.path, '/api/attendance/classes/c1/students');
      expect(client.gets.single.query, <String, dynamic>{
        'projection': 'roster',
      });
      expect(roster.single.id, 's1');
      expect(roster.single.parentPhoneLast4, '3210');
    });

    test(
      'REFUSES an unmasked reply rather than decoding parent phone numbers',
      () async {
        // This is what production returns TODAY: PR #124 is unmerged, so the
        // unknown `projection` parameter is ignored and the full student
        // documents come back. Falling back to them would put every parent's
        // E.164 number on the handset, silently, on the first real run.
        final client = FakeApiClient(
          getResponse: <dynamic>[
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
          ],
        );

        await expectLater(
          repo(client).listRoster('c1'),
          throwsA(isA<RosterProjectionUnavailableException>()),
        );
      },
    );

    test(
      'a 400 from the projection route also fails closed, not as a validation '
      'error',
      () async {
        // Once PR #124 merges, an unrecognised `projection` is a 400. On this
        // path that means the deployment does not know `roster` — the same
        // fail-closed case, not something to show the teacher.
        final client = FakeApiClient(
          error: validation('Invalid query parameters'),
        );

        await expectLater(
          repo(client).listRoster('c1'),
          throwsA(
            isA<RosterProjectionUnavailableException>()
                .having((e) => e.reason, 'reason', 'rejected'),
          ),
        );
      },
    );

    test('401 on the roster still surfaces as auth, not as the PII guard',
        () async {
      final client = FakeApiClient(error: unauthorized);
      await expectLater(
        repo(client).listRoster('c1'),
        throwsA(
          allOf(
            isA<ApiException>().having((e) => e.isAuth, 'isAuth', isTrue),
            isNot(isA<RosterProjectionUnavailableException>()),
          ),
        ),
      );
    });

    test('404 Class not found is still a class error', () async {
      final client = FakeApiClient(error: notFound('Class not found'));
      await expectLater(
        repo(client).listRoster('c1'),
        throwsA(isA<ClassNotFoundException>()),
      );
    });
  });

  // ── Register ───────────────────────────────────────────────────────────────

  group('attendanceOn / attendanceForMonth — GET .../records', () {
    test('one day is addressed by ?date=', () async {
      final client = FakeApiClient(
        getResponse: <String, dynamic>{
          'classId': 'c1',
          'date': '2026-08-19',
          'records': <String, dynamic>{'s1': 'present'},
        },
      );

      final record = await repo(client)
          .attendanceOn('c1', const AttendanceDate(2026, 8, 19));

      expect(client.gets.single.path, '/api/attendance/classes/c1/records');
      expect(client.gets.single.query, <String, dynamic>{
        'date': '2026-08-19',
      });
      expect(record!.statusFor('s1'), AttendanceStatus.present);
    });

    test('an unmarked day comes back null', () async {
      final client = FakeApiClient();
      expect(
        await repo(client).attendanceOn('c1', const AttendanceDate(2026, 8, 19)),
        isNull,
      );
    });

    test('a month is addressed by ?year=&month=', () async {
      final client = FakeApiClient(
        getResponse: <String, dynamic>{
          '2026-08-19': <String, dynamic>{
            'classId': 'c1',
            'records': <String, dynamic>{'s1': 'absent'},
          },
        },
      );

      final month =
          await repo(client).attendanceForMonth('c1', year: 2026, month: 8);

      expect(client.gets.single.query, <String, dynamic>{
        'year': 2026,
        'month': 8,
      });
      expect(
        month[const AttendanceDate(2026, 8, 19)]!.statusFor('s1'),
        AttendanceStatus.absent,
      );
    });
  });

  group('saveAttendance — POST .../records (premium, IST window)', () {
    const statuses = <String, AttendanceStatus>{
      's1': AttendanceStatus.present,
      's2': AttendanceStatus.absent,
    };

    test('the window is the IST one, from the injected clock', () {
      final window = repo(FakeApiClient()).markableWindow;
      // 20:00 UTC is 01:30 IST on the 19th. A device-local computation would
      // give the 18th here.
      expect(window.today.wire, '2026-08-19');
      expect(window.earliest.wire, '2026-08-12');
    });

    test('the teacher\'s IST today is accepted at 01:30 IST', () async {
      // The exact regression: a client computing "today" from the UTC instant
      // would refuse the 19th as a future date, while the server accepts it.
      final client = FakeApiClient(postResponse: {'success': true});

      final result = await repo(client).saveAttendance(
        'c1',
        date: const AttendanceDate(2026, 8, 19),
        statuses: statuses,
      );

      expect(result, isA<AttendanceWriteAccepted<AttendanceDate>>());
      expect(result.valueOrNull, const AttendanceDate(2026, 8, 19));
      expect(client.posts.single.path, '/api/attendance/classes/c1/records');
      final body = client.posts.single.data! as Map<String, dynamic>;
      expect(body['date'], '2026-08-19');
      expect(body['records'], <String, String>{
        's1': 'present',
        's2': 'absent',
      });
    });

    test('the seventh day back is still markable', () async {
      final client = FakeApiClient(postResponse: {'success': true});
      final result = await repo(client).saveAttendance(
        'c1',
        date: const AttendanceDate(2026, 8, 12),
        statuses: statuses,
      );
      expect(result.isBlockedByPlan, isFalse);
      expect(client.posts, hasLength(1));
    });

    test('a future date is refused locally, with NO request sent', () async {
      final client = FakeApiClient(postResponse: {'success': true});

      await expectLater(
        repo(client).saveAttendance(
          'c1',
          date: const AttendanceDate(2026, 8, 20),
          statuses: statuses,
        ),
        throwsA(
          isA<AttendanceDateOutOfWindowException>()
              .having((e) => e.rejection, 'rejection',
                  AttendanceDateRejection.future)
              .having((e) => e.isLocal, 'isLocal', isTrue),
        ),
      );
      // A round trip on a rural connection to be told what the client could
      // compute is not a good use of the teacher's time.
      expect(client.posts, isEmpty);
    });

    test('a date older than the window is refused locally too', () async {
      final client = FakeApiClient(postResponse: {'success': true});

      await expectLater(
        repo(client).saveAttendance(
          'c1',
          date: const AttendanceDate(2026, 8, 11),
          statuses: statuses,
        ),
        throwsA(
          isA<AttendanceDateOutOfWindowException>()
              .having((e) => e.rejection, 'rejection',
                  AttendanceDateRejection.tooOld)
              .having((e) => e.isLocal, 'isLocal', isTrue),
        ),
      );
      expect(client.posts, isEmpty);
    });

    test('a server-side window 400 is still typed, and marked non-local',
        () async {
      // In-window for the client, refused by the server: the two clocks
      // genuinely disagree (a stale handset clock). Distinguishable from the
      // pre-flight refusal by isLocal.
      final client = FakeApiClient(
        postError: validation('Cannot mark attendance for future dates'),
      );

      await expectLater(
        repo(client).saveAttendance(
          'c1',
          date: const AttendanceDate(2026, 8, 19),
          statuses: statuses,
        ),
        throwsA(
          isA<AttendanceDateOutOfWindowException>()
              .having((e) => e.rejection, 'rejection',
                  AttendanceDateRejection.future)
              .having((e) => e.isLocal, 'isLocal', isFalse),
        ),
      );
    });

    test('a server-side "older than 7 days" 400 maps to tooOld', () async {
      final client = FakeApiClient(
        postError: validation('Cannot mark attendance older than 7 days'),
      );

      await expectLater(
        repo(client).saveAttendance(
          'c1',
          date: const AttendanceDate(2026, 8, 19),
          statuses: statuses,
        ),
        throwsA(
          isA<AttendanceDateOutOfWindowException>().having(
              (e) => e.rejection, 'rejection', AttendanceDateRejection.tooOld),
        ),
      );
    });

    test('403 PREMIUM_REQUIRED is a blocked write, not an exception', () async {
      // The free-plan teacher's read-only register: everything above reads
      // fine, and marking returns a value the UI turns into an upsell.
      final client = FakeApiClient(postError: premiumRequired);

      final result = await repo(client).saveAttendance(
        'c1',
        date: const AttendanceDate(2026, 8, 19),
        statuses: statuses,
      );

      expect(result, isA<AttendanceWriteBlockedByPlan<AttendanceDate>>());
    });

    test('a forged records map 400 surfaces as a validation error', () async {
      final client = FakeApiClient(
        postError: validation('Unknown student in attendance records: s9'),
      );
      await expectLater(
        repo(client).saveAttendance(
          'c1',
          date: const AttendanceDate(2026, 8, 19),
          statuses: statuses,
        ),
        throwsA(isA<AttendanceValidationException>()),
      );
    });
  });

  // ── Summaries and triage signals ───────────────────────────────────────────

  group('studentSummaries — GET .../summaries', () {
    test('addresses the month and decodes the rollups', () async {
      final client = FakeApiClient(
        getResponse: <dynamic>[
          <String, dynamic>{
            'studentId': 's1',
            'studentName': 'Asha Devi',
            'rollNumber': 1,
            'totalDays': 20,
            'presentDays': 18,
            'absentDays': 2,
            'attendanceRate': 90,
            'consecutiveAbsences': 2,
          },
        ],
      );

      final summaries =
          await repo(client).studentSummaries('c1', year: 2026, month: 8);

      expect(client.gets.single.path, '/api/attendance/classes/c1/summaries');
      expect(client.gets.single.query, <String, dynamic>{
        'year': 2026,
        'month': 8,
      });
      expect(summaries.single.attendanceRate, 90);
    });
  });

  group('absenceDates — GET .../students/{sid}/absences', () {
    test('decodes the date strings and drops anything unparseable', () async {
      final client = FakeApiClient(
        getResponse: <dynamic>['2026-08-18', '2026-08-14', 'not-a-date'],
      );

      final dates = await repo(client).absenceDates('c1', 's1', limitDays: 14);

      expect(
        client.gets.single.path,
        '/api/attendance/classes/c1/students/s1/absences',
      );
      expect(client.gets.single.query, <String, dynamic>{'limitDays': 14});
      expect(dates.map((d) => d.wire), <String>['2026-08-18', '2026-08-14']);
    });

    test('defaults to the route\'s 30-day lookback', () async {
      final client = FakeApiClient(getResponse: <dynamic>[]);
      await repo(client).absenceDates('c1', 's1');
      expect(client.gets.single.query, <String, dynamic>{'limitDays': 30});
    });

    test('percent-encodes both ids', () async {
      final client = FakeApiClient(getResponse: <dynamic>[]);
      await repo(client).absenceDates('c/1', 's 1');
      expect(
        client.gets.single.path,
        '/api/attendance/classes/c%2F1/students/s%201/absences',
      );
    });
  });

  group('behaviouralOutreachStudentIds — GET .../behavioral-outreach', () {
    test('decodes the studentId set', () async {
      final client = FakeApiClient(getResponse: <dynamic>['s1', 's2', 's1']);

      final ids = await repo(client)
          .behaviouralOutreachStudentIds('c1', lookbackDays: 15);

      expect(
        client.gets.single.path,
        '/api/attendance/classes/c1/behavioral-outreach',
      );
      expect(client.gets.single.query, <String, dynamic>{'lookbackDays': 15});
      expect(ids, <String>{'s1', 's2'});
    });
  });

  // ── Wiring ─────────────────────────────────────────────────────────────────

  group('attendanceRepositoryProvider', () {
    test('composes the api client and the nowProvider clock seam', () {
      final container = ProviderContainer(
        overrides: <Override>[
          apiClientProvider.overrideWithValue(FakeApiClient()),
          nowProvider.overrideWithValue(() => lateEveningUtc),
        ],
      );
      addTearDown(container.dispose);

      final repository = container.read(attendanceRepositoryProvider);
      expect(repository.markableWindow.today.wire, '2026-08-19');
    });
  });
}
