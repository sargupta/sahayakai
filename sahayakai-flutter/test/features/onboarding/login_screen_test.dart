import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sahayakai/core/auth/auth_providers.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/core/i18n/locale_provider.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_home_screen.dart';
import 'package:sahayakai/features/instant_answer/presentation/instant_answer_screen.dart';
import 'package:sahayakai/features/onboarding/presentation/login_screen.dart';
import 'package:sahayakai/features/onboarding/presentation/onboarding_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/app_harness.dart' show signInSucceedsOverride;
import 'onboarding_fixtures.dart';

/// P0.2 — Login.
///
/// Real Google sign-in is wired (see `AuthController` — `firebase_auth` +
/// `google_sign_in`), but it is gated on `FirebaseInit.isConfigured`, which is
/// always false in a widget test (nothing here runs `main()`'s
/// `Firebase.initializeApp()`). The 'sign in' group's two navigation tests use
/// `signInSucceedsOverride()` (test/support/app_harness.dart) to model a
/// SUCCESSFUL real exchange without touching Firebase/Google for real — what
/// is asserted is everything except the credential exchange itself: the
/// destination logic, the router handoff, and the language choice that has to
/// work BEFORE a teacher signs in.
Future<void> _pumpLogin(
  WidgetTester tester, {
  Brightness? brightness,
  double textScale = 1.0,
  Locale? locale,
  Size surface = kTallSurface,
  List<Override> extraOverrides = const [],
}) async {
  await pumpSignedInApp(
    tester,
    signedIn: false,
    brightness: brightness,
    textScale: textScale,
    locale: locale,
    surface: surface,
    extraOverrides: extraOverrides,
  );
  expect(find.byType(LoginScreen), findsOneWidget);
}

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('destinationFor', () {
    test('with no deep link, first-run setup is the destination', () {
      // A suggestion, not a gate: onboarding's own skip leaves for the
      // dashboard and nothing sends anyone back.
      expect(LoginScreen.destinationFor(null), Routes.onboarding);
      expect(LoginScreen.destinationFor(''), Routes.onboarding);
    });

    test('a preserved deep link wins', () {
      // This is what makes the guard's bounce invisible: a teacher who tapped
      // a link to the quiz tool lands on the quiz tool, not on setup.
      expect(
        LoginScreen.destinationFor(Routes.quizGenerator),
        Routes.quizGenerator,
      );
    });
  });

  group('content', () {
    testWidgets('leads with what the app does before it asks for anything',
        (tester) async {
      await _pumpLogin(tester);

      expect(find.text('Welcome to SahayakAI'), findsOneWidget);
      // Real capabilities that exist in this build, not "Get started" filler
      // (DESIGN_RUBRIC §11).
      expect(find.text('Plan a full lesson in minutes'), findsOneWidget);
      expect(find.text('Build a quiz at three difficulty levels'), findsOneWidget);
      expect(
        find.text('Answer any classroom question, in your language'),
        findsOneWidget,
      );
      expect(find.text('Continue with Google'), findsOneWidget);
    });

    testWidgets('the language picker is reachable BEFORE sign-in',
        (tester) async {
      // A teacher who reads Odia must not have to sign in to an English screen
      // to find out the app speaks Odia.
      await _pumpLogin(tester);

      // The prompt is now an EditorialSectionHeader eyebrow, which uppercases
      // Latin (unicameral Indic scripts are left as-is). Same string, same
      // reachable-before-sign-in behaviour — only the register changed.
      expect(find.text('CHOOSE YOUR LANGUAGE'), findsOneWidget);
      expect(find.text('Language'), findsWidgets);
    });
  });

  group('language picker (step 0)', () {
    testWidgets('offers all 11 languages, each in its own script',
        (tester) async {
      await _pumpLogin(tester);

      await tester.tap(find.text('Language').first);
      await tester.pumpAndSettle();

      // Never Hindi-only (DESIGN_RUBRIC §10). Every one of the 11, by endonym.
      for (final locale in AppLocale.values) {
        expect(
          find.text(locale.nativeLabel),
          findsWidgets,
          reason: '${locale.aiName} must be offered in its own script',
        );
      }
      expect(AppLocale.values, hasLength(11));
    });

    testWidgets('choosing a language sets the UI locale AND the AI language param',
        (tester) async {
      await _pumpLogin(tester);
      final container = containerOf(tester);
      expect(container.read(localeControllerProvider), AppLocale.en);

      await tester.tap(find.text('Language').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('বাংলা'));
      await tester.pumpAndSettle();

      final selected = container.read(localeControllerProvider);
      // One switcher, two consumers, zero drift: the SAME enum drives the UI
      // locale and the `language` every AI endpoint is called with.
      expect(selected, AppLocale.bn);
      expect(selected.flutterLocale, const Locale('bn'));
      expect(
        selected.aiName,
        'Bengali',
        reason: 'the AI param is the full English name the backend expects',
      );

      // And the app really re-localized, not just stored a value.
      expect(find.text('Welcome to SahayakAI'), findsNothing);
    });
  });

  group('sign in (built-pending-firebase)', () {
    testWidgets('signing in flips auth and lands on first-run setup',
        (tester) async {
      await _pumpLogin(tester, extraOverrides: [signInSucceedsOverride()]);
      final container = containerOf(tester);
      expect(container.read(isSignedInProvider), isFalse);

      await tester.tap(find.text('Continue with Google'));
      await tester.pumpAndSettle();

      expect(container.read(isSignedInProvider), isTrue);
      // The redirect races this: it sends a signed-in teacher on /login to
      // home. The screen's own navigation must win.
      expect(find.byType(OnboardingScreen), findsOneWidget);
      expect(find.byType(LoginScreen), findsNothing);
    });

    testWidgets('a preserved deep link beats first-run setup', (tester) async {
      await _pumpLogin(tester, extraOverrides: [signInSucceedsOverride()]);

      // Exactly what the guard does to an unauthenticated teacher who deep
      // links into a tool.
      routerOf(tester).go('${Routes.login}?next=${Routes.instantAnswer}');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Continue with Google'));
      await tester.pumpAndSettle();

      expect(find.byType(InstantAnswerScreen), findsOneWidget);
      expect(find.byType(OnboardingScreen), findsNothing);
    });

    testWidgets('an unauthenticated teacher on a protected route is bounced here',
        (tester) async {
      await _pumpLogin(tester);

      routerOf(tester).go(Routes.quizGenerator);
      await tester.pumpAndSettle();

      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.byType(VidyaHomeScreen), findsNothing);
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9 / §12.10 / §12.11)', () {
    for (final brightness in Brightness.values) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 in ${brightness.name}',
        (tester) async {
          await _pumpLogin(
            tester,
            brightness: brightness,
            textScale: 1.3,
            surface: kNarrowPhone,
          );

          expect(tester.takeException(), isNull);
          await scrollWholeList(tester);
        },
      );
    }

    for (final locale in const [Locale('bn'), Locale('ta'), Locale('ml')]) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 in ${locale.languageCode}',
        (tester) async {
          // The real localized screen at a real Indic locale, where the raised
          // line-heights land too.
          await _pumpLogin(
            tester,
            locale: locale,
            textScale: 1.3,
            surface: kNarrowPhone,
          );

          expect(tester.takeException(), isNull);
          await scrollWholeList(tester);
        },
      );
    }

    testWidgets('the language sheet does not overflow at textScale 1.3',
        (tester) async {
      await _pumpLogin(tester, textScale: 1.3, surface: kNarrowPhone);

      // The premium hero (displayHero masthead + hairline value register) sits
      // the language picker below the fold at 360dp x 1.3, so the lazy ListView
      // has not built it yet — scroll it into view before opening the sheet.
      await tester.scrollUntilVisible(find.text('Language'), 200);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Language').first);
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('മലയാളം'), findsWidgets);
    });
  });
}

/// Walks the list top to bottom, asserting no RenderFlex overflow at any scroll
/// offset. An overflow below the fold is still an overflow.
Future<void> scrollWholeList(WidgetTester tester) async {
  final position =
      tester.state<ScrollableState>(find.byType(Scrollable).first).position;
  var guard = 0;
  while (position.pixels < position.maxScrollExtent && guard++ < 60) {
    await tester.drag(find.byType(ListView).first, const Offset(0, -280));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  }
}
