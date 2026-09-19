import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/document_sheet.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/note_banner.dart';
import '../../../../shared/widgets/read_aloud_button.dart';
import '../../../../shared/widgets/result_actions_bar.dart';
import '../../../../shared/widgets/rich_markdown.dart';
import '../../../../shared/widgets/secondary_button.dart';
import '../../data/quiz_repository.dart';
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
/// Regenerate / Read aloud over the shared [ResultActionsBar] (Save to Library
/// / Copy / Share).
///
/// All model-authored prose flows through [AiText] (line-height 1.7 + Indic
/// height behaviour) so matras and vowel signs never clip, and long compound
/// words wrap instead of scrolling. See DESIGN_RUBRIC §3 / §8.
class QuizResultView extends StatefulWidget {
  const QuizResultView({
    super.key,
    required this.quiz,
    this.onRegenerate,
    this.saveRequest,
  });

  final Quiz quiz;

  /// Re-runs generation from the current form (the controller's `generate`).
  /// When null (e.g. a direct render in a test) the footer action bar is
  /// omitted.
  final VoidCallback? onRegenerate;

  /// The request that produced [quiz]. Supplies the topic / grade / language
  /// the `POST /api/content/save` body needs (the model output alone carries no
  /// request topic). When null — or when the quiz carries no verbatim
  /// [Quiz.raw] to persist — the Save action is withheld and the bar offers
  /// Copy / Share only.
  final QuizRequest? saveRequest;

  @override
  State<QuizResultView> createState() => _QuizResultViewState();
}

class _QuizResultViewState extends State<QuizResultView> {
  /// Which answers are currently revealed, per difficulty variant. Lifted out
  /// of the variant views (where it used to live) so the Copy export can honour
  /// the on-screen "hide answers" state — a hidden answer must not leak into the
  /// clipboard, the same way the web gates its export on `showAnswers`. Reveal
  /// is remembered per variant, so switching a tab and coming back keeps what
  /// the teacher had shown; a freshly-opened variant starts unspoiled (its set
  /// is absent, hence empty).
  final Map<QuizDifficulty, Set<int>> _revealed = <QuizDifficulty, Set<int>>{};

  /// Read-only view of a variant's revealed indices (never mutates the map).
  Set<int> _revealedOf(QuizVariant variant) =>
      _revealed[variant.difficulty] ?? const <int>{};

  void _toggle(QuizVariant variant, int index) {
    setState(() {
      final set = _revealed.putIfAbsent(variant.difficulty, () => <int>{});
      if (!set.remove(index)) set.add(index);
    });
  }

  void _toggleAll(QuizVariant variant) {
    setState(() {
      final set = _revealed.putIfAbsent(variant.difficulty, () => <int>{});
      if (set.length == variant.questions.length) {
        set.clear();
      } else {
        set
          ..clear()
          ..addAll(List<int>.generate(variant.questions.length, (i) => i));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final quiz = widget.quiz;
    final onRegenerate = widget.onRegenerate;
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
      if (subject != null) AppBadge(icon: LucideIcons.bookOpen, label: subject),
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
        _VariantView(
          variant: quiz.variants.first,
          revealed: _revealedOf(quiz.variants.first),
          onToggle: (i) => _toggle(quiz.variants.first, i),
          onToggleAll: () => _toggleAll(quiz.variants.first),
        )
      else
        _DifficultyVariants(
          variants: quiz.variants,
          revealedOf: _revealedOf,
          onToggle: _toggle,
          onToggleAll: _toggleAll,
        ),
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
          : _ActionBar(
              quiz: quiz,
              onRegenerate: onRegenerate,
              revealed: _revealed,
              saveRequest: widget.saveRequest,
            ),
      children: revealed,
    );
  }
}

/// The document's action bar: Regenerate (secondary) and Read aloud over the
/// shared [ResultActionsBar] — Save to Library / Copy / Share.
///
/// Copy and Share both carry the quiz as plain text, and both honour the
/// on-screen reveal state: only answers the teacher has revealed are included,
/// so a teacher who hid the answers before projecting does not paste (or
/// WhatsApp) the answer key. Save posts the verbatim model output and is
/// offered only when there is a request behind the quiz AND a [Quiz.raw] to
/// persist.
class _ActionBar extends ConsumerWidget {
  const _ActionBar({
    required this.quiz,
    required this.onRegenerate,
    required this.revealed,
    this.saveRequest,
  });

  final Quiz quiz;
  final VoidCallback onRegenerate;

  /// Revealed answer indices, per difficulty variant. See [_QuizResultViewState].
  final Map<QuizDifficulty, Set<int>> revealed;

  final QuizRequest? saveRequest;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final text = _quizAsText(quiz, l10n, revealed: revealed);
    final request = saveRequest;
    final canSave = request != null && quiz.raw != null;
    final heading = quiz.topic ?? quiz.variants.first.title;

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
          shareSubject: heading.isEmpty ? null : heading,
          saveResetKey: quiz,
          onSave: canSave
              ? () => ref
                    .read(quizRepositoryProvider)
                    .save(quiz: quiz, request: request)
              : null,
        ),
      ],
    );
  }
}

