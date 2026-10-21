import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// Lift-&-Settle page transition (PREMIUM_DESIGN_SPEC.md §4). The incoming page
/// slides in from +0.06x, fades, and settles from scale 0.985→1 on the
/// `emphasized` curve; the outgoing page recedes to 0.99 scale / 0.85 opacity.
///
/// Honours reduce-motion (`MediaQuery.disableAnimations`) by cross-fading only
/// — the final composed frame, no travel. Animates only opacity / transform, so
/// nothing reflows mid-push.
class LiftSettleTransitionsBuilder extends PageTransitionsBuilder {
  const LiftSettleTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (reduce) {
      return FadeTransition(opacity: animation, child: child);
    }

    final enter = CurvedAnimation(
      parent: animation,
      curve: AppMotion.emphasized,
      reverseCurve: AppMotion.emphasized.flipped,
    );
    final recede = CurvedAnimation(
      parent: secondaryAnimation,
      curve: AppMotion.emphasized,
    );

    // Outgoing page recedes as a new one covers it.
    Widget result = FadeTransition(
      opacity: Tween<double>(begin: 1.0, end: 0.85).animate(recede),
      child: ScaleTransition(
        scale: Tween<double>(begin: 1.0, end: 0.99).animate(recede),
        child: child,
      ),
    );

    // Incoming page lifts in and settles.
    result = FadeTransition(
      opacity: enter,
      child: SlideTransition(
        position: Tween<Offset>(begin: const Offset(0.06, 0), end: Offset.zero)
            .animate(enter),
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.985, end: 1.0).animate(enter),
          child: result,
        ),
      ),
    );

    return result;
  }
}
