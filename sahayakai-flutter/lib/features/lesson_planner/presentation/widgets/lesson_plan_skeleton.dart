import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_skeleton.dart';

/// A lesson-plan-shaped shimmer placeholder for the 120 s generation window —
/// a title bar, a meta row and two activity blocks so the wait reads as
/// "your plan is being built", not a bare spinner. See DESIGN_RUBRIC §6.
class LessonPlanSkeleton extends StatelessWidget {
  const LessonPlanSkeleton({super.key});

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
          for (var i = 0; i < 2; i++) ...[
            // The activity cards sit space3 apart in the real result, so the
            // wait mirrors that gap (the skeleton used to drift to space4).
            if (i > 0) const SizedBox(height: AppSpacing.space3),
            const SkeletonBlock(),
          ],
        ],
      ),
    );
  }
}
