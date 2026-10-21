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
    return const SkeletonShimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Grade / subject meta.
          SkeletonBar(height: SkeletonBar.subtitle, widthFactor: 0.5),
          SizedBox(height: AppSpacing.space4),
          // The introduction paragraph.
          SkeletonBar(widthFactor: 0.95),
          SizedBox(height: AppSpacing.space2),
          SkeletonBar(widthFactor: 0.75),
          SizedBox(height: AppSpacing.space6),
          // The "Strategies" label.
          SkeletonBar(height: SkeletonBar.title, widthFactor: 0.35),
          SizedBox(height: AppSpacing.space3),
          // Two advice cards.
          SkeletonBlock(),
          SizedBox(height: AppSpacing.space3),
          SkeletonBlock(),
        ],
      ),
    );
  }
}
