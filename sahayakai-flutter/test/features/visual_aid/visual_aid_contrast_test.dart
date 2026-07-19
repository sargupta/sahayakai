import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/theme/app_colors.dart';

/// AA gate for the broken-image caption in `visual_aid_result_view.dart`.
///
/// That caption IS the content of a failed `_DrawingFrame` (chrome, not muted
/// sub-copy), and it sits on the frame's `surfaceContainerLow` fill. The muted
/// role (`onSurfaceVariant` `#65758B`) there is 4.49:1 — under the 4.5 floor for
/// 14sp normal text — so the caption is coloured `onSurface` (full ink). These
/// assert the exact scheme roles the widget uses (onSurface == foreground,
/// surfaceContainerLow, onSurfaceVariant == mutedForeground), read from the
/// AppColors tokens the ColorScheme maps them to.

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
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

void main() {
  group('broken-image caption clears WCAG AA (>=4.5) on the frame fill', () {
    test('light: onSurface ink on surfaceContainerLow', () {
      // onSurface -> lForeground, surfaceContainerLow -> lSurfaceContainerLow.
      expect(
        _ratio(AppColors.lForeground, AppColors.lSurfaceContainerLow),
        greaterThanOrEqualTo(4.5),
        reason: 'the caption (full ink) must clear AA on the drawing frame',
      );
      // The muted role the caption used to carry is below the floor here — this
      // is exactly why the fix routes it through onSurface.
      expect(
        _ratio(AppColors.lMutedForeground, AppColors.lSurfaceContainerLow),
        lessThan(4.5),
      );
    });

    test('dark: onSurface ink on surfaceContainerLow', () {
      expect(
        _ratio(AppColors.dForeground, AppColors.dSurfaceContainerLow),
        greaterThanOrEqualTo(4.5),
      );
    });
  });
}
