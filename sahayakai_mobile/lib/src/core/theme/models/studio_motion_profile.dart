import 'package:flutter/animation.dart';

class StudioMotionProfile {
  final Curve pageCurve;
  final Duration transition;
  final Curve thinkingCurve;
  // Motion Semantics for Visual Physics
  final double focusScale; // How much an active element grows (e.g. 1.05)
  final double bloomIntensity; // Strength of the glow effect (0.0 to 1.0)

  const StudioMotionProfile({
    required this.pageCurve,
    required this.transition,
    required this.thinkingCurve,
    this.focusScale = 1.0,
    this.bloomIntensity = 0.0,
  });
}
