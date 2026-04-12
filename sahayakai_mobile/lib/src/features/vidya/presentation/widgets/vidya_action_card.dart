import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../domain/vidya_models.dart';

/// Tappable card shown in chat when VIDYA suggests a NAVIGATE_AND_FILL action.
class VidyaActionCard extends StatelessWidget {
  final VidyaAction action;

  const VidyaActionCard({super.key, required this.action});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: () => context.push(action.routePath, extra: action.params),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: GlassColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(GlassRadius.sm),
            ),
            child: Icon(
              _iconForFlow(action.flow),
              color: GlassColors.primary,
              size: 24,
            ),
          ),
          const SizedBox(width: GlassSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(action.label, style: GlassTypography.labelLarge()),
                if (action.params['topic'] != null)
                  Text(
                    action.params['topic'] as String,
                    style: GlassTypography.bodySmall(
                        color: GlassColors.textSecondary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          Icon(
            Icons.arrow_forward_rounded,
            color: GlassColors.primary,
            size: 20,
          ),
        ],
      ),
    );
  }

  IconData _iconForFlow(String flow) {
    switch (flow) {
      case 'lesson-plan':
        return Icons.book_rounded;
      case 'quiz-generator':
        return Icons.extension_rounded;
      case 'worksheet-wizard':
        return Icons.assignment_rounded;
      case 'visual-aid-designer':
        return Icons.image_rounded;
      case 'rubric-generator':
        return Icons.grading_rounded;
      case 'exam-paper':
        return Icons.description_rounded;
      default:
        return Icons.auto_awesome_rounded;
    }
  }
}
