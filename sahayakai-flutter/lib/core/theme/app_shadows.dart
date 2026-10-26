import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Shadows — design system v2 (`shadow-*` in `tokens.json`).
///
/// Warm, low and rare. Only the primary card on a screen is raised
/// ([card]); floating chrome uses [float], sheets [sheet]. Brand elements
/// cast saffron light: [cta] on the primary button, [orb] on VIDYA. Never an
/// inner shadow. Each token is a single CSS `box-shadow` layer, ported as
/// one [BoxShadow] (CSS blur radius = Flutter `blurRadius`).
///
/// The pre-v2 elevation names (`e1`…`e4`) are aliases of the v2 token each
/// role now maps to. Dark keeps its pre-v2 key shadow (dark mode is an open
/// founder decision). This file is exempt from token_guard.
class AppShadows {
  AppShadows._();

  static const _ink = AppColors.ink900;
  static const _saffron = AppColors.saffron500;

  static List<BoxShadow> _one(Color c, double a, double y, double blur) => [
    BoxShadow(
      color: c.withValues(alpha: a),
      offset: Offset(0, y),
      blurRadius: blur,
    ),
  ];

  // ---- v2 tokens ----
  static final List<BoxShadow> float = _one(_ink, 0.1, 8, 22); // shadow-float
  static final List<BoxShadow> card = _one(_ink, 0.06, 8, 20); // shadow-card
  static final List<BoxShadow> panel = _one(_ink, 0.06, 10, 30); // shadow-panel
  static final List<BoxShadow> sheet = _one(_ink, 0.18, -14, 40); // shadow-sheet
  static final List<BoxShadow> hint = _one(_ink, 0.1, 8, 20); // shadow-hint
  static final List<BoxShadow> post = _one(_ink, 0.06, 6, 16); // shadow-post
  static final List<BoxShadow> prompt = _one(_ink, 0.14, 10, 28); // shadow-prompt
  static final List<BoxShadow> cta = _one(_saffron, 0.34, 10, 26); // shadow-cta
  static final List<BoxShadow> ctaSm = _one(_saffron, 0.34, 8, 22); // shadow-cta-sm
  static final List<BoxShadow> mic = _one(_saffron, 0.36, 5, 14); // shadow-mic
  static final List<BoxShadow> current = _one(_saffron, 0.18, 8, 22); // shadow-current
  static final List<BoxShadow> orb = _one(_saffron, 0.42, 10, 26); // shadow-orb

  // ---- pre-v2 roles ----
  /// Resting card / list tile: v2 cards are flat, the edge does the work.
  static final List<BoxShadow> e1 = post;

  /// The one raised card on a screen.
  static final List<BoxShadow> e2 = card;

  /// Floating chrome: the tab bar, menus, a floating action bar.
  static final List<BoxShadow> e3 = float;

  /// Bottom sheets and modals.
  static final List<BoxShadow> e4 = sheet;

  // Dark: floating key shadow (sheets/dialogs only) + 1px top highlight border.
  static final List<BoxShadow> dKey = [
    BoxShadow(color: Colors.black.withValues(alpha: 0.45), offset: const Offset(0, 16), blurRadius: 48, spreadRadius: -12),
  ];
  static final Border dTopHighlight =
      Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.05), width: 1));

  /// The saffron CTA glow (light = `shadow-cta`; dark unchanged).
  static final List<BoxShadow> ctaGlowLight = cta;
  static final List<BoxShadow> dSaffronGlow = [
    BoxShadow(color: const Color(0xFFEB9447).withValues(alpha: 0.22), offset: const Offset(0, 6), blurRadius: 24, spreadRadius: -6),
  ];

  // Back-compat aliases so existing call sites keep compiling.
  static final List<BoxShadow> soft = e1;
  static final List<BoxShadow> elevated = e2;
  static final List<BoxShadow> floating = e3;
}
