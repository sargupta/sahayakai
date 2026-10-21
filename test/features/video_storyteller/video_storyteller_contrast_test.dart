import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/theme/app_colors.dart';

/// AA gates for `video_card.dart`.
///
/// Two muted-text placements must clear WCAG AA:
///   1. The card's meta row (channel / duration) sits on the card's `surface`
///      fill (WHITE in light) in the `onSurfaceVariant` role. The task's hard
///      rule: this must NOT move onto a `surfaceContainer*` tint, where the same
///      role drops below 4.5.
///   2. The thumbnail fallback's channel label sits on the `surfaceContainer`
///      fill and is drawn in FULL ink (`onSurface`) — the hardened role; the
///      muted role on that fill clears AA in v3 too, but the fallback stays
///      full ink for parity with the drawing-frame caption.
///
/// These assert the exact scheme roles the widget uses, read from the AppColors
/// tokens the ColorScheme maps them to (onSurfaceVariant == mutedForeground,
/// surface == card, onSurface == foreground, surfaceContainer == muted).

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
  group('card meta (channel / duration) clears AA on the card surface', () {
    test('light: onSurfaceVariant on the white card surface (>=4.5)', () {
      // onSurfaceVariant -> lMutedForeground, surface -> lCard (#FFFFFF).
      expect(
        _ratio(AppColors.lMutedForeground, AppColors.lCard),
        greaterThanOrEqualTo(4.5),
        reason: 'muted meta must clear AA on the white card fill',
      );
      // The trap the rule guards against: the same role on a surfaceContainer
      // tint. In v3 that muted role clears AA on the tint too (~5.3:1), so it
      // is asserted as passing — but the meta must still sit on the white card
      // surface, never move onto a tint it wasn't validated for.
      expect(
        _ratio(AppColors.lMutedForeground, AppColors.lMuted),
        greaterThanOrEqualTo(4.5),
      );
    });

    test('dark: onSurfaceVariant on the dark card surface (>=4.5)', () {
      expect(
        _ratio(AppColors.dMutedForeground, AppColors.dCard),
        greaterThanOrEqualTo(4.5),
      );
    });
  });

  group('thumbnail fallback label clears AA on the surfaceContainer fill', () {
    test('light: onSurface ink on surfaceContainer', () {
      // onSurface -> lForeground, surfaceContainer -> lMuted.
      expect(
        _ratio(AppColors.lForeground, AppColors.lMuted),
        greaterThanOrEqualTo(4.5),
        reason: 'the fallback label (full ink) must clear AA on the fill',
      );
    });

    test('dark: onSurface ink on surfaceContainer', () {
      expect(
        _ratio(AppColors.dForeground, AppColors.dMuted),
        greaterThanOrEqualTo(4.5),
      );
    });
  });
}
