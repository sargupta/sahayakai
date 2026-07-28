import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/bullet_dot.dart';
import '../../../../shared/widgets/document_sheet.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/inline_error.dart';
import '../../../../shared/widgets/note_banner.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../../../shared/widgets/secondary_button.dart';
import '../../domain/exam_paper.dart';
import '../exam_paper_controller.dart';

/// Renders a generated [ExamPaper] as a printed document, not a chat dump
/// (PREMIUM_DESIGN_SPEC.md §5 / §6b U8 — the reference every other tool copies).
///
/// The paper is wrapped in a [DocumentSheet]: a masthead ("EXAM PAPER" eyebrow,
/// the paper title as a Fraunces title, saffron rule, board/grade/subject/
/// duration/marks meta badges), the general instructions, each section's
/// question cards (inset cards with saffron numeral medallions), the blueprint
/// summary and any PYQ source attributions. A footer action bar carries the
/// PUT-to-library Save (saffron [PrimaryButton]) over Regenerate / Copy.
///
/// THE LAYOUT CONTRACT (DESIGN_RUBRIC §12 / the ToolScaffold-crash rule): a full
/// board paper is TALL. It grows the page's own (vertical) scroll view — never a
/// nested scroller. No child here has an unbounded height. All model-authored
/// prose flows through [AiText] (line-height 1.7 + Indic height behaviour) so
/// matras never clip and long compound words wrap. Each block inks in on the
/// Ink-settle reveal.
class ExamPaperResultView extends StatelessWidget {
  const ExamPaperResultView({super.key, required this.ready, this.onRegenerate});

  final ExamPaperReady ready;

  /// Re-runs generation from the current form (the controller's `generate`).
  /// When null (e.g. a saved item re-rendered read-only from the Library, or a
  /// direct render in a test) the ENTIRE footer action bar is omitted —
  /// Save included, not just Regenerate / Copy — mirroring every other tool's
  /// result view. Save is a real PUT-to-library call with quota cost, so
  /// leaving it reachable on a paper already sitting in the Library (opened
  /// with no live generate controller behind it) let a re-open-and-tap create
  /// a duplicate save and burn quota for nothing.
  final VoidCallback? onRegenerate;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final paper = ready.paper;

    if (paper.isEmpty) {
      return EmptyView(
        message: l10n.examPaperNoContent,
        icon: LucideIcons.scrollText,
      );
    }

    final title = paper.title.isNotEmpty ? paper.title : l10n.examPaperTitle;
    final maxMarks = paper.maxMarks;
    final meta = <Widget>[
      if (paper.gradeLevel.isNotEmpty)
        AppBadge(
          icon: LucideIcons.graduationCap,
          label: paper.gradeLevel,
          tone: AppBadgeTone.accent,
        ),
      if (paper.subject.isNotEmpty)
        AppBadge(icon: LucideIcons.bookOpen, label: paper.subject),
      if (paper.board.isNotEmpty)
        AppBadge(icon: LucideIcons.scrollText, label: paper.board),
      if (paper.duration != null)
        AppBadge(icon: LucideIcons.clock, label: paper.duration!),
      if (maxMarks != null)
        AppBadge(
          icon: LucideIcons.award,
          label: l10n.examPaperMaxMarks(_formatNum(maxMarks)),
        ),
    ];

    final blueprint = paper.blueprintSummary;

    // The document blocks, in reading order. Content is unchanged from the flat
    // renderer — only the composition around it is new.
    final blocks = <Widget>[
      if (paper.generalInstructions.isNotEmpty)
        DocumentSheetSection(
          title: l10n.examPaperGeneralInstructions,
          child: _Bullets(items: paper.generalInstructions),
        ),
      for (final section in paper.sections) _SectionView(section: section),
      if (blueprint != null && !blueprint.isEmpty)
        DocumentSheetSection(
          title: l10n.examPaperBlueprintTitle,
          child: _BlueprintBody(summary: blueprint),
        ),
      if (paper.pyqSources.isNotEmpty)
        DocumentSheetSection(
          title: l10n.examPaperPyqTitle,
          child: _PyqBody(sources: paper.pyqSources),
        ),
    ];

