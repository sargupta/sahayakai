import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/theme/app_colors.dart';
import 'package:sahayakai/core/theme/app_glass.dart';

/// WCAG 2.1 relative-luminance contrast, encoding the Design System v3
/// saffron contract (the LIVE tokens in `lib/core/theme/app_colors.dart`,
/// extracted from `design_zip/tokens/colors.css`) — NOT the predecessor's
/// accessible-saffron split. This is a deliberate, documented re-baseline:
///
///   V3 CONTRACT (token values are asserted below, not just the ratios)
///   • LIGHT: saffron is a FILL with a warm-white label — buttons, active
///     cards, the mic orb (`--saffron-500` fill + the on-saffron milk-100
///     label). The primary fill `#C96A28` is ~3.8:1 with white: it clears the
///     3:1 LARGE-text bar but not the 4.5 floor, so it is a large brand FILL,
///     EXEMPT from the 4.5 text rule and banned behind small text.
///   • Saffron as TEXT/icon/eyebrow uses saffron-600 `#A5551D`
///     (`--text-eyebrow` / `--text-link`) — THAT is the pathway that must
///     pass AA (>=4.5) on the light ground/card.
///   • The tricolour accent FILLS (indigo `#2A3B8F`, leaf `#2C5F2D`) carry
///     white and clear AA as fills.
///   • DARK flips to DARK text on the saffron button: the dark ramp's
///     `--primary` is the light saffron-200 `#FFD9AE`, so `dOnPrimary`
///     (ink-900 `#171310`) on it is a genuinely ACCESSIBLE ~13.9:1 pairing
///     (NOT a fill-only exemption) — this is asserted as passing AA.
///     Saffron-as-text on the dark ground uses saffron-400 `#E08A3C` itself.
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