/// A plain-text export of the quiz for the clipboard. A question's answer and
/// explanation are written out ONLY when that question is currently revealed on
/// screen ([revealed], keyed by variant difficulty); a hidden answer is left
/// out, so a projected/printed copy stays unspoiled.
String _quizAsText(
  Quiz quiz,
  AppLocalizations l10n, {
  required Map<QuizDifficulty, Set<int>> revealed,
}) {
  final b = StringBuffer();
  final heading = quiz.topic ?? quiz.variants.first.title;
  if (heading.isNotEmpty) b.writeln(heading);
  final metaBits = [
    quiz.gradeLevel ?? quiz.variants.first.gradeLevel,
    quiz.subject ?? quiz.variants.first.subject,
  ].whereType<String>().toList();
  if (metaBits.isNotEmpty) b.writeln(metaBits.join(' · '));

  for (final variant in quiz.variants) {
    final shown = revealed[variant.difficulty] ?? const <int>{};
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
      if (shown.contains(i)) {
        b.writeln('   ${l10n.quizCorrectAnswer}: ${q.correctAnswer}');
        if (q.explanation != null) {
          b.writeln('   ${l10n.quizExplanation}: ${q.explanation}');
        }
      }
    }
  }
  return b.toString().trimRight();
}

/// The Easy / Medium / Hard switcher — a segmented control (v3 screen 09), the
/// selected segment filled saffron. Deliberately NOT a `TabBarView`: this result
/// lives inside the [DocumentSheet], itself inside the [ToolScaffold]'s scroll
/// view, where a TabBarView's unbounded height would blow up. The segmented
/// control drives an [AnimatedSwitcher] instead, so each variant is laid out at
/// its natural height.
class _DifficultyVariants extends StatefulWidget {
  const _DifficultyVariants({
    required this.variants,
    required this.revealedOf,
    required this.onToggle,
    required this.onToggleAll,
  });

  final List<QuizVariant> variants;

  /// Read-only reveal set for a variant, and the callbacks that mutate it. State
  /// lives up in [_QuizResultViewState] so the Copy export can see it.
  final Set<int> Function(QuizVariant) revealedOf;
  final void Function(QuizVariant, int) onToggle;
  final void Function(QuizVariant) onToggleAll;

  @override
  State<_DifficultyVariants> createState() => _DifficultyVariantsState();
}

class _DifficultyVariantsState extends State<_DifficultyVariants> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final variant = widget.variants[_index];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        QuizDifficultySegmented(
          labels: [
            for (final v in widget.variants)
              _difficultyLabel(l10n, v.difficulty),
          ],
          selectedIndex: _index,
          onSelected: (i) => setState(() => _index = i),
        ),
        const SizedBox(height: AppSpacing.space6),
        AnimatedSwitcher(
          duration: AppMotion.small,
          switchInCurve: AppMotion.easeOutQuart,
          switchOutCurve: AppMotion.easeOutQuart,
          // Cross-fade in place; a size transition would fight the outer scroll
          // view on long quizzes.
          layoutBuilder: (current, previous) => Stack(
            alignment: Alignment.topLeft,
            children: [...previous, ?current],
          ),
          child: _VariantView(
            key: ValueKey<QuizDifficulty>(variant.difficulty),
            variant: variant,
            revealed: widget.revealedOf(variant),
            onToggle: (i) => widget.onToggle(variant, i),
            onToggleAll: () => widget.onToggleAll(variant),
          ),
        ),
      ],
    );
  }
}

/// A saffron-filled segmented control (v3 screen 09): one rounded track, the
/// selected segment filled `scheme.primary` with `onPrimary` text (the app's
/// button fill contract), the rest plain on the track. Public so the quiz result
/// tests can target it (its labels also appear as per-question difficulty
/// badges, so tests scope finders to this widget).
class QuizDifficultySegmented extends StatelessWidget {
  const QuizDifficultySegmented({
    super.key,
    required this.labels,
    required this.selectedIndex,
    required this.onSelected,
  });

  final List<String> labels;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surfaceContainer,
        borderRadius: AppRadius.rMd,
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.space1),
        child: Row(
          children: [
            for (var i = 0; i < labels.length; i++)
              Expanded(
                child: _Segment(
                  label: labels[i],
                  selected: i == selectedIndex,
                  onTap: () => onSelected(i),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Material(
      color: Colors.transparent,
      borderRadius: AppRadius.rSm,
      child: InkWell(
        borderRadius: AppRadius.rSm,
        onTap: onTap,
        child: AnimatedContainer(
          duration: AppMotion.micro,
          curve: AppMotion.easeOutQuart,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? scheme.primary : Colors.transparent,
            borderRadius: AppRadius.rSm,
          ),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: text.labelLarge?.copyWith(
              color: selected ? scheme.onPrimary : scheme.onSurfaceVariant,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

/// One difficulty's questions, with a reveal-all shortcut. Controlled: the
/// reveal state lives up in [_QuizResultViewState] (so the Copy export can read
/// it) and is passed back down here as [revealed] + the toggle callbacks.
class _VariantView extends StatelessWidget {
  const _VariantView({
    super.key,
    required this.variant,
    required this.revealed,
    required this.onToggle,
    required this.onToggleAll,
  });

  final QuizVariant variant;
  final Set<int> revealed;
  final void Function(int index) onToggle;
  final VoidCallback onToggleAll;

  bool get _allRevealed =>
      variant.questions.isNotEmpty &&
      revealed.length == variant.questions.length;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final questions = variant.questions;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (variant.teacherInstructions != null) ...[
          NoteBanner(
            icon: LucideIcons.lightbulb,
            label: l10n.quizTeacherInstructions,
            body: variant.teacherInstructions!,
          ),
          const SizedBox(height: AppSpacing.space4),
        ],
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: questions.isEmpty ? null : onToggleAll,
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
            isRevealed: revealed.contains(i),
            onToggle: () => onToggle(i),
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
              Expanded(child: RichMarkdown(question.questionText)),
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
                            RichMarkdown(question.correctAnswer),
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
                            RichMarkdown(question.explanation!, muted: true),
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
          Expanded(child: RichMarkdown(label)),
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
