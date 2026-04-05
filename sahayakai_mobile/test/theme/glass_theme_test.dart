import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/core/theme/glassmorphic/glass_theme.dart';

void main() {
  group('GlassColors', () {
    test('primary is Indian Saffron', () {
      expect(GlassColors.primary, const Color(0xFFFF9933));
    });

    test('text hierarchy: primary darker than secondary darker than tertiary', () {
      // textPrimary should be darkest (lowest lightness)
      final primaryLum = GlassColors.textPrimary.computeLuminance();
      final secondaryLum = GlassColors.textSecondary.computeLuminance();
      final tertiaryLum = GlassColors.textTertiary.computeLuminance();
      expect(primaryLum, lessThan(secondaryLum));
      expect(secondaryLum, lessThan(tertiaryLum));
    });

    test('cardShadow returns non-empty list', () {
      expect(GlassColors.cardShadow, isNotEmpty);
      expect(GlassColors.cardShadow.length, 2);
    });

    test('buttonShadow returns non-empty list', () {
      expect(GlassColors.buttonShadow, isNotEmpty);
      expect(GlassColors.buttonShadow.length, 1);
    });

    test('backgroundGradient has 3 stops', () {
      expect(GlassColors.backgroundGradient.colors.length, 3);
      expect(GlassColors.backgroundGradient.stops!.length, 3);
    });

    test('warmBackgroundGradient has 6 color stops', () {
      expect(GlassColors.warmBackgroundGradient.colors.length, 6);
    });

    test('primaryGradient goes from light to dark', () {
      expect(GlassColors.primaryGradient.colors.first, GlassColors.primaryLight);
      expect(GlassColors.primaryGradient.colors.last, GlassColors.primaryDark);
    });

    test('convenience aliases match their sources', () {
      expect(GlassColors.background, GlassColors.backgroundEnd);
      expect(GlassColors.surface, GlassColors.cardBackground);
      expect(GlassColors.border, GlassColors.cardBorder);
    });

    test('shadedBackgroundGradient is RadialGradient', () {
      expect(GlassColors.shadedBackgroundGradient, isA<RadialGradient>());
      expect(GlassColors.shadedBackgroundGradient.colors.length, 3);
    });
  });

  group('GlassSpacing', () {
    test('values increase monotonically', () {
      expect(GlassSpacing.xs, lessThan(GlassSpacing.sm));
      expect(GlassSpacing.sm, lessThan(GlassSpacing.md));
      expect(GlassSpacing.md, lessThan(GlassSpacing.lg));
      expect(GlassSpacing.lg, lessThan(GlassSpacing.xl));
      expect(GlassSpacing.xl, lessThan(GlassSpacing.xxl));
      expect(GlassSpacing.xxl, lessThan(GlassSpacing.xxxl));
    });

    test('padding presets are symmetric EdgeInsets', () {
      expect(GlassSpacing.cardPadding, const EdgeInsets.all(20));
      expect(GlassSpacing.screenPadding, const EdgeInsets.all(20));
    });
  });

  group('GlassRadius', () {
    test('values increase monotonically', () {
      expect(GlassRadius.xs, lessThan(GlassRadius.sm));
      expect(GlassRadius.sm, lessThan(GlassRadius.md));
      expect(GlassRadius.md, lessThan(GlassRadius.lg));
      expect(GlassRadius.lg, lessThan(GlassRadius.xl));
      expect(GlassRadius.xl, lessThan(GlassRadius.xxl));
      expect(GlassRadius.xxl, lessThan(GlassRadius.pill));
    });

    test('cardRadius uses lg value', () {
      expect(GlassRadius.cardRadius, BorderRadius.circular(GlassRadius.lg));
    });

    test('chipRadius uses pill value', () {
      expect(GlassRadius.chipRadius, BorderRadius.circular(GlassRadius.pill));
    });
  });

  group('GlassTypography', () {
    test('headline sizes decrease from 1 to 3', () {
      final h1 = GlassTypography.headline1();
      final h2 = GlassTypography.headline2();
      final h3 = GlassTypography.headline3();
      expect(h1.fontSize!, greaterThan(h2.fontSize!));
      expect(h2.fontSize!, greaterThan(h3.fontSize!));
    });

    test('body sizes decrease from large to small', () {
      final large = GlassTypography.bodyLarge();
      final medium = GlassTypography.bodyMedium();
      final small = GlassTypography.bodySmall();
      expect(large.fontSize!, greaterThan(medium.fontSize!));
      expect(medium.fontSize!, greaterThan(small.fontSize!));
    });

    test('label sizes decrease from large to small', () {
      final large = GlassTypography.labelLarge();
      final medium = GlassTypography.labelMedium();
      final small = GlassTypography.labelSmall();
      expect(large.fontSize!, greaterThan(medium.fontSize!));
      expect(medium.fontSize!, greaterThan(small.fontSize!));
    });

    test('custom color is applied to typography methods', () {
      const customColor = Colors.red;
      expect(GlassTypography.headline1(color: customColor).color, customColor);
      expect(GlassTypography.bodyMedium(color: customColor).color, customColor);
      expect(GlassTypography.labelSmall(color: customColor).color, customColor);
      expect(GlassTypography.sectionHeader(color: customColor).color, customColor);
      expect(GlassTypography.buttonLarge(color: customColor).color, customColor);
    });

    test('default colors match GlassColors text hierarchy', () {
      expect(GlassTypography.headline1().color, GlassColors.textPrimary);
      expect(GlassTypography.bodySmall().color, GlassColors.textSecondary);
      expect(GlassTypography.labelSmall().color, GlassColors.textTertiary);
      expect(GlassTypography.buttonLarge().color, Colors.white);
    });

    test('decorativeLabel uses italic style', () {
      final style = GlassTypography.decorativeLabel();
      expect(style.fontStyle, FontStyle.italic);
    });
  });
}
