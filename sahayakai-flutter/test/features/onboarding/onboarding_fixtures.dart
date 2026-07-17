import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/router/app_router.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/features/onboarding/presentation/onboarding_screen.dart';
import 'package:sahayakai/features/profile/data/profile_doc_source.dart';

import '../../support/app_harness.dart';
import '../../support/fake_api_client.dart';
// `ProfileDocSource` is the PROFILE feature's seam, so its fake lives with that
// feature's fixtures and is imported here rather than copied — the same reason
// onboarding imports `ProfileRepository` instead of keeping its own. `show`
// keeps profile's own patch-only `FakeApiClient` out of scope; the client used
// here is the shared support one.
import '../profile/profile_fixtures.dart' show FakeProfileDocSource;

// Re-exported so the suites read `onboarding_fixtures.dart` as their one import.
export '../profile/profile_fixtures.dart' show FakeProfileDocSource;

/// Shared fixtures for the P0.2 suites. Not a `_test.dart` file, so the runner
/// ignores it.
///
/// Everything here runs the REAL app and the REAL router: login and onboarding
/// are almost entirely about navigation and the redirect guard, and a
/// hand-rolled router would test the hand-rolled router.

/// The DESIGN_RUBRIC §11 Indic probe strings.
const String kBn = 'শিক্ষকদের জন্য কৃত্রিম বুদ্ধিমত্তা সহায়ক';
const String kTa = 'ஆசிரியர்களுக்கான செயற்கை நுண்ணறிவு உதவியாளர்';
const String kMl = 'അധ്യാപകർക്കുള്ള നിർമ്മിത ബുദ്ധി സഹായി';

/// A deliberately unbreakable compound word: DESIGN_RUBRIC §8 says long words
/// must wrap, never scroll the body sideways.
const String kLongWord = 'Supercalifragilisticexpialidociousqualificationboard';

/// The 360dp phone gate from DESIGN_RUBRIC §12.9.
const Size kNarrowPhone = Size(360, 900);

/// A tall surface for FUNCTIONAL tests only.
///
/// Onboarding's profile step is a long lazy `ListView`: on a real 900dp phone
/// the contact rows sit past the viewport + cacheExtent, so their widgets are
/// never mounted and finders cannot see them. Behaviour tests care about
/// wiring, not layout. Layout IS asserted, at [kNarrowPhone], by the overflow
/// gates.
const Size kTallSurface = Size(360, 4000);

/// The 401 the signed-out document source and the API client both raise. It is
/// every save's outcome today: `tokenProvider` is the P0.2 stub.
const ApiException kUnauthorized = ApiException(
  ApiErrorKind.unauthorized,
  'Please sign in again.',
  statusCode: 401,
);

/// Boots the real app, signed in, on a surface of [surface].
Future<void> pumpSignedInApp(
  WidgetTester tester, {
  FakeApiClient? client,
  ProfileDocSource? docs,
  Brightness? brightness,
  double textScale = 1.0,
  Locale? locale,
  Size surface = kTallSurface,
  bool signedIn = true,
  /// False to observe an in-flight state. `pumpAndSettle` never terminates
  /// while a shimmer or a progress indicator is animating.
  bool settle = true,
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

  await tester.pumpWidget(
    appHarness(
      overrides: harnessOverrides(
        // The dashboard fires GET /api/content/list as soon as the redirect
        // lands on it; unstubbed that is a live request to production. The
        // default replies with no body, which decodes to an empty library —
        // harmless, and it leaves the PATCH lane working for save tests.
        client: client ?? FakeApiClient(),
        docs: docs ?? FakeProfileDocSource(doc: null),
        overrides: [
          bootstrapOverride(FakeBootstrap()),
          if (signedIn) signedInOverride(),
        ],
      ),
    ),
  );
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    // Enough frames for the router's redirect to land, without draining the
    // request under observation.
    await tester.pump();
    await tester.pump();
  }
}

/// Boots the app and navigates to onboarding the way the dashboard's nudge and
/// the login screen both do.
Future<void> pumpOnboarding(
  WidgetTester tester, {
  FakeApiClient? client,
  ProfileDocSource? docs,
  Brightness? brightness,
  double textScale = 1.0,
  Locale? locale,
  Size surface = kTallSurface,
}) async {
  await pumpSignedInApp(
    tester,
    client: client,
    docs: docs,
    brightness: brightness,
    textScale: textScale,
    locale: locale,
    surface: surface,
  );
  routerOf(tester).go(Routes.onboarding);
  await tester.pumpAndSettle();
  expect(find.byType(OnboardingScreen), findsOneWidget);
}

/// The app's real [GoRouter], for driving navigation a test cannot tap its way
/// to.
GoRouter routerOf(WidgetTester tester) {
  final container = ProviderScope.containerOf(
    tester.element(find.byType(Navigator).first),
  );
  return container.read(appRouterProvider);
}

/// Reads the container so a test can assert on provider state (the locale, the
/// auth status) rather than inferring it from pixels.
ProviderContainer containerOf(WidgetTester tester) {
  return ProviderScope.containerOf(
    tester.element(find.byType(Navigator).first),
  );
}
