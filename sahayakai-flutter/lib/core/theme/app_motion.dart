import 'package:flutter/animation.dart';

/// Motion tokens — PREMIUM_DESIGN_SPEC.md §4 (LOCKED).
///
/// The sanctioned curve family is EXACTLY three: [easeOutQuart] (canonical
/// decelerate), [emphasized] (travels distance), [standard] (reversible /
/// symmetric). The lint/guard bans any other `Cubic`/`Curves.*`; bounce and
/// elastic stay banned. Everything degrades to an instant cross-fade when
/// `MediaQuery.disableAnimations` is true. Animate only opacity / transform /
/// pre-tuned shadow+color. This file is exempt from token_guard.
class AppMotion {
  AppMotion._();

  // Durations
  static const Duration instant = Duration(milliseconds: 120); // color/opacity only
  static const Duration micro = Duration(milliseconds: 160); // tap depress, focus, hover
  static const Duration small = Duration(milliseconds: 240); // reveal, dropdown, chip select
  static const Duration medium = Duration(milliseconds: 320); // page, dialog, sheet, result card
  static const Duration large = Duration(milliseconds: 420); // hero / splash element (single)
  static const Duration stagger = Duration(milliseconds: 55); // per-item entrance offset

  // Curves — the WHOLE sanctioned set.
  static const Cubic easeOutQuart = Cubic(0.16, 1.0, 0.30, 1.0); // entrances, reveals, settle
  static const Cubic emphasized = Cubic(0.20, 0.00, 0.00, 1.0); // page/sheet/result
  static const Cubic standard = Cubic(0.40, 0.00, 0.20, 1.0); // theme cross-fade, toggle
}
