import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/features/attendance/presentation/add_student_screen.dart';
import 'package:sahayakai/features/attendance/presentation/attendance_roster_screen.dart';
import 'package:sahayakai/features/attendance/presentation/widgets/attendance_premium_card.dart';
import 'package:sahayakai/shared/widgets/inline_error.dart';
import 'package:sahayakai/shared/widgets/primary_button.dart';

import '../../support/fake_api_client.dart';
import 'attendance_harness.dart';

/// U12 — adding a student.
///
/// This is the one form in the app that handles a parent's full phone number,
/// and it only ever sends it UP: F9-001 forbids the number coming back DOWN,
/// which is what the roster projection masks and the roster decoder refuses.
/// So the tests here are about the two server rules the form enforces before a
/// request exists, and about the plan gate landing as an upsell.
void main() {
  FakeApiClient client({
    List<Map<String, dynamic>>? roster,
    Object? postError,
    Object? postResponse,
  }) => FakeApiClient(
    getResponsesByPath: <String, Object?>{
      studentsPath('c1'):
          roster ??
          <Map<String, dynamic>>[
            maskedStudent(),
            maskedStudent(id: 's3', name: 'Ravi Kumar', rollNumber: 3),
          ],
    },
    postResponsesByPath: postResponse == null
        ? null
        : <String, Object?>{studentsPath('c1'): postResponse},
    postErrorsByPath: postError == null
        ? null
        : <String, Object>{studentsPath('c1'): postError},
  );

  Widget screen() =>
      AddStudentScreen(classId: 'c1', attendanceClass: testClass());

  Future<void> openFromRoster(WidgetTester tester, FakeApiClient api) async {
    await pumpRouted(
      tester,
      client: api,
      initialLocation: Routes.attendanceRosterPath('c1'),
    );
    final l10n = strings(tester, AttendanceRosterScreen);
    await tapVisible(
      tester,
      find.widgetWithText(PrimaryButton, l10n.attendanceAddStudent),
    );
    expect(find.byType(AddStudentScreen), findsOneWidget);
  }

  Future<void> fill(
    WidgetTester tester, {
    String name = 'Meena Devi',
    String? roll,
    String phone = '9876543210',
  }) async {
    await tester.enterText(find.byType(TextFormField).at(0), name);
    if (roll != null) {
      await tester.enterText(find.byType(TextFormField).at(1), roll);
    }
    await tester.enterText(find.byType(TextFormField).at(2), phone);
    await tester.pumpAndSettle();
  }

  Future<void> submit(WidgetTester tester) async {
    final l10n = strings(tester, AddStudentScreen);
    await tapVisible(
      tester,
      find.widgetWithText(PrimaryButton, l10n.attendanceAddStudent),
    );
  }

  group('the roll-number rule is enforced before a request exists', () {
    testWidgets('41 is refused inline, and nothing is sent', (tester) async {
      final api = client();
      await pumpScreen(tester, screen(), client: api);

      await fill(tester, roll: '41');
      await submit(tester);

      final l10n = strings(tester, AddStudentScreen);
      expect(find.text(l10n.attendanceRollNumberInvalid), findsOneWidget);
      expect(api.posts, isEmpty);
    });

    testWidgets('0 is refused inline, and nothing is sent', (tester) async {
      final api = client();
      await pumpScreen(tester, screen(), client: api);

      await fill(tester, roll: '0');
      await submit(tester);

      final l10n = strings(tester, AddStudentScreen);
      expect(find.text(l10n.attendanceRollNumberInvalid), findsOneWidget);
      expect(api.posts, isEmpty);
    });

    testWidgets('a fractional roll number cannot even be typed', (
      tester,
    ) async {
      await pumpScreen(tester, screen(), client: client());

      await tester.enterText(find.byType(TextFormField).at(1), '41.5');
      await tester.pumpAndSettle();

      // The server's own integer check exists because `41.5` slipped through a
      // naive range test in JS. The cheapest place to make that impossible is
      // the keyboard.
      expect(find.text('41.5'), findsNothing);
      expect(find.text('415'), findsOneWidget);
    });

    testWidgets('the lowest free roll number is pre-filled from the roster', (
      tester,
    ) async {
      // The roster holds 1 and 3, so the obvious next number is the gap at 2 —
      // not 4, and not a number the teacher has to hunt for.
      await openFromRoster(tester, client());
      expect(find.text('2'), findsOneWidget);
    });

    testWidgets('no roster means no guessed roll number', (tester) async {
      // The masked projection is unavailable, so there is no list to read a
      // gap from. Guessing one could collide with a student already on the
      // register.
      final api = client(roster: <Map<String, dynamic>>[unmaskedStudent()]);
      await pumpScreen(tester, screen(), client: api);

      final field = tester.widget<TextFormField>(
        find.byType(TextFormField).at(1),
      );
      expect(field.controller?.text, isEmpty);
    });
  });

  group('the parent phone is validated the way the server normalizes it', () {
    testWidgets('a short number is refused inline, and nothing is sent', (
      tester,
    ) async {
      final api = client();
      await pumpScreen(tester, screen(), client: api);

      await fill(tester, roll: '2', phone: '98765');
      await submit(tester);

      final l10n = strings(tester, AddStudentScreen);
      expect(find.text(l10n.attendanceParentPhoneInvalid), findsOneWidget);
      expect(api.posts, isEmpty);
    });

    testWidgets('a 91-prefixed number is accepted', (tester) async {
      final api = client(postResponse: <String, dynamic>{'studentId': 's9'});
      await openFromRoster(tester, api);

      await fill(tester, roll: '2', phone: '+91 98765 43210');
      await submit(tester);

      final post = api.posts.single;
      expect(post.path, studentsPath('c1'));
      expect(
        (post.data! as Map<String, dynamic>)['parentPhone'],
        '+91 98765 43210',
      );
    });

    testWidgets('the note says where the number goes and that it never comes '
        'back', (tester) async {
      await pumpScreen(tester, screen(), client: client());

      final l10n = strings(tester, AddStudentScreen);
      expect(find.text(l10n.attendanceParentPhonePrivacy), findsOneWidget);
    });
  });

  testWidgets(
    'a valid student is posted, confirmed, and the roster refreshed',
    (tester) async {
      final api = client(postResponse: <String, dynamic>{'studentId': 's9'});
      await openFromRoster(tester, api);

      final l10n = strings(tester, AddStudentScreen);
      await fill(tester, roll: '2');
      await submit(tester);

      final body = api.posts.single.data! as Map<String, dynamic>;
      expect(body['name'], 'Meena Devi');
      expect(body['rollNumber'], 2);
      expect(body['parentLanguage'], 'Hindi');

      expect(find.text(l10n.attendanceStudentAdded), findsOneWidget);
      expect(find.byType(AttendanceRosterScreen), findsOneWidget);
      expect(
        api.gets.where((g) => g.path == studentsPath('c1')).length,
        greaterThanOrEqualTo(2),
      );
    },
  );

  testWidgets('a plan-gated add becomes an upsell, never an error', (
    tester,
  ) async {
    final api = client(
      postError: const ApiException(
        ApiErrorKind.forbidden,
        'PREMIUM_REQUIRED',
        statusCode: 403,
        errorCode: 'PREMIUM_REQUIRED',
      ),
    );
    await pumpScreen(tester, screen(), client: api);

    final l10n = strings(tester, AddStudentScreen);
    await fill(tester, roll: '2');
    await submit(tester);

    expect(find.byType(AttendancePremiumCard), findsOneWidget);
    expect(find.text(l10n.attendancePremiumTitle), findsOneWidget);
    expect(find.byType(InlineError), findsNothing);
    expect(find.byType(TextFormField), findsNothing);
    expect(find.text('PREMIUM_REQUIRED'), findsNothing);
  });

  testWidgets('a cap race lost to another device is explained with the cap, '
      'not the server string', (tester) async {
    final api = client(
      postError: const ApiException(
        ApiErrorKind.badResponse,
        'Maximum 40 students per class',
        statusCode: 400,
        errorCode: 'Maximum 40 students per class',
      ),
    );
    await pumpScreen(tester, screen(), client: api);

    final l10n = strings(tester, AddStudentScreen);
    await fill(tester, roll: '2');
    await submit(tester);

    expect(find.byType(InlineError), findsOneWidget);
    expect(find.text(l10n.attendanceClassFullBody(40)), findsOneWidget);
    expect(find.text('Maximum 40 students per class'), findsNothing);
  });
}
