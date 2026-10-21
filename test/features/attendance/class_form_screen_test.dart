import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/attendance/presentation/attendance_classes_screen.dart';
import 'package:sahayakai/features/attendance/presentation/class_form_screen.dart';
import 'package:sahayakai/features/attendance/presentation/widgets/attendance_premium_card.dart';
import 'package:sahayakai/shared/widgets/inline_error.dart';
import 'package:sahayakai/shared/widgets/primary_button.dart';

import '../../support/fake_api_client.dart';
import 'attendance_harness.dart';

/// U12 — creating a class.
///
/// There is no edit counterpart, and that is deliberate: the repository binds
/// the ten shipped attendance routes and none of them updates a class. See
/// `class_form_screen.dart`.
void main() {
  FakeApiClient client({Object? postError, Object? postResponse}) =>
      FakeApiClient(
        getResponsesByPath: <String, Object?>{
          kClassesPath: const <Map<String, dynamic>>[],
        },
        postResponsesByPath: postResponse == null
            ? null
            : <String, Object?>{kClassesPath: postResponse},
        postErrorsByPath: postError == null
            ? null
            : <String, Object>{kClassesPath: postError},
      );

  Future<void> openForm(WidgetTester tester, FakeApiClient api) async {
    await pumpRouted(tester, client: api);
    final l10n = strings(tester, AttendanceClassesScreen);
    await tapVisible(
      tester,
      find.widgetWithText(PrimaryButton, l10n.attendanceNewClass),
    );
    expect(find.byType(ClassFormScreen), findsOneWidget);
  }

  testWidgets('the academic year is seeded from the IST window', (
    tester,
  ) async {
    await openForm(tester, client());

    // 2026-08-19 IST falls in the session that began in April 2026, and the
    // device's UTC day (the 18th) would have produced the same answer here
    // only by luck — the derivation reads `AttendanceWindow`, not the device.
    expect(find.text('2026-27'), findsOneWidget);
  });

  testWidgets('a blank class name is refused before any request', (
    tester,
  ) async {
    final api = client();
    await openForm(tester, api);

    final l10n = strings(tester, ClassFormScreen);
    await tapVisible(
      tester,
      find.widgetWithText(PrimaryButton, l10n.attendanceCreateClassSubmit),
    );

    expect(find.text(l10n.attendanceClassNameRequired), findsOneWidget);
    expect(api.posts, isEmpty);
  });

  testWidgets('a created class is posted, confirmed, and the list refreshed', (
    tester,
  ) async {
    final api = client(postResponse: <String, dynamic>{'classId': 'c9'});
    await openForm(tester, api);

    final l10n = strings(tester, ClassFormScreen);
    await tester.enterText(find.byType(TextFormField).first, 'Class 7B');
    await tester.pumpAndSettle();
    await tapVisible(
      tester,
      find.widgetWithText(PrimaryButton, l10n.attendanceCreateClassSubmit),
    );

    final post = api.posts.single;
    expect(post.path, kClassesPath);
    final body = post.data! as Map<String, dynamic>;
    expect(body['name'], 'Class 7B');
    expect(body['academicYear'], '2026-27');
    expect(body['subject'], isNotEmpty);
    expect(body['gradeLevel'], isNotEmpty);

    expect(find.text(l10n.attendanceClassCreated), findsOneWidget);
    // Popped back to the list, which refetched.
    expect(find.byType(AttendanceClassesScreen), findsOneWidget);
    expect(
      api.gets.where((g) => g.path == kClassesPath).length,
      greaterThanOrEqualTo(2),
    );
  });

  testWidgets('a plan-gated create becomes an upsell, never an error', (
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
    await openForm(tester, api);

    final l10n = strings(tester, ClassFormScreen);
    await tester.enterText(find.byType(TextFormField).first, 'Class 7B');
    await tester.pumpAndSettle();
    await tapVisible(
      tester,
      find.widgetWithText(PrimaryButton, l10n.attendanceCreateClassSubmit),
    );

    expect(find.byType(AttendancePremiumCard), findsOneWidget);
    expect(find.text(l10n.attendancePremiumTitle), findsOneWidget);
    // The form is REPLACED, not annotated: nothing went wrong, so there is no
    // error banner and no submit button still inviting the same refusal.
    expect(find.byType(InlineError), findsNothing);
    expect(find.byType(TextFormField), findsNothing);
    expect(find.text('PREMIUM_REQUIRED'), findsNothing);
  });

  testWidgets('a real failure is an inline error in the app own words', (
    tester,
  ) async {
    final api = client(
      postError: const ApiException(
        ApiErrorKind.server,
        'Internal error',
        statusCode: 500,
      ),
    );
    await openForm(tester, api);

    final l10n = strings(tester, ClassFormScreen);
    await tester.enterText(find.byType(TextFormField).first, 'Class 7B');
    await tester.pumpAndSettle();
    await tapVisible(
      tester,
      find.widgetWithText(PrimaryButton, l10n.attendanceCreateClassSubmit),
    );

    expect(find.byType(InlineError), findsOneWidget);
    expect(find.byType(AttendancePremiumCard), findsNothing);
    expect(find.text('Internal error'), findsNothing);
  });
}
