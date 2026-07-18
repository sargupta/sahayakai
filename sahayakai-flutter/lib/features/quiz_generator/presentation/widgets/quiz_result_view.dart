import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/document_sheet.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/note_banner.dart';
import '../../../../shared/widgets/secondary_button.dart';
import '../../domain/quiz.dart';

/// Renders a generated [Quiz] as a printed document, not a chat dump
/// (PREMIUM_DESIGN_SPEC.md §5 / §6b U8 — the reference every other tool copies).
///
/// The quiz is wrapped in a [DocumentSheet]: a masthead ("QUIZ" eyebrow, the
/// topic as a Fraunces title, saffron rule, grade/subject/count meta badges),
/// then the difficulty variants in the body. The model returns up to three
/// variants; only the ones that actually came back get a tab, so an empty tab
/// is never drawn. Correct answers stay hidden behind a per-question reveal so
/// the teacher can project or read a question aloud without spoiling it. Each
/// block inks in on the Ink-settle reveal, and a footer action bar offers
/// Regenerate / Copy.
///
/// All model-authored prose flows through [AiText] (line-height 1.7 + Indic
/// height behaviour) so matras and vowel signs never clip, and long compound
/// words wrap instead of scrolling. See DESIGN_RUBRIC §3 / §8.
class QuizResultView extends StatelessWidget {
  const QuizResultView({super.key, required this.quiz, this.onRegenerate});

  final Quiz quiz;

  /// Re-runs generation from the current form (the controller's `generate`).
  /// When null (e.g. a direct render in a test) the footer action bar is
  /// omitted.
  final VoidCallback? onRegenerate;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    if (quiz.variants.isEmpty) {
      return EmptyView(
        message: l10n.quizNoQuestions,
        icon: LucideIcons.fileQuestion,
      );
    }

    // The variants carry the model's own title; the envelope carries the
    // teacher's metadata. Prefer the envelope, fall back to the first variant.
    final title = quiz.topic ?? quiz.variants.first.title;
    final grade = quiz.gradeLevel ?? quiz.variants.first.gradeLevel;
    final subject = quiz.subject ?? quiz.variants.first.subject;

    final meta = <Widget>[
      if (grade != null)
        AppBadge(
          icon: LucideIcons.graduationCap,
          label: grade,
          tone: AppBadgeTone.accent,
        ),
      if (subject != null)
        AppBadge(icon: LucideIcons.bookOpen, label: subject),
      AppBadge(
        icon: LucideIcons.listChecks,
        label: l10n.quizQuestionCount(quiz.variants.first.questions.length),
      ),
    ];

    // The document blocks, in reading order. Content is unchanged from the flat
    // renderer — only the composition around it is new.
    final blocks = <Widget>[
      if (quiz.validationWarning != null)
        NoteBanner(
          icon: LucideIcons.info,
          label: l10n.quizNoteLabel,
          body: quiz.validationWarning!.message,
        ),
      if (quiz.variants.length == 1)
        _VariantView(variant: quiz.variants.first)
      else
        _DifficultyTabs(variants: quiz.variants),
    ];

    // Ink-settle: each block fades + rises in turn, so the document assembles
    // itself. Degrades to the static composed frame under reduce-motion.
    final revealed = <Widget>[
      for (var i = 0; i < blocks.length; i++)
        inkSettle(context, blocks[i], index: i),
    ];

    return DocumentSheet(
      docType: l10n.quizTitle,
      title: title,
      meta: meta,
      footer: onRegenerate == null
          ? null
          : _ActionBar(quiz: quiz, onRegenerate: onRegenerate!),
      children: revealed,
    );
  }
}

/// The document's action bar: Regenerate (secondary) over a Copy ghost. Copy
/// exports the full quiz — every variant, with its answer key — as plain text
/// to the clipboard, a presentation-only action with no controller involved.
class _ActionBar extends StatelessWidget {
  const _ActionBar({required this.quiz, required this.onRegenerate});

