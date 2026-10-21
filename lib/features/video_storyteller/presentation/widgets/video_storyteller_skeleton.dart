import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_skeleton.dart';

/// A video-browse-shaped shimmer: a short "message" line, a section heading, and
/// two video-card placeholders (a 16:9 thumbnail block over a title and a meta
/// line), so the wait reads as "your videos are being gathered" rather than a
/// bare spinner. See DESIGN_RUBRIC §6.
class VideoStorytellerSkeleton extends StatelessWidget {
  const VideoStorytellerSkeleton({super.key});

  /// A 16:9 thumbnail placeholder at the tool form's capped content width. Kept
  /// generous so the shimmer previews a real video card, not a text block.
  static const double _thumbBlock = 176;

  @override
  Widget build(BuildContext context) {
    return const SkeletonShimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // The personalized-message intro.
          SkeletonBar(widthFactor: 0.9),
          SizedBox(height: AppSpacing.space3),
          SkeletonBar(widthFactor: 0.6),
          SizedBox(height: AppSpacing.space8),
          // A category heading.
          SkeletonBar(height: SkeletonBar.subtitle, widthFactor: 0.5),
          SizedBox(height: AppSpacing.space4),
          _CardSkeleton(thumb: _thumbBlock),
          SizedBox(height: AppSpacing.space4),
          _CardSkeleton(thumb: _thumbBlock),
        ],
      ),
    );
  }
}

class _CardSkeleton extends StatelessWidget {
  const _CardSkeleton({required this.thumb});

  final double thumb;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        SkeletonBlock(height: thumb),
        const SizedBox(height: AppSpacing.space3),
        const SkeletonBar(widthFactor: 0.85),
        const SizedBox(height: AppSpacing.space2),
        const SkeletonBar(widthFactor: 0.45),
      ],
    );
  }
}
