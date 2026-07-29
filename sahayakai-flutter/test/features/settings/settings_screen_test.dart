import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sahayakai/app.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/core/i18n/locale_provider.dart';
import 'package:sahayakai/core/theme/theme_mode_provider.dart';
import 'package:sahayakai/features/settings/presentation/settings_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'settings_fixtures.dart';

/// Screen-layer gates for P0.7.
///
/// No live API is exercised: nothing here reaches a repository, because the
/// only two network calls (profile save, delete account) are signed-out stubs
/// until Firebase lands.
ProviderContainer _containerOf(WidgetTester tester) =>
    ProviderScope.containerOf(tester.element(find.byType(SettingsScreen)));

Future<void> _pumpScreen(
  WidgetTester tester, {
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  Locale locale = const Locale('en'),
  bool signedIn = false,
  /// The `users/<uid>` document the teaching-profile form hydrates from. Null
  /// leaves the default signed-out source bound, so the read 401s.
  Map<String, dynamic>? doc,
  // Functional tests mount the whole list (see kTallSurface); the overflow
  // gates pass kNarrowPhone and scroll it for real.
  Size surface = kTallSurface,
}) async {
  tester.view.physicalSize = surface;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    hostSettings(
      const SettingsScreen(),
      brightness: brightness,
      textScale: textScale,
      locale: locale,
      overrides: [
        if (signedIn) signedInOverride(),
        if (doc != null) profileDocOverride(doc: doc),
      ],
    ),
  );
  await tester.pumpAndSettle();
}

