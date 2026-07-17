import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../../../../core/theme/app_theme.dart';

/// A lesson-plan-shaped shimmer placeholder for the 120 s generation window —
/// a title bar, a meta row and two activity blocks so the wait reads as
/// "your plan is being built", not a bare spinner. See DESIGN_RUBRIC §6.
class LessonPlanSkeleton extends StatelessWidget {
  const LessonPlanSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Shimmer.fromColors(
      baseColor: scheme.surfaceContainer,
      highlightColor: scheme.surfaceContainerHigh,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          _bar(scheme, height: 26, widthFactor: 0.7),
          const SizedBox(height: AppSpacing.space3),
          _bar(scheme, height: 14, widthFactor: 0.45),
          const SizedBox(height: AppSpacing.space6),
          _block(scheme),
          const SizedBox(height: AppSpacing.space4),
          _block(scheme),
        ],
      ),
    );
  }

  Widget _block(ColorScheme scheme) {
    return Container(
      height: 132,
      decoration: BoxDecoration(
        color: scheme.surfaceContainer,
        borderRadius: AppRadius.rLg,
      ),
    );
  }

  Widget _bar(
    ColorScheme scheme, {
    required double height,
    double widthFactor = 1,
  }) {
    return Align(
      alignment: Alignment.centerLeft,
      child: FractionallySizedBox(
        alignment: Alignment.centerLeft,
        widthFactor: widthFactor,
        child: Container(
          height: height,
          decoration: BoxDecoration(
            color: scheme.surfaceContainer,
            borderRadius: AppRadius.rSm,
          ),
        ),
      ),
    );
  }
}
