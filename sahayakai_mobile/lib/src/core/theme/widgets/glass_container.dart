import 'dart:ui';
import 'package:flutter/material.dart';

class GlassContainer extends StatelessWidget {
  final Widget child;
  final double blur;
  final double opacity;
  final BorderRadius radius;
  final Color tint;
  final double borderOpacity;

  const GlassContainer({
    super.key,
    required this.child,
    this.blur = 20,
    this.opacity = 0.12,
    this.borderOpacity = 0.25,
    required this.radius,
    required this.tint,
  });

  @override
  Widget build(BuildContext context) {
    // Performance: Skip blur on low-end devices or if user requested reduced motion
    final disableAnimations = MediaQuery.of(context).disableAnimations;

    if (disableAnimations) {
      return Container(
        decoration: BoxDecoration(
          color: tint.withOpacity(opacity * 2.0), // Higher opacity fallback
          borderRadius: radius,
          border: Border.all(
            color: Colors.white.withOpacity(borderOpacity),
            width: 1,
          ),
        ),
        child: child,
      );
    }

    return ClipRRect(
      borderRadius: radius,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: Container(
          decoration: BoxDecoration(
            color: tint.withOpacity(opacity),
            borderRadius: radius,
            border: Border.all(
              color: Colors.white.withOpacity(borderOpacity),
              width: 1,
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}
