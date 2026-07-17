import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/theme/app_colors.dart';

/// WCAG 2.1 relative-luminance contrast. Locks the founder-approved
/// accessible-saffron split so a future theme edit cannot silently
/// reintroduce the #FF9933-on-white 2.13:1 failure.
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
  group('Accessible saffron split (WCAG AA)', () {
    test('LIGHT primary passes AA (4.5) as text/icon on white', () {
      // Saffron text/icons on light surfaces (dashboard tiles, correct-answer
      // marks, plan badge) use scheme.primary.
      expect(_ratio(AppColors.lPrimary, _white), greaterThanOrEqualTo(4.5),
          reason: 'lPrimary saffron text on white must meet AA');
    });

    test('LIGHT CTA passes AA (4.5): white label on the primary fill', () {
      expect(_ratio(AppColors.lOnPrimary, AppColors.lPrimary),
          greaterThanOrEqualTo(4.5),
          reason: 'white button label on saffron CTA must meet AA');
    });

    test('LIGHT focus ring passes non-text UI contrast (3.0) on white', () {
      expect(_ratio(AppColors.lRing, _white), greaterThanOrEqualTo(3.0),
          reason: 'focus ring / active state must meet the 3:1 UI floor');
    });

    test('DARK primary passes AA (4.5) as text on the dark surface', () {
      expect(_ratio(AppColors.dPrimary, AppColors.dBackground),
          greaterThanOrEqualTo(4.5),
          reason: 'vivid saffron reads fine on near-black; dark keeps it');
      expect(_ratio(AppColors.dOnPrimary, AppColors.dPrimary),
          greaterThanOrEqualTo(3.0));
    });

    test('brandSaffron is the vivid #FF9933 reserved for large brand moments', () {
      expect(AppColors.brandSaffron, const Color(0xFFFF9933));
      // Documented as failing AA on white — must NOT be used behind small text
      // on a light surface. This test records the fact so the intent is clear.
      expect(_ratio(AppColors.brandSaffron, _white), lessThan(3.0));
    });
  });
}
