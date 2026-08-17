import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sahayakai/core/auth/auth_providers.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/profile/presentation/me_screen.dart';
import 'package:sahayakai/shared/widgets/app_skeleton.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';
import 'package:sahayakai/shared/widgets/language_switcher.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart' as net;
import 'profile_fixtures.dart';

/// Screen-layer gates for U-OS1 — the Me / operating-system hub.
///
/// No live API: the profile lane is a fake document source, the usage lane is a
/// fake [ApiClient], and the plan claim is the signed-out stub unless a test
/// provides a token.

/// The `GET /api/usage` body a signed-in hub would receive. `limit: -1` is the
/// unlimited sentinel; a zero-limit feature is omitted server-side.
Map<String, dynamic> usageJson({String plan = 'free'}) => <String, dynamic>{
  'plan': plan,
  'canExport': false,
  'canViewDetailedAnalytics': false,
  'canAccessAbsenceRecords': false,
  'canUseParentMessaging': false,
  'model': 'gemini-2.5-flash',
  'usage': <String, dynamic>{
    'lesson-plan': <String, dynamic>{'used': 3, 'limit': 10},
    'quiz': <String, dynamic>{'used': 5, 'limit': 5},
    'instant-answer': <String, dynamic>{'used': 12, 'limit': -1},
    'visual-aid': <String, dynamic>{'used': 0, 'limit': 2},
  },
};

Future<void> _pumpMe(
  WidgetTester tester, {
  FakeProfileDocSource? source,
  net.FakeApiClient? client,
  String? token,
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  Locale locale = const Locale('en'),
  Size surface = kTallSurface,
  bool settle = true,
}) async {
  tester.view.physicalSize = surface;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    hostProfile(
      const MeScreen(),
      brightness: brightness,
      textScale: textScale,
      locale: locale,
      overrides: [
        docSourceOverride(source ?? FakeProfileDocSource(doc: teacherDoc())),
        apiClientOverride(
          client ?? net.FakeApiClient(getResponse: usageJson()),
        ),
        tokenOverride(token),
      ],
    ),
  );
  if (settle) await tester.pumpAndSettle();
}

/// A router host, for the rows that push a route. Probe screens stand in for the
/// real editor / Settings so a tap can be proven to navigate.
class _Probe extends StatelessWidget {
  const _Probe(this.label);
  final String label;
  @override
  Widget build(BuildContext context) =>
      Scaffold(body: Center(child: Text(label)));
}

