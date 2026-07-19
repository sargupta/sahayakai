import 'package:flutter/material.dart';

/// Barely-there texture — PREMIUM_DESIGN_SPEC.md §2.4 (LOCKED sanctioned set).
///
/// Paint [lightPaper] / [darkVignette] as a `DecoratedBox` behind scaffold
/// content, never as `scaffoldBackgroundColor` (that must stay a solid
/// `Color`). [lightHeroWash] only on the dashboard hero and
/// marketing/onboarding, never behind dense content.
///
/// BANNED (still): mesh gradients, glassmorphism blur panels, gradient-filled
/// text, multi-stop rainbow, any gradient behind body text. If a gradient is
/// noticeable at a glance, it is too strong. This file is exempt from
/// token_guard.
class AppGradients {
  AppGradients._();

  /// ~2% vertical wash around the warm off-white ground — scaffold body.
  static const lightPaper = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFFF9F7F3), Color(0xFFF0EEE9)],
  );

  /// 8%→0% saffron top-right corner — hero only.
  static const lightHeroWash = RadialGradient(
    center: Alignment(1.0, -1.0),
    radius: 1.2,
    colors: [Color(0x14E0924D), Color(0x00E0924D)],
  );

  /// Cool center-top → darker edges — dark scaffold body (production near-black).
  static const darkVignette = RadialGradient(
    center: Alignment(0.0, -0.6),
    radius: 1.4,
    colors: [Color(0xFF181A21), Color(0xFF0E1014)],
  );

  /// 3px saffron ribbon: primary → primary@0.
  static const accentBar = LinearGradient(
    colors: [Color(0xFFE0924D), Color(0x00E0924D)],
  );
}
