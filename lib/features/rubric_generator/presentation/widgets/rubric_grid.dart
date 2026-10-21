import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../domain/rubric.dart';

/// The rubric, rendered STACKED — one card per criterion, its performance
/// levels listed vertically inside it, highest score first (v3 screen 10:
/// "stacked, no sideways table"). This replaces the earlier criteria × levels
/// `Table` that scrolled sideways: on a 360dp phone a four-column grid forced a
/// horizontal scroller the design explicitly retired.
///
/// THE LAYOUT CONTRACT (DESIGN_RUBRIC §8, and the known ToolScaffold crash):
///  - Everything is a vertical [Column]; there is NO horizontal scroller and no
///    `Table`, so the page's own vertical `SingleChildScrollView` is the only
///    scroller and the sideways-scroll crash class simply cannot occur.
///  - Every height is content-driven (no banned fixed row heights), so Indic
///    wrapping and textScale 1.3 grow each level row safely.
///  - Rank reads through a green→saffron→red colour ramp on each level's number
///    chip (4 = strongest, down to 1), derived from theme roles by lerp so it
///    needs no off-token colours and adapts to any level count.
class RubricGrid extends StatelessWidget {
  const RubricGrid({super.key, required this.rubric});

  final Rubric rubric;

  @override
  Widget build(BuildContext context) {
    final criteria = rubric.criteria;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < criteria.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space3),
          _CriterionBlock(criterion: criteria[i]),
        ],
      ],
    );
  }
}

/// One criterion as a card: its name and description, then each performance
/// level as a colour-ranked row.
class _CriterionBlock extends StatelessWidget {
  const _CriterionBlock({required this.criterion});

  final RubricCriterion criterion;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final levels = criterion.levels;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: AppRadius.rLg,
        border: Border.all(color: scheme.outline, width: 1),
        boxShadow: AppShadows.soft,
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.space4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (criterion.name.isNotEmpty)
              Text(criterion.name, style: text.titleSmall),
            if (criterion.name.isNotEmpty && criterion.description != null)
              const SizedBox(height: AppSpacing.space2),
            if (criterion.description != null)
              AiText(criterion.description!, muted: true),
            if (levels.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.space3),
              for (var i = 0; i < levels.length; i++) ...[
                if (i > 0) const SizedBox(height: AppSpacing.space2),
                _LevelRow(
                  level: levels[i],
                  color: _rankColor(scheme, i, levels.length),
                  fallbackRank: levels.length - i,
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  /// The rank ramp: strongest level green, weakest red, through saffron in the
  /// middle. Built by lerping theme roles so it stays on-token and scales to any
  /// level count. `i` is 0 for the top level.
  Color _rankColor(ColorScheme scheme, int i, int count) {
    final f = count <= 1 ? 0.0 : i / (count - 1);
    if (f <= 0.5) {
      return Color.lerp(scheme.secondary, scheme.primary, f / 0.5)!;
    }
    return Color.lerp(scheme.primary, scheme.error, (f - 0.5) / 0.5)!;
  }
}

/// One performance level: a colour-ranked number chip, the level name, and what
/// performance at that level looks like.
class _LevelRow extends StatelessWidget {
  const _LevelRow({
    required this.level,
    required this.color,
    required this.fallbackRank,
  });

  final RubricLevel level;
  final Color color;

  /// Shown on the chip when the model gave no points (descending rank).
  final int fallbackRank;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    // Darken the ramp colour for the chip fill so a WHITE numeral is legible
    // across the whole range (saffron-on-white alone would not clear contrast).
    final fill = Color.alphaBlend(Colors.black.withValues(alpha: 0.2), color);
    final label = level.pointsLabel ?? '$fallbackRank';

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.space2,
            vertical: 3,
          ),
          decoration: BoxDecoration(color: fill, borderRadius: AppRadius.rSm),
          alignment: Alignment.center,
          child: Text(
            label,
            style: text.labelSmall?.copyWith(
              color: scheme.onPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.space3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (level.name.isNotEmpty) ...[
                Text(level.name, style: text.labelMedium),
                const SizedBox(height: AppSpacing.space1),
              ],
              AiText(level.description),
            ],
          ),
        ),
      ],
    );
  }
}
