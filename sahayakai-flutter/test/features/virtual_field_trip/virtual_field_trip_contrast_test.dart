import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/theme/app_colors.dart';

/// AA gates for the field-trip stop card (the hard rule: any toned inset uses a
/// text role that clears 4.5:1 on its fill).
///
/// Four placements are pinned to the exact scheme roles the widgets use, read
/// from the AppColors tokens the ColorScheme maps them to (onSurface ==
/// foreground, onSurfaceVariant == mutedForeground, surface == card,
/// surfaceContainerHigh/Low == the like-named tokens, onPrimaryContainer /
/// primaryContainer == the like-named tokens):
///   1. The educational-fact NoteBanner keeps its text in FULL ink (onSurface)
///      on the surfaceContainerHigh fill.
///   2. The reflection inset keeps its text in FULL ink (onSurface) on the
///      surfaceContainerLow fill — NOT the muted role, which fails there.
///   3. The analogy / explanation section labels are muted (onSurfaceVariant) but
///      sit on the WHITE card surface, where that role clears AA — the trap they
///      would fall into on a surfaceContainer tint is asserted too.
///   4. The stop medallion's onPrimaryContainer label clears AA on its tint.

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
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

void main() {
  group(
    'educational-fact NoteBanner: full ink on the surfaceContainerHigh fill',
    () {
      test('light: onSurface on surfaceContainerHigh (>=4.5)', () {
        expect(
          _ratio(AppColors.lForeground, AppColors.lSurfaceContainerHigh),
          greaterThanOrEqualTo(4.5),
        );
      });
      test('dark: onSurface on surfaceContainerHigh (>=4.5)', () {
        expect(
          _ratio(AppColors.dForeground, AppColors.dSurfaceContainerHigh),
          greaterThanOrEqualTo(4.5),
        );
      });
    },
  );

  group('reflection inset: full ink on the surfaceContainerLow fill', () {
    test('light: onSurface on surfaceContainerLow (>=4.5)', () {
      expect(
        _ratio(AppColors.lForeground, AppColors.lSurfaceContainerLow),
        greaterThanOrEqualTo(4.5),
        reason: 'the reflection label + prompt must be full ink on the inset',
      );
      // The exact trap the hard rule guards against: the MUTED role on this same
      // inset fill is BELOW the floor, which is why the inset uses full ink.
      expect(
        _ratio(AppColors.lMutedForeground, AppColors.lSurfaceContainerLow),
        lessThan(4.5),
      );
    });
    test('dark: onSurface on surfaceContainerLow (>=4.5)', () {
      expect(
        _ratio(AppColors.dForeground, AppColors.dSurfaceContainerLow),
        greaterThanOrEqualTo(4.5),
      );
    });
  });

  group(
    'analogy / explanation labels: muted, but on the white card surface',
    () {
      test('light: onSurfaceVariant on the white card surface (>=4.5)', () {
        expect(
          _ratio(AppColors.lMutedForeground, AppColors.lCard),
          greaterThanOrEqualTo(4.5),
          reason: 'muted section labels must clear AA on the white card fill',
        );
      });
      test('dark: onSurfaceVariant on the dark card surface (>=4.5)', () {
        expect(
          _ratio(AppColors.dMutedForeground, AppColors.dCard),
          greaterThanOrEqualTo(4.5),
        );
      });
    },
  );

  group('stop medallion: onPrimaryContainer clears AA on its tint', () {
    test('light: onPrimaryContainer on primaryContainer (>=4.5)', () {
      expect(
        _ratio(AppColors.lOnPrimaryContainer, AppColors.lPrimaryContainer),
        greaterThanOrEqualTo(4.5),
      );
    });
    test('dark: onPrimaryContainer on primaryContainer (>=4.5)', () {
      expect(
        _ratio(AppColors.dOnPrimaryContainer, AppColors.dPrimaryContainer),
        greaterThanOrEqualTo(4.5),
      );
    });
  });
}
