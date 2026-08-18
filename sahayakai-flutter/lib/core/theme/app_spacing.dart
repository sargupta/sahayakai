import 'package:flutter/widgets.dart';

/// 4dp-grid spacing scale — the ONLY sanctioned spacing values.
/// Allowed multiples: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128.
/// See DESIGN_RUBRIC.md §0 / §1. No off-grid magic numbers in screens.
class AppSpacing {
  AppSpacing._();

  static const double space1 = 4; // icon <-> label gap
  static const double space2 = 8; // tight internal
  static const double space3 = 12; // internal card gap
  static const double space4 = 16; // default card padding, form rows
  static const double space5 = 20; // card-section (tablet)
  static const double space6 = 24; // card padding (tablet), block gap
  static const double space8 = 32; // section gap
  static const double space10 = 40; // page top/bottom (tablet)
  static const double space12 = 48; // page section break
  static const double space16 = 64;
  static const double space20 = 80;
  static const double space24 = 96;
  static const double space32 = 128;

  /// Gap between two stacked sections (e.g. a tool's form and its result).
  /// A section break, so it resolves to the §0 section gap (32), NOT block
  /// spacing — the old `lg` alias pointed a section-level name at space6 (24).
  static const double sectionGap = space8; // 32

  /// Screen horizontal safe padding = 16 phone; vertical rhythm = 24.
  static const EdgeInsets pagePadding =
      EdgeInsets.symmetric(horizontal: space4, vertical: space6);

  /// Tablet page padding (>= 600dp width).
  static const EdgeInsets pagePaddingTablet =
      EdgeInsets.symmetric(horizontal: space6, vertical: space10);
}
