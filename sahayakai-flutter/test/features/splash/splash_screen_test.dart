import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/onboarding/presentation/login_screen.dart';
import 'package:sahayakai/features/splash/presentation/splash_screen.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_home_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/app_harness.dart';
import '../../support/fake_api_client.dart';
import 'splash_fixtures.dart';

/// P0.1 — Splash, and the redirect it hands off to.
///
/// These run the REAL router, so what is asserted is the app's actual
/// redirect behaviour on each auth state, not a re-implementation of it.
Future<void> _pumpApp(
  WidgetTester tester, {
  required FakeBootstrap boot,
  bool signedIn = false,
  Brightness? brightness,
  double textScale = 1.0,
  Locale? locale,
  Size surface = kNarrowPhone,
}) async {
  tester.view.physicalSize = surface;
  tester.view.devicePixelRatio = 1.0;
  if (brightness != null) {
    tester.platformDispatcher.platformBrightnessTestValue = brightness;
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
  }
  if (locale != null) {
    tester.platformDispatcher.localeTestValue = locale;
    addTearDown(tester.platformDispatcher.clearLocaleTestValue);
  }
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
  addTearDown(tester.view.reset);
  if (signedIn) {
    // The signed-in landing is now the VIDYA home, whose Seal Mic breathes on a
    // repeating controller; disable animations so pumpAndSettle sees its still.
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
  }

  await tester.pumpWidget(
    appHarness(
      overrides: harnessOverrides(
        // The dashboard fires GET /api/content/list the moment the redirect
        // lands on it. Without this that is a live request to production.
        client: FakeApiClient(error: kUnauthorized),
        overrides: [bootstrapOverride(boot), if (signedIn) signedInOverride()],
      ),
    ),
  );
}

