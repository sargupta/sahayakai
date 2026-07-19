import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/theme/app_colors.dart';

/// WCAG 2.1 relative-luminance contrast, encoding PRODUCTION's real saffron
/// contract (LIVE-sampled from sahayakai.com) — NOT the predecessor's
/// accessible-saffron split. This is a deliberate, documented re-baseline:
///
///   PRODUCTION CONTRACT
///   • LIGHT: saffron is a FILL with WHITE text — buttons, active cards, the
///     mic orb (`--primary` + `--primary-foreground: white`). Production's
///     rendered saffron `#E0924D` is ~2.5:1 with white: a large brand FILL,
///     EXEMPT from the 4.5 text rule. We assert the PAIRING (white is the
///     foreground on the saffron fill), not a text-contrast ratio.
///   • Saffron as TEXT/icon/eyebrow uses saffron-700 `#AC4815` — THAT is the
///     pathway that must pass AA (>=4.5) on the light ground/card.
///   • The tricolour accent FILLS (navy `#000080`, green `#28572B`) carry white
///     and clear AA as fills.
///   • DARK flips to DARK text on the saffron button: production `.dark`
///     `--primary-foreground` computes to `#0F1729`, so `dOnPrimary` on
///     `dPrimary #EB9447` is a genuinely ACCESSIBLE ~7.5:1 pairing (NOT a
///     fill-only exemption) — this is asserted as passing AA. Saffron-as-text
///     on the dark ground uses `#EB9447` itself.
double _lin(int c) {
  final s = c / 255.0;
  return s <= 0.03928 ? s / 12.92 : math.pow((s + 0.055) / 1.055, 2.4).toDouble();
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
    // Saffron used as TEXT/icons/eyebrows routes through saffron-700
    // (`saffronText` / `lPrimaryText` `#AC4815`), NOT the `#E0924D` fill.
    test('saffronText passes AA on the light background', () {
      expect(_ratio(AppColors.saffronText, AppColors.lBackground),
          greaterThanOrEqualTo(4.5),
          reason: 'saffron-700 text must meet AA on the warm off-white ground');
    });
    test('saffronText passes AA on a white card', () {
      expect(_ratio(AppColors.saffronText, AppColors.lCard),
          greaterThanOrEqualTo(4.5),
          reason: 'saffron-700 text must meet AA on white cards');
    });
    test('saffronText is saffron-700 #AC4815 and lPrimaryText aliases it', () {
      expect(AppColors.saffronText, const Color(0xFFAC4815));
      expect(AppColors.saffronText, AppColors.lPrimaryText);
    });
    test('body foreground passes AA on the background', () {
      expect(_ratio(AppColors.lForeground, AppColors.lBackground),
          greaterThanOrEqualTo(4.5),
          reason: 'primary ink must be legible on the ground');
    });
  });

  group('LIGHT — saffron FILL carries white (brand fill, exempt from 4.5)', () {
    test('the primary fill is the production saffron #E0924D with a white label',
        () {
      // Production `--primary` + `--primary-foreground: white`. We assert the
      // PAIRING, not a ratio: this is a large brand fill, not saffron-as-text.
      expect(AppColors.lPrimary, const Color(0xFFE0924D));
      expect(AppColors.lPrimary, AppColors.brandSaffron);
      expect(AppColors.lOnPrimary, _white);
      expect(AppColors.lRing, AppColors.lPrimary); // `--ring` = saffron
    });
    test('white on the saffron fill is below the text floor — hence white-only, '
        'large-fill use (documented exemption)', () {
      // Records WHY saffron may not sit behind small text: as text it fails.
      // It is sanctioned ONLY as a large fill with a white label (~2.5:1).
      expect(_ratio(_white, AppColors.lPrimary), lessThan(3.0));
    });
  });

  group('LIGHT — tricolour accent FILLS clear AA with white', () {
    test('navy accent fill (#000080) carries white at AA', () {
      expect(AppColors.navy, const Color(0xFF000080));
      expect(_ratio(_white, AppColors.lTertiary), greaterThanOrEqualTo(4.5));
    });
    test('green secondary fill (#28572B) carries white at AA', () {
      expect(AppColors.green, const Color(0xFF28572B));
      expect(_ratio(_white, AppColors.lSecondary), greaterThanOrEqualTo(4.5));
    });
  });

  group('DARK — mirrors the production .dark block', () {
    test('the dark saffron button uses DARK text and PASSES AA (accessible)', () {
      // Production `.dark` `--primary-foreground` computes to #0F1729 — dark
      // text on the #EB9447 saffron. Unlike light (white fill, exempt), THIS is
      // a real accessible pairing, so it is asserted as passing AA (~7.5:1).
      expect(AppColors.dPrimary, const Color(0xFFEB9447));
      expect(AppColors.dOnPrimary, const Color(0xFF0F1729));
      expect(_ratio(AppColors.dOnPrimary, AppColors.dPrimary),
          greaterThanOrEqualTo(4.5),
          reason: 'dark mode flips to dark-on-saffron, which must meet AA');
    });
    test('saffron-as-text is legible on the dark ground (>=4.5)', () {
      // Dark has no saffron-700; the saffron itself is the text/eyebrow colour
      // and reads fine on near-black (~7.7:1).
      expect(_ratio(AppColors.dPrimaryText, AppColors.dBackground),
          greaterThanOrEqualTo(4.5),
          reason: 'dark saffron text must be legible on the dark ground');
    });
    test('body foreground passes AA on the dark ground', () {
      expect(_ratio(AppColors.dForeground, AppColors.dBackground),
          greaterThanOrEqualTo(4.5));
    });
  });

  group('the production saffron is reserved for large brand fills', () {
    test('brandSaffron is the rendered #E0924D and unifies with the primary fill',
        () {
      expect(AppColors.brandSaffron, const Color(0xFFE0924D));
      // Documented as failing AA with white — never behind small text; used as
      // a large fill (buttons, active cards, the mic orb).
      expect(_ratio(AppColors.brandSaffron, _white), lessThan(3.0));
    });
  });

  group('warm error-container pairing passes AA (>=4.5)', () {
    // The error TINT container (send-failed bar, and any future error surface)
    // is a warm brand tint, NOT M3's default cool pink. onErrorContainer is the
    // label colour on it and must clear AA in both themes.
    test('LIGHT onErrorContainer on errorContainer', () {
      expect(_ratio(AppColors.lOnErrorContainer, AppColors.lErrorContainer),
          greaterThanOrEqualTo(4.5),
          reason: 'the send-failed bar label must meet AA on the warm tint');
    });
    test('DARK onErrorContainer on errorContainer', () {
      expect(_ratio(AppColors.dOnErrorContainer, AppColors.dErrorContainer),
          greaterThanOrEqualTo(4.5));
    });
  });
}
