import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sahayakai/core/auth/auth_providers.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/profile/domain/plan_badge.dart';
import 'package:sahayakai/features/profile/presentation/profile_screen.dart';
import 'package:sahayakai/shared/widgets/app_skeleton.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';
import 'package:sahayakai/shared/widgets/error_view.dart';
import 'package:sahayakai/shared/widgets/offline_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'profile_fixtures.dart';

/// Screen-layer gates for P0.8.
///
/// No live API is exercised: the document lane is a fake, and the PATCH lane is
/// a signed-out stub until Firebase lands.
Future<void> _pumpScreen(
  WidgetTester tester, {
  FakeProfileDocSource? source,
  FakeApiClient? client,
  String? token,
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  Locale locale = const Locale('en'),
  // Functional tests mount the whole list (see kTallSurface); the overflow
  // gates pass kNarrowPhone and scroll it for real.
  Size surface = kTallSurface,
  bool settle = true,
}) async {
  tester.view.physicalSize = surface;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    hostProfile(
      const ProfileScreen(),
      brightness: brightness,
      textScale: textScale,
      locale: locale,
      overrides: [
        docSourceOverride(source ?? FakeProfileDocSource(doc: teacherDoc())),
        // Without this the PATCH lane opens a real socket to production.
        apiClientOverride(client ?? FakeApiClient()),
        tokenOverride(token),
      ],
    ),
  );
  if (settle) await tester.pumpAndSettle();
}

