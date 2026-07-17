import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/bullet_dot.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/inline_error.dart';
import '../../../../shared/widgets/note_banner.dart';
import '../../../../shared/widgets/section_label.dart';
import '../../domain/exam_paper.dart';
import '../exam_paper_controller.dart';

/// Renders a generated [ExamPaper]: a header, a save-to-library action, the
/// general instructions, each section's question cards, the blueprint summary
/// and any PYQ source attributions.
///
/// THE LAYOUT CONTRACT (DESIGN_RUBRIC §12 / the ToolScaffold-crash rule): a full
/// board paper is TALL. It is rendered as a plain vertical [Column] of cards
/// that grows the page's own (vertical) scroll view — never a nested scroller.
/// No child here has an unbounded height, so nothing fights the outer scroll.
/// All model-authored prose flows through [AiText] (line-height 1.7 + Indic
/// height behaviour) so matras never clip and long compound words wrap.
class ExamPaperResultView extends StatelessWidget {
  const ExamPaperResultView({super.key, required this.ready});

  final ExamPaperReady ready;

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

    final blueprint = paper.blueprintSummary;
    final sections = <Widget>[
      _Header(paper: paper),
      _SaveBar(ready: ready),
      if (paper.generalInstructions.isNotEmpty)
        _InstructionsCard(instructions: paper.generalInstructions),
      for (final section in paper.sections) _SectionView(section: section),
      if (blueprint != null && !blueprint.isEmpty)
        _BlueprintCard(summary: blueprint),
      if (paper.pyqSources.isNotEmpty) _PyqCard(sources: paper.pyqSources),
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
  const _Header({required this.paper});

  final ExamPaper paper;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;

    final maxMarks = paper.maxMarks;
    final meta = <Widget>[
      if (paper.gradeLevel.isNotEmpty)
        AppBadge(icon: LucideIcons.graduationCap, label: paper.gradeLevel),
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (paper.title.isNotEmpty)
          Text(paper.title, style: text.headlineSmall),
        if (paper.title.isNotEmpty && meta.isNotEmpty)
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
    if (!state.isLoading && !state.hasError && savedId != null && savedId.isNotEmpty) {
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

    // Idle or saving.
    final saving = state.isLoading;
    return Align(
      alignment: Alignment.centerLeft,
      child: FilledButton.tonalIcon(
        onPressed: saving ? null : save,
        style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
        icon: saving
            ? SizedBox(
                width: AppIconSize.inline,
                height: AppIconSize.inline,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: scheme.onSecondaryContainer,
                ),
              )
            : const Icon(LucideIcons.save, size: AppIconSize.inline),
        label: Text(saving ? l10n.examPaperSaving : l10n.examPaperSave),
      ),
    );
  }
}

class _InstructionsCard extends StatelessWidget {
  const _InstructionsCard({required this.instructions});

  final List<String> instructions;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          SectionLabel(
            context.l10n.examPaperGeneralInstructions,
            icon: LucideIcons.listChecks,
          ),
          const SizedBox(height: AppSpacing.space3),
          for (var i = 0; i < instructions.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.space2),
            _BulletLine(text: instructions[i]),
          ],
        ],
      ),
    );
  }
}

class _BulletLine extends StatelessWidget {
  const _BulletLine({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const BulletDot(),
        const SizedBox(width: AppSpacing.space3),
        Expanded(child: AiText(text)),
      ],
    );
  }
}

class _SectionView extends StatelessWidget {
  const _SectionView({required this.section});

  final ExamSection section;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    final totalMarks = section.totalMarks;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        // A section header row: the name, its label, and the section marks.
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppBadge.count(
                number != null ? _formatNum(number) : '${index + 1}',
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
                  AppBadge(
                    label: question.source!,
                    size: AppBadgeSize.small,
                  ),
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

class _BlueprintCard extends StatelessWidget {
  const _BlueprintCard({required this.summary});

  final BlueprintSummary summary;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          SectionLabel(
            l10n.examPaperBlueprintTitle,
            icon: LucideIcons.pieChart,
          ),
          if (summary.chapterWise.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space3),
            Text(
              l10n.examPaperBlueprintChapters,
              style: Theme.of(context).textTheme.titleSmall,
            ),
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
            const SizedBox(height: AppSpacing.space4),
            Text(
              l10n.examPaperBlueprintDifficulty,
              style: Theme.of(context).textTheme.titleSmall,
            ),
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
      ),
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
        Expanded(
          child: Text(
            label,
            style: text.bodyMedium?.copyWith(height: 1.4),
          ),
        ),
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

class _PyqCard extends StatelessWidget {
  const _PyqCard({required this.sources});

  final List<PyqSource> sources;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          SectionLabel(
            l10n.examPaperPyqTitle,
            icon: LucideIcons.bookMarked,
          ),
          const SizedBox(height: AppSpacing.space3),
          for (var i = 0; i < sources.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.space2),
            _BulletLine(text: _pyqLabel(l10n, sources[i])),
          ],
        ],
      ),
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

/// Drops a trailing `.0` so `80.0` reads as `80` and `12.5` stays `12.5`.
String _formatNum(num value) {
  return value == value.roundToDouble()
      ? value.toInt().toString()
      : value.toString();
}
