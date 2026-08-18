import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/document_sheet.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/read_aloud_button.dart';
import '../../../../shared/widgets/result_actions_bar.dart';
import '../../../../shared/widgets/rich_markdown.dart';
import '../../../../shared/widgets/secondary_button.dart';
import '../../data/rubric_repository.dart';
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
/// the Ink-settle reveal, and a footer action bar offers Regenerate / Read
/// aloud over the shared [ResultActionsBar] (Save to Library / Copy / Share).
class RubricResultView extends StatelessWidget {
  const RubricResultView({
    super.key,
    required this.rubric,
    this.onRegenerate,
    this.saveRequest,
  });

  final Rubric rubric;

  /// Re-runs generation from the current form (the controller's `generate`).
  /// When null (e.g. a direct render in a test) the footer action bar is
  /// omitted.
  final VoidCallback? onRegenerate;

  /// The request that produced [rubric]. Supplies the assignment description /
  /// grade / language the `POST /api/content/save` body needs (the model output
  /// alone carries no assignment). When null — or when the rubric carries no
  /// verbatim [Rubric.raw] to persist — the Save action is withheld and the bar
  /// offers Copy / Share only.
  final RubricRequest? saveRequest;

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
      if (rubric.description != null)
        RichMarkdown(rubric.description!, muted: true),
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
          : _ActionBar(
              rubric: rubric,
              onRegenerate: onRegenerate!,
              saveRequest: saveRequest,
            ),
      children: revealed,
    );
  }
}

/// The document's action bar: Regenerate (secondary) and Read aloud over the
/// shared [ResultActionsBar] — Save to Library / Copy / Share.
///
/// Copy and Share both carry the rubric as plain text (the grid flattened to
/// criterion / level lines, since a table does not survive a chat app). Save
/// posts the verbatim model output and is offered only when there is a request
/// behind the rubric AND a [Rubric.raw] to persist.
class _ActionBar extends ConsumerWidget {
  const _ActionBar({
    required this.rubric,
    required this.onRegenerate,
    this.saveRequest,
  });

  final Rubric rubric;
  final VoidCallback onRegenerate;
  final RubricRequest? saveRequest;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final text = _rubricAsText(rubric, l10n);
    final request = saveRequest;
    final canSave = request != null && rubric.raw != null;

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
        ReadAloudButton(text: text),
        const SizedBox(height: AppSpacing.space3),
        ResultActionsBar(
          text: text,
          shareSubject: rubric.title.isEmpty ? null : rubric.title,
          saveResetKey: rubric,
          onSave: canSave
              ? () => ref
                    .read(rubricRepositoryProvider)
                    .save(rubric: rubric, request: request)
              : null,
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
  final metaBits = [
    rubric.gradeLevel,
    rubric.subject,
  ].whereType<String>().toList();
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