Future<void> _pumpMeRouter(
  WidgetTester tester, {
  required List<Override> overrides,
  Size surface = kTallSurface,
}) async {
  tester.view.physicalSize = surface;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  final router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(path: '/', builder: (_, _) => const MeScreen()),
      GoRoute(
        path: Routes.profile,
        builder: (_, _) => const _Probe('EDIT-PROFILE'),
      ),
      GoRoute(
        path: Routes.settings,
        builder: (_, _) => const _Probe('SETTINGS'),
      ),
      GoRoute(path: Routes.login, builder: (_, _) => const _Probe('LOGIN')),
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp.router(
        theme: AppTheme.light(),
        routerConfig: router,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// Walks the hub top to bottom, asserting no overflow at any scroll offset.
Future<void> _scrollWholeList(WidgetTester tester) async {
  final position = tester
      .state<ScrollableState>(find.byType(Scrollable).first)
      .position;
  var guard = 0;
  while (position.pixels < position.maxScrollExtent && guard++ < 60) {
    await tester.drag(find.byType(ListView), const Offset(0, -280));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  }
}

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('states', () {
    testWidgets('shows a skeleton while the profile is being read', (
      tester,
    ) async {
      await _pumpMe(
        tester,
        source: FakeProfileDocSource(
          doc: teacherDoc(),
          readDelay: const Duration(milliseconds: 50),
        ),
        settle: false,
      );

      expect(find.byType(AppSkeleton), findsOneWidget);

      await tester.pump(const Duration(milliseconds: 100));
      await tester.pumpAndSettle();
      expect(find.byType(AppSkeleton), findsNothing);
      expect(find.text('Lakshmi Iyer'), findsWidgets);
    });

    testWidgets('renders the profile summary header from the loaded document', (
      tester,
    ) async {
      await _pumpMe(tester, token: fakeJwt({'planType': 'pro'}));

      // Name + role · school + the identity plan badge (from the token claim).
      expect(find.text('Lakshmi Iyer'), findsWidgets);
      expect(
        find.textContaining('Government Higher Primary School'),
        findsWidgets,
      );
      expect(find.text('Pro'), findsOneWidget);
      // Board + language summary chips.
      expect(find.text('Karnataka State Board (KSEEB)'), findsWidgets);
      expect(find.text('ಕನ್ನಡ'), findsOneWidget); // Kannada endonym
    });

    testWidgets('no display name falls back to a placeholder, never a blank', (
      tester,
    ) async {
      await _pumpMe(tester, source: FakeProfileDocSource(doc: null));
      // An empty profile is a valid hub (onboarding gate is OFF): the header
      // shows the placeholder identity, not an error.
      expect(find.text('Your profile'), findsOneWidget);
      expect(find.byType(EmptyView), findsNothing);
    });
  });

  group('plan & usage', () {
    testWidgets('a metered feature shows used/limit and a bar sized to it', (
      tester,
    ) async {
      await _pumpMe(tester);

      // Section is present (the editorial eyebrow uppercases Latin).
      expect(find.text('PLAN & USAGE'), findsOneWidget);

      // The metered lesson-plan row: its "3 / 10" and a meter whose fill is the
      // fraction 0.3.
      final lessonRow = find.byKey(
        const ValueKey<String>('usage-row-lesson-plan'),
      );
      expect(lessonRow, findsOneWidget);
      expect(
        find.descendant(of: lessonRow, matching: find.text('3 / 10')),
        findsOneWidget,
      );
      final meter = find.byKey(
        const ValueKey<String>('usage-meter-lesson-plan'),
      );
      expect(meter, findsOneWidget);
      final fill = tester.widget<FractionallySizedBox>(
        find.descendant(of: meter, matching: find.byType(FractionallySizedBox)),
      );
      expect(fill.widthFactor, closeTo(0.3, 1e-6));
    });

    testWidgets('an unlimited feature says "Unlimited" and draws no bar', (
      tester,
    ) async {
      await _pumpMe(tester);

      final instantRow = find.byKey(
        const ValueKey<String>('usage-row-instant-answer'),
      );
      expect(instantRow, findsOneWidget);
      expect(
        find.descendant(of: instantRow, matching: find.text('Unlimited')),
        findsOneWidget,
      );
      // No meter for the unlimited row.
      expect(
        find.byKey(const ValueKey<String>('usage-meter-instant-answer')),
        findsNothing,
      );
    });

    testWidgets('the plan tier badge reflects the usage plan', (tester) async {
      await _pumpMe(
        tester,
        client: net.FakeApiClient(getResponse: usageJson(plan: 'gold')),
        token: null, // header badge is "Not available"; the usage badge is Gold
      );

      expect(find.text('Gold'), findsOneWidget);
      expect(find.text('Not available'), findsOneWidget);
    });

    testWidgets('a usage failure degrades only the section, keeping the hub', (
      tester,
    ) async {
      // The profile read still succeeds, so the header stays; only the usage
      // card shows its degraded note + retry.
      await _pumpMe(tester, client: net.FakeApiClient(error: kUnauthorized));

      expect(find.text('Lakshmi Iyer'), findsWidgets); // header intact
      expect(
        find.text('We could not load your usage. Please try again.'),
        findsOneWidget,
      );
      expect(find.text('Try again'), findsOneWidget);
    });
  });

  group('defaults', () {
    testWidgets('surfaces the board and the shared language switcher', (
      tester,
    ) async {
      await _pumpMe(tester);

      expect(find.text('DEFAULTS'), findsOneWidget); // uppercased eyebrow
      expect(find.text('Education board'), findsOneWidget);
      // The board value appears in the Defaults row (and the header chip).
      expect(find.text('Karnataka State Board (KSEEB)'), findsWidgets);
      // The ONE shared switcher, not a second picker.
      expect(find.byType(LanguageSwitcher), findsOneWidget);
    });
  });

  group('privacy & settings rows', () {
    testWidgets('every hub row clears the 48dp touch floor', (tester) async {
      await _pumpMe(tester);

      // Board, Settings and Sign out are the hub rows (scoped by label so the
      // shared LanguageSwitcher's own tiles are not counted).
      for (final label in const ['Education board', 'Settings', 'Sign out']) {
        final tile = find.ancestor(
          of: find.text(label),
          matching: find.byType(ListTile),
        );
        expect(tile, findsOneWidget, reason: label);
        expect(
          tester.getSize(tile).height,
          greaterThanOrEqualTo(48.0),
          reason: '$label row must clear 48dp',
        );
      }
    });

    testWidgets('the Settings row navigates to Settings', (tester) async {
      await _pumpMeRouter(
        tester,
        overrides: [
          docSourceOverride(FakeProfileDocSource(doc: teacherDoc())),
          apiClientOverride(net.FakeApiClient(getResponse: usageJson())),
          tokenOverride(null),
        ],
      );

      await tester.tap(find.text('Settings'));
      await tester.pumpAndSettle();
      expect(find.text('SETTINGS'), findsOneWidget);
    });

    testWidgets('tapping the summary header opens the profile editor', (
      tester,
    ) async {
      await _pumpMeRouter(
        tester,
        overrides: [
          docSourceOverride(FakeProfileDocSource(doc: teacherDoc())),
          apiClientOverride(net.FakeApiClient(getResponse: usageJson())),
          tokenOverride(null),
        ],
      );

      await tester.tap(find.text('Lakshmi Iyer'));
      await tester.pumpAndSettle();
      expect(find.text('EDIT-PROFILE'), findsOneWidget);
    });

    testWidgets('the board row opens the profile editor', (tester) async {
      await _pumpMeRouter(
        tester,
        overrides: [
          docSourceOverride(FakeProfileDocSource(doc: teacherDoc())),
          apiClientOverride(net.FakeApiClient(getResponse: usageJson())),
          tokenOverride(null),
        ],
      );

      await tester.tap(find.text('Education board'));
      await tester.pumpAndSettle();
      expect(find.text('EDIT-PROFILE'), findsOneWidget);
    });

    testWidgets('sign out flips the auth state the router redirects on', (
      tester,
    ) async {
      await tester.pumpWidget(
        hostProfile(
          const MeScreen(),
          overrides: [
            docSourceOverride(FakeProfileDocSource(doc: teacherDoc())),
            apiClientOverride(net.FakeApiClient(getResponse: usageJson())),
            tokenOverride(null),
            signedInOverride(),
          ],
        ),
      );
      tester.view.physicalSize = kTallSurface;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
      await tester.pumpAndSettle();

      final container = ProviderScope.containerOf(
        tester.element(find.byType(MeScreen)),
      );
      expect(container.read(isSignedInProvider), isTrue);

      final signOut = find.text('Sign out');
      await tester.ensureVisible(signOut);
      await tester.pumpAndSettle();
      await tester.tap(signOut);
      await tester.pumpAndSettle();

      expect(container.read(isSignedInProvider), isFalse);
    });
  });

  group('signed out (401)', () {
    testWidgets(
      'the whole hub degrades to a sign-in prompt, no faked identity',
      (tester) async {
        final client = net.FakeApiClient(getResponse: usageJson());
        await _pumpMe(
          tester,
          source: FakeProfileDocSource(readError: kUnauthorized),
          client: client,
        );

        // A sign-in prompt, not a retry, not an invented profile.
        expect(find.byType(EmptyView), findsOneWidget);
        expect(find.text('You are signed out'), findsOneWidget);
        expect(find.text('Sign in'), findsOneWidget);
        expect(find.text('Lakshmi Iyer'), findsNothing);
        // The usage read is never even fired when there is no identity.
        expect(client.gets, isEmpty);
      },
    );

    testWidgets('the sign-in button routes to login', (tester) async {
      await _pumpMeRouter(
        tester,
        overrides: [
          docSourceOverride(FakeProfileDocSource(readError: kUnauthorized)),
          apiClientOverride(net.FakeApiClient(getResponse: usageJson())),
          tokenOverride(null),
        ],
      );

      await tester.tap(find.text('Sign in'));
      await tester.pumpAndSettle();
      expect(find.text('LOGIN'), findsOneWidget);
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9 / §12.10 / §12.11)', () {
    for (final brightness in Brightness.values) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 in ${brightness.name}',
        (tester) async {
          await _pumpMe(
            tester,
            brightness: brightness,
            textScale: 1.3,
            surface: kNarrowPhone,
            token: fakeJwt({'planType': 'pro'}),
          );

          expect(tester.takeException(), isNull);
          await _scrollWholeList(tester);
        },
      );
    }

    for (final locale in const [Locale('bn'), Locale('ta')]) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 in ${locale.languageCode}',
        (tester) async {
          await _pumpMe(
            tester,
            locale: locale,
            textScale: 1.3,
            surface: kNarrowPhone,
            source: FakeProfileDocSource(
              doc: teacherDoc(
                overrides: {'displayName': kBn, 'schoolName': kTa},
              ),
            ),
          );

          expect(tester.takeException(), isNull);
          await _scrollWholeList(tester);
        },
      );
    }
  });
}