  final Quiz quiz;
  final VoidCallback onRegenerate;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final text = Theme.of(context).textTheme;
    final saffron = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;
    final messenger = ScaffoldMessenger.of(context);

    void copy() {
      Clipboard.setData(ClipboardData(text: _quizAsText(quiz, l10n)));
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

/// A plain-text export of the whole quiz — every variant and its answer key —
/// for the clipboard.
String _quizAsText(Quiz quiz, AppLocalizations l10n) {
  final b = StringBuffer();
  final heading = quiz.topic ?? quiz.variants.first.title;
  if (heading.isNotEmpty) b.writeln(heading);
  final metaBits = [
    quiz.gradeLevel ?? quiz.variants.first.gradeLevel,
    quiz.subject ?? quiz.variants.first.subject,
  ].whereType<String>().toList();
  if (metaBits.isNotEmpty) b.writeln(metaBits.join(' · '));

  for (final variant in quiz.variants) {
    b
      ..writeln()
      ..writeln(_difficultyLabel(l10n, variant.difficulty).toUpperCase());
    if (variant.teacherInstructions != null) {
      b.writeln(variant.teacherInstructions);
    }
    for (var i = 0; i < variant.questions.length; i++) {
      final q = variant.questions[i];
      b.writeln('${i + 1}. ${q.questionText}');
      for (var j = 0; j < q.options.length; j++) {
        b.writeln('   ${_optionMarker(j)}. ${q.options[j]}');
      }
      b.writeln('   ${l10n.quizCorrectAnswer}: ${q.correctAnswer}');
      if (q.explanation != null) {
        b.writeln('   ${l10n.quizExplanation}: ${q.explanation}');
      }
    }
  }
  return b.toString().trimRight();
}

/// The Easy / Medium / Hard switcher. Deliberately NOT a `TabBarView`: this
/// result lives inside the [DocumentSheet], itself inside the [ToolScaffold]'s
/// scroll view, where a TabBarView's unbounded height would blow up. A TabBar
/// drives an [AnimatedSwitcher] instead, so each variant is laid out at its
/// natural height.
class _DifficultyTabs extends StatefulWidget {
  const _DifficultyTabs({required this.variants});

  final List<QuizVariant> variants;

  @override
  State<_DifficultyTabs> createState() => _DifficultyTabsState();
}

class _DifficultyTabsState extends State<_DifficultyTabs>
    with SingleTickerProviderStateMixin {
  late final TabController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TabController(length: widget.variants.length, vsync: this);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            color: scheme.surfaceContainer,
            borderRadius: AppRadius.rMd,
          ),
          child: TabBar(
            controller: _controller,
            // A short label set (three words); a fixed bar keeps them evenly
            // weighted and cannot overflow at 360dp.
            dividerColor: Colors.transparent,
            indicatorSize: TabBarIndicatorSize.tab,
            indicator: BoxDecoration(
              color: scheme.primary.withValues(alpha: 0.12),
              borderRadius: AppRadius.rMd,
              border: Border.all(color: scheme.primary),
            ),
            labelColor: scheme.primary,
            unselectedLabelColor: scheme.onSurfaceVariant,
            splashBorderRadius: AppRadius.rMd,
            tabs: [
              for (final variant in widget.variants)
                Tab(
                  height: 48,
                  child: Text(
                    _difficultyLabel(l10n, variant.difficulty),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.space6),
        AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            final variant = widget.variants[_controller.index];
            return AnimatedSwitcher(
              duration: AppMotion.small,
              switchInCurve: AppMotion.easeOutQuart,
              switchOutCurve: AppMotion.easeOutQuart,
              // Cross-fade in place; a size transition would fight the outer
              // scroll view on long quizzes.
              layoutBuilder: (current, previous) => Stack(
                alignment: Alignment.topLeft,
                children: [...previous, ?current],
              ),
              child: _VariantView(
                key: ValueKey<QuizDifficulty>(variant.difficulty),
                variant: variant,
              ),
            );
          },
        ),
      ],
    );
  }
}