    // Ink-settle: each block fades + rises in turn, so the document assembles
    // itself. Degrades to the static composed frame under reduce-motion.
    final revealed = <Widget>[
      for (var i = 0; i < blocks.length; i++)
        inkSettle(context, blocks[i], index: i),
    ];

    return DocumentSheet(
      docType: l10n.examPaperTitle,
      title: title,
      meta: meta,
      footer: onRegenerate == null
          ? null
          : _ActionBar(ready: ready, onRegenerate: onRegenerate!),
      children: revealed,
    );
  }
}

/// The document's action bar: the PUT-to-library Save (a saffron [PrimaryButton]
/// that reflects saving / saved / failed) over Regenerate and a Copy ghost.
/// Only built when the screen provided a regenerate callback — see
/// [ExamPaperResultView.onRegenerate] — so a saved item re-opened read-only
/// from the Library never gets a live Save action.
class _ActionBar extends StatelessWidget {
  const _ActionBar({required this.ready, required this.onRegenerate});

  final ExamPaperReady ready;
  final VoidCallback onRegenerate;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final text = Theme.of(context).textTheme;
    final saffron = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;
    final messenger = ScaffoldMessenger.of(context);

    void copy() {
      Clipboard.setData(ClipboardData(text: _paperAsText(ready.paper, l10n)));
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(l10n.copyConfirmation)));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        _SaveBar(ready: ready),
        const SizedBox(height: AppSpacing.space3),
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

/// The PUT-to-library save action. Reads the save controller so the button
/// reflects saving / saved / failed without ever disturbing the rendered paper.
class _SaveBar extends ConsumerWidget {
  const _SaveBar({required this.ready});

  final ExamPaperReady ready;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final state = ref.watch(examPaperSaveControllerProvider);

    Future<void> save() =>
        ref.read(examPaperSaveControllerProvider.notifier).save(ready);

    // Saved: a non-empty contentId came back.
    final savedId = state.valueOrNull;
    if (!state.isLoading &&
        !state.hasError &&
        savedId != null &&
        savedId.isNotEmpty) {
      return Row(
        children: [
          Icon(
            LucideIcons.checkCircle,
            size: AppIconSize.inline,
            color: scheme.primary,
          ),
          const SizedBox(width: AppSpacing.space2),
          Expanded(
            child: Text(
              l10n.examPaperSaved,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: scheme.onSurfaceVariant, height: 1.4),
            ),
          ),
        ],
      );
    }

    // Failed: show the reason and let the teacher try the save again.
    if (state.hasError) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          InlineError(
            title: l10n.examPaperSaveFailedTitle,
            message: l10n.examPaperSaveFailedBody,
          ),
          const SizedBox(height: AppSpacing.space3),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              onPressed: save,
              icon:
                  const Icon(LucideIcons.refreshCw, size: AppIconSize.inline),
              label: Text(l10n.examPaperSaveRetry),
            ),
          ),
        ],
      );
    }

    // Idle or saving — the primary action, a saffron CTA whose width holds while
    // it spins.
    final saving = state.isLoading;
    return PrimaryButton(
      label: saving ? l10n.examPaperSaving : l10n.examPaperSave,
      icon: saving ? null : LucideIcons.save,
      isBusy: saving,
      onPressed: save,
    );
  }
}

/// One section of the paper: an editorial header (saffron tick + name + label +
/// section marks) over its question cards.
class _SectionView extends StatelessWidget {
  const _SectionView({required this.section});

  final ExamSection section;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final saffron = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;

