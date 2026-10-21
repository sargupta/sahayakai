import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_skeleton.dart';

/// An answer-shaped shimmer: a meta chip row and a card of prose lines with a
/// short last line, so the wait reads as "your answer is being written" rather
/// than a bare spinner. See DESIGN_RUBRIC §6.
class InstantAnswerSkeleton extends StatelessWidget {
  const InstantAnswerSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SkeletonShimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          const SkeletonBar(height: SkeletonBar.heading, widthFactor: 0.5),
          const SizedBox(height: AppSpacing.space4),
          Container(
            padding: const EdgeInsets.all(AppSpacing.space4),
            decoration: BoxDecoration(
              color: scheme.surfaceContainer,
              borderRadius: AppRadius.rLg,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                const SkeletonBar(
                  height: SkeletonBar.subtitle,
                  widthFactor: 0.6,
                ),
                const SizedBox(height: AppSpacing.space4),
                for (final width in const <double>[1, 1, 0.9, 1, 0.45]) ...[
                  SkeletonBar(widthFactor: width),
                  const SizedBox(height: AppSpacing.space3),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
