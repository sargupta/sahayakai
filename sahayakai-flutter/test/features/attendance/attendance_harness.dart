import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/core/platform/clock.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/attendance/domain/attendance_class.dart';
import 'package:sahayakai/features/attendance/presentation/add_student_screen.dart';
import 'package:sahayakai/features/attendance/presentation/attendance_classes_screen.dart';
import 'package:sahayakai/features/attendance/presentation/attendance_month_screen.dart';
import 'package:sahayakai/features/attendance/presentation/attendance_roster_screen.dart';
import 'package:sahayakai/features/attendance/presentation/class_form_screen.dart';
import 'package:sahayakai/features/attendance/presentation/mark_attendance_screen.dart';

import '../../support/fake_api_client.dart';

/// The pinned instant every attendance screen test runs at.
///
/// `2026-08-18T20:00Z` is **01:30 IST on 2026-08-19**. The device's UTC day is
/// still the 18th while the teacher's day is the 19th, which is the exact
/// window (00:00 to 05:30 IST) where a client that derived "today" from a UTC
/// instant would offer the wrong day and 400 the server. Every assertion about
/// dates below is therefore also an assertion that the IST derivation held.
final kIstAfterMidnight = DateTime.utc(2026, 8, 18, 20);

/// The IST calendar day containing [kIstAfterMidnight].
const kIstToday = (year: 2026, month: 8, day: 19);

/// A class row, with the fields the screens actually read.
AttendanceClass testClass({
  String id = 'c1',
  String name = 'Class 6A',
  String subject = 'Science',
  String gradeLevel = 'Class 6',
  String academicYear = '2026-27',
  String? section = 'A',
  int studentCount = 12,
}) => AttendanceClass(
  id: id,
  name: name,
  subject: subject,
  gradeLevel: gradeLevel,
  academicYear: academicYear,
  section: section,
  studentCount: studentCount,
);

/// The MASKED roster entry `?projection=roster` returns: exactly the six
/// allowlisted fields, and no `parentPhone`.
Map<String, dynamic> maskedStudent({
  String id = 's1',
  String name = 'Asha Rao',
  int rollNumber = 1,
  String parentLanguage = 'Kannada',
  bool hasParentPhone = true,
  String parentPhoneLast4 = '4821',
}) => <String, dynamic>{
  'id': id,
  'name': name,
  'rollNumber': rollNumber,
  'parentLanguage': parentLanguage,
  'hasParentPhone': hasParentPhone,
  'parentPhoneLast4': parentPhoneLast4,
};

/// The UNMASKED student document production still returns today, because the
/// `?projection=roster` change is draft PR #124 and unmerged. The decoder must
/// refuse this rather than put the number on the handset.
Map<String, dynamic> unmaskedStudent({
  String id = 's1',
  String name = 'Asha Rao',
  int rollNumber = 1,
  String parentPhone = '+919876543210',
}) => <String, dynamic>{
  'id': id,
  'name': name,
  'rollNumber': rollNumber,
  'parentLanguage': 'Kannada',
  'parentPhone': parentPhone,
  'classId': 'c1',
  'createdAt': '2026-08-01T00:00:00.000Z',
};

/// One `StudentAttendanceSummary` as the summaries route returns it. This is
/// also the register's student list — see `monthlySummariesProvider`.
Map<String, dynamic> summaryJson({
  String studentId = 's1',
  String studentName = 'Asha Rao',
  int rollNumber = 1,
  int totalDays = 0,
  int presentDays = 0,
  int absentDays = 0,
  int lateDays = 0,
  int attendanceRate = 100,
  int consecutiveAbsences = 0,
}) => <String, dynamic>{
  'studentId': studentId,
  'studentName': studentName,
  'rollNumber': rollNumber,
  'totalDays': totalDays,
  'presentDays': presentDays,
  'absentDays': absentDays,
  'lateDays': lateDays,
  'attendanceRate': attendanceRate,
  'consecutiveAbsences': consecutiveAbsences,
};

// ── Route paths the fakes key on ─────────────────────────────────────────────

const String kClassesPath = '/api/attendance/classes';
String classPath(String id) => '$kClassesPath/$id';
String studentsPath(String id) => '${classPath(id)}/students';
String recordsPath(String id) => '${classPath(id)}/records';
String summariesPath(String id) => '${classPath(id)}/summaries';
String absencesPath(String classId, String studentId) =>
    '${studentsPath(classId)}/$studentId/absences';

