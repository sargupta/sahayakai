import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../../core/theme/app_theme.dart';

/// Shimmer skeleton that mimics the shape of loaded content — never a bare
/// centered spinner for content areas. See DESIGN_RUBRIC §6.
class AppSkeleton extends StatelessWidget {
  const AppSkeleton({super.key, this.lines = 3});

  final int lines;

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
          _bar(scheme, height: 20, widthFactor: 0.6),
          const SizedBox(height: AppSpacing.space3),
          for (var i = 0; i < lines; i++) ...[
            _bar(scheme, height: 14),
            const SizedBox(height: AppSpacing.space2),
          ],
          const SizedBox(height: AppSpacing.space2),
          _bar(scheme, height: 120),
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
