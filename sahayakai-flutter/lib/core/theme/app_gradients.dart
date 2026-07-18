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

  /// 3% vertical warm wash — scaffold body.
  static const lightPaper = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFFFBF7F0), Color(0xFFF1EADD)],
  );

  /// 8%→0% saffron top-right corner — hero only.
  static const lightHeroWash = RadialGradient(
    center: Alignment(1.0, -1.0),
    radius: 1.2,
    colors: [Color(0x14C2410C), Color(0x00C2410C)],
  );

  /// Warm center-top → darker edges — dark scaffold body.
  static const darkVignette = RadialGradient(
    center: Alignment(0.0, -0.6),
    radius: 1.4,
    colors: [Color(0xFF1E1811), Color(0xFF140F09)],
  );

  /// 3px saffron ribbon: primary → primary@0.
  static const accentBar = LinearGradient(
    colors: [Color(0xFFC2410C), Color(0x00C2410C)],
  );
}
