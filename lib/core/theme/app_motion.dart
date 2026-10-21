import 'package:flutter/material.dart';

/// Motion tokens — Design System v3 + PREMIUM_DESIGN_SPEC.md §4.
///
/// **Gentle and continuous. Nothing bounces.**
/// - Resting orb floats: 5.5s ease-in-out, translateY −7px, scale 1.035.
/// - Listening orb mic-pulses: 2s, scale 1.07, plus ring.
/// - Working orb pulses: 1.8s, scale 1.04.
/// - Step spinners "breathe" at 1.6s.
/// - UI transitions .24–.4s, standard easing `cubic-bezier(.4,0,.2,1)`.
/// - `prefers-reduced-motion` (`BuildContext.motionEnabled`, defined in
///   `shared/motion/animated_entrance.dart`) turns all of it off.
class AppMotion {
  AppMotion._();

  // ---------------------------------------------------------------------------
  // DURATIONS (legacy contract — names and roles unchanged)
  // ---------------------------------------------------------------------------

  static const Duration instant = Duration(milliseconds: 120); // color/opacity only
  static const Duration micro = Duration(milliseconds: 160); // tap depress, focus, hover
  static const Duration small = Duration(milliseconds: 240); // reveal, dropdown, chip select
  static const Duration medium = Duration(milliseconds: 320); // page, dialog, sheet, result card
  static const Duration large = Duration(milliseconds: 420); // hero / splash element (single)
  static const Duration stagger = Duration(milliseconds: 55); // per-item entrance offset

  // ---------------------------------------------------------------------------
  // CURVES (legacy contract — `standard` and `emphasized` are Curves)
  // ---------------------------------------------------------------------------

  static const Cubic easeOutQuart = Cubic(0.16, 1.0, 0.30, 1.0); // entrances, reveals, settle
  static const Cubic emphasized = Cubic(0.20, 0.00, 0.00, 1.0); // page/sheet/result
  static const Cubic standard = Cubic(0.40, 0.00, 0.20, 1.0); // theme cross-fade, toggle

  // ---------------------------------------------------------------------------
  // V3 AMBIENT MOTION — orb + spinners
  // ---------------------------------------------------------------------------

  /// Resting orb float: 5.5s ease-in-out (translateY −7px, scale 1.035).
  static const Duration orbFloat = Duration(milliseconds: 5500);

  /// Listening orb mic-pulse: 2s (scale 1.07 + ring).
  static const Duration orbListenPulse = Duration(milliseconds: 2000);

  /// Working orb pulse: 1.8s (scale 1.04).
  static const Duration orbWorkPulse = Duration(milliseconds: 1800);

  /// Step spinners "breathe": 1.6s.
  static const Duration orbBreathe = Duration(milliseconds: 1600);

  /// Sheet enter (v3: sheets settle in over 400ms).
  static const Duration sheetEnter = Duration(milliseconds: 400);
  static const Duration sheetExit = Duration(milliseconds: 300);

  /// Standard easing alias (same cubic-bezier(.4,0,.2,1)).
  static const Cubic standardEasing = standard;

  // Float tweens — resting orb: translateY −7px, scale 1.035.
  static final Tween<double> orbFloatTranslate = Tween<double>(begin: 0, end: -7);
  static final Tween<double> orbFloatScale = Tween<double>(begin: 1.0, end: 1.035);

  /// Whether motion should run (respects `prefers-reduced-motion`).
  static bool motionEnabled(BuildContext context) =>
      !(MediaQuery.maybeOf(context)?.disableAnimations ?? false);
}