/// Walks the settings list from top to bottom, asserting no RenderFlex
/// overflow at any scroll offset. An overflow below the fold is still an
/// overflow, and Settings is taller than any phone.
Future<void> _scrollWholeList(WidgetTester tester) async {
  final position = tester.state<ScrollableState>(find.byType(Scrollable).first)
      .position;
  var guard = 0;
  while (position.pixels < position.maxScrollExtent && guard++ < 40) {
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

  group('language (the single AppLocale source of truth)', () {
    testWidgets('offers all 11 languages by native label', (tester) async {
      await _pumpScreen(tester);
      await tester.tap(find.text('Language').last);
      await tester.pumpAndSettle();

      // Never Hindi-only: every one of the 11 is first-class in the picker.
      for (final locale in AppLocale.values) {
        expect(
          find.text(locale.nativeLabel),
          findsWidgets,
          reason: '${locale.aiName} must be offered by its endonym',
        );
      }
    });

    testWidgets('selecting a language flips the UI locale AND the AI param',
        (tester) async {
      await _pumpScreen(tester);
      final container = _containerOf(tester);
      expect(container.read(localeControllerProvider), AppLocale.en);

      await tester.tap(find.text('Language').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('বাংলা').last);
      await tester.pumpAndSettle();

      final selected = container.read(localeControllerProvider);
      // 1. the UI locale ...
      expect(selected, AppLocale.bn);
      expect(selected.flutterLocale, const Locale('bn'));
      // 2. ... and the exact `language` param every future AI call sends.
      //    One switcher, two consumers: this is the whole contract of P0.7.
      expect(selected.aiName, 'Bengali');
    });

    testWidgets('the choice is persisted', (tester) async {
      await _pumpScreen(tester);
      await tester.tap(find.text('Language').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('ಕನ್ನಡ').last);
      await tester.pumpAndSettle();

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('app_locale_code'), 'kn');
    });

    testWidgets('app.dart drives MaterialApp.locale from the provider',
        (tester) async {
      // Proves the "flips the UI locale" half end to end, not just the provider.
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            localeControllerProvider.overrideWith(_FixedLocale.new),
          ],
          child: const SahayakApp(),
        ),
      );
      await tester.pump();

      expect(
        tester.widget<MaterialApp>(find.byType(MaterialApp)).locale,
        const Locale('ta'),
      );

      // Drain the bootstrap timer so no timers remain pending.
      await tester.pump(const Duration(milliseconds: 700));
      await tester.pump();
    });
  });

  group('theme', () {
    testWidgets('offers system, light and dark', (tester) async {
      await _pumpScreen(tester);
      expect(find.text('Match my device'), findsOneWidget);
      expect(find.text('Light'), findsOneWidget);
      expect(find.text('Dark'), findsOneWidget);
    });

    testWidgets('tapping Dark switches ThemeMode', (tester) async {
      await _pumpScreen(tester);
      final container = _containerOf(tester);
      expect(container.read(themeModeControllerProvider), ThemeMode.system);

      await tester.tap(find.text('Dark'));
      await tester.pumpAndSettle();
      expect(container.read(themeModeControllerProvider), ThemeMode.dark);

      // ... and back, so the toggle is not one-way.
      await tester.tap(find.text('Light'));
      await tester.pumpAndSettle();
      expect(container.read(themeModeControllerProvider), ThemeMode.light);
    });

    testWidgets('the choice is persisted', (tester) async {
      await _pumpScreen(tester);
      await tester.tap(find.text('Dark'));
      await tester.pumpAndSettle();

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('app_theme_mode'), 'dark');
    });

    testWidgets('the selected radio reflects the active mode', (tester) async {
      await tester.pumpWidget(
        hostSettings(
          const SettingsScreen(),
          overrides: [themeModeOverride(ThemeMode.dark)],
        ),
      );
      await tester.pumpAndSettle();

      final group = tester.widget<RadioGroup<ThemeMode>>(
        find.byType(RadioGroup<ThemeMode>),
      );
      expect(group.groupValue, ThemeMode.dark);
    });

    testWidgets('app.dart drives MaterialApp.themeMode from the provider',
        (tester) async {
      // Proves "re-themes LIVE": the screen sets the provider (above) and the
      // root MaterialApp reads it, so the whole app re-themes on the tap.
      await tester.pumpWidget(
        ProviderScope(
          overrides: [themeModeOverride(ThemeMode.dark)],
          child: const SahayakApp(),
        ),
      );
      await tester.pump();

      expect(
        tester.widget<MaterialApp>(find.byType(MaterialApp)).themeMode,
        ThemeMode.dark,
      );

      await tester.pump(const Duration(milliseconds: 700));
      await tester.pump();
    });
  });

  group('notifications', () {
    testWidgets('defaults off and persists when switched on', (tester) async {
      await _pumpScreen(tester);
      final switchFinder = find.byType(SwitchListTile).first;
      expect(tester.widget<SwitchListTile>(switchFinder).value, isFalse);

      await tester.tap(find.text('Reminders and updates'));
      await tester.pumpAndSettle();
      expect(tester.widget<SwitchListTile>(switchFinder).value, isTrue);

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getBool('notifications_enabled'), isTrue);
    });
  });

  group('logged-out state', () {
    testWidgets('renders the sign-in card instead of the account sections',
        (tester) async {
      await _pumpScreen(tester);

      expect(find.text('You are signed out'), findsOneWidget);
      expect(find.text('Sign in'), findsOneWidget);

      // The account half must be gone entirely, not merely disabled. The
      // section eyebrow is now the editorial saffron header (UPPERCASE Latin,
      // §5) — a structure change from the muted grey label, behaviour intact.
      expect(find.text('TEACHING PROFILE'), findsNothing);
      expect(find.text('Save profile'), findsNothing);
      expect(find.text('Delete account'), findsNothing);
    });

    testWidgets('device preferences still work while signed out',
        (tester) async {
      // Language / theme / notifications are per-device, so signing out must
      // not take them away.
      await _pumpScreen(tester);
      // Section eyebrows are the editorial saffron header (UPPERCASE Latin, §5).
      expect(find.text('APPEARANCE'), findsOneWidget);
      expect(find.text('NOTIFICATIONS'), findsOneWidget);

      await tester.tap(find.text('Dark'));
      await tester.pumpAndSettle();
      expect(_containerOf(tester).read(themeModeControllerProvider),
          ThemeMode.dark);
    });

    testWidgets('signed in, the account sections replace the sign-in card',
        (tester) async {
      // A readable, empty document: signed in, nothing saved yet. The form
      // hydrates from the profile read, so it needs one to render.
      await _pumpScreen(tester, signedIn: true, doc: const <String, dynamic>{});

      expect(find.text('You are signed out'), findsNothing);
      // The teaching-profile eyebrow is the editorial saffron header.
      expect(find.text('TEACHING PROFILE'), findsOneWidget);
      expect(find.text('Education board'), findsOneWidget);
      expect(find.text('Qualifications'), findsOneWidget);
      expect(find.text('Administrative role'), findsOneWidget);
    });
  });

  group('teaching profile form', () {
    testWidgets('qualifications are a multi-select', (tester) async {
      await _pumpScreen(tester, signedIn: true, doc: const <String, dynamic>{});

      final bEd = find.ancestor(
        of: find.text('B.Ed'),
        matching: find.byType(FilterChip),
      );
      await tester.ensureVisible(bEd);
      await tester.pumpAndSettle();
      expect(tester.widget<FilterChip>(bEd).selected, isFalse);

      await tester.tap(bEd);
      await tester.pumpAndSettle();
      expect(tester.widget<FilterChip>(bEd).selected, isTrue);

      // A second qualification joins rather than replacing the first.
      final net = find.ancestor(
        of: find.text('NET'),
        matching: find.byType(FilterChip),
      );
      await tester.ensureVisible(net);
      await tester.pumpAndSettle();
      await tester.tap(net);
      await tester.pumpAndSettle();

      expect(tester.widget<FilterChip>(bEd).selected, isTrue);
      expect(tester.widget<FilterChip>(net).selected, isTrue);

      // ... and deselecting removes only that one.
      await tester.tap(bEd);
      await tester.pumpAndSettle();
      expect(tester.widget<FilterChip>(bEd).selected, isFalse);
      expect(tester.widget<FilterChip>(net).selected, isTrue);
    });

    testWidgets('the delete-account button is reachable and destructive',
        (tester) async {
      await _pumpScreen(tester, signedIn: true);

      final deleteButton = find.widgetWithText(OutlinedButton, 'Delete account');
      // Below the fold: tap() only WARNS on a missed hit-test, so scroll first.
      await tester.ensureVisible(deleteButton);
      await tester.pumpAndSettle();
      expect(deleteButton, findsOneWidget);

      await tester.tap(deleteButton);
      await tester.pumpAndSettle();

      // It opens the interlock dialog rather than deleting anything.
      expect(find.text('Delete your account?'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('touch targets (DESIGN_RUBRIC §12.2)', () {
    testWidgets('every control clears 48dp, chips and radios included',
        (tester) async {
      // The qualification chips this measures only render once the profile
      // form hydrates, so it needs a readable document (empty is fine).
      await _pumpScreen(
        tester,
        signedIn: true,
        doc: const <String, dynamic>{},
        surface: kNarrowPhone,
      );

      // Measured, not assumed: a bare FilterChip is ~32dp, so the padded tap
      // target is the only thing standing between this screen and a FAIL.
      Future<void> checkAll(Finder finder, String label) async {
        final count = tester.widgetList(finder).length;
        expect(count, greaterThan(0), reason: 'no $label found to measure');
        for (var i = 0; i < count; i++) {
          final target = finder.at(i);
          await tester.scrollUntilVisible(
            target,
            200,
            scrollable: find.byType(Scrollable).first,
          );
          await tester.pumpAndSettle();
          expect(
            tester.getSize(target).height,
            greaterThanOrEqualTo(48.0),
            reason: '$label #$i is under the 48dp minimum',
          );
        }
      }

      await checkAll(find.byType(RadioListTile<ThemeMode>), 'theme radio');
      // The two switches (notifications, live voice) sit in different sections
      // of a lazily-built ListView, so a bare `byType(SwitchListTile)` index can
      // go stale as off-screen tiles unmount mid-scroll. Measure each by a
      // stable, unique title instead — same 48dp gate, one match apiece.
      await checkAll(
        find.widgetWithText(SwitchListTile, 'Reminders and updates'),
        'notifications switch',
      );
      await checkAll(
        find.widgetWithText(SwitchListTile, 'Live voice (beta)'),
        'live voice switch',
      );
      await checkAll(find.byType(FilterChip), 'qualification chip');
      await checkAll(find.byType(FilledButton), 'save button');
      await checkAll(find.byType(OutlinedButton), 'delete button');
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9, §12.10, §12.13)', () {
    for (final brightness in Brightness.values) {
      for (final scale in <double>[1.0, 1.3]) {
        testWidgets(
          'signed out at 360dp, textScale $scale, ${brightness.name}',
          (tester) async {
            await _pumpScreen(
              tester,
              brightness: brightness,
              textScale: scale,
              surface: kNarrowPhone,
            );

            expect(tester.takeException(), isNull);
            expect(find.text('APPEARANCE'), findsOneWidget);
            await _scrollWholeList(tester);
            expect(find.text('You are signed out'), findsOneWidget);
          },
        );

        testWidgets(
          'signed in at 360dp, textScale $scale, ${brightness.name}',
          (tester) async {
            await _pumpScreen(
              tester,
              brightness: brightness,
              textScale: scale,
              signedIn: true,
              // The form has to hydrate for the gate to measure it; without a
              // readable doc the section collapses to a sign-in card and this
              // stops exercising the tallest part of the screen.
              doc: const <String, dynamic>{},
              surface: kNarrowPhone,
            );

            expect(tester.takeException(), isNull);
            // The profile form and danger zone are the tallest part of the
            // screen and both sit below the fold.
            await _scrollWholeList(tester);
            expect(
              find.widgetWithText(OutlinedButton, 'Delete account'),
              findsOneWidget,
            );
          },
        );
      }
    }

    for (final locale in <Locale>[Locale('bn'), Locale('ta'), Locale('ml')]) {
      testWidgets(
        'renders in ${locale.languageCode} at 360dp x textScale 1.3',
        (tester) async {
          // The §11 Indic probe, run against the REAL localized screen (raised
          // line-heights and all) rather than English with a pasted-in string.
          await _pumpScreen(
            tester,
            textScale: 1.3,
            locale: locale,
            signedIn: true,
            // The localized profile-form labels are part of the §11 probe, so
            // the form must hydrate rather than collapse to a sign-in card.
            doc: const <String, dynamic>{},
            surface: kNarrowPhone,
          );

          expect(tester.takeException(), isNull);
          await _scrollWholeList(tester);
          expect(tester.takeException(), isNull);
        },
      );
    }

    testWidgets('the longest board name stays inside 360dp', (tester) async {
      await _pumpScreen(
        tester,
        signedIn: true,
        doc: const <String, dynamic>{},
        textScale: 1.3,
        surface: kNarrowPhone,
      );

      // The board dropdown carries the longest canonical strings in the app;
      // isExpanded must keep them inside 360dp rather than overflow sideways.
      // It sits below the fold, and tap() only WARNS on a missed hit-test, so
      // scroll it into the viewport first. The board field is the only
      // String?-typed dropdown on the screen, so this finder is unambiguous
      // (and, unlike `.first`, does not throw while still unmounted).
      const boardField = 'Himachal Pradesh State Board (HPBOSE)';
      final board = find.byType(DropdownButtonFormField<String?>);
      await tester.scrollUntilVisible(
        board,
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();
      await tester.tap(board);
      await tester.pumpAndSettle();
      // The open menu renders all 29 board names at 360dp.
      expect(tester.takeException(), isNull);

      // Nothing is selected yet, so this name exists only inside the menu.
      await tester.scrollUntilVisible(
        find.text(boardField),
        120,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text(boardField));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      // ... and the longest name now sits in the closed field, still inside
      // 360dp at textScale 1.3.
      expect(find.text(boardField), findsOneWidget);
    });

    testWidgets('long words in a Text do not overflow the page', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        hostSettings(
          Scaffold(
            body: ListView(
              padding: const EdgeInsets.all(16),
              children: const [Text(kLongWord), Text(kBn), Text(kTa), Text(kMl)],
            ),
          ),
          textScale: 1.3,
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}

class _FixedLocale extends LocaleController {
  @override
  AppLocale build() => AppLocale.ta;
}
