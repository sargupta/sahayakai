import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_skeleton.dart';

/// A quiz-shaped shimmer placeholder for the 120 s generation window — a title
/// bar, a difficulty-tab strip and three question blocks, so the wait reads as
/// "your quiz is being written", not a bare spinner. See DESIGN_RUBRIC §6.
class QuizSkeleton extends StatelessWidget {
  const QuizSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonShimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          const SkeletonBar(height: SkeletonBar.title, widthFactor: 0.65),
          const SizedBox(height: AppSpacing.space3),
          const SkeletonBar(widthFactor: 0.4),
          const SizedBox(height: AppSpacing.space6),
          // The difficulty tab strip.
          const SkeletonBar(height: AppSpacing.space10),
          const SizedBox(height: AppSpacing.space6),
          for (var i = 0; i < 3; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.space3),
            const SkeletonBlock(),
          ],
        ],
      ),
    );
  }
}
