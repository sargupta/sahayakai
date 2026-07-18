import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sahayakai/core/theme/app_theme.dart';

/// DESIGN_RUBRIC §0 / §12 — the Indic line-height merge gate.
///
/// Flutter resolves component text styles with `??`, NOT a merge: once
/// `appBarTheme.titleTextStyle` is set, the TextTheme's `titleLarge` is never
/// consulted. So a theme that swaps only `textTheme` for an Indic locale leaves
/// every hand-declared component style on Latin metrics. The AppBar and the
/// bottom nav are the chrome on EVERY screen, so Bengali/Tamil/Malayalam clip
/// app-wide while the TextTheme still looks correct when inspected on its own.
///
/// These assert the derivation directly, because that is the only way to make
/// the bug observable without golden-rendering all 10 locales.
void main() {
  // AppTheme reaches GoogleFonts; without this it tries to fetch TTFs over the
  // network from a unit test. These are `testWidgets` for the same reason: the
  // font loader reports asynchronously and a bare `test` fails on it.
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => GoogleFonts.config.allowRuntimeFetching = false);

  /// Every component style Flutter takes INSTEAD of the TextTheme, keyed by
  /// name so a failure names the widget that will clip.
  Map<String, TextStyle?> mergeGateStyles(ThemeData t) => {
        'appBarTheme.titleTextStyle': t.appBarTheme.titleTextStyle,
        'navigationBarTheme.labelTextStyle(unselected)':
            t.navigationBarTheme.labelTextStyle?.resolve({}),
        'navigationBarTheme.labelTextStyle(selected)':
            t.navigationBarTheme.labelTextStyle?.resolve({WidgetState.selected}),
        'snackBarTheme.contentTextStyle': t.snackBarTheme.contentTextStyle,
        'tooltipTheme.textStyle': t.tooltipTheme.textStyle,
        'filledButtonTheme.textStyle':
            t.filledButtonTheme.style?.textStyle?.resolve({}),
        'elevatedButtonTheme.textStyle':
            t.elevatedButtonTheme.style?.textStyle?.resolve({}),
        'outlinedButtonTheme.textStyle':
            t.outlinedButtonTheme.style?.textStyle?.resolve({}),
        'textButtonTheme.textStyle':
            t.textButtonTheme.style?.textStyle?.resolve({}),
      };

  // Built lazily inside each test body: AppTheme touches GoogleFonts, which
  // needs an initialized binding, so building at main() scope throws first.
  final bases = <String, ThemeData Function()>{
    'light': AppTheme.light,
    'dark': AppTheme.dark,
  };

  for (final base in bases.entries) {
    group('${base.key} theme', () {
      testWidgets('every ??-resolved component style sets an explicit height',
          (tester) async {
        mergeGateStyles(base.value()).forEach((name, style) {
          expect(style, isNotNull, reason: '$name is unset');
          expect(
            style!.height,
            isNotNull,
            reason: '$name declares no height, so it falls back to the font\'s '
                'own default (~1.21 for Inter) and clips Indic matras',
          );
          // 1.25 is titleLarge's deliberate Latin serif metric (app_text.dart:
          // Fraunces 21/600 at 1.25 Latin / 1.42 Indic) — the tightest chrome
          // slot. Nothing may sit below it, and nothing may be left to the font
          // (~1.21 for Inter). The Indic rise is asserted separately below.
          expect(
            style.height,
            greaterThanOrEqualTo(1.25),
            reason: '$name height ${style.height} is tighter than any '
                'sanctioned line-height',
          );
        });
      });

      testWidgets('every ??-resolved component style clears the 12sp floor',
          (tester) async {
        mergeGateStyles(base.value()).forEach((name, style) {
          expect(
            style!.fontSize,
            greaterThanOrEqualTo(12),
            reason: '$name fontSize ${style.fontSize} is below the §0 floor',
          );
        });
      });

      testWidgets('withIndic raises EVERY component style, not just the '
          'TextTheme', (tester) async {
        final theme = base.value();
        final latin = mergeGateStyles(theme);
        final indic = mergeGateStyles(AppTheme.withIndic(theme));

        for (final name in latin.keys) {
          expect(
            indic[name]!.height,
            greaterThan(latin[name]!.height!),
            reason: '$name did not rise for Indic — it is declared on the '
                'component instead of derived from the TextTheme, so '
                'withIndic() cannot reach it',
          );
        }
      });

      testWidgets('withIndic raises the TextTheme itself', (tester) async {
        final theme = base.value();
        expect(
          AppTheme.withIndic(theme).textTheme.bodyMedium!.height,
          greaterThan(theme.textTheme.bodyMedium!.height!),
        );
      });

      testWidgets('withIndic preserves brightness and the brand primary',
          (tester) async {
        final theme = base.value();
        final indic = AppTheme.withIndic(theme);

        expect(indic.brightness, theme.brightness);
        expect(indic.colorScheme.primary, theme.colorScheme.primary);
        expect(indic.colorScheme.onPrimary, theme.colorScheme.onPrimary);
      });

      testWidgets('the bottom-nav label meets the §0 floor of 12sp / 1.4',
          (tester) async {
        // The exact regression this file exists for: labelTextStyle was 10sp
        // with no height, and `??` meant the TextTheme could never correct it.
        final nav = base.value().navigationBarTheme.labelTextStyle!;

        for (final states in [<WidgetState>{}, {WidgetState.selected}]) {
          final label = nav.resolve(states)!;
          expect(label.fontSize, greaterThanOrEqualTo(12));
          expect(label.height, greaterThanOrEqualTo(1.4));
        }
      });

      testWidgets('the nav label keeps its per-state weight and colour',
          (tester) async {
        final theme = base.value();
        final nav = theme.navigationBarTheme.labelTextStyle!;
        final selected = nav.resolve({WidgetState.selected})!;
        final unselected = nav.resolve({})!;

        expect(selected.fontWeight, FontWeight.w600);
        expect(unselected.fontWeight, FontWeight.w500);
        expect(selected.color, theme.colorScheme.primary);
        expect(unselected.color, theme.colorScheme.onSurfaceVariant);
      });

      testWidgets('the AppBar title carries titleLarge\'s metrics '
          '(THEME_SPEC §5.6)', (tester) async {
        final theme = base.value();
        final title = theme.appBarTheme.titleTextStyle!;
        final titleLarge = theme.textTheme.titleLarge!;

        // Compared field-by-field, not with `==`: ThemeData merges the TextTheme
        // against the default Typography (which adds `decoration: none`), while
        // the component style stays as handed in. Only the metrics matter.
        expect(title.fontFamily, titleLarge.fontFamily);
        expect(title.fontSize, titleLarge.fontSize);
        expect(title.fontWeight, titleLarge.fontWeight);
        expect(title.height, titleLarge.height);
        expect(title.letterSpacing, titleLarge.letterSpacing);
        expect(title.color, titleLarge.color);
        expect(title.fontFamilyFallback, titleLarge.fontFamilyFallback);
      });
    });
  }
}