    final totalMarks = section.totalMarks;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 4,
              height: 14,
              margin: const EdgeInsets.only(top: 4),
              decoration: BoxDecoration(
                color: saffron,
                borderRadius: AppRadius.rSm,
              ),
            ),
            const SizedBox(width: AppSpacing.space2),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (section.name.isNotEmpty)
                    Text(section.name, style: text.titleMedium),
                  if (section.label != null) ...[
                    const SizedBox(height: AppSpacing.space1),
                    Text(
                      section.label!,
                      style: text.bodyMedium?.copyWith(
                        color: scheme.onSurfaceVariant,
                        height: 1.4,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (totalMarks != null) ...[
              const SizedBox(width: AppSpacing.space3),
              AppBadge(
                label: l10n.examPaperSectionMarks(_formatNum(totalMarks)),
                tone: AppBadgeTone.accent,
                size: AppBadgeSize.small,
              ),
            ],
          ],
        ),
        const SizedBox(height: AppSpacing.space3),
        for (var i = 0; i < section.questions.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space3),
          _QuestionCard(question: section.questions[i], index: i),
        ],
      ],
    );
  }
}

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({required this.question, required this.index});

  final ExamQuestion question;
  final int index;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final number = question.number;
    final marks = question.marks;

    return AppCard(
      variant: AppCardVariant.inset,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Medallion(
                label: number != null ? _formatNum(number) : '${index + 1}',
              ),
              const SizedBox(width: AppSpacing.space3),
              Expanded(child: AiText(question.text)),
            ],
          ),
          if (marks != null || question.source != null) ...[
            const SizedBox(height: AppSpacing.space3),
            Wrap(
              spacing: AppSpacing.space2,
              runSpacing: AppSpacing.space2,
              children: [
                if (marks != null)
                  AppBadge(
                    label: l10n.examPaperMarks(_formatNum(marks)),
                    tone: AppBadgeTone.accent,
                    size: AppBadgeSize.small,
                  ),
                if (question.source != null)
                  AppBadge(label: question.source!, size: AppBadgeSize.small),
              ],
            ),
          ],
          if (question.options.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space3),
            for (var i = 0; i < question.options.length; i++) ...[
              if (i > 0) const SizedBox(height: AppSpacing.space2),
              _OptionRow(label: question.options[i]),
            ],
          ],
          if (question.internalChoice != null) ...[
            const SizedBox(height: AppSpacing.space3),
            NoteBanner(
              label: l10n.examPaperInternalChoice,
              body: question.internalChoice!,
            ),
          ],
          if (question.hasAnswerKey) ...[
            const SizedBox(height: AppSpacing.space3),
            NoteBanner(
              icon: LucideIcons.checkCircle,
              label: l10n.examPaperAnswerKey,
              body: question.answerKey!,
            ),
          ],
          if (question.hasMarkingScheme) ...[
            const SizedBox(height: AppSpacing.space2),
            NoteBanner(
              icon: LucideIcons.award,
              label: l10n.examPaperMarkingScheme,
              body: question.markingScheme!,
              muted: true,
            ),
          ],
        ],
      ),
    );
  }
}

/// One MCQ option. The backend already labels options "(a) …"/"(b) …", so the
/// text carries its own marker; a leading dot keeps the list scannable.
class _OptionRow extends StatelessWidget {
  const _OptionRow({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const BulletDot(),
        const SizedBox(width: AppSpacing.space3),
        Expanded(child: AiText(label)),
      ],
    );
  }
}

/// The blueprint the paper was built against: how marks split across chapters
/// and how difficulty is distributed.
class _BlueprintBody extends StatelessWidget {
  const _BlueprintBody({required this.summary});

  final BlueprintSummary summary;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (summary.chapterWise.isNotEmpty) ...[
          Text(l10n.examPaperBlueprintChapters, style: text.titleSmall),
          const SizedBox(height: AppSpacing.space2),
          for (var i = 0; i < summary.chapterWise.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.space2),
            _WeightRow(
              label: summary.chapterWise[i].chapter,
              value: summary.chapterWise[i].marks == null
                  ? null
                  : l10n.examPaperMarks(
                      _formatNum(summary.chapterWise[i].marks!),
                    ),
            ),
          ],
        ],
        if (summary.difficultyWise.isNotEmpty) ...[
          if (summary.chapterWise.isNotEmpty)
            const SizedBox(height: AppSpacing.space4),
          Text(l10n.examPaperBlueprintDifficulty, style: text.titleSmall),
          const SizedBox(height: AppSpacing.space2),
          for (var i = 0; i < summary.difficultyWise.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.space2),
            _WeightRow(
              label: summary.difficultyWise[i].level,
              value: summary.difficultyWise[i].percentage == null
                  ? null
                  : l10n.examPaperPercent(
                      _formatNum(summary.difficultyWise[i].percentage!),
                    ),
            ),
          ],
        ],
      ],
    );
  }
}

