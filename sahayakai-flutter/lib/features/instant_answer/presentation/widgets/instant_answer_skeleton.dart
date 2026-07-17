import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../../../../core/theme/app_theme.dart';

/// An answer-shaped shimmer: a meta chip row and a card of prose lines with a
/// short last line, so the wait reads as "your answer is being written" rather
/// than a bare spinner. See DESIGN_RUBRIC §6.
class InstantAnswerSkeleton extends StatelessWidget {
  const InstantAnswerSkeleton({super.key});

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
          _bar(scheme, height: 32, widthFactor: 0.5),
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
                _bar(scheme, height: 20, widthFactor: 0.6),
                const SizedBox(height: AppSpacing.space4),
                for (final width in const <double>[1, 1, 0.9, 1, 0.45]) ...[
                  _bar(scheme, height: 14, widthFactor: width),
                  const SizedBox(height: AppSpacing.space3),
                ],
              ],
            ),
          ),
        ],
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
