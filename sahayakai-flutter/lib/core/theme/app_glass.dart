import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Glass — design system v2 ("Cards are glass").
///
/// Glass is translucency over the wash: a translucent white fill and a 1px
/// luminous `border-glass` edge. It is not a blur — v2 keeps real blur for the
/// website's sticky nav only — so in light both [GlassSurface] constructors
/// draw the same flat material. Dark keeps its pre-v2 blur.
///
/// LIGHT fills (v2 tokens):
///   • [lChromeFill] `surface-chrome` — the tab bar, app bar, floating chrome.
///   • [lFlatFill] `surface-glass` — cards on the wash.
///   • `surface-glass-strong` / `-soft` are on [AppColors] for the card tones.
///
/// DARK keeps its pre-v2 glass (dark mode is an open founder decision).
///
/// Corners are plain circular radii, as the v2 CSS draws them
/// (`border-radius`), not the pre-v2 continuous "squircle".
///
/// This file is exempt from token_guard (it defines raw values; other files
/// reference them by name).
class AppGlass {
  AppGlass._();

  /// Blur sigma for the few chrome surfaces that float over scrolling content.
  static const double blurSigma = 20.0;

  /// The glass edge: 1px.
  static const double borderWidth = 1.0;

  // ---- fills ----
  static const Color lChromeFill = AppColors.surfaceChrome;
  static const Color dChromeFill = Color(0xBF1C1F26);
  static const Color lFlatFill = AppColors.surfaceGlass;
  static const Color dFlatFill = Color(0xCC1C1F26);

  // ---- edge ----
  /// Light: the v2 `border-glass` edge, drawn as a flat 1px ring (both stops
  /// are the token, so the ring is uniform).
  static const LinearGradient lBorderGradient = LinearGradient(
    colors: [AppColors.borderGlass, AppColors.borderGlass],
  );

  /// Dark: the pre-v2 top-left catch-light (0.14 → 0.03).
  static final LinearGradient dBorderGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Colors.white.withValues(alpha: 0.14),
      Colors.white.withValues(alpha: 0.03),
    ],
  );

  // ---- sheen ----
  /// Light: none. v2 glass has no sheen, and saffron is reserved for VIDYA and
  /// the one action, so a saffron-tinted corner glow on every card is out.
  static const LinearGradient lSheenGradient = LinearGradient(
    colors: [Color(0x00FFFFFF), Color(0x00FFFFFF)],
  );

  static final Color _dSheenBase =
      Color.lerp(Colors.white, AppColors.dPrimary, 0.40)!;

  /// Dark: the pre-v2 sheen, unchanged.
  static final LinearGradient dSheenGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.center,
    colors: [
      _dSheenBase.withValues(alpha: 0.12),
      _dSheenBase.withValues(alpha: 0.0),
    ],
  );

  /// The glass shape at a uniform [radius]. Lives here (not in a widget) so
  /// the runtime `.circular(radius)` stays inside the token_guard-exempt
  /// theme directory.
  static ShapeBorder shape(double radius) =>
      RoundedRectangleBorder(borderRadius: BorderRadius.circular(radius));

  /// The glass shape with per-corner radii (e.g. a sheet's top corners).
  static ShapeBorder shapeFromBorderRadius(BorderRadius borderRadius) =>
      RoundedRectangleBorder(borderRadius: borderRadius);

  /// [borderRadius] inset by [borderWidth] on every corner (clamped at 0) —
  /// the inner shape of the 1px edge ring.
  static BorderRadius insetBorderRadius(BorderRadius borderRadius) {
    Radius inset(Radius r) =>
        Radius.circular((r.x - borderWidth).clamp(0.0, double.infinity));
    return BorderRadius.only(
      topLeft: inset(borderRadius.topLeft),
      topRight: inset(borderRadius.topRight),
      bottomLeft: inset(borderRadius.bottomLeft),
      bottomRight: inset(borderRadius.bottomRight),
    );
  }
}
