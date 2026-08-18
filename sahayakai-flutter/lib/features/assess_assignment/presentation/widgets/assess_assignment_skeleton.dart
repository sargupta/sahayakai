import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_skeleton.dart';

/// A scorecard-shaped shimmer for the (slow, expensive) grading window — a
/// score block, a couple of transcript lines and two criterion blocks — so the
/// wait reads as "your assessment is being graded", not a bare spinner. This
/// model is the slowest on the backend (gemini-2.5-pro), so the skeleton
/// matters more here than anywhere. See DESIGN_RUBRIC §6.
class AssessAssignmentSkeleton extends StatelessWidget {
  const AssessAssignmentSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonShimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // The score card.
          const SkeletonBlock(height: 96),
          const SizedBox(height: AppSpacing.space6),
          // Transcript lines.
          const SkeletonBar(height: SkeletonBar.subtitle, widthFactor: 0.5),
          const SizedBox(height: AppSpacing.space3),
          const SkeletonBar(widthFactor: 0.95),
          const SizedBox(height: AppSpacing.space2),
          const SkeletonBar(widthFactor: 0.85),
          const SizedBox(height: AppSpacing.space6),
          // Per-criterion cards.
          for (var i = 0; i < 2; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.space3),
            const SkeletonBlock(),
          ],
        ],
      ),
    );
  }
}
