import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';

import '../features/onboarding/onboarding_fixtures.dart';

/// The 11-locale render sweep.
///
/// U0.7 and U0.8 closed a 4,760-string translation gap. Those units proved the
/// STRINGS are correct — present, in the right script, with intact placeholders
/// and plurals. They proved nothing about whether the app can still lay them
/// out.
///
/// That gap matters here specifically. Several translators flagged that their
/// body strings run 40-50% longer than the English, and Indic scripts stack
/// matras above and below the baseline, so a line that fits in English can clip
/// in Malayalam. The narrow phone at textScale 1.3 is where a teacher on a
/// cheap Android with large-text accessibility on actually reads this app —
/// which is most of them.
///
/// So: boot the real app in every locale, at 360dp x 1.3, and assert it renders
/// without throwing and without a RenderFlex overflow. Flutter surfaces both
/// through `tester.takeException()`.
///
/// This is assertions for all eleven. Pixel goldens (units U0.10/U0.11) cover
/// three of them in depth; nothing else covers the other eight at all, and a
/// full golden matrix across 11 locales would cost re-baselining every one of
/// them on any copy change.
///
/// An overflow here is a REAL FINDING — a string too long for its box, or a box
/// too rigid for a script. Fix the layout or shorten the translation. Do not
/// widen the surface or drop the text scale to make it pass; that only moves
/// the clipping onto the teacher's phone.
void main() {
  // Every locale the app ships, English included — the sweep should catch an
  // English regression too, not just an Indic one.
  const locales = AppLocalizations.supportedLocales;

  group('renders in every supported locale at 360dp x textScale 1.3', () {
    for (final locale in locales) {
      testWidgets('${locale.languageCode}: the shell boots and lays out', (
        tester,
      ) async {
        await pumpSignedInApp(
          tester,
          locale: locale,
          textScale: 1.3,
          surface: kNarrowPhone,
        );

        // Throws, RenderFlex overflows and layout assertions all land here.
        expect(
          tester.takeException(),
          isNull,
          reason:
              'the shell failed to render in ${locale.languageCode} at 360dp '
              'x 1.3 — a real layout finding, not a test artifact',
        );

        // The app is actually on screen, not a blank frame that trivially
        // cannot overflow.
        expect(find.byType(MaterialApp), findsOneWidget);
      });
    }
  });

  group('renders in every supported locale in dark at 360dp x 1.3', () {
    for (final locale in locales) {
      testWidgets('${locale.languageCode}: dark theme lays out', (
        tester,
      ) async {
        await pumpSignedInApp(
          tester,
          locale: locale,
          textScale: 1.3,
          surface: kNarrowPhone,
          brightness: Brightness.dark,
        );
        expect(
          tester.takeException(),
          isNull,
          reason:
              'dark theme failed to render in ${locale.languageCode} at 360dp '
              'x 1.3',
        );
      });
    }
  });

  group('the signed-out surface renders in every locale', () {
    for (final locale in locales) {
      testWidgets('${locale.languageCode}: login lays out', (tester) async {
        await pumpSignedInApp(
          tester,
          locale: locale,
          textScale: 1.3,
          surface: kNarrowPhone,
          signedIn: false,
        );
        expect(
          tester.takeException(),
          isNull,
          reason:
              'login failed to render in ${locale.languageCode} at 360dp x 1.3 '
              '— this is the first screen a teacher ever sees',
        );
      });
    }
  });
}
