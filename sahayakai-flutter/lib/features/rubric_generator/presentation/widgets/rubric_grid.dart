import 'package:flutter/material.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../domain/rubric.dart';

/// The rubric grid: criteria (rows) x performance levels (columns).
///
/// THE LAYOUT CONTRACT (DESIGN_RUBRIC §8, and the known ToolScaffold crash):
///  - The grid can be WIDE (a criterion column plus one column per level). It
///    lives inside ITS OWN bounded, horizontally-scrolling box, so the page (the
///    ToolScaffold's vertical `SingleChildScrollView`) never scrolls sideways.
///  - The single horizontal [SingleChildScrollView] wraps a [Table]. A `Table`
///    with fixed column widths has a definite width (it scrolls) and a
///    content-driven height (it does NOT — no banned fixed row heights, so Indic
///    wrapping and textScale 1.3 grow rows safely). That bounded-height child is
///    what keeps the horizontal scroller legal inside the outer vertical column
///    (an unbounded child there is the crash).
///  - Columns stay aligned across every criterion because it is ONE table in ONE
///    scroller, not a per-row scroller. The criterion column is column 0 and
///    scrolls with the grid; a frozen column is not attempted because pinning it
///    without banned fixed row heights (or a linked-scroll dependency) cannot
///    keep the pinned cell aligned with its wrapping, variable-height row.
class RubricGrid extends StatelessWidget {
  const RubricGrid({super.key, required this.rubric});

  final Rubric rubric;

  /// The criterion (first) column. Wide enough to read a criterion name and its
  /// short description without cramping; content-driven height wraps within it.
  static const double _criterionWidth = 168;

  /// Each performance-level column. Fixed WIDTH only (never height): a fixed
  /// text height is what DESIGN_RUBRIC §7 bans, not a fixed column width.
  static const double _levelWidth = 188;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final headerLevels = rubric.headerLevels;

    // No levels at all (a partial response) — a grid is meaningless, so fall
    // back to a readable, full-width stack of the criteria that DID arrive.
    if (headerLevels.isEmpty) {
      return _CriteriaFallback(criteria: rubric.criteria);
    }

    final levelCount = rubric.levelCount;

    final columnWidths = <int, TableColumnWidth>{
      0: const FixedColumnWidth(_criterionWidth),
      for (var i = 1; i <= levelCount; i++)
        i: const FixedColumnWidth(_levelWidth),
    };

    final rows = <TableRow>[
      _headerRow(context, headerLevels),
      for (final criterion in rubric.criteria)
        _criterionRow(context, criterion, levelCount),
    ];

    // Card grammar (§5): surface, radius 12, 1dp outline, shadowSoft. The outer
    // border is the crisp rounded edge; the Table draws only the INNER grid
    // lines, so the two never double up. ClipRRect keeps the scrolled content
    // inside the rounded corners.
    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: AppRadius.rLg,
        border: Border.all(color: scheme.outline, width: 1),
        boxShadow: AppShadows.soft,
      ),
      child: ClipRRect(
        borderRadius: AppRadius.rLg,
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Table(
            columnWidths: columnWidths,
            defaultVerticalAlignment: TableCellVerticalAlignment.top,
            border: TableBorder(
              horizontalInside: BorderSide(color: scheme.outlineVariant),
              verticalInside: BorderSide(color: scheme.outlineVariant),
            ),
            children: rows,
          ),
        ),
      ),
    );
  }

  TableRow _headerRow(BuildContext context, List<RubricLevel> headerLevels) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return TableRow(
      // A tinted header row reads as the column key without a saffron flood.
      decoration: BoxDecoration(color: scheme.surfaceContainerHigh),
      children: [
        _Cell(
          child: Text(
            context.l10n.rubricCriteriaColumn,
            style: text.labelMedium?.copyWith(
              color: scheme.onSurfaceVariant,
              letterSpacing: 0.4,
            ),
          ),
        ),
        for (final level in headerLevels) _LevelHeader(level: level),
      ],
    );
  }

  TableRow _criterionRow(
    BuildContext context,
    RubricCriterion criterion,
    int levelCount,
  ) {
    return TableRow(
      children: [
        _CriterionCell(criterion: criterion),
        for (var i = 0; i < levelCount; i++)
          _Cell(
            child: i < criterion.levels.length
                ? AiText(criterion.levels[i].description)
                : const SizedBox.shrink(),
          ),
      ],
    );
  }
}

/// A grid cell: the one padding used everywhere in the table.
class _Cell extends StatelessWidget {
  const _Cell({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.space3),
      child: child,
    );
  }
}

class _LevelHeader extends StatelessWidget {
  const _LevelHeader({required this.level});

  final RubricLevel level;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final points = level.pointsLabel;
    return _Cell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (level.name.isNotEmpty)
            Text(
              level.name,
              style: text.titleSmall?.copyWith(letterSpacing: 0.2),
            ),
          if (points != null) ...[
            const SizedBox(height: AppSpacing.space2),
            AppBadge(
              label: context.l10n.rubricPoints(points),
              tone: AppBadgeTone.accent,
              size: AppBadgeSize.small,
            ),
          ],
        ],
      ),
    );
  }
}

class _CriterionCell extends StatelessWidget {
  const _CriterionCell({required this.criterion});

  final RubricCriterion criterion;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return _Cell(
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
        ],
      ),
    );
  }
}

/// When the model returned criteria but no performance levels, a grid has
/// nothing to array. The criteria still carry value, so they are shown as a
/// plain full-width stack rather than an empty table.
class _CriteriaFallback extends StatelessWidget {
  const _CriteriaFallback({required this.criteria});

  final List<RubricCriterion> criteria;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < criteria.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space3),
          _CriterionCell(criterion: criteria[i]),
        ],
      ],
    );
  }
}
