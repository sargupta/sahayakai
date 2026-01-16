import 'package:flutter/material.dart';

/// A mesh gradient background with multiple radial gradients
/// Creates depth and visual interest inspired by the Quiz reference design
///
/// Usage:
/// ```dart
/// MeshBackground(
///   child: YourContent(),
/// )
/// ```
class MeshBackground extends StatelessWidget {
  final Widget child;
  final List<MeshGradientPoint>? gradientPoints;

  const MeshBackground({
    super.key,
    required this.child,
    this.gradientPoints,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Default gradient points matching the Quiz reference
    final defaultPoints = isDark ? _darkModePoints() : _lightModePoints();
    final points = gradientPoints ?? defaultPoints;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF022C22) : const Color(0xFFF0FDF4),
      ),
      child: Stack(
        children: [
          // Radial gradient layers
          ...points.map((point) => Positioned.fill(
                child: Align(
                  alignment: point.alignment,
                  child: Container(
                    width: double.infinity,
                    height: double.infinity,
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        center: point.alignment,
                        radius: point.radius,
                        colors: [
                          point.color.withOpacity(point.opacity),
                          point.color.withOpacity(0),
                        ],
                        stops: const [0.0, 0.5],
                      ),
                    ),
                  ),
                ),
              )),
          // Content
          child,
        ],
      ),
    );
  }

  List<MeshGradientPoint> _lightModePoints() {
    return [
      const MeshGradientPoint(
        alignment: Alignment.topLeft,
        color: Color(0xFF14B8A6), // Teal
        radius: 1.2,
        opacity: 0.15,
      ),
      const MeshGradientPoint(
        alignment: Alignment.topRight,
        color: Color(0xFFFF9933), // Saffron
        radius: 1.2,
        opacity: 0.1,
      ),
      const MeshGradientPoint(
        alignment: Alignment.bottomRight,
        color: Color(0xFF10B981), // Emerald
        radius: 1.2,
        opacity: 0.15,
      ),
      const MeshGradientPoint(
        alignment: Alignment.bottomLeft,
        color: Color(0xFF14B8A6), // Teal
        radius: 1.2,
        opacity: 0.1,
      ),
    ];
  }

  List<MeshGradientPoint> _darkModePoints() {
    return [
      const MeshGradientPoint(
        alignment: Alignment.topLeft,
        color: Color(0xFF064E3B), // Dark green
        radius: 1.0,
        opacity: 0.5,
      ),
      const MeshGradientPoint(
        alignment: Alignment.bottomRight,
        color: Color(0xFF14B8A6), // Teal
        radius: 1.5,
        opacity: 0.2,
      ),
    ];
  }
}

/// Configuration for a single gradient point in the mesh
class MeshGradientPoint {
  final Alignment alignment;
  final Color color;
  final double radius;
  final double opacity;

  const MeshGradientPoint({
    required this.alignment,
    required this.color,
    this.radius = 1.0,
    this.opacity = 0.15,
  });
}
