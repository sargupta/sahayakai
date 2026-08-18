import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/attendance/presentation/attendance_classes_screen.dart';
import 'package:sahayakai/features/attendance/presentation/attendance_roster_screen.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';
import 'package:sahayakai/shared/widgets/error_view.dart';
import 'package:sahayakai/shared/widgets/offline_view.dart';
import 'package:sahayakai/shared/widgets/secondary_button.dart';

import '../../support/fake_api_client.dart';
import 'attendance_harness.dart';

/// U12 — the Attendance landing.
///
/// The class list is a READ, and reads are not plan-gated, so this screen has
/// no premium branch of its own: the gate lives on the three write forms. What
/// it does own is the four ways a read can fail, and the three destinations
/// each class offers.
void main() {
  Map<String, Object?> classesBody(List<Map<String, dynamic>> items) =>
      <String, Object?>{kClassesPath: items};

  testWidgets('lists each class with its count against the 40-student cap', (
    tester,
  ) async {
    final client = FakeApiClient(
      getResponsesByPath: classesBody([
        <String, dynamic>{
          'id': 'c1',
          'name': 'Class 6A',
          'subject': 'Science',
          'gradeLevel': 'Class 6',
          'academicYear': '2026-27',
          'section': 'A',
          'studentCount': 12,
        },
      ]),
    );

    await pumpScreen(tester, const AttendanceClassesScreen(), client: client);

    expect(find.text('Class 6A'), findsOneWidget);
    expect(find.text('Science · Class 6 · A · 2026-27'), findsOneWidget);
    // The count is rendered as a bare fraction against the cap, so no sentence
    // has to exist in eleven languages to say "students".
    expect(find.text('12 / 40'), findsOneWidget);

    final l10n = strings(tester, AttendanceClassesScreen);
    expect(find.text(l10n.attendanceClassFullBadge), findsNothing);
    // All three destinations are offered from the row.
    expect(find.text(l10n.attendanceOpenRegister), findsOneWidget);
    expect(find.text(l10n.attendanceOpenRoster), findsOneWidget);
    expect(find.text(l10n.attendanceOpenMonth), findsOneWidget);
  });

  testWidgets('a class at the cap is badged Full', (tester) async {
    final client = FakeApiClient(
      getResponsesByPath: classesBody([
        <String, dynamic>{
          'id': 'c1',
          'name': 'Class 6A',
          'subject': 'Science',
          'gradeLevel': 'Class 6',
          'academicYear': '2026-27',
          'studentCount': 40,
        },
      ]),
    );

    await pumpScreen(tester, const AttendanceClassesScreen(), client: client);

    final l10n = strings(tester, AttendanceClassesScreen);
    expect(find.text('40 / 40'), findsOneWidget);
    expect(find.text(l10n.attendanceClassFullBadge), findsOneWidget);
  });

  testWidgets('no classes yet is an EmptyView, not an error', (tester) async {
    final client = FakeApiClient(
      getResponsesByPath: classesBody(const <Map<String, dynamic>>[]),
    );

    await pumpScreen(tester, const AttendanceClassesScreen(), client: client);

    final l10n = strings(tester, AttendanceClassesScreen);
    expect(find.byType(EmptyView), findsOneWidget);
    expect(find.text(l10n.attendanceClassesEmptyTitle), findsOneWidget);
    expect(find.byType(ErrorView), findsNothing);
  });

  testWidgets(
    'a 401 offers sign-in rather than a retry that would fail again',
    (tester) async {
      final client = FakeApiClient(
        getErrorsByPath: <String, Object>{
          kClassesPath: const ApiException(
            ApiErrorKind.unauthorized,
            'Please sign in again.',
            statusCode: 401,
          ),
        },
      );

      await pumpScreen(tester, const AttendanceClassesScreen(), client: client);

      final l10n = strings(tester, AttendanceClassesScreen);
      expect(find.text(l10n.attendanceSignedOutTitle), findsOneWidget);
      expect(
        find.widgetWithText(SecondaryButton, l10n.actionSignIn),
        findsOneWidget,
      );
      expect(find.byType(ErrorView), findsNothing);
      expect(find.byType(OfflineView), findsNothing);
    },
  );

  testWidgets('a dropped connection is an OfflineView with a retry', (
    tester,
  ) async {
    final client = FakeApiClient(
      getErrorsByPath: <String, Object>{
        kClassesPath: const ApiException(
          ApiErrorKind.network,
          'No internet connection.',
        ),
      },
    );

    await pumpScreen(tester, const AttendanceClassesScreen(), client: client);

    expect(find.byType(OfflineView), findsOneWidget);
    expect(find.byType(ErrorView), findsNothing);
  });

  testWidgets('any other failure shows the screen own copy, never the server '
      'message', (tester) async {
    final client = FakeApiClient(
      getErrorsByPath: <String, Object>{
        kClassesPath: const ApiException(
          ApiErrorKind.badResponse,
          'Invalid query parameters',
          statusCode: 400,
          errorCode: 'Invalid query parameters',
        ),
      },
    );

    await pumpScreen(tester, const AttendanceClassesScreen(), client: client);

    final l10n = strings(tester, AttendanceClassesScreen);
    expect(find.byType(ErrorView), findsOneWidget);
    expect(find.text(l10n.attendanceClassesError), findsOneWidget);
    // The server's developer-facing English is never put in front of a teacher
    // reading the app in another language.
    expect(find.text('Invalid query parameters'), findsNothing);
  });

  testWidgets('the Students action opens that class roster', (tester) async {
    final client = FakeApiClient(
      getResponsesByPath: <String, Object?>{
        kClassesPath: <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'c1',
            'name': 'Class 6A',
            'subject': 'Science',
            'gradeLevel': 'Class 6',
            'academicYear': '2026-27',
            'studentCount': 2,
          },
        ],
        studentsPath('c1'): <Map<String, dynamic>>[maskedStudent()],
      },
    );

    await pumpRouted(tester, client: client);

    final l10n = strings(tester, AttendanceClassesScreen);
    await tapVisible(tester, find.text(l10n.attendanceOpenRoster));

    expect(find.byType(AttendanceRosterScreen), findsOneWidget);
    // The row handed the loaded class through `extra`, so the title painted
    // without a second read.
    expect(find.widgetWithText(AppBar, 'Class 6A'), findsOneWidget);
    expect(find.text('Asha Rao'), findsOneWidget);
  });
}
