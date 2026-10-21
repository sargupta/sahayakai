import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../domain/teacher_advice.dart';

/// One coaching-advice point, rendered as a numbered inset card inside the
/// result [DocumentSheet] (PREMIUM_DESIGN_SPEC.md §5 — the U8 numbered-item
/// grammar): a saffron numeral medallion, the strategy as the card title, the
/// pedagogical principle as a small accent tag, and the explanation as
/// Indic-safe AI prose. Each of the three is rendered only when the model
/// actually returned it, so a partial point never shows a blank slot.
class AdviceCard extends StatelessWidget {
  const AdviceCard({super.key, required this.index, required this.point});

  /// The 1-based position of this point, shown in the numeral medallion.
  final int index;
  final TeacherAdvicePoint point;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;

    final children = <Widget>[
      if (point.strategy.isNotEmpty)
        Text(point.strategy, style: text.titleMedium),
      // The pedagogical principle behind the strategy — the "why" named. A pill
      // hugs its content, so it sits left rather than stretching the card width.
      if (point.pedagogy.isNotEmpty)
        Align(
          alignment: Alignment.centerLeft,
          child: AppBadge(
            icon: LucideIcons.lightbulb,
            label: point.pedagogy,
            tone: AppBadgeTone.accent,
          ),
        ),
      if (point.explanation.isNotEmpty) AiText(point.explanation),
    ];

    return AppCard(
      variant: AppCardVariant.inset,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Medallion(index: index),
          const SizedBox(width: AppSpacing.space3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var i = 0; i < children.length; i++) ...[
                  if (i > 0) const SizedBox(height: AppSpacing.space3),
                  children[i],
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The saffron numeral medallion that numbers an advice point (mirrors U8).
class _Medallion extends StatelessWidget {
  const _Medallion({required this.index});

  final int index;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Container(
      width: 32,
      height: 32,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: scheme.primaryContainer,
      ),
      child: Text(
        '$index',
        style: text.labelLarge?.copyWith(
          color: scheme.onPrimaryContainer,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
