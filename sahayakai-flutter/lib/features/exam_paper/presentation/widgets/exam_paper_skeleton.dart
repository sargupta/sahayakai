import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_skeleton.dart';

/// An exam-paper-shaped shimmer for the 120 s generation window: a title bar, a
/// couple of instruction lines, and two section-sized blocks, so the wait reads
/// as "your paper is being built", not a bare spinner. See DESIGN_RUBRIC §6.
class ExamPaperSkeleton extends StatelessWidget {
  const ExamPaperSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const SkeletonShimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          SkeletonBar(height: SkeletonBar.title, widthFactor: 0.7),
          SizedBox(height: AppSpacing.space3),
          SkeletonBar(widthFactor: 0.9),
          SizedBox(height: AppSpacing.space2),
          SkeletonBar(widthFactor: 0.6),
          SizedBox(height: AppSpacing.space6),
          // Two sections' worth of question cards.
          SkeletonBlock(),
          SizedBox(height: AppSpacing.space4),
          SkeletonBlock(),
        ],
      ),
    );
  }
}
