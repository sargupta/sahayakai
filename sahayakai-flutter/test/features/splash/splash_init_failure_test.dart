import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sahayakai/core/auth/auth_providers.dart';
import 'package:sahayakai/core/firebase/firebase_init.dart';
import 'package:sahayakai/features/onboarding/presentation/login_screen.dart';
import 'package:sahayakai/features/splash/presentation/splash_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/app_harness.dart';
import '../../support/fake_api_client.dart';

/// The wiring test for the splash's retry screen becoming REACHABLE on a real
/// bootstrap failure.
///
/// The retry UI was built, localized and tested, but before this fix a real
/// `Firebase.initializeApp()` failure was swallowed by `firebase_init.dart`'s
/// `catch (_)`, so `appBootstrap` never errored and the teacher fell through to
/// a dead Login button instead. The fix (see `firebase_init.dart`) records the
/// failure in `FirebaseInit.initError` instead of dropping it, and
/// `appBootstrap` re-throws it as a typed [FirebaseInitException] the splash
/// renders as its retry screen.
///
/// These tests inject that failure through the harness's [FakeBootstrap] lever
/// (the same seam every splash test uses), NOT by calling the real
/// `Firebase.initializeApp()`: in the widget-test isolate that platform channel
/// never resolves (it HANGS rather than throws, since firebase_core 3.x speaks
/// Pigeon, not a mockable `MethodChannel`), so driving it directly would hang
/// the suite forever. The behaviour that matters — a typed init failure flows
/// through `appBootstrap`, and the splash surfaces its retry instead of
/// stranding the teacher — is exactly what [FakeBootstrap] models. The one
/// thing left to code review (not a hanging integration test) is the one-line
/// `catch (_)` -> `catch (error) { _initError = error; }` change in
/// `firebase_init.dart` that turns a real, swallowed failure into the
/// [FirebaseInitException] these tests inject.
void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  testWidgets('a bootstrap failure surfaces as a typed FirebaseInitException', (
    tester,
  ) async {
    final container = ProviderContainer(
      overrides: [
        bootstrapOverride(
          FakeBootstrap(
            error: const FirebaseInitException('injected init failure'),
          ),
        ),
      ],
    );
    addTearDown(container.dispose);

    // The provider resolves to an error (fast — the fake throws immediately),
    // and it is the exact type the splash keys its retry screen on. Before the
    // fix a real init failure never reached this point at all.
    await expectLater(
      container.read(appBootstrapProvider.future),
      throwsA(isA<FirebaseInitException>()),
    );
  });

  testWidgets(
    'the bootstrap failure reaches the splash retry screen (and retry re-runs it)',
    (tester) async {
      final fake = FakeBootstrap(
        error: const FirebaseInitException('injected init failure'),
      );
      await tester.pumpWidget(
        appHarness(
          overrides: harnessOverrides(
            client: FakeApiClient(),
            overrides: [bootstrapOverride(fake)],
          ),
        ),
      );
      // The fake throws immediately, so the splash settles onto its failure state
      // (no spinner) rather than hanging.
      await tester.pumpAndSettle();

      // The router parked on the splash instead of guessing an auth answer, and
      // the splash surfaced its retry — the teacher is no longer stranded on a
      // dead Login button.
      expect(find.byType(SplashScreen), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
      expect(find.byType(LoginScreen), findsNothing);
      // No raw exception text ever reaches the teacher.
      expect(find.textContaining('FirebaseInitException'), findsNothing);
      expect(find.textContaining('Exception'), findsNothing);

      // Tapping retry genuinely re-runs the bootstrap (the whole point of the
      // fix: the retry is real, not a repaint), which fails again and stays on
      // the retry screen.
      final callsBeforeRetry = fake.calls;
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(fake.calls, greaterThan(callsBeforeRetry));
      expect(find.byType(SplashScreen), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    },
  );
}
