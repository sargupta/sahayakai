import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_skeleton.dart';

/// An advice-shaped shimmer for the long generation window: a meta line, an
/// introduction paragraph, a section label and two advice-card blocks, so the
/// wait reads as "your advice is being written", not a bare spinner. See
/// DESIGN_RUBRIC §6.
class TeacherTrainingSkeleton extends StatelessWidget {
  const TeacherTrainingSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonShimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Grade / subject meta.
          const SkeletonBar(height: SkeletonBar.subtitle, widthFactor: 0.5),
          const SizedBox(height: AppSpacing.space4),
          // The introduction paragraph.
          const SkeletonBar(widthFactor: 0.95),
          const SizedBox(height: AppSpacing.space2),
          const SkeletonBar(widthFactor: 0.75),
          const SizedBox(height: AppSpacing.space6),
          // The "Strategies" label.
          const SkeletonBar(height: SkeletonBar.title, widthFactor: 0.35),
          const SizedBox(height: AppSpacing.space3),
          // Two advice cards.
          const SkeletonBlock(),
          const SizedBox(height: AppSpacing.space3),
          const SkeletonBlock(),
        ],
      ),
    );
  }
}
