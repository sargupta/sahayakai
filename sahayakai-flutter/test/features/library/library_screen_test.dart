import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sahayakai/features/lesson_planner/presentation/lesson_plan_screen.dart';
import 'package:sahayakai/features/library/presentation/library_screen.dart';
import 'package:sahayakai/shared/widgets/app_skeleton.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';
import 'package:sahayakai/shared/widgets/error_view.dart';
import 'package:sahayakai/shared/widgets/library_item_row.dart';
import 'package:sahayakai/shared/widgets/offline_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import '../dashboard/dashboard_fixtures.dart';

/// My Library — the tab that used to be a permanent, actionless empty state.
///
/// These boot the REAL app and reach the tab the way a teacher does: by tapping
/// it in the real bottom nav. The point of nearly every test here is that the
/// tab now reports what actually happened to the read, instead of claiming
/// "nothing saved" no matter what.
Future<void> _openLibrary(
  WidgetTester tester, {
  FakeApiClient? client,
  bool settle = true,
}) async {
  await pumpDashboard(tester, client: client, settle: settle);
  await tester.tap(find.text('Library'));
  await (settle ? tester.pumpAndSettle() : tester.pump());
}

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('states', () {
    testWidgets('shows the teacher\'s saved work, not a dead empty state',
        (tester) async {
      await _openLibrary(
        tester,
        client: libraryClient(
          response: contentListResponse(
            items: [
              contentItem(),
              contentItem(overrides: {'type': 'quiz', 'title': 'Fractions quiz'}),
            ],
          ),
        ),
      );

      expect(find.byType(LibraryScreen), findsOneWidget);
      expect(find.byType(LibraryItemRow), findsNWidgets(2));
      expect(find.text('Photosynthesis for Class 6'), findsOneWidget);
      expect(find.text('Fractions quiz'), findsOneWidget);
      expect(find.byType(EmptyView), findsNothing);
    });

    testWidgets('shows a shaped skeleton while the read is in flight, never a '
        'bare spinner', (tester) async {
      await _openLibrary(
        tester,
        client: libraryClient(delay: const Duration(seconds: 1)),
        settle: false,
      );

      // A shaped shimmer of the rows that are coming, not a bare spinner
      // dropped in the content area (DESIGN_RUBRIC §6). The only
      // CircularProgressIndicator in this tree belongs to the pull-to-refresh
      // affordance, which is not the loading state.
      expect(find.byType(AppSkeleton), findsOneWidget);
      expect(
        find.descendant(
          of: find.byType(ListView),
          matching: find.byType(CircularProgressIndicator),
        ),
        findsNothing,
      );

      await tester.pumpAndSettle();
    });

    testWidgets('an empty library offers a way out of it (DESIGN_RUBRIC §6/§11)',
        (tester) async {
      await _openLibrary(
        tester,
        client: libraryClient(response: contentListResponse(items: [])),
      );

      expect(find.byType(EmptyView), findsOneWidget);
      // The old screen was an EmptyView with NO action. This is the fix.
      expect(find.text('Create a lesson plan'), findsOneWidget);
    });

    testWidgets('the empty state\'s action reaches a tool that exists',
        (tester) async {
      await _openLibrary(
        tester,
        client: libraryClient(response: contentListResponse(items: [])),
      );

      await tester.tap(find.text('Create a lesson plan'));
      await tester.pumpAndSettle();

      expect(find.byType(LessonPlanScreen), findsOneWidget);
    });
  });

  group('failures are reported honestly', () {
    testWidgets('offline gets its own copy and a retry, not a generic error',
        (tester) async {
      await _openLibrary(tester, client: libraryClient(error: kOffline));

      expect(find.byType(OfflineView), findsOneWidget);
      expect(find.byType(ErrorView), findsNothing);
    });

    testWidgets('a server error offers a retry that re-reads', (tester) async {
      final client = libraryClient(error: kServerError);
      await _openLibrary(tester, client: client);

      expect(find.byType(ErrorView), findsOneWidget);
      final before = client.gets.length;

      // The connection comes back between the failure and the retry.
      client.error = null;
      client.getResponse = contentListResponse();
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();

      expect(client.gets.length, greaterThan(before));
      expect(find.byType(ErrorView), findsNothing);
      expect(find.byType(LibraryItemRow), findsOneWidget);
    });

    testWidgets('no identity asks for sign-in and does NOT offer a retry that '
        'cannot work', (tester) async {
      await _openLibrary(tester, client: libraryClient(error: kUnauthorized));

      expect(find.byType(EmptyView), findsOneWidget);
      expect(find.text('Sign in to see your saved work.'), findsOneWidget);
      expect(find.text('Try again'), findsNothing);
    });
  });

  group('the 20-item cap is disclosed', () {
    testWidgets('a full page says it is the newest 20, not the whole archive',
        (tester) async {
      await _openLibrary(
        tester,
        client: libraryClient(
          response: contentListResponse(
            items: [
              for (var i = 0; i < 20; i++)
                contentItem(overrides: {'id': 'id-$i', 'title': 'Item $i'}),
            ],
          ),
        ),
      );

      expect(find.text('Showing your 20 most recent items.'), findsOneWidget);
    });

    testWidgets('a short list does not', (tester) async {
      await _openLibrary(tester);

      expect(find.text('Showing your 20 most recent items.'), findsNothing);
    });
  });

  group('it shares the dashboard\'s single read', () {
    testWidgets('opening the tab fires no second request', (tester) async {
      final client = libraryClient();
      await pumpDashboard(tester, client: client);

      // AppShell builds every tab in an IndexedStack, so Library is already
      // mounted. One provider means one request serves both surfaces.
      final afterDashboard = client.gets.length;
      expect(afterDashboard, 1);

      await tester.tap(find.text('Library'));
      await tester.pumpAndSettle();

      expect(client.gets.length, afterDashboard);
      expect(client.gets.single.query, <String, dynamic>{'limit': 20});
    });
  });
}