void main() {
  group('LIGHT — saffron TEXT pathway passes AA (>=4.5)', () {
    // Saffron used as TEXT/icons/eyebrows routes through saffron-600
    // (`saffronText` / `lPrimaryText` `#A5551D`), NOT the `#C96A28` fill.
    test('saffronText passes AA on the light background', () {
      expect(
        _ratio(AppColors.saffronText, AppColors.lBackground),
        greaterThanOrEqualTo(4.5),
        reason: 'saffron-700 text must meet AA on the warm off-white ground',
      );
    });
    test('saffronText passes AA on a white card', () {
      expect(
        _ratio(AppColors.saffronText, AppColors.lCard),
        greaterThanOrEqualTo(4.5),
        reason: 'saffron-700 text must meet AA on white cards',
      );
    });
    test('saffronText is saffron-600 #A5551D and lPrimaryText aliases it', () {
      // v3: the text-role saffron is saffron-600 (darkened so it clears AA on
      // warm surfaces); the pre-redesign saffron-700 #AC4815 is gone.
      expect(AppColors.saffronText, const Color(0xFFA5551D));
      expect(AppColors.saffronText, AppColors.lPrimaryText);
    });
    test('body foreground passes AA on the background', () {
      expect(
        _ratio(AppColors.lForeground, AppColors.lBackground),
        greaterThanOrEqualTo(4.5),
        reason: 'primary ink must be legible on the ground',
      );
    });
  });

  group('LIGHT — saffron FILL carries white (brand fill, exempt from 4.5)', () {
    test(
      'the primary fill is the v3 saffron-500 #C96A28 with a warm-white label',
      () {
        // v3 `--primary` is saffron-500 with `--primary-foreground: milk-100`.
        // We assert the PAIRING, not a ratio: this is a large brand fill, not
        // saffron-as-text.
        expect(AppColors.lPrimary, const Color(0xFFC96A28));
        expect(AppColors.lPrimary, AppColors.brandSaffron);
        expect(AppColors.lOnPrimary, AppColors.milk100);
        expect(AppColors.lRing, AppColors.lPrimary); // `--ring` = saffron
      },
    );
    test(
      'white on the saffron fill is below the text floor — hence white-only, '
      'large-fill use (documented exemption)',
      () {
        // Records WHY milk-100/white may not sit behind small text: as text on
        // saffron-500 it fails AA (3.77:1). It is sanctioned ONLY as a large
        // fill with a warm-white label (large-text 3.1 floor only).
        expect(_ratio(_white, AppColors.lPrimary), greaterThan(3.0));
        expect(_ratio(_white, AppColors.lPrimary), lessThan(4.5));
      },
    );
  });

  group('LIGHT — tricolour accent FILLS clear AA with white', () {
    test('navy accent fill (v3 indigo #2A3B8F) carries white at AA', () {
      expect(AppColors.navy, const Color(0xFF2A3B8F));
      expect(_ratio(_white, AppColors.lTertiary), greaterThanOrEqualTo(4.5));
    });
    test('green secondary fill (v3 leaf #2C5F2D) carries white at AA', () {
      expect(AppColors.green, const Color(0xFF2C5F2D));
      expect(_ratio(_white, AppColors.lSecondary), greaterThanOrEqualTo(4.5));
    });
  });

  group('DARK — mirrors the production .dark block', () {
    test('the dark saffron button uses DARK text and PASSES AA (accessible)', () {
      // v3 dark flips `--primary` to saffron-200 (a light tint) with ink-900
      // text. This is a real accessible pairing, asserted as passing AA
      // (~13.9:1) — unlike the light mode large-fill exemption.
      expect(AppColors.dPrimary, const Color(0xFFFFD9AE));
      expect(AppColors.dOnPrimary, const Color(0xFF171310));
      expect(
        _ratio(AppColors.dOnPrimary, AppColors.dPrimary),
        greaterThanOrEqualTo(4.5),
        reason: 'dark mode flips to dark-on-saffron, which must meet AA',
      );
    });
    test('saffron-as-text is legible on the dark ground (>=4.5)', () {
      // Dark has no saffron-700; the saffron itself is the text/eyebrow colour
      // and reads fine on near-black (~7.7:1).
      expect(
        _ratio(AppColors.dPrimaryText, AppColors.dBackground),
        greaterThanOrEqualTo(4.5),
        reason: 'dark saffron text must be legible on the dark ground',
      );
    });
    test('body foreground passes AA on the dark ground', () {
      expect(
        _ratio(AppColors.dForeground, AppColors.dBackground),
        greaterThanOrEqualTo(4.5),
      );
    });
  });

  group('the production saffron is reserved for large brand fills', () {
    test(
      'brandSaffron is the v3 saffron-500 #C96A28 and unifies with the primary fill',
      () {
        expect(AppColors.brandSaffron, const Color(0xFFC96A28));
        // Documented as failing AA with white (3.77:1) — never behind small
        // text; used as a large fill (buttons, active cards, the mic orb).
        expect(_ratio(AppColors.brandSaffron, _white), greaterThan(3.0));
        expect(_ratio(AppColors.brandSaffron, _white), lessThan(4.5));
      },
    );
  });

  group('warm error-container pairing passes AA (>=4.5)', () {
    // The error TINT container (send-failed bar, and any future error surface)
    // is a warm brand tint, NOT M3's default cool pink. onErrorContainer is the
    // label colour on it and must clear AA in both themes.
    test('LIGHT onErrorContainer on errorContainer', () {
      expect(
        _ratio(AppColors.lOnErrorContainer, AppColors.lErrorContainer),
        greaterThanOrEqualTo(4.5),
        reason: 'the send-failed bar label must meet AA on the warm tint',
      );
    });
    test('DARK onErrorContainer on errorContainer', () {
      expect(
        _ratio(AppColors.dOnErrorContainer, AppColors.dErrorContainer),
        greaterThanOrEqualTo(4.5),
      );
    });
  });

  group('GL-1 glassmorphism — flat-fill token stays AA-safe (>=4.5)', () {
    // GlassSurface.flat composites AppGlass.l/dFlatFill directly over the
    // scaffold's near-flat paper/vignette background (~lBackground/
    // dBackground). onSurface (lForeground/dForeground — see app_theme.dart's
    // ColorScheme mapping) is the body-text colour that would sit on it.
    // Color.alphaBlend mirrors what the compositor actually paints.
    test('LIGHT: onSurface on the composited flat-glass fill passes AA', () {
      final composited = Color.alphaBlend(
        AppGlass.lFlatFill,
        AppColors.lBackground,
      );
      expect(
        _ratio(AppColors.lForeground, composited),
        greaterThanOrEqualTo(4.5),
        reason:
            'body text on the flat glass fill must stay AA-safe once composited over the paper background',
      );
    });
    test('DARK: onSurface on the composited flat-glass fill passes AA', () {
      final composited = Color.alphaBlend(
        AppGlass.dFlatFill,
        AppColors.dBackground,
      );
      expect(
        _ratio(AppColors.dForeground, composited),
        greaterThanOrEqualTo(4.5),
        reason:
            'body text on the flat glass fill must stay AA-safe once composited over the vignette background',
      );
    });

    // The two tests above assume the near-flat paper/vignette backdrop the
    // visual design targets. The GL-1 design review flagged that a REAL
    // BackdropFilter blurs whatever is actually behind it (a busy gradient,
    // an image, a saffron-heavy hero) — not necessarily something that
    // softens toward lBackground/dBackground. These test the worst
    // REALISTIC case (the app's own most saturated brand colour) and the
    // absolute extremes (pure black/white), so the opacity tuning below
    // (dropped from an original, over-cautious 85-90% per that same review)
    // is proven safe against more than the best-case backdrop.
    test('LIGHT: chrome fill over the most saturated real backdrop '
        '(brandSaffron) still passes AA', () {
      final composited = Color.alphaBlend(
        AppGlass.lChromeFill,
        AppColors.brandSaffron,
      );
      expect(
        _ratio(AppColors.lForeground, composited),
        greaterThanOrEqualTo(4.5),
        reason:
            'a real blur can soften toward saffron-heavy content '
            'behind it, not just the paper background',
      );
    });
    test('LIGHT: chrome fill over the absolute-worst extremes '
        '(pure black, pure white) still passes AA', () {
      for (final extreme in [Colors.black, Colors.white]) {
        final composited = Color.alphaBlend(AppGlass.lChromeFill, extreme);
        expect(
          _ratio(AppColors.lForeground, composited),
          greaterThanOrEqualTo(4.5),
          reason: 'worst-case backdrop $extreme must not break AA',
        );
      }
    });
    test('DARK: chrome fill over the absolute-worst extremes '
        '(pure black, pure white) still passes AA', () {
      for (final extreme in [Colors.black, Colors.white]) {
        final composited = Color.alphaBlend(AppGlass.dChromeFill, extreme);
        expect(
          _ratio(AppColors.dForeground, composited),
          greaterThanOrEqualTo(4.5),
          reason: 'worst-case backdrop $extreme must not break AA',
        );
      }
    });
  });

  group('GL-4 mine-bubble wash — DOUBLE composite stays AA-safe (>=4.5)', () {
    // message_bubble.dart / chat_bubble.dart paint a translucent
    // primaryContainer@0.85 wash ON TOP of the already-composited flat-glass
    // fill — a composite of a composite, not a single layer. The GL-4 design
    // review caught the doc comments asserting a number that didn't match
    // EITHER token actually used here (it matched onPrimaryContainer,
    // mislabelled as onSurface) — this locks the real double-blend so it
    // can't drift silently again.
    Color doubleComposite(Color flatFill, Color background, Color container) {
      final step1 = Color.alphaBlend(flatFill, background);
      return Color.alphaBlend(container.withValues(alpha: 0.85), step1);
    }

    test('LIGHT: onSurface (body) on the wash composite passes AA', () {
      final composited = doubleComposite(
        AppGlass.lFlatFill,
        AppColors.lBackground,
        AppColors.lPrimaryContainer,
      );
      expect(
        _ratio(AppColors.lForeground, composited),
        greaterThanOrEqualTo(4.5),
        reason:
            'mine-bubble body text must stay AA-safe on the '
            'double-composited wash',
      );
    });
    test('DARK: onSurface (body) on the wash composite passes AA', () {
      final composited = doubleComposite(
        AppGlass.dFlatFill,
        AppColors.dBackground,
        AppColors.dPrimaryContainer,
      );
      expect(
        _ratio(AppColors.dForeground, composited),
        greaterThanOrEqualTo(4.5),
        reason:
            'mine-bubble body text must stay AA-safe on the '
            'double-composited wash',
      );
    });
    test('LIGHT: onPrimaryContainer (meta/tick) on the wash composite '
        'passes AA', () {
      final composited = doubleComposite(
        AppGlass.lFlatFill,
        AppColors.lBackground,
        AppColors.lPrimaryContainer,
      );
      expect(
        _ratio(AppColors.lOnPrimaryContainer, composited),
        greaterThanOrEqualTo(4.5),
        reason:
            'mine-bubble meta/tick must stay AA-safe on the '
            'double-composited wash',
      );
    });
    test('DARK: onPrimaryContainer (meta/tick) on the wash composite '
        'passes AA', () {
      final composited = doubleComposite(
        AppGlass.dFlatFill,
        AppColors.dBackground,
        AppColors.dPrimaryContainer,
      );
      expect(
        _ratio(AppColors.dOnPrimaryContainer, composited),
        greaterThanOrEqualTo(4.5),
        reason:
            'mine-bubble meta/tick must stay AA-safe on the '
            'double-composited wash',
      );
    });
  });
}
