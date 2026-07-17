import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_skeleton.dart';

/// A rubric-shaped shimmer for the 120 s generation window: a title bar, a
/// description line, and a grid-sized block, so the wait reads as "your rubric
/// is being built", not a bare spinner. See DESIGN_RUBRIC §6.
class RubricSkeleton extends StatelessWidget {
  const RubricSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonShimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          const SkeletonBar(height: SkeletonBar.title, widthFactor: 0.65),
          const SizedBox(height: AppSpacing.space3),
          const SkeletonBar(widthFactor: 0.9),
          const SizedBox(height: AppSpacing.space2),
          const SkeletonBar(widthFactor: 0.75),
          const SizedBox(height: AppSpacing.space6),
          // The criteria x levels grid.
          const SkeletonBlock(),
        ],
      ),
    );
  }
}
