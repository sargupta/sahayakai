import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_skeleton.dart';

/// A scorecard-shaped shimmer for the (slow, expensive) grading window — a hero
/// score block, then two question-card blocks and a next-steps stub — so the
/// wait reads as "your answer sheet is being graded", not a bare spinner.
/// Multi-page OCR + rubric scoring is among the slowest paths on the backend, so
/// the skeleton matters here. See DESIGN_RUBRIC §6.
class AssessmentScannerSkeleton extends StatelessWidget {
  const AssessmentScannerSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonShimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // The hero score gauge.
          const SkeletonBlock(height: 120),
          const SizedBox(height: AppSpacing.space6),
          // The "question-by-question" heading.
          const SkeletonBar(height: SkeletonBar.subtitle, widthFactor: 0.55),
          const SizedBox(height: AppSpacing.space3),
          // Per-question cards.
          for (var i = 0; i < 2; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.space3),
            const SkeletonBlock(),
          ],
          const SizedBox(height: AppSpacing.space6),
          // Next-steps stub.
          const SkeletonBar(height: SkeletonBar.subtitle, widthFactor: 0.5),
          const SizedBox(height: AppSpacing.space3),
          const SkeletonBar(widthFactor: 0.95),
          const SizedBox(height: AppSpacing.space2),
          const SkeletonBar(widthFactor: 0.85),
        ],
      ),
    );
  }
}
