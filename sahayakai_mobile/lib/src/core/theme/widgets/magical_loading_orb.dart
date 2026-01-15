import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

class MagicalLoadingOrb extends StatelessWidget {
  final Gradient gradient;
  final double size;

  const MagicalLoadingOrb({
    super.key,
    required this.gradient,
    this.size = 80,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // 1. Outer Bloom (Breathing)
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: gradient,
            ),
          )
              .animate(onPlay: (c) => c.repeat(reverse: true))
              .blur(
                  begin: const Offset(10, 10),
                  end: const Offset(20, 20),
                  duration: 2000.ms)
              .scale(
                  begin: const Offset(0.8, 0.8),
                  end: const Offset(1.1, 1.1),
                  duration: 2000.ms)
              .fadeOut(begin: 0.3, duration: 2000.ms),

          // 2. Rotating Ring (Cognition)
          Container(
            width: size * 0.7,
            height: size * 0.7,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border:
                  Border.all(width: 4, color: Colors.white.withOpacity(0.5)),
              gradient: SweepGradient(
                colors: [
                  Colors.transparent,
                  Colors.white.withOpacity(0.8),
                  Colors.transparent,
                ],
              ),
            ),
          ).animate(onPlay: (c) => c.repeat()).rotate(duration: 3000.ms),

          // 3. Core Pulse (Heartbeat)
          Container(
            width: size * 0.3,
            height: size * 0.3,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.white,
                  blurRadius: 10,
                  spreadRadius: 2,
                )
              ],
            ),
          ).animate(onPlay: (c) => c.repeat(reverse: true)).scale(
              begin: const Offset(1.0, 1.0),
              end: const Offset(1.2, 1.2),
              duration: 1000.ms),
        ],
      ),
    );
  }
}
