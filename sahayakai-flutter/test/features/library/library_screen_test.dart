import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/features/lesson_planner/presentation/lesson_plan_screen.dart';
import 'package:sahayakai/features/library/presentation/library_detail_screen.dart';
import 'package:sahayakai/features/library/presentation/library_screen.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_sheet.dart';
import 'package:sahayakai/shared/data/library_items_provider.dart';
import 'package:sahayakai/shared/domain/library_item.dart';
import 'package:sahayakai/shared/widgets/app_skeleton.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';
import 'package:sahayakai/shared/widgets/error_view.dart';
import 'package:sahayakai/shared/widgets/library_item_row.dart';
import 'package:sahayakai/shared/widgets/offline_view.dart';
import 'package:sahayakai/shared/widgets/secondary_button.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import '../dashboard/dashboard_fixtures.dart';
import '../onboarding/onboarding_fixtures.dart' show pumpSignedInApp;

/// A `LibraryItems` override that resolves to the typed 401, so the Library
/// screen's signed-out empty state renders without a live read.
class _UnauthorizedLibraryItems extends LibraryItems {
  @override
  Future<List<LibraryItem>> build() => Future<List<LibraryItem>>.error(
    const ApiException(
      ApiErrorKind.unauthorized,
      'Please sign in again.',
      statusCode: 401,
    ),
  );
}

/// A marker a real `context.push(Routes.login)` resolves to, so the sign-in CTA
/// navigation can be asserted without dragging the login screen's provider
/// graph (and the router's signed-in redirect) into this suite.
class _DestMarker extends StatelessWidget {
  const _DestMarker(this.id);

  final String id;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(child: Text('DEST', key: Key('dest-$id'))),
  );
}

/// Pumps [LibraryScreen] over a two-route GoRouter (/ + /login), with the
/// library read forced to the signed-out 401.
Future<void> _pumpSignedOutLibrary(WidgetTester tester) async {
  final router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(path: '/', builder: (_, _) => const LibraryScreen()),
      GoRoute(
        path: Routes.login,
        builder: (_, _) => const _DestMarker('login'),
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        libraryItemsProvider.overrideWith(_UnauthorizedLibraryItems.new),
      ],
      child: MaterialApp.router(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: router,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

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
  Brightness? brightness,
  double textScale = 1.0,
  Locale? locale,
  Size surface = kTallSurface,
}) async {
  // NEW IA (U-V5): reach the Library tab the way a teacher does now — by tapping
  // it in the real bottom nav from the VIDYA home, not through the dashboard
  // (which is no longer the landing). The Library tab still owns its own read.
  await pumpSignedInApp(
    tester,
    client: client ?? libraryClient(),
    settle: settle,
    brightness: brightness,
    textScale: textScale,
    locale: locale,
    surface: surface,
  );
  await tester.tap(find.byIcon(LucideIcons.library));
  await (settle ? tester.pumpAndSettle() : tester.pump());
}

/// Drags the Library list to its end, asserting no overflow along the way.
Future<void> _scrollWholeList(WidgetTester tester) async {
  final position = tester
      .state<ScrollableState>(find.byType(Scrollable).first)
      .position;
  var guard = 0;
  while (position.pixels < position.maxScrollExtent && guard++ < 60) {
    await tester.drag(find.byType(ListView).first, const Offset(0, -280));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  }
}