/// One difficulty's questions, with a reveal-all shortcut. Reveal state is
/// per-variant on purpose: switching tabs re-hides the answers.
class _VariantView extends StatefulWidget {
  const _VariantView({super.key, required this.variant});

  final QuizVariant variant;

  @override
  State<_VariantView> createState() => _VariantViewState();
}

class _VariantViewState extends State<_VariantView> {
  final Set<int> _revealed = <int>{};

  bool get _allRevealed => _revealed.length == widget.variant.questions.length;

  void _toggleAll() {
    setState(() {
      if (_allRevealed) {
        _revealed.clear();
      } else {
        _revealed.addAll(
          List<int>.generate(widget.variant.questions.length, (i) => i),
        );
      }
    });
  }

  void _toggle(int index) {
    setState(() {
      if (!_revealed.remove(index)) _revealed.add(index);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final questions = widget.variant.questions;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.variant.teacherInstructions != null) ...[
          NoteBanner(
            icon: LucideIcons.lightbulb,
            label: l10n.quizTeacherInstructions,
            body: widget.variant.teacherInstructions!,
          ),
          const SizedBox(height: AppSpacing.space4),
        ],
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: questions.isEmpty ? null : _toggleAll,
            style: TextButton.styleFrom(
              minimumSize: const Size(0, 48),
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.space3,
              ),
            ),
            icon: Icon(
              _allRevealed ? LucideIcons.eyeOff : LucideIcons.eye,
              size: AppIconSize.inline,
            ),
            label: Text(
              _allRevealed ? l10n.quizHideAllAnswers : l10n.quizShowAllAnswers,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.space3),
        for (var i = 0; i < questions.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space3),
          _QuestionCard(
            number: i + 1,
            question: questions[i],
            isRevealed: _revealed.contains(i),
            onToggle: () => _toggle(i),
          ),
        ],
      ],
    );
  }
}

/// A single question as a numbered inset card, led by a saffron numeral
/// medallion (mirrors the U8 activity cards).
class _QuestionCard extends StatelessWidget {
  const _QuestionCard({
    required this.number,
    required this.question,
    required this.isRevealed,
    required this.onToggle,
  });

  final int number;
  final Question question;
  final bool isRevealed;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    // Marking the right option inline is clearer than repeating it below, so
    // only fall back to a spelled-out answer line when we cannot mark it.
    final showAnswerLine =
        !(question.hasMarkedOption && question.options.isNotEmpty);

