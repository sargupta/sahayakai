import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/theme/app_theme.dart';

/// WCAG 2.1 relative-luminance contrast, encoding the design system v2
/// contract ("Accessibility and quality gates", `tokens.json` usage notes):
///
///   • Text holds 4.5:1 on the composited ground: ink-900, ink-600, ink-500
///     on milk and glass; saffron as text is saffron-600 (or saffron-700 on
///     saffron tints), never saffron-500.
///   • White never sits on saffron-500 (3.77:1). A saffron fill under a white
///     label is `accent-fill` (saffron-600, 5.28:1), decided 26 Oct 2026; the
///     buttons and selected chips in the theme are asserted to use it.
///   • Leaf, indigo and red fills carry white at AA.
double _lin(int c) {
  final s = c / 255.0;
  return s <= 0.03928
      ? s / 12.92
      : math.pow((s + 0.055) / 1.055, 2.4).toDouble();
}

double _luminance(Color c) =>
    0.2126 * _lin((c.r * 255).round()) +
    0.7152 * _lin((c.g * 255).round()) +
    0.0722 * _lin((c.b * 255).round());

double _ratio(Color a, Color b) {
  final la = _luminance(a);
  final lb = _luminance(b);
  final hi = math.max(la, lb);
  final lo = math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

const _white = Color(0xFFFFFFFF);

/// The v2 wash's four stops: text must hold on every one of them.
const _washStops = [
  Color(0xFFFFF3E4),
  Color(0xFFFDEFEE),
  Color(0xFFEFF4EE),
  Color(0xFFFFF7EC),
];

/// Every light ground text sits on: the wash stops, milk grounds, and glass
/// composited over the warmest wash stop.
final _lightGrounds = <String, Color>{
  for (final (i, c) in _washStops.indexed) 'wash stop $i': c,
  'milk-50 (surface-card)': AppColors.milk50,
  'milk-200 (lBackground)': AppColors.milk200,
  'milk-300 (surface-inset)': AppColors.milk300,
  'glass on wash': Color.alphaBlend(AppColors.surfaceGlass, _washStops.first),
  'strong glass on wash': Color.alphaBlend(
    AppColors.surfaceGlassStrong,
    _washStops.first,
  ),
  'soft glass on wash': Color.alphaBlend(
    AppColors.surfaceGlassSoft,
    _washStops.first,
  ),
};

void main() {
  group('LIGHT — text holds 4.5:1 on every v2 ground', () {
    final inks = <String, Color>{
      'text-strong (ink-900)': AppColors.textStrong,
      'text-body (ink-600)': AppColors.textBody,
      'text-muted (ink-500)': AppColors.textMuted,
      'text-eyebrow (saffron-600)': AppColors.textEyebrow,
    };
    for (final ink in inks.entries) {
      for (final ground in _lightGrounds.entries) {
        test('${ink.key} on ${ground.key}', () {
          expect(
            _ratio(ink.value, ground.value),
            greaterThanOrEqualTo(4.5),
            reason: '${ink.key} must meet AA on ${ground.key}',
          );
        });
      }
    }

    test('saffron as text is saffron-600, and the role names alias it', () {
      expect(AppColors.saffronText, AppColors.saffron600);
      expect(AppColors.lPrimaryText, AppColors.saffron600);
      expect(AppColors.textLink, AppColors.saffron600);
    });

    test('saffron-700 on a saffron tint (primaryContainer) passes AA', () {
      expect(
        _ratio(AppColors.lOnPrimaryContainer, AppColors.lPrimaryContainer),
        greaterThanOrEqualTo(4.5),
      );
    });
  });

  group('LIGHT — saffron accent and the label fill', () {
    test('the accent (orb, mic discs, dots, bars) is saffron-500 #C96A28', () {
      expect(AppColors.lPrimary, const Color(0xFFC96A28));
      expect(AppColors.lPrimary, AppColors.brandSaffron);
    });

    test('a saffron fill under a white label is accent-fill: 5.28:1', () {
      expect(AppColors.accentFill, AppColors.saffron600);
      expect(
        _ratio(_white, AppColors.accentFill),
        greaterThanOrEqualTo(4.5),
      );
      // Why: white on saffron-500 is 3.77:1, under AA for 12-15px labels.
      expect(_ratio(_white, AppColors.saffron500), lessThan(4.5));
    });

    testWidgets('the primary and elevated buttons and the selected chip fill '
        'with accent-fill, white on top', (tester) async {
      final t = AppTheme.light();
      for (final style in [
        t.filledButtonTheme.style!,
        t.elevatedButtonTheme.style!,
      ]) {
        expect(style.backgroundColor!.resolve({}), AppColors.accentFill);
        expect(style.foregroundColor!.resolve({}), _white);
      }
      expect(t.chipTheme.selectedColor, AppColors.accentFill);
      expect(t.chipTheme.secondaryLabelStyle!.color, _white);
    });

    test('focus is saffron-600: 3:1 or better on every ground', () {
      expect(AppColors.lRing, AppColors.saffron600);
      for (final ground in _lightGrounds.entries) {
        expect(
          _ratio(AppColors.lRing, ground.value),
          greaterThanOrEqualTo(3.0),
          reason: 'focus ring on ${ground.key}',
        );
      }
    });

    test('the retired #E0924D is gone from every saffron role', () {
      const retired = Color(0xFFE0924D);
      for (final c in [
        AppColors.brandSaffron,
        AppColors.lPrimary,
        AppColors.saffron500,
        AppColors.accent,
      ]) {
        expect(c, isNot(retired));
      }
    });
  });

  group('LIGHT — meaning fills carry white at AA', () {
    test('leaf-500 (secondary) carries white', () {
      expect(AppColors.lSecondary, AppColors.leaf500);
      expect(_ratio(_white, AppColors.leaf500), greaterThanOrEqualTo(4.5));
    });
    test('indigo-500 (tertiary) carries white', () {
      expect(AppColors.lTertiary, AppColors.indigo500);
      expect(_ratio(_white, AppColors.indigo500), greaterThanOrEqualTo(4.5));
    });
    test('red-500 (error) carries white at 5.44:1', () {
      expect(AppColors.lError, AppColors.red500);
      expect(_ratio(_white, AppColors.red500), closeTo(5.44, 0.01));
    });
    test('red-700 on the red row passes AA', () {
      expect(
        _ratio(
          AppColors.lOnErrorContainer,
          Color.alphaBlend(AppColors.lErrorContainer, AppColors.milk50),
        ),
        greaterThanOrEqualTo(4.5),
      );
    });
  });

  group('glass stays AA-safe once composited', () {
    test('LIGHT: ink-900 on chrome over the most saturated real backdrop '
        '(saffron-500) still passes AA', () {
      final composited = Color.alphaBlend(
        AppGlass.lChromeFill,
        AppColors.saffron500,
      );
      expect(
        _ratio(AppColors.lForeground, composited),
        greaterThanOrEqualTo(4.5),
      );
    });
    test('LIGHT: chrome and card glass over pure black and white', () {
      for (final fill in [AppGlass.lChromeFill, AppGlass.lFlatFill]) {
        for (final extreme in [Colors.black, Colors.white]) {
          expect(
            _ratio(AppColors.lForeground, Color.alphaBlend(fill, extreme)),
            greaterThanOrEqualTo(4.5),
            reason: 'worst-case backdrop $extreme',
          );
        }
      }
    });
  });

  group('mine-bubble wash — DOUBLE composite stays AA-safe (>=4.5)', () {
    // message_bubble.dart / chat_bubble.dart paint primaryContainer@0.85 ON
    // TOP of the already-composited flat-glass fill — a composite of a
    // composite, not a single layer.
    Color doubleComposite(Color flatFill, Color background, Color container) {
      final step1 = Color.alphaBlend(flatFill, background);
      return Color.alphaBlend(container.withValues(alpha: 0.85), step1);
    }

    test('LIGHT: body and meta on the wash composite pass AA', () {
      final composited = doubleComposite(
        AppGlass.lFlatFill,
        _washStops.first,
        AppColors.lPrimaryContainer,
      );
      expect(
        _ratio(AppColors.lForeground, composited),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        _ratio(AppColors.lOnPrimaryContainer, composited),
        greaterThanOrEqualTo(4.5),
      );
    });
  });
}
