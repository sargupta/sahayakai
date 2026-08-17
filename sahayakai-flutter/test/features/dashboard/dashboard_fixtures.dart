import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/features/dashboard/presentation/dashboard_screen.dart';
import 'package:sahayakai/features/profile/data/profile_doc_source.dart';

import '../../support/fake_api_client.dart';
import '../onboarding/onboarding_fixtures.dart';

/// Shared fixtures for the P0.3 suites. Not a `_test.dart` file, so the runner
/// ignores it.
///
/// The dashboard is the signed-in landing surface, so its suites boot the REAL
/// app through the shared harness (see `test/support/app_harness.dart`) and
/// arrive here the way a teacher does: through the router's redirect.
export '../onboarding/onboarding_fixtures.dart'
    show
        FakeProfileDocSource,
        kBn,
        kTa,
        kMl,
        kLongWord,
        kNarrowPhone,
        kTallSurface,
        kUnauthorized,
        containerOf,
        routerOf;

/// One item of `GET /api/content/list`'s `items` array, in the shape the route
/// really returns: every timestamp already run through `dbAdapter.serialize`,
/// which turns Firestore's `{_seconds, _nanoseconds}` into an ISO 8601 string.
Map<String, dynamic> contentItem({
  Map<String, dynamic> overrides = const <String, dynamic>{},
}) {
  return <String, dynamic>{
    'id': '3f2a1b4c-0000-4000-8000-000000000001',
    'type': 'lesson-plan',
    'title': 'Photosynthesis for Class 6',
    'gradeLevel': 'Class 6',
    'subject': 'Science',
    'topic': 'Photosynthesis',
    'language': 'English',
    'isPublic': false,
    'isDraft': false,
    'createdAt': '2026-07-15T09:30:00.000Z',
    'updatedAt': '2026-07-15T09:30:00.000Z',
    'storagePath': 'users/u1/content/abc.json',
    ...overrides,
  };
}

/// The `{ items, count, nextCursor }` envelope the route wraps them in.
/// `nextCursor` is an explicit null on the last page, never an absent key.
Map<String, dynamic> contentListResponse({
  List<Map<String, dynamic>>? items,
  String? nextCursor,
}) {
  final list = items ?? <Map<String, dynamic>>[contentItem()];
  return <String, dynamic>{
    'items': list,
    'count': list.length,
    'nextCursor': nextCursor,
  };
}

/// A client whose GET replies with [response].
FakeApiClient libraryClient({
  Object? response,
  Object? error,
  Duration? delay,
}) {
  return FakeApiClient(
    getResponse: response ?? contentListResponse(),
    error: error,
    delay: delay,
  );
}

/// Boots the app signed in and drives to the Prep desk (the former dashboard).
///
/// NEW IA (U-V5): the landing is now the voice-first VIDYA home, and the
/// teaching-tools grid moved to the `/prep-desk` route reached from its app bar.
/// These dashboard suites test that grid, so the fixture navigates straight to
/// it — the tiles, recent-work states and nudge are unchanged, only the way in.
Future<void> pumpDashboard(
  WidgetTester tester, {
  FakeApiClient? client,
  ProfileDocSource? docs,
  Brightness? brightness,
  double textScale = 1.0,
  Locale? locale,
  Size surface = kTallSurface,
  bool settle = true,

  /// Passed through to [pumpSignedInApp]. The golden suites use it to pin the
  /// clock, because the dashboard eyebrow greets by time of day and a baseline
  /// that encodes the hour it was generated in is not a baseline.
  List<Override> extraOverrides = const [],
}) async {
  await pumpSignedInApp(
    tester,
    extraOverrides: extraOverrides,
    client: client ?? libraryClient(),
    // The profile read 401s on today's stub auth, which is the honest default:
    // it is what a real device does right now.
    docs: docs ?? const SignedOutProfileDocSource(),
    brightness: brightness,
    textScale: textScale,
    locale: locale,
    surface: surface,
    settle: settle,
  );
  // Replace the VIDYA-home landing with the Prep desk so only the dashboard
  // watches the library provider (the recent-work get-count assertions hold).
  routerOf(tester).go(Routes.prepDesk);
  if (settle) {
    await tester.pumpAndSettle();
    expect(find.byType(DashboardScreen), findsOneWidget);
  } else {
    await tester.pump();
    await tester.pump();
  }
}

/// The offline failure a rural connection produces, which the recent section
/// must treat as expected rather than exceptional.
const ApiException kOffline = ApiException(
  ApiErrorKind.network,
  'No internet connection.',
);

/// Anything else that goes wrong server-side.
const ApiException kServerError = ApiException(
  ApiErrorKind.server,
  'Something went wrong on our side.',
  statusCode: 500,
);
