import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../domain/teacher_advice.dart';

/// One coaching-advice point, in the app's single card grammar: the strategy as
/// the card title, the pedagogical principle as a small accent tag, and the
/// explanation as Indic-safe AI prose. Each of the three is rendered only when
/// the model actually returned it, so a partial point never shows a blank slot.
class AdviceCard extends StatelessWidget {
  const AdviceCard({super.key, required this.point});

  final TeacherAdvicePoint point;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;

    final children = <Widget>[
      if (point.strategy.isNotEmpty) Text(point.strategy, style: text.titleMedium),
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
    );
  }
}