const ApiException kUnauthorized = ApiException(
  ApiErrorKind.unauthorized,
  'Please sign in again.',
  statusCode: 401,
);

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('states', () {
    testWidgets(
      'while bootstrapping it shows the brand mark, not a bare spinner',
      (tester) async {
        await _pumpApp(tester, boot: FakeBootstrap(pending: true));
        await tester.pump();

        expect(find.byType(SplashScreen), findsOneWidget);
        // The brand mark IS the loading state. The progress indicator is beside
        // it, not instead of it (DESIGN_RUBRIC §6).
        expect(find.text('SahayakAI'), findsWidgets);
        expect(
          find.text('Teaching assistant for every classroom'),
          findsOneWidget,
        );
        expect(find.byType(CircularProgressIndicator), findsOneWidget);
        expect(find.text('Try again'), findsNothing);
      },
    );

    testWidgets('a failed bootstrap shows a retry, not an endless spinner', (
      tester,
    ) async {
      // The router keeps parking on /splash while the bootstrap has no value,
      // so without this state the teacher would spin here forever.
      await _pumpApp(
        tester,
        boot: FakeBootstrap(error: Exception('no network')),
      );
      await tester.pump();

      expect(find.byType(SplashScreen), findsOneWidget);
      expect(find.text('We could not start the app'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      // The brand mark stays: the layout does not jump between states.
      expect(find.text('SahayakAI'), findsWidgets);
    });

    testWidgets('no raw exception text ever reaches the teacher', (
      tester,
    ) async {
      await _pumpApp(
        tester,
        boot: FakeBootstrap(error: Exception('PlayIntegrity handshake failed')),
      );
      await tester.pump();

      expect(find.textContaining('PlayIntegrity'), findsNothing);
      expect(find.textContaining('Exception'), findsNothing);
    });

    testWidgets('retry re-runs the bootstrap and lets the redirect proceed', (
      tester,
    ) async {
      final boot = FakeBootstrap(error: Exception('no network'));
      await _pumpApp(tester, boot: boot);
      await tester.pump();
      expect(boot.calls, 1);
      expect(find.text('Try again'), findsOneWidget);

      // The connection came back.
      boot.error = null;
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();

      expect(boot.calls, 2, reason: 'retry must re-run the bootstrap');
      // Booted and signed out -> the guard sends the teacher to login.
      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.byType(SplashScreen), findsNothing);
    });
  });

  group('redirect on each auth state (P0.1 acceptance)', () {
    testWidgets('bootstrap pending -> parks on splash', (tester) async {
      await _pumpApp(
        tester,
        boot: FakeBootstrap(pending: true),
        signedIn: true,
      );
      await tester.pump();

      // Signed in, but there is no first snapshot yet: nothing may render
      // behind the guard.
      expect(find.byType(SplashScreen), findsOneWidget);
      expect(find.byType(VidyaHomeScreen), findsNothing);
      expect(find.byType(LoginScreen), findsNothing);
    });

    testWidgets('bootstrap failed -> parks on splash, never guesses', (
      tester,
    ) async {
      // Guessing here would either leak a protected screen or sign out a
      // signed-in teacher.
      await _pumpApp(
        tester,
        boot: FakeBootstrap(error: Exception('boom')),
        signedIn: true,
      );
      await tester.pump();

      expect(find.byType(SplashScreen), findsOneWidget);
      expect(find.byType(VidyaHomeScreen), findsNothing);
    });

    testWidgets('booted and signed out -> login', (tester) async {
      await _pumpApp(tester, boot: FakeBootstrap());
      await tester.pumpAndSettle();

      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.byType(SplashScreen), findsNothing);
    });

    testWidgets('booted and signed in -> the VIDYA home (new landing)', (
      tester,
    ) async {
      await _pumpApp(tester, boot: FakeBootstrap(), signedIn: true);
      await tester.pumpAndSettle();

      // The landing is now the voice-first VIDYA home, not the form-first
      // dashboard (U-V5 IA change).
      expect(find.byType(VidyaHomeScreen), findsOneWidget);
      expect(find.byType(SplashScreen), findsNothing);
      expect(find.byType(LoginScreen), findsNothing);
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9 / §12.10 / §12.11)', () {
    for (final brightness in Brightness.values) {
      testWidgets(
        'booting: no overflow at 360dp x textScale 1.3 in ${brightness.name}',
        (tester) async {
          await _pumpApp(
            tester,
            boot: FakeBootstrap(pending: true),
            brightness: brightness,
            textScale: 1.3,
          );
          await tester.pump();

          expect(tester.takeException(), isNull);
        },
      );

      testWidgets(
        'failed: no overflow at 360dp x textScale 1.3 in ${brightness.name}',
        (tester) async {
          await _pumpApp(
            tester,
            boot: FakeBootstrap(error: Exception('x')),
            brightness: brightness,
            textScale: 1.3,
          );
          await tester.pump();

          expect(tester.takeException(), isNull);
        },
      );
    }

    for (final locale in const [Locale('bn'), Locale('ta'), Locale('ml')]) {
      testWidgets(
        'failed: no overflow at 360dp x textScale 1.3 in ${locale.languageCode}',
        (tester) async {
          // The real localized screen at a real Indic locale, which is also
          // where the raised line-heights land.
          await _pumpApp(
            tester,
            boot: FakeBootstrap(error: Exception('x')),
            locale: locale,
            textScale: 1.3,
          );
          await tester.pump();

          expect(tester.takeException(), isNull);
        },
      );
    }

    testWidgets('the failure state survives a short screen at textScale 1.3', (
      tester,
    ) async {
      // A Spacer-based column would overflow here; the splash scrolls instead.
      await _pumpApp(
        tester,
        boot: FakeBootstrap(error: Exception('x')),
        textScale: 1.3,
        surface: kShortPhone,
      );
      await tester.pump();

      expect(tester.takeException(), isNull);
      expect(find.text('Try again'), findsOneWidget);
    });
  });
}