    return AppCard(
      variant: AppCardVariant.inset,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Medallion(index: number),
              const SizedBox(width: AppSpacing.space3),
              Expanded(child: AiText(question.questionText)),
            ],
          ),
          if (question.questionType != null ||
              question.difficultyLevel != null) ...[
            const SizedBox(height: AppSpacing.space3),
            Wrap(
              spacing: AppSpacing.space2,
              runSpacing: AppSpacing.space2,
              children: [
                if (question.questionType != null)
                  AppBadge(
                    label: _typeLabel(l10n, question.questionType!),
                    size: AppBadgeSize.small,
                  ),
                if (question.difficultyLevel != null)
                  AppBadge(
                    label: _difficultyLabel(l10n, question.difficultyLevel!),
                    size: AppBadgeSize.small,
                  ),
              ],
            ),
          ],
          if (question.options.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space3),
            for (var i = 0; i < question.options.length; i++) ...[
              if (i > 0) const SizedBox(height: AppSpacing.space2),
              _OptionRow(
                marker: _optionMarker(i),
                label: question.options[i],
                isCorrect:
                    isRevealed &&
                    question.options[i].trim().toLowerCase() ==
                        question.correctAnswer.trim().toLowerCase(),
              ),
            ],
          ],
          const SizedBox(height: AppSpacing.space3),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              onPressed: onToggle,
              icon: Icon(
                isRevealed ? LucideIcons.eyeOff : LucideIcons.eye,
                size: AppIconSize.inline,
              ),
              label: Text(
                isRevealed ? l10n.quizHideAnswer : l10n.quizShowAnswer,
              ),
            ),
          ),
          AnimatedSize(
            duration: AppMotion.small,
            curve: AppMotion.easeOutQuart,
            alignment: Alignment.topCenter,
            child: !isRevealed
                ? const SizedBox(width: double.infinity)
                : Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.space3),
                    child: Container(
                      padding: const EdgeInsets.all(AppSpacing.space3),
                      decoration: BoxDecoration(
                        color: scheme.surfaceContainerHigh,
                        borderRadius: AppRadius.rMd,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (showAnswerLine) ...[
                            Row(
                              children: [
                                Icon(
                                  LucideIcons.checkCircle,
                                  size: AppIconSize.inline,
                                  color: scheme.primary,
                                ),
                                const SizedBox(width: AppSpacing.space2),
                                Flexible(
                                  child: Text(
                                    l10n.quizCorrectAnswer,
                                    style: text.labelSmall?.copyWith(
                                      color: scheme.onSurfaceVariant,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: AppSpacing.space1),
                            AiText(question.correctAnswer),
                          ],
                          if (question.explanation != null) ...[
                            if (showAnswerLine)
                              const SizedBox(height: AppSpacing.space3),
                            Row(
                              children: [
                                Icon(
                                  LucideIcons.lightbulb,
                                  size: AppIconSize.inline,
                                  color: scheme.onSurfaceVariant,
                                ),
                                const SizedBox(width: AppSpacing.space2),
                                Flexible(
                                  child: Text(
                                    l10n.quizExplanation,
                                    style: text.labelSmall?.copyWith(
                                      color: scheme.onSurfaceVariant,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: AppSpacing.space1),
                            AiText(question.explanation!, muted: true),
                          ],
                        ],
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

/// The saffron numeral medallion that numbers a question (mirrors U8).
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

/// One multiple-choice option. Once revealed, the correct one is marked with a
/// saffron check and a tinted surface — colour is never the only signal.
class _OptionRow extends StatelessWidget {
  const _OptionRow({
    required this.marker,
    required this.label,
    required this.isCorrect,
  });

  final String marker;
  final String label;
  final bool isCorrect;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return AnimatedContainer(
      duration: AppMotion.micro,
      curve: AppMotion.easeOutQuart,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.space3,
        vertical: AppSpacing.space2,
      ),
      decoration: BoxDecoration(
        color: isCorrect
            ? scheme.primary.withValues(alpha: 0.1)
            : Colors.transparent,
        borderRadius: AppRadius.rSm,
        border: Border.all(
          color: isCorrect ? scheme.primary : scheme.outlineVariant,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            marker,
            style: text.labelLarge?.copyWith(
              color: isCorrect ? scheme.primary : scheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(width: AppSpacing.space3),
          Expanded(child: AiText(label)),
          if (isCorrect) ...[
            const SizedBox(width: AppSpacing.space2),
            Icon(
              LucideIcons.checkCircle,
              size: AppIconSize.inline,
              color: scheme.primary,
            ),
          ],
        ],
      ),
    );
  }
}

/// A, B, C, ... for the first 26 options; numbers beyond that (defensive — the
/// model never returns more than a handful).
String _optionMarker(int index) =>
    index < 26 ? String.fromCharCode(65 + index) : '${index + 1}';

String _difficultyLabel(AppLocalizations l10n, QuizDifficulty difficulty) =>
    switch (difficulty) {
      QuizDifficulty.easy => l10n.quizDifficultyEasy,
      QuizDifficulty.medium => l10n.quizDifficultyMedium,
      QuizDifficulty.hard => l10n.quizDifficultyHard,
    };

String _typeLabel(AppLocalizations l10n, QuestionType type) => switch (type) {
  QuestionType.multipleChoice => l10n.quizTypeMultipleChoice,
  QuestionType.fillInTheBlanks => l10n.quizTypeFillInTheBlanks,
  QuestionType.shortAnswer => l10n.quizTypeShortAnswer,
  QuestionType.trueFalse => l10n.quizTypeTrueFalse,
};
