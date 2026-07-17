import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../domain/rubric.dart';
import 'rubric_grid.dart';

/// Renders a generated [Rubric]: a header, the assignment description, and the
/// criteria x levels grid. The grid owns the only sideways scroll on the page
/// (see [RubricGrid]); everything above it is full-width, left-aligned prose.
class RubricResultView extends StatelessWidget {
  const RubricResultView({super.key, required this.rubric});

  final Rubric rubric;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    if (rubric.isEmpty) {
      return EmptyView(
        message: l10n.rubricNoContent,
        icon: LucideIcons.clipboardCheck,
      );
    }

    final hasHeader = rubric.title.isNotEmpty ||
        rubric.gradeLevel != null ||
        rubric.subject != null;
    final hasGrid = rubric.criteria.isNotEmpty;
    // The swipe affordance is only honest when the grid is actually a wide,
    // scrollable table (it has level columns to scroll through).
    final showScrollHint = rubric.levelCount > 0;

    final sections = <Widget>[
      if (hasHeader) _Header(rubric: rubric),
      if (rubric.description != null)
        AiText(rubric.description!, muted: true),
      if (hasGrid) ...[
        if (showScrollHint) const _ScrollHint(),
        RubricGrid(rubric: rubric),
      ],
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < sections.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.sectionGap),
          sections[i],
        ],
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.rubric});

  final Rubric rubric;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final meta = <Widget>[
      if (rubric.gradeLevel != null)
        AppBadge(icon: LucideIcons.graduationCap, label: rubric.gradeLevel!),
      if (rubric.subject != null)
        AppBadge(icon: LucideIcons.bookOpen, label: rubric.subject!),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (rubric.title.isNotEmpty)
          Text(rubric.title, style: text.headlineSmall),
        if (rubric.title.isNotEmpty && meta.isNotEmpty)
          const SizedBox(height: AppSpacing.space3),
        if (meta.isNotEmpty)
          Wrap(
            spacing: AppSpacing.space2,
            runSpacing: AppSpacing.space2,
            children: meta,
          ),
      ],
    );
  }
}

/// A muted "swipe across to see all levels" affordance: the grid scrolls
/// horizontally within its own box, and this tells the teacher so.
class _ScrollHint extends StatelessWidget {
  const _ScrollHint();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Row(
      children: [
        Icon(
          LucideIcons.moveHorizontal,
          size: AppIconSize.inline,
          color: scheme.onSurfaceVariant,
        ),
        const SizedBox(width: AppSpacing.space2),
        Flexible(
          child: Text(
            context.l10n.rubricScrollHint,
            style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
          ),
        ),
      ],
    );
  }
}