/// Two saved items of two types, so the filter bar has something to filter.
FakeApiClient _twoTypeClient() => libraryClient(
  response: contentListResponse(
    items: [
      contentItem(),
      contentItem(
        overrides: {
          'id': 'id-quiz-1',
          'type': 'quiz',
          'title': 'Fractions quiz',
        },
      ),
    ],
  ),
);

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('states', () {
    testWidgets('shows the teacher\'s saved work, not a dead empty state', (
      tester,
    ) async {
      await _openLibrary(
        tester,
        client: libraryClient(
          response: contentListResponse(
            items: [
              contentItem(),
              contentItem(
                overrides: {'type': 'quiz', 'title': 'Fractions quiz'},
              ),
            ],
          ),
        ),
      );

      expect(find.byType(LibraryScreen), findsOneWidget);
      expect(find.byType(LibraryItemRow), findsNWidgets(2));
      expect(find.text('Photosynthesis for Class 6'), findsOneWidget);
      expect(find.text('Fractions quiz'), findsOneWidget);
      expect(find.byType(EmptyView), findsNothing);
      // P1.2 launcher ubiquity: the VIDYA co-teacher action is in the app bar
      // here too, not only on the ToolScaffold tool screens.
      expect(find.byType(VidyaAppBarAction), findsOneWidget);
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

    testWidgets(
      'an empty library offers a way out of it (DESIGN_RUBRIC §6/§11)',
      (tester) async {
        await _openLibrary(
          tester,
          client: libraryClient(response: contentListResponse(items: [])),
        );

        expect(find.byType(EmptyView), findsOneWidget);
        // The old screen was an EmptyView with NO action. This is the fix.
        expect(find.text('Create a lesson plan'), findsOneWidget);
      },
    );

    testWidgets('the empty state\'s action reaches a tool that exists', (
      tester,
    ) async {
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
    testWidgets('offline gets its own copy and a retry, not a generic error', (
      tester,
    ) async {
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
      // The dead-end this unit fixes: the signed-out state now offers a way
      // FORWARD (a working "Sign in" action), not just an actionless message.
      expect(find.widgetWithText(SecondaryButton, 'Sign in'), findsOneWidget);
    });

    testWidgets('the signed-out "Sign in" action navigates to /login', (
      tester,
    ) async {
      await _pumpSignedOutLibrary(tester);

      expect(find.text('Sign in to see your saved work.'), findsOneWidget);
      final signIn = find.widgetWithText(SecondaryButton, 'Sign in');
      expect(signIn, findsOneWidget);
      expect(find.byIcon(LucideIcons.logIn), findsWidgets);

      await tester.tap(signIn);
      await tester.pumpAndSettle();

      // The action is real: it reaches the login route, not a dead end.
      expect(find.byKey(const Key('dest-login')), findsOneWidget);
    });
  });

  group('the 20-item cap is disclosed', () {
    testWidgets('a full page says it is the newest 20, not the whole archive', (
      tester,
    ) async {
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

  group('the shell reads the library once', () {
    testWidgets('opening the tab fires no second request', (tester) async {
      final client = libraryClient();
      // NEW IA (U-V5): the shell's IndexedStack builds every tab up front, so the
      // Library tab's single read has already fired behind the VIDYA-home
      // landing. Switching to the tab shows it without a second request.
      await pumpSignedInApp(tester, client: client);

      // U-V7: the VIDYA home also restores its own session/profile on boot, so
      // count only the LIBRARY read — the behaviour under test is unchanged.
      int contentReads() =>
          client.gets.where((g) => g.path == '/api/content/list').length;
      expect(contentReads(), 1);

      await tester.tap(find.byIcon(LucideIcons.library));
      await tester.pumpAndSettle();

      // Switching to the tab shows the already-loaded list without a re-read.
      expect(contentReads(), 1);
      expect(
        client.gets.firstWhere((g) => g.path == '/api/content/list').query,
        <String, dynamic>{'limit': 20},
      );
    });
  });

  group('type filters', () {
    testWidgets('a filter bar appears when there is more than one type', (
      tester,
    ) async {
      await _openLibrary(tester, client: _twoTypeClient());

      // "All" plus one chip per present type. The chips are ChoiceChips.
      expect(find.byType(ChoiceChip), findsNWidgets(3));
      expect(find.text('All'), findsOneWidget);
    });

    testWidgets(
      'a single-type library shows no filter bar (it would be busywork)',
      (tester) async {
        // Both items are lesson plans, so there is nothing to filter between.
        await _openLibrary(
          tester,
          client: libraryClient(
            response: contentListResponse(
              items: [
                contentItem(),
                contentItem(overrides: {'id': 'id-2', 'title': 'Cells'}),
              ],
            ),
          ),
        );

        expect(find.byType(ChoiceChip), findsNothing);
        expect(find.byType(LibraryItemRow), findsNWidgets(2));
      },
    );

    testWidgets('selecting a type narrows the list to that type', (
      tester,
    ) async {
      await _openLibrary(tester, client: _twoTypeClient());
      expect(find.byType(LibraryItemRow), findsNWidgets(2));

      // The "Quiz" chip is the only widget with exactly that text — the row's
      // meta line is a single joined string ("Quiz - ...").
      await tester.tap(find.widgetWithText(ChoiceChip, 'Quiz'));
      await tester.pumpAndSettle();

      expect(find.byType(LibraryItemRow), findsOneWidget);
      expect(find.text('Fractions quiz'), findsOneWidget);
      expect(find.text('Photosynthesis for Class 6'), findsNothing);
    });

    testWidgets('the All chip clears the filter again', (tester) async {
      await _openLibrary(tester, client: _twoTypeClient());

      await tester.tap(find.widgetWithText(ChoiceChip, 'Quiz'));
      await tester.pumpAndSettle();
      expect(find.byType(LibraryItemRow), findsOneWidget);

      await tester.tap(find.widgetWithText(ChoiceChip, 'All'));
      await tester.pumpAndSettle();
      expect(find.byType(LibraryItemRow), findsNWidgets(2));
    });

    testWidgets('client-side filtering fires no extra request', (tester) async {
      final client = _twoTypeClient();
      await _openLibrary(tester, client: client);
      final before = client.gets.length;

      await tester.tap(find.widgetWithText(ChoiceChip, 'Quiz'));
      await tester.pumpAndSettle();

      // The filter narrows the loaded list; it does not re-query the route.
      expect(client.gets.length, before);
    });
  });

  group('tap to open', () {
    testWidgets('tapping a row opens the item detail', (tester) async {
      final client = _twoTypeClient();
      await _openLibrary(tester, client: client);

      // The per-item read answers the detail; switch the fake to a single item.
      client.getResponse = contentItem();
      final row = find.text('Photosynthesis for Class 6');
      await tester.ensureVisible(row);
      await tester.pumpAndSettle();
      await tester.tap(row);
      await tester.pumpAndSettle();

      expect(find.byType(LibraryDetailScreen), findsOneWidget);
      // It fetched the tapped item off the per-item GET.
      expect(client.gets.last.path, '/api/content/get');
      expect(client.gets.last.query, <String, dynamic>{
        'id': '3f2a1b4c-0000-4000-8000-000000000001',
      });
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9 / §12.10 / §12.11)', () {
    for (final brightness in Brightness.values) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 in ${brightness.name}',
        (tester) async {
          await _openLibrary(
            tester,
            brightness: brightness,
            textScale: 1.3,
            surface: kNarrowPhone,
            client: _twoTypeClient(),
          );

          expect(tester.takeException(), isNull);
          // The filter bar is the row most likely to break: pills plus icons at
          // 1.3 on a 360dp line.
          expect(find.byType(ChoiceChip), findsNWidgets(3));
          await _scrollWholeList(tester);
        },
      );
    }

    for (final locale in const [Locale('bn'), Locale('ta'), Locale('ml')]) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 in ${locale.languageCode}',
        (tester) async {
          // Real localized screen at a real Indic locale, with Indic data in the
          // rows — not an English screen with a pasted string.
          await _openLibrary(
            tester,
            locale: locale,
            textScale: 1.3,
            surface: kNarrowPhone,
            client: libraryClient(
              response: contentListResponse(
                items: [
                  contentItem(overrides: {'title': kTa}),
                  contentItem(
                    overrides: {
                      'id': 'id-quiz-ml',
                      'title': kMl,
                      'type': 'quiz',
                    },
                  ),
                ],
              ),
            ),
          );

          expect(tester.takeException(), isNull);
          await _scrollWholeList(tester);
        },
      );
    }

    testWidgets('an unbreakable compound word wraps, never scrolls sideways', (
      tester,
    ) async {
      await _openLibrary(
        tester,
        textScale: 1.3,
        surface: kNarrowPhone,
        client: libraryClient(
          response: contentListResponse(
            items: [
              contentItem(overrides: {'title': kLongWord}),
            ],
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      await _scrollWholeList(tester);
    });
  });
}
