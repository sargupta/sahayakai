import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Glass — design system v2 ("Cards are glass").
///
/// Glass is translucency over the wash: a translucent white fill and a 1px
/// luminous `border-glass` edge. It is not a blur — v2 keeps real blur for the
/// website's sticky nav only — so both [GlassSurface] constructors draw the
/// same flat material.
///
/// Fills (v2 tokens):
///   • [lChromeFill] `surface-chrome` — the tab bar, app bar, floating chrome.
///   • [lFlatFill] `surface-glass` — cards on the wash.
///   • `surface-glass-strong` / `-soft` are on [AppColors] for the card tones.
///
/// Corners are plain circular radii, as the v2 CSS draws them
/// (`border-radius`), not the pre-v2 continuous "squircle".
///
/// This file is exempt from token_guard (it defines raw values; other files
/// reference them by name).
class AppGlass {
  AppGlass._();

  /// The glass edge: 1px.
  static const double borderWidth = 1.0;

  // ---- fills ----
  static const Color lChromeFill = AppColors.surfaceChrome;
  static const Color lFlatFill = AppColors.surfaceGlass;

  // ---- edge ----
  /// The v2 `border-glass` edge, drawn as a flat 1px ring (both stops are the
  /// token, so the ring is uniform).
  static const LinearGradient lBorderGradient = LinearGradient(
    colors: [AppColors.borderGlass, AppColors.borderGlass],
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
