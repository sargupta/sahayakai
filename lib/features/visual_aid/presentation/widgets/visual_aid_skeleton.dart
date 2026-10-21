import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_skeleton.dart';

/// A drawing-shaped shimmer: a large image block over a short "how to use" heading
/// and a couple of prose lines, so the wait reads as "your drawing is being
/// prepared" rather than a bare spinner. See DESIGN_RUBRIC §6.
class VisualAidSkeleton extends StatelessWidget {
  const VisualAidSkeleton({super.key});

  /// The image placeholder height. Taller than the default card block so the
  /// shimmer previews the hero drawing rather than a text card.
  static const double _imageBlock = 192;

  @override
  Widget build(BuildContext context) {
    return const SkeletonShimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          SkeletonBlock(height: _imageBlock),
          SizedBox(height: AppSpacing.space6),
          SkeletonBar(height: SkeletonBar.subtitle, widthFactor: 0.5),
          SizedBox(height: AppSpacing.space4),
          SkeletonBar(widthFactor: 1),
          SizedBox(height: AppSpacing.space3),
          SkeletonBar(widthFactor: 0.9),
          SizedBox(height: AppSpacing.space3),
          SkeletonBar(widthFactor: 0.45),
        ],
      ),
    );
  }
}
