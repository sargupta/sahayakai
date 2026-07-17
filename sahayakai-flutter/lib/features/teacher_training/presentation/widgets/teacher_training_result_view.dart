import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/section_label.dart';
import '../../domain/teacher_advice.dart';
import 'advice_card.dart';

/// Renders a [TeacherAdvice] result: the grade/subject it was pitched at, the
/// introduction prose, the list of advice cards under a "Strategies" heading,
/// and the closing prose. Everything is left-aligned; the introduction and
/// conclusion use the Indic-safe AI-prose metrics and the advice list is a plain
/// vertical column of cards, so the page only ever scrolls vertically.
class TeacherTrainingResultView extends StatelessWidget {
  const TeacherTrainingResultView({super.key, required this.advice});

  final TeacherAdvice advice;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    // The model can come back with nothing usable; that is an empty state the
    // teacher can act on, not a blank card.
    if (advice.isEmpty) {
      return EmptyView(
        message: l10n.teacherTrainingNoContent,
        icon: LucideIcons.messagesSquare,
      );
    }

    final points = advice.advice;

    final sections = <Widget>[
      if (advice.gradeLevel != null || advice.subject != null)
        _MetaRow(advice: advice),
      if (advice.introduction.isNotEmpty) AiText(advice.introduction),
      if (points.isNotEmpty)
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            SectionLabel(l10n.teacherTrainingStrategiesTitle),
            const SizedBox(height: AppSpacing.space3),
            for (final (index, point) in points.indexed) ...[
              if (index > 0) const SizedBox(height: AppSpacing.space3),
              AdviceCard(point: point),
            ],
          ],
        ),
      if (advice.conclusion.isNotEmpty) AiText(advice.conclusion, muted: true),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < sections.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space4),
          sections[i],
        ],
      ],
    );
  }
}

/// The grade / subject the advice was pitched at. The envelope echoes what the
/// flow resolved (it infers these when the form does not give them), so this is
/// what the advice is actually written for.
class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.advice});

  final TeacherAdvice advice;

  @override
  Widget build(BuildContext context) {
    final chips = <Widget>[
      if (advice.gradeLevel != null)
        AppBadge(icon: LucideIcons.graduationCap, label: advice.gradeLevel!),
      if (advice.subject != null)
        AppBadge(icon: LucideIcons.bookOpen, label: advice.subject!),
    ];
    if (chips.isEmpty) return const SizedBox.shrink();

    return Wrap(
      spacing: AppSpacing.space2,
      runSpacing: AppSpacing.space2,
      children: chips,
    );
  }
}
