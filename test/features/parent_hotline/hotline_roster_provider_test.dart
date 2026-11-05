import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/auth/auth_providers.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/features/attendance/data/attendance_errors.dart';
import 'package:sahayakai/features/parent_hotline/domain/hotline_roster.dart';
import 'package:sahayakai/features/parent_hotline/domain/hotline_student.dart';
import 'package:sahayakai/features/parent_hotline/presentation/hotline_roster_provider.dart';

import '../../support/fake_api_client.dart';

/// The Parent Hotline roster read.
///
/// The rules this file exists to pin, in order of how much they matter:
///
///  1. **It fails closed.** The masked `?projection=roster` shape is draft PR
///     #124 and is not merged, so `GET .../students` on `origin/main` answers
///     with the full student document. The read must abort with
///     `RosterProjectionUnavailableException` rather than decode a single parent
///     phone number onto the handset — and the error must not quote the body.
///  2. **It always ASKS for the projection.** A read that forgot the query
///     parameter would be handed the unmasked document by a merged route too.
///  3. **An empty roster and an unavailable roster are different answers.** One
///     is data, the other is an error; collapsing them would tell a teacher with
///     40 students that they have none.
///  4. **Per class.** One class that cannot be read is reported ON that class
///     (the picker shows it in place, never as a complete list), and the other
///     classes stay callable. Only a sign-out, or every class failing closed,
///     fails the whole picker.
void main() {
  const classesPath = '/api/attendance/classes';
  const studentsPath = '/api/attendance/classes/c1/students';
  const otherStudentsPath = '/api/attendance/classes/c2/students';

  Map<String, dynamic> classJson({
    String id = 'c1',
    String name = 'Class 6A',
  }) => <String, dynamic>{
    'id': id,
    'name': name,
    'subject': 'Science',
    'gradeLevel': '6',
    'academicYear': '2025-26',
    'studentCount': 1,
  };

  Map<String, dynamic> maskedStudent({
    String id = 's1',
    String name = 'Asha Rao',
    int rollNumber = 7,
    String parentLanguage = 'Kannada',
    bool hasParentPhone = true,
    String last4 = '4821',
  }) => <String, dynamic>{
    'id': id,
    'name': name,
    'rollNumber': rollNumber,
    'parentLanguage': parentLanguage,
    'hasParentPhone': hasParentPhone,
    'parentPhoneLast4': last4,
  };

  /// The whole `students/{id}` document, as production returns it today.
  Map<String, dynamic> unmaskedStudent() => <String, dynamic>{
    'id': 's1',
    'name': 'Asha Rao',
    'rollNumber': 7,
    'parentLanguage': 'Kannada',
    'parentPhone': '+919876543210',
    'classId': 'c1',
    'createdAt': '2026-08-01T10:00:00.000Z',
  };

  ProviderContainer makeContainer({
    required FakeApiClient client,
    bool signedIn = true,
    List<HotlineStudent>? supplied,
  }) {
    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(client),
        isSignedInProvider.overrideWithValue(signedIn),
        if (supplied != null)
          hotlineStudentRosterProvider.overrideWithValue(supplied),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  Future<List<HotlineClassRoster>> read(ProviderContainer container) =>
      container.read(hotlineRosterProvider.future);

  test('decodes the masked projection into HotlineStudents, carrying the class '
      'identity from the class record', () async {
    final client = FakeApiClient(
      getResponsesByPath: <String, Object?>{
        classesPath: [classJson()],
        studentsPath: [
          maskedStudent(),
          maskedStudent(
            id: 's2',
            name: 'Bhavya Nair',
            rollNumber: 8,
            hasParentPhone: false,
            last4: '',
          ),
        ],
      },
    );
    final classes = await read(makeContainer(client: client));
    expect(classes, hasLength(1));
    expect(classes.single.classId, 'c1');
    expect(classes.single.className, 'Class 6A');
    // The class's subject travels with it: the message draft requires one.
    expect(classes.single.subject, 'Science');
    expect(classes.single.failed, isFalse);
    expect(classes.single.reachableCount, 1);
    final roster = classes.single.students;

    expect(roster, hasLength(2));
    expect(roster.first.id, 's1');
    expect(roster.first.name, 'Asha Rao');
    // The projection does not repeat the class per student; it comes from the
    // class record via `RosterStudent.toHotlineStudent`.
    expect(roster.first.classId, 'c1');
    expect(roster.first.className, 'Class 6A');
    expect(roster.first.parentLanguage, 'Kannada');
    expect(roster.first.parentPhoneLast4, '4821');
    // `''` on the wire means "nothing safe to show" — normalised to null so the
    // UI has one absent case, not two.
    expect(roster.last.hasParentPhone, isFalse);
    expect(roster.last.parentPhoneLast4, isNull);
  });

  test('always sends ?projection=roster', () async {
    final client = FakeApiClient(
      getResponsesByPath: <String, Object?>{
        classesPath: [classJson()],
        studentsPath: [maskedStudent()],
      },
    );
    await read(makeContainer(client: client));

    final studentsGet = client.gets.firstWhere((g) => g.path == studentsPath);
    expect(studentsGet.query, <String, dynamic>{'projection': 'roster'});
  });

  test('FAILS CLOSED on the unmasked document production returns today, and '
      'never quotes the phone number it refused', () async {
    final client = FakeApiClient(
      getResponsesByPath: <String, Object?>{
        classesPath: [classJson()],
        studentsPath: [unmaskedStudent()],
      },
    );

    await expectLater(
      read(makeContainer(client: client)),
      throwsA(
        isA<RosterProjectionUnavailableException>().having(
          (e) => e.reason,
          'reason',
          'unmasked',
        ),
      ),
    );

    // An error string carrying the number is the same leak by a slower route.
    try {
      await read(makeContainer(client: client));
      fail('expected a fail-closed throw');
    } on RosterProjectionUnavailableException catch (e) {
      expect(e.toString(), isNot(contains('9876543210')));
      expect(e.message, isNot(contains('9876543210')));
    }
  });

  test(
    'FAILS CLOSED when a merged route rejects the projection (400)',
    () async {
      final client = FakeApiClient(
        getResponsesByPath: <String, Object?>{
          classesPath: [classJson()],
        },
        getErrorsByPath: <String, Object>{
          studentsPath: const ApiException(
            ApiErrorKind.badResponse,
            'Invalid query parameters',
            statusCode: 400,
            errorCode: 'Invalid query parameters',
          ),
        },
      );

      await expectLater(
        read(makeContainer(client: client)),
        throwsA(
          isA<RosterProjectionUnavailableException>().having(
            (e) => e.reason,
            'reason',
            'rejected',
          ),
        ),
      );
    },
  );

  test('one class failing closed is reported ON that class, with no '
      'students decoded; the other class stays callable', () async {
    final client = FakeApiClient(
      getResponsesByPath: <String, Object?>{
        classesPath: [classJson(), classJson(id: 'c2', name: 'Class 7B')],
        studentsPath: [maskedStudent()],
        otherStudentsPath: [unmaskedStudent()],
      },
    );

    final classes = await read(makeContainer(client: client));

    expect(classes.map((c) => c.classId), ['c1', 'c2']);
    expect(classes.first.failed, isFalse);
    expect(classes.first.students.single.id, 's1');
    expect(classes.last.failed, isTrue);
    expect(classes.last.students, isEmpty);
    expect(classes.last.error, isA<RosterProjectionUnavailableException>());
    expect(classes.last.error.toString(), isNot(contains('9876543210')));
  });

  test(
    'a network failure on one class is reported on that class only',
    () async {
      final client = FakeApiClient(
        getResponsesByPath: <String, Object?>{
          classesPath: [classJson(), classJson(id: 'c2', name: 'Class 7B')],
          studentsPath: [maskedStudent()],
        },
        getErrorsByPath: <String, Object>{
          otherStudentsPath: const ApiException(
            ApiErrorKind.network,
            'No connection.',
          ),
        },
      );

      final classes = await read(makeContainer(client: client));

      expect(classes.first.failed, isFalse);
      expect(classes.last.error, isA<ApiException>());
    },
  );

  test('every class failing closed fails the WHOLE picker', () async {
    final client = FakeApiClient(
      getResponsesByPath: <String, Object?>{
        classesPath: [classJson(), classJson(id: 'c2', name: 'Class 7B')],
        studentsPath: [unmaskedStudent()],
        otherStudentsPath: [unmaskedStudent()],
      },
    );

    await expectLater(
      read(makeContainer(client: client)),
      throwsA(isA<RosterProjectionUnavailableException>()),
    );
  });

  test(
    'a 401 on any class read fails the whole picker as signed out',
    () async {
      final client = FakeApiClient(
        getResponsesByPath: <String, Object?>{
          classesPath: [classJson(), classJson(id: 'c2', name: 'Class 7B')],
          studentsPath: [maskedStudent()],
        },
        getErrorsByPath: <String, Object>{
          otherStudentsPath: const ApiException(
            ApiErrorKind.unauthorized,
            'Please sign in again.',
            statusCode: 401,
          ),
        },
      );

      await expectLater(
        read(makeContainer(client: client)),
        throwsA(isA<ApiException>().having((e) => e.isAuth, 'isAuth', isTrue)),
      );
    },
  );

  test('no classes is an EMPTY roster, not an error', () async {
    final client = FakeApiClient(
      getResponsesByPath: <String, Object?>{classesPath: <Object?>[]},
    );
    expect(await read(makeContainer(client: client)), isEmpty);
  });

  test(
    'a signed-out teacher is refused locally, with no request sent',
    () async {
      final client = FakeApiClient();
      await expectLater(
        read(makeContainer(client: client, signedIn: false)),
        throwsA(isA<ApiException>().having((e) => e.isAuth, 'isAuth', isTrue)),
      );
      expect(client.gets, isEmpty);
    },
  );

  test('a 401 from the route stays an auth ApiException', () async {
    final client = FakeApiClient(
      getErrorsByPath: <String, Object>{
        classesPath: const ApiException(
          ApiErrorKind.unauthorized,
          'Please sign in again.',
          statusCode: 401,
        ),
      },
    );
    await expectLater(
      read(makeContainer(client: client)),
      throwsA(isA<ApiException>().having((e) => e.isAuth, 'isAuth', isTrue)),
    );
  });

  test('a SUPPLIED roster wins and fires no request at all', () async {
    final client = FakeApiClient();
    final supplied = [
      const HotlineStudent(
        id: 's9',
        name: 'Supplied Student',
        classId: 'c9',
        className: 'Class 9C',
        parentLanguage: 'Hindi',
      ),
    ];
    final roster = await read(
      makeContainer(client: client, supplied: supplied),
    );

    expect(roster.single.classId, 'c9');
    expect(roster.single.className, 'Class 9C');
    expect(roster.single.students, supplied);
    expect(client.gets, isEmpty);
  });

  test(
    'a SUPPLIED EMPTY roster is a real answer, not "nothing was supplied"',
    () async {
      // The sentinel is null, so an injected empty list must NOT fall through to
      // a network read. This is the distinction the old `const []` default
      // destroyed.
      final client = FakeApiClient();
      expect(
        await read(
          makeContainer(client: client, supplied: const <HotlineStudent>[]),
        ),
        isEmpty,
      );
      expect(client.gets, isEmpty);
    },
  );
}
