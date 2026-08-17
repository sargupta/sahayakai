import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/core/i18n/locale_provider.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_home_screen.dart';
import 'package:sahayakai/features/onboarding/presentation/onboarding_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import 'onboarding_fixtures.dart';

/// P0.2 — Onboarding.
///
/// The suite's centre of gravity is the "no hard gate" group. The web shipped a
/// cookie-only onboarding gate on 2026-06-08 and locked out its ENTIRE existing
/// user base; `ONBOARDING_GATE_ENABLED` is default-off because of it. These
/// tests exist so nobody re-creates that gate on the client by accident.

/// Advances step 0 -> step 1 (the profile form).
Future<void> _toProfileStep(WidgetTester tester) async {
  await tester.tap(find.text('Next'));
  await tester.pumpAndSettle();
  expect(find.text('Tell us about your classroom'), findsOneWidget);
}

Future<void> _tapSave(WidgetTester tester) async {
  final save = find.text('Save and continue');
  // tap() only WARNS on a missed hit-test, so the button is scrolled into view
  // rather than trusting the surface height.
  await tester.ensureVisible(save);
  await tester.pumpAndSettle();
  await tester.tap(save);
  await tester.pumpAndSettle();
}

Future<void> _enter(WidgetTester tester, String label, String value) async {
  final field = find.ancestor(
    of: find.text(label),
    matching: find.byType(Column),
  );
  expect(field, findsWidgets);
  await tester.enterText(
    find.descendant(of: field.first, matching: find.byType(TextFormField)),
    value,
  );
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('no hard gate (the 2026-06-08 incident must not come back)', () {
    testWidgets('nothing ever redirects a signed-in teacher TO onboarding', (
      tester,
    ) async {
      // A teacher with NO profile at all — the exact user a gate would trap —
      // boots straight into the app (the VIDYA home is now the landing, U-V5).
      await pumpSignedInApp(tester, docs: FakeProfileDocSource(doc: null));

      expect(find.byType(VidyaHomeScreen), findsOneWidget);
      expect(find.byType(OnboardingScreen), findsNothing);
    });

    testWidgets('every tool stays reachable with an empty profile', (
      tester,
    ) async {
      await pumpSignedInApp(tester, docs: FakeProfileDocSource(doc: null));

      routerOf(tester).go(Routes.quizGenerator);
      await tester.pumpAndSettle();

      // A gate would have bounced this to /onboarding.
      expect(find.byType(OnboardingScreen), findsNothing);
    });

    testWidgets('skip is offered on step 0 and lands on the dashboard', (
      tester,
    ) async {
      await pumpOnboarding(tester);

      expect(find.text('Skip for now'), findsOneWidget);
      await tester.tap(find.text('Skip for now'));
      await tester.pumpAndSettle();

      expect(find.byType(VidyaHomeScreen), findsOneWidget);
      expect(find.byType(OnboardingScreen), findsNothing);
    });

    testWidgets('skip is offered on the profile step too', (tester) async {
      await pumpOnboarding(tester);
      await _toProfileStep(tester);

      expect(find.text('Skip for now'), findsOneWidget);
      await tester.tap(find.text('Skip for now'));
      await tester.pumpAndSettle();

      expect(find.byType(VidyaHomeScreen), findsOneWidget);
    });

    testWidgets('skip still works WHILE a save is failing', (tester) async {
      // The trap: a teacher whose save 401s (which is every save today) must
      // not be stranded on a setup screen they cannot complete or leave.
      final docs = FakeProfileDocSource(doc: null, writeError: kUnauthorized);
      await pumpOnboarding(tester, docs: docs);
      await _toProfileStep(tester);
      await _tapSave(tester);

      expect(
        find.text(
          'Please sign in again to save your profile. You can continue now and add it later.',
        ),
        findsOneWidget,
      );

      // ... and the way out is right there.
      await tester.tap(find.text('Skip for now'));
      await tester.pumpAndSettle();
      expect(find.byType(VidyaHomeScreen), findsOneWidget);
    });

    testWidgets('a failed save keeps the teacher on the form, not advanced', (
      tester,
    ) async {
      // The other half of honesty: never tell a teacher their profile is saved
      // when it is not.
      final docs = FakeProfileDocSource(doc: null, writeError: kUnauthorized);
      await pumpOnboarding(tester, docs: docs);
      await _toProfileStep(tester);
      await _tapSave(tester);

      expect(find.text('Tell us about your classroom'), findsOneWidget);
      expect(find.text('You are ready to begin'), findsNothing);
    });
  });

  group('step 0 language', () {
    testWidgets('offers all 11 languages inline, each in its own script', (
      tester,
    ) async {
      // Inline, not behind a sheet: this is the first screen of setup, and a
      // teacher must SEE their language. Never Hindi-only (DESIGN_RUBRIC §10).
      await pumpOnboarding(tester);

      for (final locale in AppLocale.values) {
        expect(
          find.text(locale.nativeLabel),
          findsWidgets,
          reason: '${locale.aiName} must be offered in its own script',
        );
      }
      expect(AppLocale.values, hasLength(11));
    });

    testWidgets(
      'choosing a language sets the UI locale AND the AI language param',
      (tester) async {
        await pumpOnboarding(tester);
        final container = containerOf(tester);

        await tester.tap(find.text('தமிழ்'));
        await tester.pumpAndSettle();

        final selected = container.read(localeControllerProvider);
        expect(selected, AppLocale.ta);
        expect(selected.flutterLocale, const Locale('ta'));
        expect(
          selected.aiName,
          'Tamil',
          reason: 'the AI param is the full English name the backend expects',
        );

        // ... and the running app really adopted it, rather than only storing a
        // value. Asserted on the resolved locale and not on translated copy: only
        // 23 of the 264 ARB keys carry translations today, so most strings still
        // render their English fallback (a pre-existing content gap across every
        // shipped screen, not a wiring bug).
        expect(
          Localizations.localeOf(tester.element(find.byType(OnboardingScreen))),
          const Locale('ta'),
        );
      },
    );
  });

  group('steps', () {
    testWidgets('starts on the language step', (tester) async {
      await pumpOnboarding(tester);

      expect(find.text('Step 1 of 3'), findsOneWidget);
      expect(find.text('Which language do you teach in?'), findsOneWidget);
      // No back arrow on the first step: there is nowhere behind it.
      expect(find.text('Back'), findsNothing);
    });

    testWidgets('next goes to the profile step', (tester) async {
      await pumpOnboarding(tester);
      await _toProfileStep(tester);

      expect(find.text('Step 2 of 3'), findsOneWidget);
    });

    testWidgets('back returns to the previous step', (tester) async {
      await pumpOnboarding(tester);
      await _toProfileStep(tester);

      await tester.tap(find.byTooltip('Back'));
      await tester.pumpAndSettle();

      expect(find.text('Which language do you teach in?'), findsOneWidget);
      expect(find.text('Step 1 of 3'), findsOneWidget);
    });

    testWidgets('a successful save advances to the summary', (tester) async {
      await pumpOnboarding(tester, docs: FakeProfileDocSource(doc: null));
      await _toProfileStep(tester);
      await _enter(tester, 'Your name', 'Lakshmi Iyer');
      await _tapSave(tester);

      expect(find.text('You are ready to begin'), findsOneWidget);
      expect(find.text('Step 3 of 3'), findsOneWidget);
    });

    testWidgets('the summary reflects what the teacher actually chose', (
      tester,
    ) async {
      // Step 2 earns its place by proving the setup bought something, rather
      // than congratulating the teacher for filling in a form.
      await pumpOnboarding(tester, docs: FakeProfileDocSource(doc: null));
      await _toProfileStep(tester);
      await tester.tap(find.text('Mathematics'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Class 6'));
      await tester.pumpAndSettle();
      await _tapSave(tester);

      expect(find.text('Mathematics'), findsOneWidget);
      expect(find.text('Class 6'), findsOneWidget);
      expect(find.text('English'), findsWidgets);
    });

    testWidgets('the summary finishes on the dashboard', (tester) async {
      await pumpOnboarding(tester, docs: FakeProfileDocSource(doc: null));
      await _toProfileStep(tester);
      await _tapSave(tester);

      await tester.tap(find.text('Go to my dashboard'));
      await tester.pumpAndSettle();

      expect(find.byType(VidyaHomeScreen), findsOneWidget);
    });
  });

  group('save (backend contract)', () {
    testWidgets('writes the document lane, and never the protected fields', (
      tester,
    ) async {
      final docs = FakeProfileDocSource(doc: null);
      await pumpOnboarding(tester, docs: docs);
      await _toProfileStep(tester);
      await _enter(tester, 'Your name', 'Lakshmi Iyer');
      await tester.tap(find.text('Science'));
      await tester.pumpAndSettle();
      await _tapSave(tester);

      expect(docs.merges, hasLength(1));
      final merge = docs.merges.single;
      expect(merge['displayName'], 'Lakshmi Iyer');
      expect(merge['subjects'], contains('Science'));
      // The document key is `gradeLevels`; `teachingGradeLevels` is the REST
      // route's legacy alias and must not be written here.
      expect(merge.containsKey('gradeLevels'), isTrue);
      expect(merge.containsKey('teachingGradeLevels'), isFalse);
      // firestore.rules' protectedUserFields() would reject the whole merge.
      expect(merge.containsKey('administrativeRole'), isFalse);
      expect(merge.containsKey('planType'), isFalse);
      // Not a persisted field anywhere on the backend: it is a picker helper.
      expect(merge.containsKey('boardCategory'), isFalse);
    });

    testWidgets('the language lane writes the full English name', (
      tester,
    ) async {
      final docs = FakeProfileDocSource(doc: null);
      await pumpOnboarding(tester, docs: docs);
      await tester.tap(find.text('বাংলা'));
      await tester.pumpAndSettle();
      // Re-localized: drive the remaining steps by widget, not by English copy.
      await tester.tap(find.byType(FilledButton).first);
      await tester.pumpAndSettle();
      await tester.tap(find.byType(FilledButton).first);
      await tester.pumpAndSettle();

      expect(docs.merges, hasLength(1));
      // What the web writes and what the AI flows read back as `language`.
      expect(docs.merges.single['preferredLanguage'], 'Bengali');
    });

    testWidgets('goes down the PATCH lane, and never sends educationBoard', (
      tester,
    ) async {
      // THE TRAP (pinned in docs/flutter/HANDOFF.md §3): the route's allowlist
      // accepts only `preferredBoard` and silently DROPS `educationBoard` — the
      // save would appear to succeed and change nothing.
      final client = FakeApiClient();
      final docs = FakeProfileDocSource(doc: null);
      await pumpOnboarding(tester, client: client, docs: docs);
      await _toProfileStep(tester);
      await _tapSave(tester);

      expect(client.patches, hasLength(1));
      expect(client.patches.single.path, '/api/user/profile');
      final body = client.patches.single.data! as Map<String, dynamic>;
      expect(body.containsKey('educationBoard'), isFalse);
      expect(body.containsKey('boardCategory'), isFalse);
    });

    testWidgets('a board selection travels as preferredBoard', (tester) async {
      final client = FakeApiClient();
      await pumpOnboarding(
        tester,
        client: client,
        docs: FakeProfileDocSource(doc: null),
      );
      await _toProfileStep(tester);

      // The CBSE category narrows the 29-entry board list to one.
      await tester.tap(find.widgetWithText(ChoiceChip, 'CBSE'));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(DropdownButtonFormField<String?>).first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('CBSE').last);
      await tester.pumpAndSettle();
      await _tapSave(tester);

      final body = client.patches.single.data! as Map<String, dynamic>;
      expect(body['preferredBoard'], 'CBSE');
      expect(body.containsKey('educationBoard'), isFalse);
    });

    testWidgets('a validation failure never reaches the network', (
      tester,
    ) async {
      final client = FakeApiClient();
      final docs = FakeProfileDocSource(doc: null);
      await pumpOnboarding(tester, client: client, docs: docs);
      await _toProfileStep(tester);
      await _enter(tester, 'Mobile number', '123');
      await _tapSave(tester);

      expect(
        find.text('Please enter a ten digit Indian mobile number.'),
        findsOneWidget,
      );
      expect(docs.merges, isEmpty);
      expect(client.patches, isEmpty);
    });

    testWidgets('a blank optional field is valid: nothing here is required', (
      tester,
    ) async {
      // Onboarding must accept a teacher who fills in nothing at all.
      final docs = FakeProfileDocSource(doc: null);
      await pumpOnboarding(tester, docs: docs);
      await _toProfileStep(tester);
      await _tapSave(tester);

      expect(docs.merges, hasLength(1));
      expect(find.text('You are ready to begin'), findsOneWidget);
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9 / §12.10 / §12.11)', () {
    for (final brightness in Brightness.values) {
      testWidgets(
        'profile step: no overflow at 360dp x textScale 1.3 in ${brightness.name}',
        (tester) async {
          await pumpOnboarding(
            tester,
            brightness: brightness,
            textScale: 1.3,
            surface: kNarrowPhone,
          );
          await _toProfileStep(tester);

          expect(tester.takeException(), isNull);
          await _scrollWholeList(tester);
        },
      );

      testWidgets(
        'language step: no overflow at 360dp x textScale 1.3 in ${brightness.name}',
        (tester) async {
          await pumpOnboarding(
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
          await pumpOnboarding(
            tester,
            locale: locale,
            textScale: 1.3,
            surface: kNarrowPhone,
          );

          expect(tester.takeException(), isNull);
          await _scrollWholeList(tester);
        },
      );
    }

    testWidgets('an unbreakable compound word wraps, never scrolls sideways', (
      tester,
    ) async {
      await pumpOnboarding(tester, textScale: 1.3, surface: kNarrowPhone);
      await _toProfileStep(tester);
      await _enter(tester, 'Your name', kLongWord);
      await _enter(tester, 'School name', kLongWord);

      expect(tester.takeException(), isNull);
      await _scrollWholeList(tester);
    });

    testWidgets('the summary does not overflow with Indic values at 1.3', (
      tester,
    ) async {
      await pumpOnboarding(
        tester,
        textScale: 1.3,
        surface: kNarrowPhone,
        docs: FakeProfileDocSource(doc: null),
      );
      await _toProfileStep(tester);
      await _enter(tester, 'Your name', kMl);
      // A summary row long enough that a label/value Row would overflow.
      //
      // scrollUntilVisible, not ensureVisible: at 360dp these chips are past
      // the viewport + cacheExtent of a lazy ListView, so they are not mounted
      // and ensureVisible has no element to find.
      for (final subject in ['Mathematics', 'Science', 'Social Science']) {
        final chip = find.widgetWithText(FilterChip, subject);
        await tester.scrollUntilVisible(
          chip,
          200,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.pumpAndSettle();
        await tester.tap(chip);
        await tester.pumpAndSettle();
      }
      await _tapSave(tester);

      expect(tester.takeException(), isNull);
      await _scrollWholeList(tester);
    });
  });
}

/// Walks the current step's list top to bottom, asserting no RenderFlex
/// overflow at any scroll offset. An overflow below the fold is still an
/// overflow, and the profile step is taller than any phone.
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
