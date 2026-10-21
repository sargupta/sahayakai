import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_skeleton.dart';

/// A worksheet-shaped shimmer placeholder for the 120 s generation window — a
/// title bar, a couple of objective lines and two activity blocks, so the wait
/// reads as "your worksheet is being written", not a bare spinner. See
/// DESIGN_RUBRIC §6.
class WorksheetSkeleton extends StatelessWidget {
  const WorksheetSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonShimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          const SkeletonBar(height: SkeletonBar.title, widthFactor: 0.7),
          const SizedBox(height: AppSpacing.space3),
          const SkeletonBar(widthFactor: 0.45),
          const SizedBox(height: AppSpacing.space6),
          // Learning-objective lines.
          const SkeletonBar(widthFactor: 0.9),
          const SizedBox(height: AppSpacing.space2),
          const SkeletonBar(widthFactor: 0.8),
          const SizedBox(height: AppSpacing.space6),
          // Activity cards.
          for (var i = 0; i < 2; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.space3),
            const SkeletonBlock(),
          ],
        ],
      ),
    );
  }
}
