import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../../core/theme/app_theme.dart';

/// Paints a shimmer over its subtree with the app's two skeleton tones.
///
/// Every skeleton wrapped identical `Shimmer.fromColors` colours; this is the
/// one place that pairing lives now.
class SkeletonShimmer extends StatelessWidget {
  const SkeletonShimmer({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Shimmer.fromColors(
      baseColor: scheme.surfaceContainer,
      highlightColor: scheme.surfaceContainerHigh,
      child: child,
    );
  }
}

/// One left-aligned shimmer bar: a placeholder for a line of text.
///
/// Heights are the named §0-grid constants below, so every skeleton draws a
/// "title" or a "body line" at the SAME size instead of the old drift (26 vs
/// 32 titles, 14dp body lines off the grid entirely).
class SkeletonBar extends StatelessWidget {
  const SkeletonBar({super.key, this.height = line, this.widthFactor = 1});

  final double height;
  final double widthFactor;

  /// A page or answer heading. (§0 grid: 32)
  static const double heading = AppSpacing.space8;

  /// A card title. (§0 grid: 24)
  static const double title = AppSpacing.space6;

  /// A section title or a card's inner heading. (§0 grid: 20)
  static const double subtitle = AppSpacing.space5;

  /// A body / meta line. (§0 grid: 12)
  static const double line = AppSpacing.space3;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Align(
      alignment: Alignment.centerLeft,
      child: FractionallySizedBox(
        alignment: Alignment.centerLeft,
        widthFactor: widthFactor,
        child: Container(
          height: height,
          decoration: BoxDecoration(
            color: scheme.surfaceContainer,
            borderRadius: AppRadius.rSm,
          ),
        ),
      ),
    );
  }
}

/// A card-sized shimmer block: a placeholder for a question or activity card.
/// Carries the card radius ([AppRadius.rLg]), unlike the text-line [SkeletonBar].
class SkeletonBlock extends StatelessWidget {
  const SkeletonBlock({super.key, this.height = card});

  final double height;

  /// A generation-result card placeholder. (§0 grid: 128)
  static const double card = AppSpacing.space32;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: scheme.surfaceContainer,
        borderRadius: AppRadius.rLg,
      ),
    );
  }
}

/// Shimmer skeleton that mimics the shape of loaded content — never a bare
/// centered spinner for content areas. See DESIGN_RUBRIC §6.
class AppSkeleton extends StatelessWidget {
  const AppSkeleton({super.key, this.lines = 3});

  final int lines;

  @override
  Widget build(BuildContext context) {
    return SkeletonShimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          const SkeletonBar(height: SkeletonBar.subtitle, widthFactor: 0.6),
          const SizedBox(height: AppSpacing.space3),
          for (var i = 0; i < lines; i++) ...[
            const SkeletonBar(),
            const SizedBox(height: AppSpacing.space2),
          ],
          const SizedBox(height: AppSpacing.space2),
          const SkeletonBlock(),
        ],
      ),
    );
  }
}
