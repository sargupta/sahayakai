import 'package:flutter/animation.dart';

/// Motion tokens. `easeOutQuart` is the SINGLE canonical curve — no other
/// custom curve is allowed in the codebase. See DESIGN_RUBRIC.md §0.
class AppMotion {
  AppMotion._();

  static const Duration micro = Duration(milliseconds: 150); // hover, tap, color
  static const Duration small = Duration(milliseconds: 250); // reveal, dropdown
  static const Duration medium = Duration(milliseconds: 350); // page, dialog, sheet

  static const Cubic easeOutQuart = Cubic(0.16, 1.0, 0.3, 1.0);
}
