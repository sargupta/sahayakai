import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// The v2 screen ground (`PhoneScreen`): the [AppGradients.washScreen] wash
/// with the [AppGradients.glowSaffron] disc off the top-right corner, behind
/// [child].
///
/// Painted under EVERY page route by `LiftSettleTransitionsBuilder`, because
/// the light scaffold is transparent (`app_theme.dart`): each page carries
/// its own opaque wash, so glass cards read as glass everywhere and a pushed
/// page still fully covers the page beneath it mid-transition.
class ScreenWash extends StatelessWidget {
  const ScreenWash({super.key, required this.child, this.wash});

  final Widget child;

  /// Overrides the light wash — [AppGradients.washWorking] while VIDYA
  /// writes, [AppGradients.washCall] during a live call.
  final Gradient? wash;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(gradient: wash ?? AppGradients.washScreen),
      child: Stack(
        children: [
          Positioned(
            top: AppGradients.glowOffset.dy,
            right: AppGradients.glowOffset.dx,
            width: AppGradients.glowSize,
            height: AppGradients.glowSize,
            child: const IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: AppGradients.glowSaffron,
                ),
              ),
            ),
          ),
          Positioned.fill(child: child),
        ],
      ),
    );
  }
}
