import 'package:flutter/material.dart';

import 'app_colors.dart';

/// The depth engine — PREMIUM_DESIGN_SPEC.md §2.3 (LOCKED).
///
/// Five levels. LIGHT = warm-tinted two-layer shadows (pure black on warm
/// paper looks dirty). DARK = surface steps + a 1px top highlight + a black
/// key shadow only where things float. `cardTheme.elevation` stays `0`
/// (`surfaceTintColor: transparent`); draw these on the widget's own
/// `Container`/`DecoratedBox` (Material tonal elevation cannot express two
/// layers). This file is exempt from token_guard.
class AppShadows {
  AppShadows._();

  static const _l = AppColors.lShadowBase; // warm brown-black #3A2E1E

  // e1 — resting card / list tile / input
  static final List<BoxShadow> e1 = [
    BoxShadow(color: _l.withValues(alpha: 0.04), offset: const Offset(0, 1), blurRadius: 3),
    BoxShadow(color: _l.withValues(alpha: 0.06), offset: const Offset(0, 2), blurRadius: 6, spreadRadius: -1),
  ];

  // e2 — raised / hover / the one focal card / result masthead
  static final List<BoxShadow> e2 = [
    BoxShadow(color: _l.withValues(alpha: 0.05), offset: const Offset(0, 2), blurRadius: 6),
    BoxShadow(color: _l.withValues(alpha: 0.09), offset: const Offset(0, 8), blurRadius: 20, spreadRadius: -4),
  ];

  // e3 — dialog / menu / floating CTA bar / floating nav
  static final List<BoxShadow> e3 = [
    BoxShadow(color: _l.withValues(alpha: 0.06), offset: const Offset(0, 4), blurRadius: 10),
    BoxShadow(color: _l.withValues(alpha: 0.14), offset: const Offset(0, 16), blurRadius: 40, spreadRadius: -8),
  ];

  // e4 — bottom sheet / modal
  static final List<BoxShadow> e4 = [
    BoxShadow(color: _l.withValues(alpha: 0.08), offset: const Offset(0, 8), blurRadius: 16),
    BoxShadow(color: _l.withValues(alpha: 0.20), offset: const Offset(0, 28), blurRadius: 64, spreadRadius: -12),
  ];

  // Dark: floating key shadow (sheets/dialogs only) + 1px top highlight border.
  static final List<BoxShadow> dKey = [
    BoxShadow(color: Colors.black.withValues(alpha: 0.45), offset: const Offset(0, 16), blurRadius: 48, spreadRadius: -12),
  ];
  static final Border dTopHighlight =
      Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.05), width: 1));

  // Signature saffron glow — CTA / mic orb only, never repeated. Production
  // saffron (light #E0924D) / dark saffron (#EB9447), matching the brand primary.
  static final List<BoxShadow> ctaGlowLight = [
    BoxShadow(color: const Color(0xFFE0924D).withValues(alpha: 0.30), offset: const Offset(0, 6), blurRadius: 18, spreadRadius: -4),
  ];
  static final List<BoxShadow> dSaffronGlow = [
    BoxShadow(color: const Color(0xFFEB9447).withValues(alpha: 0.22), offset: const Offset(0, 6), blurRadius: 24, spreadRadius: -6),
  ];

  // Back-compat aliases so existing call sites keep compiling during migration.
  static final List<BoxShadow> soft = e1;
  static final List<BoxShadow> elevated = e2;
  static final List<BoxShadow> floating = e3;
}
