import 'package:flutter/material.dart';

/// [ScrollBehavior] that removes the overscroll glow and rubber-band stretch
/// on iOS/macOS, mimicking Instagram's clamping scroll (no bounce, no glow).
///
/// Usage: pass to [MaterialApp.scrollBehavior] or [MaterialApp.router.scrollBehavior].
class NoOverscrollBehavior extends ScrollBehavior {
  const NoOverscrollBehavior();

  @override
  ScrollPhysics getScrollPhysics(BuildContext context) {
    // Use clamping physics everywhere (Android default) — no rubber-band.
    return const ClampingScrollPhysics();
  }

  @override
  Widget buildOverscrollIndicator(
    BuildContext context,
    Widget child,
    ScrollableDetails details,
  ) {
    // Disable the overscroll glow indicator entirely.
    return child;
  }

  @override
  TargetPlatform getPlatform(BuildContext context) {
    // Pretend we're on Android everywhere so the framework doesn't
    // apply iOS-specific scroll behavior.
    return TargetPlatform.android;
  }
}