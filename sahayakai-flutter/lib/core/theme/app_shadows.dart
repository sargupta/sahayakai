import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Web-parity soft shadow grammar. Do NOT use Material's default heavy
/// tonal elevations. See THEME_SPEC.md §4 / DESIGN_RUBRIC.md §0.
class AppShadows {
  AppShadows._();

  static const _b = AppColors.shadowBase;

  /// Card at rest: 0 1px 2px /.04, 0 1px 3px /.03.
  static final List<BoxShadow> soft = [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.04),
      offset: const Offset(0, 1),
      blurRadius: 2,
    ),
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.03),
      offset: const Offset(0, 1),
      blurRadius: 3,
    ),
  ];

  /// Hover / pressed / important: 0 4px 12px /.08, 0 2px 4px /.04.
  static final List<BoxShadow> elevated = [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.08),
      offset: const Offset(0, 4),
      blurRadius: 12,
      spreadRadius: -2,
    ),
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.04),
      offset: const Offset(0, 2),
      blurRadius: 4,
      spreadRadius: -2,
    ),
  ];

  /// Dialogs, sheets, bottom-nav: 0 16px 40px /.12.
  static final List<BoxShadow> floating = [
    BoxShadow(
      color: _b.withValues(alpha: 0.12),
      offset: const Offset(0, 16),
      blurRadius: 40,
    ),
  ];
}
