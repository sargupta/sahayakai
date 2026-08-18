@Tags(['golden'])
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../features/dashboard/dashboard_fixtures.dart';
import '../features/onboarding/onboarding_fixtures.dart';
import '../support/app_harness.dart';

/// Pixel baselines for the Indic scripts, on the two densest signed-in
/// surfaces, at the accessibility setting where an Indic line actually breaks.
///
/// WHY bn, ta AND ml — AND NOT ALL ELEVEN
/// The eleven supported locales are not eleven independent typographic risks.
/// Devanagari (hi, mr) is the script every Flutter text stack is tuned for and
/// the one the default face already handles. The interesting failures are the
/// ones that need vertical room the Latin metrics never asked for, and the ones
/// that need horizontal room:
///   * bn (Bengali) hangs matras BELOW the baseline and carries a headstroke
///     ABOVE it, so a row sized from Latin ascent/descent clips top and bottom.
///   * ml (Malayalam) stacks conjuncts taller still, and its glyphs are the
///     widest per-character of the set.
///   * ta (Tamil) is the length probe: the same sentence runs roughly a third
///     longer than English, so it is what overflows a fixed-width chip or a
///     single-line eyebrow.
/// Cover those three and te/kn/gu/pa/or fail for a reason one of them already
/// caught. Adding the other eight would multiply the re-baselining cost of a
/// one-word copy change by eleven and buy no new signal.
///
/// WHY 360dp x textScale 1.3 AND NOT THE FULL MATRIX
/// The Latin suites already own the axes this one does not: light/dark is
/// asserted in `screens_golden_test.dart`, 800dp is asserted there too, and the
/// four shared states are asserted in `states_golden_test.dart`. Re-running all
/// of that per locale would be 40+ baselines defending the same pixels. What is
/// unique to a script is whether its glyphs fit, and the narrowest supported
/// phone at the largest common accessibility scale is precisely where they stop
/// fitting. One axis, three scripts, two surfaces: six files.
///
/// WHY THESE TWO SURFACES
/// The VIDYA home is the landing every teacher sees and the densest composition
/// in the app (greeting eyebrow, seal mic, quick-tools row). The Prep desk is
/// the tile grid — many short labels in fixed-height cards, which is the other
/// way Indic text fails: not by clipping a matra but by ellipsising a tile.
/// The profile screen is deliberately absent; it is being changed concurrently.
///
/// PLATFORM WARNING
/// As in the sibling suites: Flutter goldens are not portable across host
/// platforms. These were generated on macOS and will not match ubuntu CI. CI
/// re-baselines them itself (unit U0.12, via workflow_dispatch); the local
/// ladder runs `--exclude-tags golden` so nobody is staring at red that means
/// nothing.
///
/// Fonts come from `test/flutter_test_config.dart`, which FontLoader-registers
/// the bundled Noto faces. Without it every glyph below is an Ahem box and
/// these baselines would certify rectangles as correct Bengali.
void main() {
  // The locale controller reads SharedPreferences on first build; without the
  // mock the platform channel throws MissingPluginException and the frame the
  // golden captures is an error screen, not a localized one.
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  // The locale is driven through the platform dispatcher, which is how
  // `LocaleController` seeds itself on first run — the same path a teacher
  // whose phone is set to Bengali takes. Nothing is stored in prefs, so the
  // seed is what renders.
  const probes = <(String, Locale)>[
    ('bn', Locale('bn')),
    ('ta', Locale('ta')),
    ('ml', Locale('ml')),
  ];

  group('Indic baselines at 360dp, textScale 1.3, light', () {
    for (final (code, locale) in probes) {
      testWidgets('vidya home — $code', (tester) async {
        // fixedClock pins 10:00 so the greeting eyebrow reads "good morning"
        // in every locale forever. Without it the baseline encodes the hour it
        // was generated in, which is how the first set went red after midnight.
        await pumpSignedInApp(
          tester,
          extraOverrides: [fixedClock()],
          locale: locale,
          brightness: Brightness.light,
          surface: kNarrowPhone,
          textScale: 1.3,
        );
        await expectLater(
          find.byType(MaterialApp),
          matchesGoldenFile('goldens/indic_home_ts13_$code.png'),
        );
      });

      testWidgets('prep desk — $code', (tester) async {
        await pumpDashboard(
          tester,
          extraOverrides: [fixedClock()],
          client: libraryClient(),
          locale: locale,
          brightness: Brightness.light,
          surface: kNarrowPhone,
          textScale: 1.3,
        );
        await expectLater(
          find.byType(MaterialApp),
          matchesGoldenFile('goldens/indic_prep_desk_ts13_$code.png'),
        );
      });
    }
  });
}
