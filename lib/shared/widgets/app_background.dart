import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_gradients.dart';

/// Reusable app-wide background for the reference "Two periods, one prep gap"
/// screen. A soft diagonal wash (peach → blush → sage → cream) plus a single
/// radial saffron glow bleeding off the top-right corner. Static — no animation,
/// no blur filter. Edge-to-edge behind status bar and bottom nav.
class AppBackground extends StatelessWidget {
  const AppBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // Diagonal 4-stop pastel wash (the reference background).
        Positioned.fill(
          child: DecoratedBox(
            decoration: const BoxDecoration(gradient: AppGradients.washDefault),
          ),
        ),
        // Single soft saffron orb bleeding off the top-right corner.
        Positioned(
          top: -46,
          right: -54,
          width: 214,
          height: 214,
          child: DecoratedBox(
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: AppGradients.glowSaffron,
            ),
          ),
        ),
        child,
      ],
    );
  }
}