import 'package:flutter/material.dart';

/// Responsive utilities for adapting to different screen sizes.
///
/// Usage:
/// ```dart
/// padding: EdgeInsets.all(GlassSpacing.lg * GlassResponsive.scale(context))
/// ```
class GlassResponsive {
  GlassResponsive._();

  /// Returns a scaling factor for spacing/sizing based on screen width.
  /// - Small phone (<400dp): 0.85
  /// - Normal phone (400-600dp): 1.0
  /// - Tablet portrait (600-900dp): 1.2
  /// - Tablet landscape (>900dp): 1.4
  static double scale(BuildContext context) {
    final w = MediaQuery.of(context).size.width;
    if (w < 400) return 0.85;
    if (w < 600) return 1.0;
    if (w < 900) return 1.2;
    return 1.4;
  }

  /// Max content width for result screens (prevents ultra-wide text on tablets).
  static const double maxContentWidth = 650;

  /// Wraps content in a centered ConstrainedBox for tablet-friendly layout.
  static Widget constrainedContent({required Widget child}) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: maxContentWidth),
        child: child,
      ),
    );
  }

  /// Returns true if the device is a tablet (>= 600dp width).
  static bool isTablet(BuildContext context) {
    return MediaQuery.of(context).size.width >= 600;
  }

  /// Returns true if the device is in landscape orientation.
  static bool isLandscape(BuildContext context) {
    return MediaQuery.of(context).orientation == Orientation.landscape;
  }
}