/// Walks the profile list top to bottom, asserting no RenderFlex overflow at
/// any scroll offset. An overflow below the fold is still an overflow, and this
/// screen is taller than any phone.
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
      await _pumpScreen(
        tester,
        // A read that is still in flight, which is the only state where a
        // skeleton is the right answer.
        source: FakeProfileDocSource(
          doc: teacherDoc(),
          readDelay: const Duration(milliseconds: 50),
        ),
        settle: false,
      );

      // A shaped shimmer, never a bare centered spinner (DESIGN_RUBRIC §6).
      expect(find.byType(AppSkeleton), findsOneWidget);
      expect(find.byType(TextFormField), findsNothing);

      // The read lands; the skeleton must give way to the form. (pumpAndSettle
      // only terminates once the shimmer is gone: it animates forever.)
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pumpAndSettle();

      expect(find.byType(AppSkeleton), findsNothing);
      expect(find.text('Lakshmi Iyer'), findsWidgets);
    });

    testWidgets('renders the teacher\'s saved values once loaded', (
      tester,
    ) async {
      await _pumpScreen(tester);

      expect(find.text('Lakshmi Iyer'), findsWidgets);
      expect(find.text('Government Higher Primary School'), findsWidgets);
      expect(find.text('Karnataka'), findsWidgets);
      expect(find.text('Mysuru'), findsWidgets);
      expect(find.text('9845012345'), findsOneWidget);
      expect(find.text('570001'), findsOneWidget);
      expect(find.text('Karnataka State Board (KSEEB)'), findsWidgets);
    });

    testWidgets('an empty profile gets the empty state, not an error', (
      tester,
    ) async {
      await _pumpScreen(tester, source: FakeProfileDocSource(doc: null));

      expect(find.byType(EmptyView), findsOneWidget);
      expect(find.byType(ErrorView), findsNothing);
      // ... and the form is still there, because filling it in is the fix.
      expect(find.byType(TextFormField), findsWidgets);
    });

    testWidgets('a loaded profile does NOT show the empty state', (
      tester,
    ) async {
      await _pumpScreen(tester);
      expect(find.byType(EmptyView), findsNothing);
    });

    testWidgets('a 401 shows the sign-in prompt, not a retry', (tester) async {
      // Offering "Try again" to a signed-out teacher would loop them forever.
      await _pumpScreen(
        tester,
        source: FakeProfileDocSource(readError: kUnauthorized),
      );

      expect(find.text('You are signed out'), findsOneWidget);
      expect(find.text('Sign in'), findsOneWidget);
      expect(find.byType(OfflineView), findsNothing);
      expect(find.byType(ErrorView), findsNothing);
    });

    testWidgets('a network failure shows the offline state with a retry', (
      tester,
    ) async {
      await _pumpScreen(
        tester,
        source: FakeProfileDocSource(
          readError: const ApiException(
            ApiErrorKind.network,
            'No internet connection.',
          ),
        ),
      );

      expect(find.byType(OfflineView), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('a timeout is treated as offline too', (tester) async {
      await _pumpScreen(
        tester,
        source: FakeProfileDocSource(
          readError: const ApiException(ApiErrorKind.timeout, 'Too slow.'),
        ),
      );

      expect(find.byType(OfflineView), findsOneWidget);
    });

    testWidgets('any other failure shows the error state with a retry', (
      tester,
    ) async {
      await _pumpScreen(
        tester,
        source: FakeProfileDocSource(
          readError: const ApiException(ApiErrorKind.server, 'boom'),
        ),
      );

      expect(find.byType(ErrorView), findsOneWidget);
      expect(
        find.text('We could not open your profile. Please try again.'),
        findsOneWidget,
      );
      // No raw exception text ever reaches the teacher (DESIGN_RUBRIC §6).
      expect(find.textContaining('boom'), findsNothing);
    });

    testWidgets('retry re-runs the read and recovers', (tester) async {
      final source = FakeProfileDocSource(
        readError: const ApiException(
          ApiErrorKind.network,
          'No internet connection.',
        ),
      );
      await _pumpScreen(tester, source: source);
      expect(find.byType(OfflineView), findsOneWidget);

      // The connection came back.
      source
        ..readError = null
        ..doc = teacherDoc();
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();

      expect(find.byType(OfflineView), findsNothing);
      expect(find.text('Lakshmi Iyer'), findsWidgets);
    });
  });

  group('plan badge', () {
    testWidgets('with no token it says "Not available", never "Free"', (
      tester,
    ) async {
      // This is the runtime state today: the token provider is the P0.2 stub.
      // Rendering "Free" here would state a fact about a paying teacher's
      // account that the app has no way to know.
      await _pumpScreen(tester, token: null);

      expect(find.text('Not available'), findsOneWidget);
      expect(find.text('Free'), findsNothing);
    });

    testWidgets('renders each tier from the token claim', (tester) async {
      for (final entry in const <(PlanBadge, String)>[
        (PlanBadge.free, 'Free'),
        (PlanBadge.pro, 'Pro'),
        (PlanBadge.gold, 'Gold'),
        (PlanBadge.premium, 'Premium'),
      ]) {
        await _pumpScreen(tester, token: fakeJwt({'planType': entry.$1.claim}));

        expect(
          find.text(entry.$2),
          findsOneWidget,
          reason: 'the ${entry.$1.name} claim must render as "${entry.$2}"',
        );
        expect(find.text('Not available'), findsNothing);
      }
    });

    testWidgets('a token with no plan claim renders Free', (tester) async {
      // A new user whose claim has not been stamped yet IS metered as free.
      await _pumpScreen(tester, token: fakeJwt({'sub': 'u1'}));

      expect(find.text('Free'), findsOneWidget);
    });

    testWidgets('a malformed token falls back to unknown, not a crash', (
      tester,
    ) async {
      await _pumpScreen(tester, token: 'not-a-jwt');

      expect(find.text('Not available'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('validation', () {
    Future<void> enterAndSave(
      WidgetTester tester, {
      required String label,
      required String value,
    }) async {
      final field = find.ancestor(
        of: find.text(label),
        matching: find.byType(Column),
      );
      expect(field, findsWidgets);
      await tester.enterText(
        find.descendant(of: field.first, matching: find.byType(TextFormField)),
        value,
      );
      // tap() only WARNS on a missed hit-test, so the button is scrolled into
      // view before it is tapped rather than trusting the surface height.
      final save = find.text('Save profile');
      await tester.ensureVisible(save);
      await tester.pumpAndSettle();
      await tester.tap(save);
      await tester.pumpAndSettle();
    }

    testWidgets('rejects a phone number that is not an Indian mobile', (
      tester,
    ) async {
      await _pumpScreen(tester);
      await enterAndSave(tester, label: 'Mobile number', value: '12345');

      expect(
        find.text('Please enter a ten digit Indian mobile number.'),
        findsOneWidget,
      );
    });

    testWidgets('accepts the three ways a teacher writes their number', (
      tester,
    ) async {
      for (final number in const [
        '9845012345',
        '+919845012345',
        '09845012345',
      ]) {
        await _pumpScreen(tester);
        await enterAndSave(tester, label: 'Mobile number', value: number);

        expect(
          find.text('Please enter a ten digit Indian mobile number.'),
          findsNothing,
          reason: '"$number" is a number a real teacher would type',
        );
      }
    });

    testWidgets('forgives spaces and hyphens in a phone number', (
      tester,
    ) async {
      await _pumpScreen(tester);
      await enterAndSave(tester, label: 'Mobile number', value: '98450 12345');

      expect(
        find.text('Please enter a ten digit Indian mobile number.'),
        findsNothing,
      );
    });

    testWidgets('a blank phone number is valid: the field is optional', (
      tester,
    ) async {
      await _pumpScreen(tester, source: FakeProfileDocSource(doc: null));
      await enterAndSave(tester, label: 'Mobile number', value: '');

      expect(
        find.text('Please enter a ten digit Indian mobile number.'),
        findsNothing,
      );
    });

    testWidgets('rejects a PIN code that is not six digits', (tester) async {
      await _pumpScreen(tester);
      await enterAndSave(tester, label: 'PIN code', value: '5700');

      expect(find.text('Please enter a six digit PIN code.'), findsOneWidget);
    });

    testWidgets('rejects a PIN code starting with zero', (tester) async {
      // No Indian PIN code begins with 0.
      await _pumpScreen(tester);
      await enterAndSave(tester, label: 'PIN code', value: '070001');

      expect(find.text('Please enter a six digit PIN code.'), findsOneWidget);
    });

    testWidgets('accepts a real PIN code', (tester) async {
      await _pumpScreen(tester);
      await enterAndSave(tester, label: 'PIN code', value: '570001');

      expect(find.text('Please enter a six digit PIN code.'), findsNothing);
    });

    testWidgets('a blank PIN code is valid: the field is optional', (
      tester,
    ) async {
      await _pumpScreen(tester, source: FakeProfileDocSource(doc: null));
      await enterAndSave(tester, label: 'PIN code', value: '');

      expect(find.text('Please enter a six digit PIN code.'), findsNothing);
    });
  });

  group('save', () {
    testWidgets('a validation failure never reaches the network', (
      tester,
    ) async {
      final source = FakeProfileDocSource(doc: teacherDoc());
      await _pumpScreen(tester, source: source);

      final phone = find.ancestor(
        of: find.text('Mobile number'),
        matching: find.byType(Column),
      );
      await tester.enterText(
        find.descendant(of: phone.first, matching: find.byType(TextFormField)),
        '123',
      );
      final save = find.text('Save profile');
      await tester.ensureVisible(save);
      await tester.pumpAndSettle();
      await tester.tap(save);
      await tester.pumpAndSettle();

      expect(source.merges, isEmpty);
    });

    testWidgets('a valid save writes the document lane', (tester) async {
      final source = FakeProfileDocSource(doc: teacherDoc());
      await _pumpScreen(tester, source: source);

      final save = find.text('Save profile');
      await tester.ensureVisible(save);
      await tester.pumpAndSettle();
      await tester.tap(save);
      await tester.pumpAndSettle();

      expect(source.merges, hasLength(1));
      expect(source.merges.single['displayName'], 'Lakshmi Iyer');
      expect(source.merges.single['state'], 'Karnataka');
      // Never the fields the rules protect or the PATCH lane owns.
      expect(source.merges.single.containsKey('planType'), isFalse);
      expect(source.merges.single.containsKey('administrativeRole'), isFalse);
    });

    testWidgets('a save failure shows an inline error, keeping the form', (
      tester,
    ) async {
      final source = FakeProfileDocSource(
        doc: teacherDoc(),
        writeError: kUnauthorized,
      );
      await _pumpScreen(tester, source: source);

      final save = find.text('Save profile');
      await tester.ensureVisible(save);
      await tester.pumpAndSettle();
      await tester.tap(save);
      await tester.pumpAndSettle();

      expect(
        find.text('Please sign in again to save your profile.'),
        findsOneWidget,
      );
      // The teacher's typing survives the failure.
      expect(find.text('Lakshmi Iyer'), findsWidgets);
    });
  });

  group('navigation', () {
    testWidgets('the gear opens Settings', (tester) async {
      // The P0.7 entry point. Pushing a route needs a router, so this asserts
      // the action exists and is wired; the route itself is pinned by the
      // router's own suite.
      await _pumpScreen(tester);

      expect(find.byTooltip('Settings'), findsOneWidget);
    });

    testWidgets('sign out flips the auth state the router redirects on', (
      tester,
    ) async {
      await tester.pumpWidget(
        hostProfile(
          const ProfileScreen(),
          overrides: [
            docSourceOverride(FakeProfileDocSource(doc: teacherDoc())),
            apiClientOverride(FakeApiClient()),
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
        tester.element(find.byType(ProfileScreen)),
      );
      expect(container.read(isSignedInProvider), isTrue);

      final signOut = find.text('Sign out');
      await tester.ensureVisible(signOut);
      await tester.pumpAndSettle();
      await tester.tap(signOut);
      await tester.pumpAndSettle();

      // The router's redirect guard reads exactly this: signed out on a
      // protected route sends the teacher to /login.
      expect(container.read(isSignedInProvider), isFalse);
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9 / §12.10 / §12.11)', () {
    for (final brightness in Brightness.values) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 in ${brightness.name}',
        (tester) async {
          await _pumpScreen(
            tester,
            brightness: brightness,
            textScale: 1.3,
            surface: kNarrowPhone,
          );

          expect(tester.takeException(), isNull);
          await _scrollWholeList(tester);
        },
      );
    }

    for (final locale in const [Locale('bn'), Locale('ta'), Locale('ml')]) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 in ${locale.languageCode}',
        (tester) async {
          // The real localized screen at a real Indic locale, with Indic data
          // in the fields — not an English screen with a pasted string.
          await _pumpScreen(
            tester,
            locale: locale,
            textScale: 1.3,
            surface: kNarrowPhone,
            source: FakeProfileDocSource(
              doc: teacherDoc(
                overrides: {
                  'displayName': kBn,
                  'schoolName': kTa,
                  'district': kMl,
                },
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
      await _pumpScreen(
        tester,
        textScale: 1.3,
        surface: kNarrowPhone,
        source: FakeProfileDocSource(
          doc: teacherDoc(
            overrides: {
              'displayName': kLongWord,
              'schoolName': kLongWord,
              'district': kLongWord,
            },
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      await _scrollWholeList(tester);
    });

    testWidgets('the longest board name does not overflow the identity card', (
      tester,
    ) async {
      await _pumpScreen(
        tester,
        textScale: 1.3,
        surface: kNarrowPhone,
        token: fakeJwt({'planType': 'premium'}),
        source: FakeProfileDocSource(
          doc: teacherDoc(
            overrides: {
              'preferredBoard': 'Himachal Pradesh State Board (HPBOSE)',
              'state': 'Dadra and Nagar Haveli and Daman and Diu',
            },
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      await _scrollWholeList(tester);
    });
  });
}
