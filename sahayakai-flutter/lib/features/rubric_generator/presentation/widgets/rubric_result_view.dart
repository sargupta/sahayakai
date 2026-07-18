import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/document_sheet.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/secondary_button.dart';
import '../../domain/rubric.dart';
import 'rubric_grid.dart';

/// Renders a generated [Rubric] as a printed document, not a chat dump
/// (PREMIUM_DESIGN_SPEC.md §5 / §6b U8 — the reference every other tool copies).
///
/// The rubric is wrapped in a [DocumentSheet]: a masthead ("RUBRIC" eyebrow, the
/// rubric title as a Fraunces title, saffron rule, grade/subject meta badges),
/// the assignment description, and the criteria x performance-levels grid.
///
/// THE LAYOUT CONTRACT (DESIGN_RUBRIC §8, and the known ToolScaffold crash): the
/// grid owns the ONLY sideways scroll on the page (see [RubricGrid]); it lives
/// inside its own bounded, horizontally-scrolling box INSIDE the DocumentSheet,
/// so the page (the ToolScaffold's vertical scroll view) never scrolls sideways.
/// Everything above the grid is full-width, left-aligned prose.
///
/// All model-authored prose flows through [AiText] (line-height 1.7 + Indic
/// height behaviour) so matras and vowel signs never clip. Each block inks in on
/// the Ink-settle reveal, and a footer action bar offers Regenerate / Copy.
class RubricResultView extends StatelessWidget {
  const RubricResultView({super.key, required this.rubric, this.onRegenerate});

  final Rubric rubric;

  /// Re-runs generation from the current form (the controller's `generate`).
  /// When null (e.g. a direct render in a test) the footer action bar is
  /// omitted.
  final VoidCallback? onRegenerate;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    if (rubric.isEmpty) {
      return EmptyView(
        message: l10n.rubricNoContent,
        icon: LucideIcons.clipboardCheck,
      );
    }

    final title = rubric.title.isNotEmpty ? rubric.title : l10n.rubricTitle;
    final hasGrid = rubric.criteria.isNotEmpty;
    // The swipe affordance is only honest when the grid is actually a wide,
    // scrollable table (it has level columns to scroll through).
    final showScrollHint = rubric.levelCount > 0;

    final meta = <Widget>[
      if (rubric.gradeLevel != null)
        AppBadge(
          icon: LucideIcons.graduationCap,
          label: rubric.gradeLevel!,
          tone: AppBadgeTone.accent,
        ),
      if (rubric.subject != null)
        AppBadge(icon: LucideIcons.bookOpen, label: rubric.subject!),
    ];

    // The document blocks, in reading order. Content is unchanged from the flat
    // renderer — only the composition around it is new. The grid keeps its own
    // bounded horizontal scroller.
    final blocks = <Widget>[
      if (rubric.description != null) AiText(rubric.description!, muted: true),
      if (hasGrid)
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (showScrollHint) ...[
              const _ScrollHint(),
              const SizedBox(height: AppSpacing.space3),
            ],
            RubricGrid(rubric: rubric),
          ],
        ),
    ];

    // Ink-settle: each block fades + rises in turn. Degrades to the static
    // composed frame under reduce-motion.
    final revealed = <Widget>[
      for (var i = 0; i < blocks.length; i++)
        inkSettle(context, blocks[i], index: i),
    ];

    return DocumentSheet(
      docType: l10n.rubricTitle,
      title: title,
      meta: meta,
      footer: onRegenerate == null
          ? null
          : _ActionBar(rubric: rubric, onRegenerate: onRegenerate!),
      children: revealed,
    );
  }
}

/// The document's action bar: Regenerate (secondary) over a Copy ghost. Copy
/// exports the rubric as plain text to the clipboard — a presentation-only
/// action, no controller involved.
class _ActionBar extends StatelessWidget {
  const _ActionBar({required this.rubric, required this.onRegenerate});

  final Rubric rubric;
  final VoidCallback onRegenerate;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final text = Theme.of(context).textTheme;
    final saffron = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;
    final messenger = ScaffoldMessenger.of(context);

    void copy() {
      Clipboard.setData(ClipboardData(text: _rubricAsText(rubric, l10n)));
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(l10n.copyConfirmation)));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        SecondaryButton(
          label: l10n.actionRegenerate,
          icon: LucideIcons.refreshCw,
          onPressed: onRegenerate,
        ),
        const SizedBox(height: AppSpacing.space2),
        SizedBox(
          height: 48,
          child: TextButton.icon(
            onPressed: copy,
            icon: const Icon(LucideIcons.copy, size: AppIconSize.inline),
            label: Text(l10n.actionCopy),
            style: TextButton.styleFrom(
              foregroundColor: saffron,
              textStyle: text.labelLarge,
            ),
          ),
        ),
      ],
    );
  }
}

/// A plain-text export of the rubric — the assignment, then each criterion with
/// its performance levels — for the clipboard.
String _rubricAsText(Rubric rubric, AppLocalizations l10n) {
  final b = StringBuffer();
  if (rubric.title.isNotEmpty) b.writeln(rubric.title);
  final metaBits =
      [rubric.gradeLevel, rubric.subject].whereType<String>().toList();
  if (metaBits.isNotEmpty) b.writeln(metaBits.join(' · '));
  if (rubric.description != null) {
    b
      ..writeln()
      ..writeln(rubric.description);
  }
  for (final criterion in rubric.criteria) {
    b
      ..writeln()
      ..writeln(criterion.name);
    if (criterion.description != null) b.writeln(criterion.description);
    for (final level in criterion.levels) {
      final points = level.pointsLabel;
      final head = points == null
          ? level.name
          : '${level.name} (${l10n.rubricPoints(points)})';
      b.writeln('- $head: ${level.description}');
    }
  }
  return b.toString().trimRight();
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
