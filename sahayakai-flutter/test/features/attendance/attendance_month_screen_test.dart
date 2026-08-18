import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/attendance/presentation/attendance_month_screen.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';

import '../../support/fake_api_client.dart';
import 'attendance_harness.dart';

/// U12 — the monthly view: the server's rollups, and the days each student
/// missed.
void main() {
  Widget screen() =>
      AttendanceMonthScreen(classId: 'c1', attendanceClass: testClass());

  FakeApiClient client({
    List<Map<String, dynamic>>? summaries,
    List<String>? absences,
  }) => FakeApiClient(
    getResponsesByPath: <String, Object?>{
      summariesPath('c1'):
          summaries ??
          <Map<String, dynamic>>[
            summaryJson(
              totalDays: 20,
              presentDays: 16,
              absentDays: 3,
              lateDays: 1,
              attendanceRate: 80,
              consecutiveAbsences: 3,
            ),
          ],
      absencesPath('c1', 's1'):
          absences ?? <String>['2026-08-14', '2026-08-13', '2026-07-30'],
    },
  );

  testWidgets('renders the server rollup rather than recomputing it', (
    tester,
  ) async {
    await pumpScreen(tester, screen(), client: client());

    final l10n = strings(tester, AttendanceMonthScreen);
    expect(find.text('Asha Rao'), findsOneWidget);
    // Rounded server-side and shown as a bare percentage, so the same number
    // appears here and in the web app.
    expect(find.text('80%'), findsOneWidget);
    expect(find.text('${l10n.attendanceStatusPresent} 16'), findsOneWidget);
    expect(find.text('${l10n.attendanceStatusAbsent} 3'), findsOneWidget);
    expect(find.text('${l10n.attendanceStatusLate} 1'), findsOneWidget);
    // The consecutive-absence run reuses the Parent Hotline's existing
    // sentence rather than inventing a second wording for the same number.
    expect(find.text(l10n.parentHotlineEvidenceAbsentDays(3)), findsOneWidget);
  });

  testWidgets('opens on the IST month and asks the route for it', (
    tester,
  ) async {
    final api = client();
    await pumpScreen(tester, screen(), client: api);

    final get = api.gets.firstWhere((g) => g.path == summariesPath('c1'));
    expect(get.query?['year'], 2026);
    expect(get.query?['month'], 8);
  });

  testWidgets('absences load only when a card is opened, and are trimmed to '
      'the month on screen', (tester) async {
    final api = client();
    await pumpScreen(tester, screen(), client: api);

    // Nothing was fetched for a panel nobody opened.
    expect(api.gets.where((g) => g.path == absencesPath('c1', 's1')), isEmpty);

    await tapVisible(tester, find.text('Asha Rao'));

    final material = materialStrings(tester, AttendanceMonthScreen);
    final l10n = strings(tester, AttendanceMonthScreen);
    expect(find.text(l10n.attendanceAbsencesTitle), findsOneWidget);
    expect(
      find.text(material.formatMediumDate(DateTime(2026, 8, 14))),
      findsOneWidget,
    );
    expect(
      find.text(material.formatMediumDate(DateTime(2026, 8, 13))),
      findsOneWidget,
    );
    // The route counts back from today regardless of the month on screen, so
    // July's absence is trimmed out rather than shown under August.
    expect(
      find.text(material.formatMediumDate(DateTime(2026, 7, 30))),
      findsNothing,
    );

    // The reach was derived from the month, not left at the route default.
    final get = api.gets.firstWhere((g) => g.path == absencesPath('c1', 's1'));
    expect(get.query?['limitDays'], 19); // 2026-08-01 .. 2026-08-19 inclusive
  });

  testWidgets('a student with no absences says so rather than showing an '
      'empty list', (tester) async {
    await pumpScreen(
      tester,
      screen(),
      client: client(absences: const <String>[]),
    );

    await tapVisible(tester, find.text('Asha Rao'));

    final l10n = strings(tester, AttendanceMonthScreen);
    expect(find.text(l10n.attendanceAbsencesEmpty), findsOneWidget);
    expect(find.text(l10n.attendanceAbsencesTitle), findsNothing);
  });

  testWidgets('stepping back from January rolls the year, not just the month', (
    tester,
  ) async {
    final api = client();
    // 2026-01-01T00:00Z is 05:30 IST on the same day, so the IST month is
    // January and the previous step must land on December 2025.
    await pumpScreen(
      tester,
      screen(),
      client: api,
      now: DateTime.utc(2026, 1, 1),
    );

    final l10n = strings(tester, AttendanceMonthScreen);
    await tapVisible(tester, find.byTooltip(l10n.attendanceMonthPrevious));

    final get = api.gets.lastWhere((g) => g.path == summariesPath('c1'));
    expect(get.query?['year'], 2025);
    expect(get.query?['month'], 12);
  });

  testWidgets('the current month cannot be stepped past', (tester) async {
    await pumpScreen(tester, screen(), client: client());

    final l10n = strings(tester, AttendanceMonthScreen);
    // `byTooltip` lands on the tooltip widget, so climb to the button that
    // owns it before reading `onPressed`.
    final next = find.ancestor(
      of: find.byTooltip(l10n.attendanceMonthNext),
      matching: find.byType(IconButton),
    );
    expect(tester.widget<IconButton>(next).onPressed, isNull);
  });

  testWidgets('a month with no students is an EmptyView, not an error', (
    tester,
  ) async {
    await pumpScreen(
      tester,
      screen(),
      client: client(summaries: const <Map<String, dynamic>>[]),
    );

    final l10n = strings(tester, AttendanceMonthScreen);
    expect(find.byType(EmptyView), findsOneWidget);
    expect(find.text(l10n.attendanceMonthEmptyTitle), findsOneWidget);
  });
}
