import 'package:flutter/material.dart';

import 'app_colors.dart';

/// SahayakAI Gradients — Design System v3 (canonical).
///
/// **App screens use a soft four-stop pastel wash (peach → blush → sage → cream, ~168°)**
/// plus one saffron radial glow bleeding off the top-right corner.
///
/// Each of the 16 canonical screens shifts the stops slightly (by only a few hex steps).
/// These are the exact gradients from SahayakAI Mobile v3.dc.html frame styles.
///
/// No photos, patterns or textures. Surfaces are type- and colour-led.
class AppGradients {
  AppGradients._();

  // =========================================================================
  // 4-STOP PASTEL WASHES — one per canonical screen (168°)
  //
  // Each wash reproduces the design HTML's `linear-gradient(168deg, …)`.
  // CSS angles are ABSOLUTE (0° = to top, clockwise), so 168° is a
  // near-vertical axis falling slightly right. Flutter's GradientRotation
  // SUBTRACTS from the begin/end axis: the axis starts vertical
  // (topCenter → bottomCenter) and rotates by 180 − 168 = 12°. Rotating
  // a topLeft → bottomRight diagonal by 168° instead netted ~350°
  // (up-left) and flipped the blush/sage stops backwards.
  // =========================================================================

  /// Default / Voice Home (Screen 02) — `#FFF3E4 → #FDEFEE → #EFF4EE → #FFF7EC`
  static const LinearGradient washDefault = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: [0.0, 0.36, 0.72, 1.0],
    colors: [
      Color(0xFFFFF3E4),
      Color(0xFFFDEFEE),
      Color(0xFFEFF4EE),
      Color(0xFFFFF7EC),
    ],
    transform: GradientRotation(12 * 3.14159 / 180),
  );

  /// Onboarding (Screen 01) — `#FFF2E0 → #FCEEEC → #EFF4EE → #FFF7EC`
  static const LinearGradient washOnboarding = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: [0.0, 0.36, 0.72, 1.0],
    colors: [
      Color(0xFFFFF2E0),
      Color(0xFFFCEEEC),
      Color(0xFFEFF4EE),
      Color(0xFFFFF7EC),
    ],
    transform: GradientRotation(12 * 3.14159 / 180),
  );

  /// Listening (Screen 04) — `#FFF1DF → #FBEDEA → #F3F1EA → #FFF6E9`
  static const LinearGradient washListening = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: [0.0, 0.30, 0.60, 1.0],
    colors: [
      Color(0xFFFFF1DF),
      Color(0xFFFBEDEA),
      Color(0xFFF3F1EA),
      Color(0xFFFFF6E9),
    ],
    transform: GradientRotation(10 * 3.14159 / 180),
  );

  /// Lesson Composer (Screen 05) — `#FFF5E7 → #FBF0EF → #F0F4EE → #FFF8F0`
  static const LinearGradient washComposer = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: [0.0, 0.38, 0.74, 1.0],
    colors: [
      Color(0xFFFFF5E7),
      Color(0xFFFBF0EF),
      Color(0xFFF0F4EE),
      Color(0xFFFFF8F0),
    ],
    transform: GradientRotation(12 * 3.14159 / 180),
  );

  /// Working (Screen 06) — COOL INDIGO WASH `#F1F3FB → #EDEFF8 → #F5F2EC → #FBF7F1`
  static const LinearGradient washWorking = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: [0.0, 0.34, 0.70, 1.0],
    colors: [
      Color(0xFFF1F3FB),
      Color(0xFFEDEFF8),
      Color(0xFFF5F2EC),
      Color(0xFFFBF7F1),
    ],
    transform: GradientRotation(12 * 3.14159 / 180),
  );

  /// Lesson Output (Screen 07) — `#FFF6EA → #F9F1EE → #EFF4EE → #FFF8F0`
  static const LinearGradient washLessonOutput = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: [0.0, 0.38, 0.74, 1.0],
    colors: [
      Color(0xFFFFF6EA),
      Color(0xFFF9F1EE),
      Color(0xFFEFF4EE),
      Color(0xFFFFF8F0),
    ],
    transform: GradientRotation(12 * 3.14159 / 180),
  );

  /// Deliver Tray (Screen 08) — same as Lesson Output
  static const LinearGradient washDeliverTray = washLessonOutput;

  /// Quiz Output (Screen 09) — `#FFF5E7 → #FBF0EF → #F0F4EE → #FFF8F0`
  static const LinearGradient washQuiz = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: [0.0, 0.38, 0.74, 1.0],
    colors: [
      Color(0xFFFFF5E7),
      Color(0xFFFBF0EF),
      Color(0xFFF0F4EE),
      Color(0xFFFFF8F0),
    ],
    transform: GradientRotation(12 * 3.14159 / 180),
  );

  /// Rubric (Screen 10) — `#FFF6EA → #F8F2EE → #EFF3EE → #FFF8F0`
  static const LinearGradient washRubric = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: [0.0, 0.38, 0.74, 1.0],
    colors: [
      Color(0xFFFFF6EA),
      Color(0xFFF8F2EE),
      Color(0xFFEFF3EE),
      Color(0xFFFFF8F0),
    ],
    transform: GradientRotation(12 * 3.14159 / 180),
  );

  /// Scanner (Screen 11) — light warm wash (dark surface removed per user request)
  static const LinearGradient washScanner = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: [0.0, 0.36, 0.72, 1.0],
    colors: [
      Color(0xFFFFF3E4),
      Color(0xFFFDEFEE),
      Color(0xFFEFF4EE),
      Color(0xFFFFF7EC),
    ],
    transform: GradientRotation(12 * 3.14159 / 180),
  );

  /// Scan Results (Screen 12) — `#FFF5E8 → #FAF1EE → #EFF4EE → #FFF8F0`
  static const LinearGradient washScanResults = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: [0.0, 0.38, 0.74, 1.0],
    colors: [
      Color(0xFFFFF5E8),
      Color(0xFFFAF1EE),
      Color(0xFFEFF4EE),
      Color(0xFFFFF8F0),
    ],
    transform: GradientRotation(12 * 3.14159 / 180),
  );

  /// Roll Call (Screen 13) — `#FFF4E6 → #F9F1EE → #EFF4EE → #FFF8F0`
  static const LinearGradient washRollCall = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: [0.0, 0.38, 0.74, 1.0],
    colors: [
      Color(0xFFFFF4E6),
      Color(0xFFF9F1EE),
      Color(0xFFEFF4EE),
      Color(0xFFFFF8F0),
    ],
    transform: GradientRotation(12 * 3.14159 / 180),
  );

  /// Parent Call (Screen 14) — SAGE GREEN WASH `#F1F6F1 → #EAF2EA → #F3F6F0 → #F8FAF6`
  static const LinearGradient washParentCall = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: [0.0, 0.40, 0.74, 1.0],
    colors: [
      Color(0xFFF1F6F1),
      Color(0xFFEAF2EA),
      Color(0xFFF3F6F0),
      Color(0xFFF8FAF6),
    ],
    transform: GradientRotation(12 * 3.14159 / 180),
  );

  /// Community (Screen 15) — `#FFF4E6 → #FBEFEF → #EFF4EE → #FFF8F0`
  static const LinearGradient washCommunity = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: [0.0, 0.36, 0.72, 1.0],
    colors: [
      Color(0xFFFFF4E6),
      Color(0xFFFBEFEF),
      Color(0xFFEFF4EE),
      Color(0xFFFFF8F0),
    ],
    transform: GradientRotation(12 * 3.14159 / 180),
  );

  /// Offline & You (Screen 16) — `#FFF6EA → #F8F2EE → #EFF3EE → #FFF8F0`
  static const LinearGradient washOffline = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: [0.0, 0.38, 0.74, 1.0],
    colors: [
      Color(0xFFFFF6EA),
      Color(0xFFF8F2EE),
      Color(0xFFEFF3EE),
      Color(0xFFFFF8F0),
    ],
    transform: GradientRotation(12 * 3.14159 / 180),
  );

  // =========================================================================
  // SAFFRON RADIAL GLOW — top-right bleed (onboarding & home)
  // =========================================================================
  /// ~214px circle, radial at 38%/32%, `rgba(255,214,170,.78) → rgba(201,106,40,0) 76%`
  /// Positioned `top: -46px; right: -54px` on 360×760 frame. The center is
  /// resolved WITHIN the 214px div: CSS `38% 32%` → Alignment(0.38·2−1,
  /// 0.32·2−1). Radius = the CSS farthest-corner line (197.5px) / 214 ≈ 0.923.
  static const RadialGradient glowSaffron = RadialGradient(
    center: Alignment(-0.24, -0.36), // 38%/32% inside the 214px div
    radius: 0.923,
    stops: [0.0, 0.76],
    colors: [
      Color(0xC7FFD6AA), // rgba(255,214,170,.78)
      // Transparent twin of the start color, not rgba(201,106,40,0):
      // CSS interpolates gradient stops premultiplied (the end RGB never
      // contributes), while Skia lerps straight — reusing the start RGB
      // makes the fade color-constant, matching the design pixel-for-pixel.
      Color(0x00FFD6AA),
    ],
  );

  // =========================================================================
  // WEBSITE GRADIENTS (marketing site — not used in app)
  // =========================================================================
  static const LinearGradient lightPaper = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: [0.0, 1.0],
    colors: [Color(0xFFFFF6EC), Color(0xFFFFF8F1)],
  );

  static const LinearGradient darkVignette = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: [0.0, 0.5, 1.0],
    colors: [Color(0xFF1B1713), Color(0xFF171310), Color(0xFF13100D)],
  );

  static const LinearGradient lightHeroWash = LinearGradient(
    begin: Alignment.topRight,
    end: Alignment.bottomLeft,
    stops: [0.0, 0.5, 1.0],
    colors: [Color(0xFFFFD6AA), Color(0xFFFFF8F3), Color(0xFFFFF8F3)],
  );

  static const LinearGradient accentBar = LinearGradient(
    colors: [AppColors.saffron500, AppColors.saffron400],
  );

  // =========================================================================
  // GLASS SHEEN — diagonal saffron tint (used by AppGlass)
  // =========================================================================
  static const LinearGradient lSheenGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    stops: [0.0, 0.5, 1.0],
    colors: [
      Color(0x0AC96A28), // ~4% saffron
      Color(0x00C96A28),
      Color(0x0AC96A28),
    ],
  );

  static const LinearGradient dSheenGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    stops: [0.0, 0.5, 1.0],
    colors: [
      Color(0x14FFD9AE), // ~8% saffron-200
      Color(0x00FFD9AE),
      Color(0x14FFD9AE),
    ],
  );

  // =========================================================================
  // GLASS BORDERS — 1px 95% white edge highlight
  // =========================================================================
  static const LinearGradient lBorderGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xF2FFFFFF), Color(0xCCFFFFFF)],
  );

  static const LinearGradient dBorderGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0x33FFFFFF), Color(0x1AFFFFFF)],
  );
}