// ── Pumping ──────────────────────────────────────────────────────────────────

/// The provider overrides every attendance screen test needs: a client that
/// cannot open a socket, and a clock pinned to [kIstAfterMidnight].
List<Override> attendanceOverrides(
  FakeApiClient client, {
  DateTime? now,
  List<Override> extra = const [],
}) => [
  apiClientProvider.overrideWithValue(client),
  nowProvider.overrideWithValue(() => now ?? kIstAfterMidnight),
  ...extra,
];

/// Renders [home] on its own, for the screens a test constructs directly with
/// their `classId` / `attendanceClass` arguments.
Future<void> pumpScreen(
  WidgetTester tester,
  Widget home, {
  required FakeApiClient client,
  DateTime? now,
  List<Override> extra = const [],
  Locale locale = const Locale('en'),
  Size surface = const Size(390, 2400),
  bool settle = true,
}) async {
  _sizeSurface(tester, surface);
  await tester.pumpWidget(
    ProviderScope(
      overrides: attendanceOverrides(client, now: now, extra: extra),
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: home,
      ),
    ),
  );
  await _settle(tester, settle);
}

/// Renders the attendance routes behind a real [GoRouter], for the tests that
/// exercise navigation (`context.push` needs one in the tree).
///
/// It is the app's own `Routes` constants and the same builders
/// `app_router.dart` registers, minus the auth redirect — the redirect is
/// tested where it lives, and reproducing it here would only prove this file
/// works.
Future<void> pumpRouted(
  WidgetTester tester, {
  required FakeApiClient client,
  String initialLocation = Routes.attendance,
  DateTime? now,
  List<Override> extra = const [],
  Locale locale = const Locale('en'),
  Size surface = const Size(390, 2400),
  bool settle = true,
}) async {
  _sizeSurface(tester, surface);
  final router = GoRouter(
    initialLocation: initialLocation,
    routes: [
      GoRoute(
        path: Routes.attendance,
        builder: (_, _) => const AttendanceClassesScreen(),
      ),
      GoRoute(
        path: Routes.attendanceNewClass,
        builder: (_, _) => const ClassFormScreen(),
      ),
      GoRoute(
        path: Routes.attendanceRosterPattern,
        builder: (_, state) => AttendanceRosterScreen(
          classId: state.pathParameters['classId']!,
          attendanceClass: _classOf(state),
        ),
      ),
      GoRoute(
        path: Routes.attendanceAddStudentPattern,
        builder: (_, state) => AddStudentScreen(
          classId: state.pathParameters['classId']!,
          attendanceClass: _classOf(state),
        ),
      ),
      GoRoute(
        path: Routes.attendanceMarkPattern,
        builder: (_, state) => MarkAttendanceScreen(
          classId: state.pathParameters['classId']!,
          attendanceClass: _classOf(state),
        ),
      ),
      GoRoute(
        path: Routes.attendanceMonthPattern,
        builder: (_, state) => AttendanceMonthScreen(
          classId: state.pathParameters['classId']!,
          attendanceClass: _classOf(state),
        ),
      ),
    ],
  );
  addTearDown(router.dispose);

  await tester.pumpWidget(
    ProviderScope(
      overrides: attendanceOverrides(client, now: now, extra: extra),
      child: MaterialApp.router(
        theme: AppTheme.light(),
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: router,
      ),
    ),
  );
  await _settle(tester, settle);
}

AttendanceClass? _classOf(GoRouterState state) =>
    state.extra is AttendanceClass ? state.extra! as AttendanceClass : null;

void _sizeSurface(WidgetTester tester, Size surface) {
  tester.view.physicalSize = surface;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  // Animations off so `pumpAndSettle` returns and the shimmer never spins
  // forever.
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
}

Future<void> _settle(WidgetTester tester, bool settle) async {
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
    await tester.pump();
  }
}

/// The app's own English strings, so an assertion names the key rather than
/// duplicating the copy (and a reworded string does not silently pass).
AppLocalizations strings(WidgetTester tester, Type screen) =>
    AppLocalizations.of(tester.element(find.byType(screen)));

/// [MaterialLocalizations] from the running tree, so a date assertion uses the
/// same formatter the screen does rather than a hand-built string.
MaterialLocalizations materialStrings(WidgetTester tester, Type screen) =>
    MaterialLocalizations.of(tester.element(find.byType(screen)));

/// Taps [finder] after scrolling it into view — the register and the class
/// list are both taller than the test surface.
Future<void> tapVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}