/// One "label ........ value" row: the label wraps, the value badge stays on the
/// right. Used for both the chapter and difficulty weight lists.
class _WeightRow extends StatelessWidget {
  const _WeightRow({required this.label, this.value});

  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: Text(label, style: text.bodyMedium?.copyWith(height: 1.4))),
        if (value != null) ...[
          const SizedBox(width: AppSpacing.space3),
          AppBadge(
            label: value!,
            tone: AppBadgeTone.accent,
            size: AppBadgeSize.small,
          ),
        ],
      ],
    );
  }
}

class _PyqBody extends StatelessWidget {
  const _PyqBody({required this.sources});

  final List<PyqSource> sources;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < sources.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space2),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const BulletDot(),
              const SizedBox(width: AppSpacing.space3),
              Expanded(child: AiText(_pyqLabel(l10n, sources[i]))),
            ],
          ),
        ],
      ],
    );
  }

  String _pyqLabel(AppLocalizations l10n, PyqSource source) {
    final chapter = source.chapter;
    final year = source.year;
    if (chapter != null && year != null) {
      return l10n.examPaperPyqChapterYear(chapter, year);
    }
    if (chapter != null) return chapter;
    if (year != null) return l10n.examPaperPyqYear(year);
    return source.id;
  }
}

class _Bullets extends StatelessWidget {
  const _Bullets({required this.items});

  final List<String> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space2),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const BulletDot(),
              const SizedBox(width: AppSpacing.space3),
              Expanded(child: AiText(items[i])),
            ],
          ),
        ],
      ],
    );
  }
}

/// The saffron numeral medallion that numbers a question (mirrors U8).
class _Medallion extends StatelessWidget {
  const _Medallion({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Container(
      constraints: const BoxConstraints(minWidth: 32),
      height: 32,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space2),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.rectangle,
        borderRadius: AppRadius.rWell,
        color: scheme.primaryContainer,
      ),
      child: Text(
        label,
        style: text.labelLarge?.copyWith(
          color: scheme.onPrimaryContainer,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// A plain-text export of the whole paper — instructions, every section and its
/// questions (with answer key and marking scheme), the blueprint and PYQ sources
/// — for the clipboard.
String _paperAsText(ExamPaper paper, AppLocalizations l10n) {
  final b = StringBuffer();
  if (paper.title.isNotEmpty) b.writeln(paper.title);
  final metaBits = [
    paper.board,
    paper.gradeLevel,
    paper.subject,
    paper.duration,
    paper.maxMarks == null
        ? null
        : l10n.examPaperMaxMarks(_formatNum(paper.maxMarks!)),
  ].whereType<String>().where((s) => s.isNotEmpty).toList();
  if (metaBits.isNotEmpty) b.writeln(metaBits.join(' · '));

  if (paper.generalInstructions.isNotEmpty) {
    b
      ..writeln()
      ..writeln(l10n.examPaperGeneralInstructions);
    for (final line in paper.generalInstructions) {
      b.writeln('- $line');
    }
  }

  for (final section in paper.sections) {
    b.writeln();
    final head = section.label == null
        ? section.name
        : '${section.name} — ${section.label}';
    b.writeln(head);
    for (var i = 0; i < section.questions.length; i++) {
      final q = section.questions[i];
      final n = q.number != null ? _formatNum(q.number!) : '${i + 1}';
      b.writeln('$n. ${q.text}');
      for (final opt in q.options) {
        b.writeln('   $opt');
      }
      if (q.internalChoice != null) {
        b.writeln('   ${l10n.examPaperInternalChoice}: ${q.internalChoice}');
      }
      if (q.hasAnswerKey) {
        b.writeln('   ${l10n.examPaperAnswerKey}: ${q.answerKey}');
      }
      if (q.hasMarkingScheme) {
        b.writeln('   ${l10n.examPaperMarkingScheme}: ${q.markingScheme}');
      }
    }
  }
  return b.toString().trimRight();
}

/// Drops a trailing `.0` so `80.0` reads as `80` and `12.5` stays `12.5`.
String _formatNum(num value) {
  return value == value.roundToDouble()
      ? value.toInt().toString()
      : value.toString();
}
