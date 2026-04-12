import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/core/theme/extensions/sahayak_theme_extensions.dart';

void main() {
  group('SahayakColors', () {
    late SahayakColors colorsA;
    late SahayakColors colorsB;

    setUp(() {
      colorsA = const SahayakColors(
        primary: Colors.orange,
        accent: Colors.amber,
        studioSurface: Colors.white,
        onStudioSurface: Colors.black,
        aiLoaderGradient: LinearGradient(colors: [Colors.orange, Colors.pink]),
        micGlow: Colors.orange,
      );
      colorsB = const SahayakColors(
        primary: Colors.blue,
        accent: Colors.lightBlue,
        studioSurface: Colors.black,
        onStudioSurface: Colors.white,
        aiLoaderGradient: LinearGradient(colors: [Colors.blue, Colors.cyan]),
        micGlow: Colors.blue,
      );
    });

    test('construction stores all fields', () {
      expect(colorsA.primary, Colors.orange);
      expect(colorsA.accent, Colors.amber);
      expect(colorsA.studioSurface, Colors.white);
      expect(colorsA.onStudioSurface, Colors.black);
      expect(colorsA.micGlow, Colors.orange);
    });

    test('copyWith replaces specified fields only', () {
      final copied = colorsA.copyWith(primary: Colors.red);
      expect(copied.primary, Colors.red);
      // Unchanged fields
      expect(copied.accent, Colors.amber);
      expect(copied.studioSurface, Colors.white);
      expect(copied.micGlow, Colors.orange);
    });

    test('copyWith with no arguments returns identical values', () {
      final copied = colorsA.copyWith();
      expect(copied.primary, colorsA.primary);
      expect(copied.accent, colorsA.accent);
      expect(copied.studioSurface, colorsA.studioSurface);
      expect(copied.onStudioSurface, colorsA.onStudioSurface);
      expect(copied.micGlow, colorsA.micGlow);
    });

    test('lerp at t=0 returns this colors', () {
      final result = colorsA.lerp(colorsB, 0.0);
      expect(result.primary.value, colorsA.primary.value);
      expect(result.micGlow.value, colorsA.micGlow.value);
    });

    test('lerp at t=1 returns other colors', () {
      final result = colorsA.lerp(colorsB, 1.0);
      expect(result.primary.value, colorsB.primary.value);
      expect(result.micGlow.value, colorsB.micGlow.value);
    });

    test('lerp at t=0.5 returns interpolated colors', () {
      final result = colorsA.lerp(colorsB, 0.5);
      final expectedPrimary = Color.lerp(Colors.orange, Colors.blue, 0.5);
      expect(result.primary, expectedPrimary);
    });

    test('lerp with non-SahayakColors returns this', () {
      final result = colorsA.lerp(null, 0.5);
      expect(result.primary, colorsA.primary);
    });
  });

  group('SahayakTypography', () {
    late SahayakTypography typoA;
    late SahayakTypography typoB;

    setUp(() {
      typoA = const SahayakTypography(
        displayLarge: TextStyle(fontSize: 57, fontWeight: FontWeight.bold),
        headlineMedium: TextStyle(fontSize: 28, fontWeight: FontWeight.w600),
        bodyLarge: TextStyle(fontSize: 16),
        bodyMedium: TextStyle(fontSize: 14),
        fontFamilyHeading: 'Outfit',
        fontFamilyBody: 'Inter',
      );
      typoB = const SahayakTypography(
        displayLarge: TextStyle(fontSize: 48, fontWeight: FontWeight.w400),
        headlineMedium: TextStyle(fontSize: 24, fontWeight: FontWeight.w500),
        bodyLarge: TextStyle(fontSize: 18),
        bodyMedium: TextStyle(fontSize: 16),
        fontFamilyHeading: 'Roboto',
        fontFamilyBody: 'Noto',
      );
    });

    test('construction stores all fields', () {
      expect(typoA.displayLarge.fontSize, 57);
      expect(typoA.fontFamilyHeading, 'Outfit');
      expect(typoA.fontFamilyBody, 'Inter');
    });

    test('copyWith replaces specified fields only', () {
      final copied = typoA.copyWith(fontFamilyHeading: 'Roboto');
      expect(copied.fontFamilyHeading, 'Roboto');
      expect(copied.fontFamilyBody, 'Inter');
      expect(copied.displayLarge.fontSize, 57);
    });

    test('copyWith with no arguments returns identical values', () {
      final copied = typoA.copyWith();
      expect(copied.fontFamilyHeading, typoA.fontFamilyHeading);
      expect(copied.fontFamilyBody, typoA.fontFamilyBody);
      expect(copied.displayLarge.fontSize, typoA.displayLarge.fontSize);
    });

    test('lerp at t=0 returns this typography', () {
      final result = typoA.lerp(typoB, 0.0);
      expect(result.displayLarge.fontSize, typoA.displayLarge.fontSize);
    });

    test('lerp at t=1 returns other typography', () {
      final result = typoA.lerp(typoB, 1.0);
      expect(result.displayLarge.fontSize, typoB.displayLarge.fontSize);
      // String fields snap to other at any t > 0
      expect(result.fontFamilyHeading, 'Roboto');
      expect(result.fontFamilyBody, 'Noto');
    });

    test('lerp with non-SahayakTypography returns this', () {
      final result = typoA.lerp(null, 0.5);
      expect(result.fontFamilyHeading, typoA.fontFamilyHeading);
    });
  });
}
