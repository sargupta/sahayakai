import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_skeleton.dart';

/// A message-shaped shimmer for the generation window: a meta line, a block for
/// the drafted message, and two action-button placeholders, so the wait reads
/// as "your message is being written", not a bare spinner. See DESIGN_RUBRIC §6.
class ParentMessageSkeleton extends StatelessWidget {
  const ParentMessageSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonShimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Language / word-count meta.
          const SkeletonBar(height: SkeletonBar.subtitle, widthFactor: 0.45),
          const SizedBox(height: AppSpacing.space4),
          // The message body.
          const SkeletonBlock(),
          const SizedBox(height: AppSpacing.space4),
          // Copy + share action buttons.
          Row(
            children: const [
              Expanded(child: SkeletonBar(height: SkeletonBar.title)),
              SizedBox(width: AppSpacing.space3),
              Expanded(child: SkeletonBar(height: SkeletonBar.title)),
            ],
          ),
        ],
      ),
    );
  }
}
