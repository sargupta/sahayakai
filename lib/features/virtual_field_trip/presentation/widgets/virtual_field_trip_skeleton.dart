import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_skeleton.dart';

/// An itinerary-shaped shimmer: a title line, a meta line, and two stop-card
/// placeholders (a heading over a few body lines and a "fact" block), so the wait
/// reads as "your field trip is being planned" rather than a bare spinner. See
/// DESIGN_RUBRIC §6.
class VirtualFieldTripSkeleton extends StatelessWidget {
  const VirtualFieldTripSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const SkeletonShimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Masthead: the trip title + a meta line.
          SkeletonBar(height: SkeletonBar.heading, widthFactor: 0.8),
          SizedBox(height: AppSpacing.space3),
          SkeletonBar(widthFactor: 0.5),
          SizedBox(height: AppSpacing.space8),
          _StopSkeleton(),
          SizedBox(height: AppSpacing.space6),
          _StopSkeleton(),
        ],
      ),
    );
  }
}

/// One stop-card placeholder: a heading, two body lines, and a fact-block.
class _StopSkeleton extends StatelessWidget {
  const _StopSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        SkeletonBar(height: SkeletonBar.subtitle, widthFactor: 0.6),
        SizedBox(height: AppSpacing.space3),
        SkeletonBar(widthFactor: 0.95),
        SizedBox(height: AppSpacing.space2),
        SkeletonBar(widthFactor: 0.85),
        SizedBox(height: AppSpacing.space3),
        SkeletonBlock(height: 72),
      ],
    );
  }
}
