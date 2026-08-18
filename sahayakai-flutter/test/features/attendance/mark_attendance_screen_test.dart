import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/attendance/presentation/mark_attendance_screen.dart';
import 'package:sahayakai/features/attendance/presentation/widgets/attendance_premium_card.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';
import 'package:sahayakai/shared/widgets/primary_button.dart';

import '../../support/fake_api_client.dart';
import 'attendance_harness.dart';

/// U12 — the daily register.
///
/// The clock is pinned to 01:30 IST on 2026-08-19 while the device's UTC day
/// is still the 18th (see [kIstAfterMidnight]). Every date assertion here is
/// therefore also an assertion that "today" was derived in Asia/Kolkata: a
/// screen that took the UTC day would offer 2026-08-18 as today and would 400
/// the server for the day the teacher is actually marking.
void main() {
  Map<String, Object?> classBody({
    List<Map<String, dynamic>>? students,
    Object? record,
  }) => <String, Object?>{
    summariesPath('c1'):
        students ??
        <Map<String, dynamic>>[
          summaryJson(),
          summaryJson(
            studentId: 's2',
            studentName: 'Ravi Kumar',
            rollNumber: 2,
          ),
        ],
    recordsPath('c1'): record,
  };

  Widget screen() =>
      MarkAttendanceScreen(classId: 'c1', attendanceClass: testClass());

  group('the date picker is clamped to the IST window', () {
    testWidgets('offers exactly the eight markable days and no ninth', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        screen(),
        client: FakeApiClient(getResponsesByPath: classBody()),
      );

      final l10n = strings(tester, MarkAttendanceScreen);
      final material = materialStrings(tester, MarkAttendanceScreen);

      // today = 2026-08-19 IST, so the window is 2026-08-12 .. 2026-08-19.
      expect(find.text(l10n.attendanceDateToday), findsOneWidget);
      expect(find.text(l10n.attendanceDateYesterday), findsOneWidget);
      for (var day = 12; day <= 17; day++) {
        expect(
          find.text(material.formatMediumDate(DateTime(2026, 8, day))),
          findsOneWidget,
          reason: '2026-08-$day is inside [today-7, today] and must be offered',
        );
      }
      // The eighth day back is outside the window the server would accept, so
      // it is never offered — the teacher cannot pick a day and then be told
      // no after a round trip.
      expect(
        find.text(material.formatMediumDate(DateTime(2026, 8, 11))),
        findsNothing,
      );
      // Nor is tomorrow, which the device's UTC clock would still call today.
      expect(
        find.text(material.formatMediumDate(DateTime(2026, 8, 20))),
        findsNothing,
      );
    });

    testWidgets('opens on the IST today, not the device UTC day', (
      tester,
    ) async {
      final client = FakeApiClient(getResponsesByPath: classBody());
      await pumpScreen(tester, screen(), client: client);

      final registerGet = client.gets.firstWhere(
        (g) => g.path == recordsPath('c1'),
      );
      expect(registerGet.query?['date'], '2026-08-19');
    });

    testWidgets('picking another day reads that day register', (tester) async {
      final client = FakeApiClient(getResponsesByPath: classBody());
      await pumpScreen(tester, screen(), client: client);

      final material = materialStrings(tester, MarkAttendanceScreen);
      await tapVisible(
        tester,
        find.text(material.formatMediumDate(DateTime(2026, 8, 14))),
      );

      expect(
        client.gets.where((g) => g.query?['date'] == '2026-08-14'),
        isNotEmpty,
      );
    });
  });

  group('unmarked is a state, not a default', () {
    testWidgets('an untouched register counts nobody as marked', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        screen(),
        client: FakeApiClient(getResponsesByPath: classBody()),
      );

      final l10n = strings(tester, MarkAttendanceScreen);
      expect(find.text(l10n.attendanceMarkProgress(0, 2)), findsOneWidget);
      // Every student carries the fourth option, so the picker never parks its
      // thumb on "Present" for a student nobody has touched.
      expect(find.text(l10n.attendanceStatusUnmarked), findsNWidgets(2));
    });

    testWidgets('a saved mark shows without any local seeding', (tester) async {
      await pumpScreen(
        tester,
        screen(),
        client: FakeApiClient(
          getResponsesByPath: classBody(
            record: <String, dynamic>{
              'classId': 'c1',
              'date': '2026-08-19',
              'records': <String, dynamic>{'s1': 'absent'},
            },
          ),
        ),
      );

      final l10n = strings(tester, MarkAttendanceScreen);
      expect(find.text(l10n.attendanceMarkProgress(1, 2)), findsOneWidget);
    });

    testWidgets('marking a student moves the progress line', (tester) async {
      await pumpScreen(
        tester,
        screen(),
        client: FakeApiClient(getResponsesByPath: classBody()),
      );

      final l10n = strings(tester, MarkAttendanceScreen);
      await tapVisible(tester, find.text(l10n.attendanceStatusPresent).first);

      expect(find.text(l10n.attendanceMarkProgress(1, 2)), findsOneWidget);
    });
  });

  group('saving', () {
    testWidgets('posts only the students who carry a mark', (tester) async {
      final client = FakeApiClient(
        getResponsesByPath: classBody(),
        postResponsesByPath: <String, Object?>{
          recordsPath('c1'): <String, dynamic>{'success': true},
        },
      );
      await pumpScreen(tester, screen(), client: client);

      final l10n = strings(tester, MarkAttendanceScreen);
      await tapVisible(tester, find.text(l10n.attendanceStatusAbsent).first);
      await tapVisible(
        tester,
        find.widgetWithText(PrimaryButton, l10n.attendanceSaveRegister),
      );

      final post = client.posts.firstWhere((p) => p.path == recordsPath('c1'));
      final body = post.data! as Map<String, dynamic>;
      expect(body['date'], '2026-08-19');
      // s2 was never touched, so it is absent from the map rather than being
      // invented as present.
      expect(body['records'], <String, String>{'s1': 'absent'});
      expect(find.text(l10n.attendanceRegisterSaved), findsOneWidget);
    });

    testWidgets('Mark everyone present fills the whole register', (
      tester,
    ) async {
      final client = FakeApiClient(
        getResponsesByPath: classBody(),
        postResponsesByPath: <String, Object?>{
          recordsPath('c1'): <String, dynamic>{'success': true},
        },
      );
      await pumpScreen(tester, screen(), client: client);

      final l10n = strings(tester, MarkAttendanceScreen);
      await tapVisible(tester, find.text(l10n.attendanceMarkAllPresent));
      expect(find.text(l10n.attendanceMarkProgress(2, 2)), findsOneWidget);

      await tapVisible(
        tester,
        find.widgetWithText(PrimaryButton, l10n.attendanceSaveRegister),
      );
      final post = client.posts.firstWhere((p) => p.path == recordsPath('c1'));
      expect((post.data! as Map<String, dynamic>)['records'], <String, String>{
        's1': 'present',
        's2': 'present',
      });
    });

    testWidgets('a plan-gated save becomes an upsell, never an error', (
      tester,
    ) async {
      final client = FakeApiClient(
        getResponsesByPath: classBody(),
        postErrorsByPath: <String, Object>{
          recordsPath('c1'): const ApiException(
            ApiErrorKind.forbidden,
            'PREMIUM_REQUIRED',
            statusCode: 403,
            errorCode: 'PREMIUM_REQUIRED',
          ),
        },
      );
      await pumpScreen(tester, screen(), client: client);

      final l10n = strings(tester, MarkAttendanceScreen);
      await tapVisible(tester, find.text(l10n.attendanceStatusPresent).first);
      await tapVisible(
        tester,
        find.widgetWithText(PrimaryButton, l10n.attendanceSaveRegister),
      );

      // The 403 arrived as a VALUE, so the form is replaced by the upgrade
      // path rather than by a red banner.
      expect(find.byType(AttendancePremiumCard), findsOneWidget);
      expect(find.text(l10n.attendancePremiumTitle), findsOneWidget);
      expect(find.text(l10n.attendancePremiumBody), findsOneWidget);
      expect(find.text(l10n.attendanceSaveRegisterFailed), findsNothing);
      expect(find.text('PREMIUM_REQUIRED'), findsNothing);
    });
  });

  testWidgets('a class with no students says so instead of an empty register', (
    tester,
  ) async {
    await pumpScreen(
      tester,
      screen(),
      client: FakeApiClient(
        getResponsesByPath: classBody(students: const <Map<String, dynamic>>[]),
      ),
    );

    final l10n = strings(tester, MarkAttendanceScreen);
    expect(find.byType(EmptyView), findsOneWidget);
    expect(find.text(l10n.attendanceNoStudentsTitle), findsOneWidget);
    // Nothing to save, so the action is withdrawn.
    expect(
      find.widgetWithText(PrimaryButton, l10n.attendanceSaveRegister),
      findsNothing,
    );
  });
}
