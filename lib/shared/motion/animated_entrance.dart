import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../core/theme/app_theme.dart';

/// Reduce-motion helper (PREMIUM_DESIGN_SPEC.md §4). Every animation site checks
/// this and degrades to the final composed frame when it is false.
extension MotionContext on BuildContext {
  bool get motionEnabled =>
      !(MediaQuery.maybeOf(this)?.disableAnimations ?? false);
}

/// Max number of items that carry a staggered offset; beyond this the stagger
/// would feel slow, so later items share the last slot's delay.
const int kStaggerCap = 8;

/// List / card entrance (§4): `fadeIn` + `moveY 12→0`, small 240ms easeOutQuart,
/// staggered 55ms per item (capped at [kStaggerCap]). One-shot, once per mount.
/// Returns [child] unchanged when motion is disabled.
Widget staggeredItem(BuildContext context, Widget child, {int index = 0}) {
  if (!context.motionEnabled) return child;
  final i = index.clamp(0, kStaggerCap - 1);
  return child
      .animate(delay: AppMotion.stagger * i)
      .fadeIn(duration: AppMotion.small, curve: AppMotion.easeOutQuart)
      .moveY(
        begin: 12,
        end: 0,
        duration: AppMotion.small,
        curve: AppMotion.easeOutQuart,
      );
}

/// Signature result reveal — "Ink-settle" (§4): each block `fadeIn` +
/// `moveY 8→0`, medium 320ms easeOutQuart, staggered per block so the document
/// assembles itself. One-shot. Returns [child] unchanged when motion is off.
Widget inkSettle(BuildContext context, Widget child, {int index = 0}) {
  if (!context.motionEnabled) return child;
  final i = index.clamp(0, kStaggerCap - 1);
  return child
      .animate(delay: AppMotion.stagger * i)
      .fadeIn(duration: AppMotion.medium, curve: AppMotion.easeOutQuart)
      .moveY(
        begin: 8,
        end: 0,
        duration: AppMotion.medium,
        curve: AppMotion.easeOutQuart,
      );
}

/// Declarative wrapper for [staggeredItem], convenient inside a `children:` list.
class AnimatedEntrance extends StatelessWidget {
  const AnimatedEntrance({super.key, required this.child, this.index = 0});

  final Widget child;
  final int index;

  @override
  Widget build(BuildContext context) =>
      staggeredItem(context, child, index: index);
}
