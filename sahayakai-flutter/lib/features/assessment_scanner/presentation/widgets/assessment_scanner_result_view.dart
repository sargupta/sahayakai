import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/domain/tool_prefill.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/bullet_dot.dart';
import '../../../../shared/widgets/document_sheet.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/note_banner.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../../../shared/widgets/read_aloud_button.dart';
import '../../../../shared/widgets/result_actions_bar.dart';
import '../../../../shared/widgets/score_ring.dart';
import '../../../../shared/widgets/secondary_button.dart';
import '../../domain/assessment_scan.dart';

/// Renders a graded [AssessmentResult] as a printed scorecard, not a chat dump
/// (PREMIUM_DESIGN_SPEC.md §5 / §6b — mirrors the Assess Assignment reference).
///
/// The scorecard is wrapped in a [DocumentSheet]: a masthead (doc-type eyebrow,
/// an "Assessment" title, saffron rule, pages / grade / to-review meta badges), a
/// hero [ScoreRing] gauge (the overall `scorePct` over 100), a per-question list
/// (each card: a number, a marks badge "{awarded}/{max}", a correct/partial/
/// incorrect chip that is icon+text — never colour alone —, and the question,
/// student answer, feedback and expected answer through [AiText]), then the
/// teacher's "Recommended next steps" and the student-facing recommendations.
///
/// All model prose flows through [AiText] (line-height 1.7 + Indic height
/// behaviour) so matras never clip, and is rendered AS-IS — the server already
/// wrote it in the requested language; the client never re-translates it. Each
/// block inks in on the Ink-settle reveal; a footer offers Regenerate / Copy.
class AssessmentScannerResultView extends StatelessWidget {
  const AssessmentScannerResultView({
    super.key,
    required this.result,
    this.onRegenerate,
  });

  final AssessmentResult result;

  /// Re-runs grading from the current form. When null (a direct render in a
  /// test) the footer action bar is omitted.
  final VoidCallback? onRegenerate;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    if (result.isEmpty) {
      return EmptyView(
        message: l10n.assessmentScannerNoContent,
        icon: LucideIcons.fileCheck,
      );
    }

    // Pages, letter grade and a review count ride in the masthead; the score is
    // the hero gauge.
    final meta = <Widget>[
      AppBadge(
        icon: LucideIcons.fileText,
        label: l10n.assessmentScannerPagesMeta(result.pageCount),
      ),
      if (result.letterGrade.isNotEmpty)
        AppBadge(
          icon: LucideIcons.award,
          label: result.letterGrade,
          tone: AppBadgeTone.accent,
        ),
      if (result.needsReviewCount > 0)
        AppBadge(
          icon: LucideIcons.alertCircle,
          label: l10n.assessmentScannerReviewBadge(result.needsReviewCount),
        ),
    ];

    final weakConcepts = _weakConcepts(result);

    final blocks = <Widget>[
      _ScoreHero(result: result),
      // VIDYA reads the scorecard and offers the obvious next move (v3 screen
      // 12): a remedial worksheet on the concepts the student missed, or a
      // message home. Only when there are weak concepts to act on.
      if (weakConcepts.isNotEmpty) _RemedialPrompt(concepts: weakConcepts),
      if (result.imageQualityWarnings.isNotEmpty)
        _QualityCard(warnings: result.imageQualityWarnings),
      if (result.questions.isNotEmpty)
        DocumentSheetSection(
          title: l10n.assessmentScannerQuestionsSection,
          child: _QuestionList(questions: result.questions),
        ),
      if (result.recommendedNextSteps.isNotEmpty)
        DocumentSheetSection(
          title: l10n.assessmentScannerNextStepsSection,
          child: _Bullets(items: result.recommendedNextSteps),
        ),
      if (result.studentRecommendations.isNotEmpty)
        DocumentSheetSection(
          title: l10n.assessmentScannerStudentSection,
          child: _Bullets(items: result.studentRecommendations),
        ),
    ];

    // Ink-settle: each block fades + rises in turn, so the document assembles
    // itself. Degrades to the static composed frame under reduce-motion.
    final revealed = <Widget>[
      for (var i = 0; i < blocks.length; i++)
        inkSettle(context, blocks[i], index: i),
    ];

    return DocumentSheet(
      docType: l10n.assessmentScannerTitle,
      title: l10n.assessmentScannerResultTitle,
      meta: meta,
      footer: onRegenerate == null
          ? null
          : _ActionBar(result: result, onRegenerate: onRegenerate!),
      children: revealed,
    );
  }
}

/// The distinct concepts the student did NOT get full marks on — the weak
/// spots, in first-seen order. Drives the remedial prompt.
List<String> _weakConcepts(AssessmentResult result) {
  final seen = <String>{};
  final out = <String>[];
  for (final q in result.questions) {
    if (q.outcome == QuestionOutcome.correct) continue;
    final concept = q.conceptTested?.trim();
    if (concept == null || concept.isEmpty) continue;
    if (seen.add(concept.toLowerCase())) out.add(concept);
  }
  return out;
}

/// VIDYA's contextual next-move card (v3 screen 12): a saffron-tinted panel that
/// reads the weak concepts back as chips and offers to build a remedial
/// worksheet on them (pushing the Worksheet Wizard with them prefilled) or to
/// message the parent. A [StatelessWidget] using `context.push`, so it needs no
/// controller.
class _RemedialPrompt extends StatelessWidget {
  const _RemedialPrompt({required this.concepts});

  final List<String> concepts;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.space4),
      decoration: BoxDecoration(
        color: scheme.primaryContainer.withValues(alpha: 0.5),
        borderRadius: AppRadius.rLg,
        border: Border.all(color: scheme.primary.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              // A small saffron orb — VIDYA speaking from context.
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    center: const Alignment(-0.35, -0.4),
                    radius: 0.95,
                    colors: [
                      Color.lerp(scheme.primary, Colors.white, 0.6)!,
                      scheme.primary,
                    ],
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.space2),
              Text(
                l10n.vidyaEyebrow,
                style: text.labelSmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                  letterSpacing: 0.6,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.space2),
          Text(l10n.scanRemedialBody, style: text.bodyMedium),
          const SizedBox(height: AppSpacing.space3),
          Wrap(
            spacing: AppSpacing.space2,
            runSpacing: AppSpacing.space2,
            children: [
              for (final concept in concepts)
                AppBadge(label: concept, size: AppBadgeSize.small),
            ],
          ),
          const SizedBox(height: AppSpacing.space4),
          PrimaryButton(
            label: l10n.scanRemedialBuild,
            icon: LucideIcons.filePlus,
            onPressed: () => context.push(
              Routes.worksheetWizard,
              extra: ToolPrefill(topic: concepts.join(', ')),
            ),
          ),
          const SizedBox(height: AppSpacing.space2),
          SecondaryButton(
            label: l10n.scanRemedialMessageParents,
            icon: LucideIcons.messageCircle,
            onPressed: () => context.push(Routes.parentMessage),
          ),
        ],
      ),
    );
  }
}

/// The scorecard headline: a hero [ScoreRing] gauge (the overall score out of
/// 100) over a raw-marks caption. The number lives inside the ring in
/// `onSurface` (maximum contrast, AA in both themes); saffron is confined to the
/// ring's progress arc, never used as score text.
class _ScoreHero extends StatelessWidget {
  const _ScoreHero({required this.result});

  final AssessmentResult result;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Center(child: ScoreRing(score: result.scorePercent, max: 100)),
        if (result.totalMaxMarks > 0) ...[
          const SizedBox(height: AppSpacing.space3),
          Center(
            child: Text(
              l10n.assessmentScannerScoreCaption(
                _fmt(result.totalAwardedMarks),
                _fmt(result.totalMaxMarks),
              ),
              // onSurfaceVariant on the white/`surface` DocumentSheet card is AA
              // (the muted role passes on the card's near-white ground).
              style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
            ),
          ),
        ],
      ],
    );
  }
}

/// The per-page photo-quality advisories (blurry, glare, faint). Rendered as a
/// calm note, not a red error — they are guidance. The strings are the server's
/// own composed English advisories, shown as-is.
class _QualityCard extends StatelessWidget {
  const _QualityCard({required this.warnings});

  final List<String> warnings;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return NoteBanner.custom(
      icon: LucideIcons.alertTriangle,
      label: l10n.assessmentScannerQualitySection,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < warnings.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.space2),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const BulletDot(),
                const SizedBox(width: AppSpacing.space3),
                Expanded(child: AiText(warnings[i])),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// The graded questions as numbered inset cards.
class _QuestionList extends StatelessWidget {
  const _QuestionList({required this.questions});

  final List<GradedQuestion> questions;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < questions.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space3),
          _QuestionCard(number: i + 1, question: questions[i]),
        ],
      ],
    );
  }
}

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({required this.number, required this.question});

  final int number;
  final GradedQuestion question;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    final chips = <Widget>[
      if (question.isScored) _OutcomeChip(outcome: question.outcome),
      if (question.needsTeacherReview) const _ReviewChip(),
    ];

    return AppCard(
      variant: AppCardVariant.inset,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppBadge.count('$number'),
              const Spacer(),
              if (question.isScored)
                AppBadge(
                  icon: LucideIcons.award,
                  tone: AppBadgeTone.accent,
                  size: AppBadgeSize.small,
                  label: l10n.assessmentScannerMarks(
                    _fmt(question.marksAwarded),
                    _fmt(question.marksMax),
                  ),
                ),
            ],
          ),
          if (chips.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space3),
            Wrap(
              spacing: AppSpacing.space2,
              runSpacing: AppSpacing.space2,
              children: chips,
            ),
          ],
          if (question.questionText.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space3),
            AiText(question.questionText),
          ],
          if (question.studentAnswer.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space3),
            _MiniLabel(l10n.assessmentScannerStudentAnswerLabel),
            const SizedBox(height: AppSpacing.space1),
            AiText(question.studentAnswer),
          ],
          if (question.feedback != null) ...[
            const SizedBox(height: AppSpacing.space3),
            _MiniLabel(l10n.assessmentScannerFeedbackLabel),
            const SizedBox(height: AppSpacing.space1),
            AiText(question.feedback!),
          ],
          if (question.expectedAnswer != null) ...[
            const SizedBox(height: AppSpacing.space3),
            _MiniLabel(l10n.assessmentScannerExpectedLabel),
            const SizedBox(height: AppSpacing.space1),
            AiText(question.expectedAnswer!),
          ],
          if (!question.isScored) ...[
            const SizedBox(height: AppSpacing.space3),
            Text(
              l10n.assessmentScannerNotScored,
              // Full ink (match _MiniLabel): inside the inset card
              // (surfaceContainerLow) the muted role is only ~4.49:1.
              style: text.bodySmall?.copyWith(color: scheme.onSurface),
            ),
          ],
        ],
      ),
    );
  }
}

/// A short section sub-label inside a question card — full ink (`onSurface`) so
/// it clears AA on the inset card's near-white ground regardless of theme.
class _MiniLabel extends StatelessWidget {
  const _MiniLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final theme = Theme.of(context).textTheme;
    return Text(
      text,
      style: theme.labelMedium?.copyWith(
        color: scheme.onSurface,
        fontWeight: FontWeight.w600,
      ),
    );
  }
}

/// The correct / partly-correct / incorrect indicator. An icon + a text label,
/// so the state is NEVER conveyed by colour alone (icon shape and word both
/// differ). "Correct" carries the green `secondaryContainer` role (its
/// `onSecondaryContainer` pairing is AA by construction); the other two states
/// use the neutral `surfaceContainerHigh` fill with full-ink `onSurface` text
/// and glyph (AA in both themes), distinguished by the check/dash/cross glyph.
class _OutcomeChip extends StatelessWidget {
  const _OutcomeChip({required this.outcome});

  final QuestionOutcome outcome;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;

    final (IconData icon, String label, Color bg, Color fg) = switch (outcome) {
      QuestionOutcome.correct => (
        LucideIcons.checkCircle2,
        l10n.assessmentScannerOutcomeCorrect,
        scheme.secondaryContainer,
        scheme.onSecondaryContainer,
      ),
      QuestionOutcome.partial => (
        LucideIcons.minusCircle,
        l10n.assessmentScannerOutcomePartial,
        scheme.surfaceContainerHigh,
        scheme.onSurface,
      ),
      QuestionOutcome.incorrect => (
        LucideIcons.xCircle,
        l10n.assessmentScannerOutcomeIncorrect,
        scheme.surfaceContainerHigh,
        scheme.onSurface,
      ),
    };

    return _StatusChip(
      icon: icon,
      label: label,
      background: bg,
      foreground: fg,
    );
  }
}

/// The "needs a teacher's eye" indicator — icon + text, neutral fill, full ink.
class _ReviewChip extends StatelessWidget {
  const _ReviewChip();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return _StatusChip(
      icon: LucideIcons.alertCircle,
      label: context.l10n.assessmentScannerReviewChip,
      background: scheme.surfaceContainerHigh,
      foreground: scheme.onSurface,
    );
  }
}

/// The one status-chip shape used by the outcome and review indicators: a
/// stadium pill (matching [AppBadge]) with an icon and a label sharing one
/// colour, so both text and glyph clear their contrast bar against [background].
class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.icon,
    required this.label,
    required this.background,
    required this.foreground,
  });

  final IconData icon;
  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.space3,
        vertical: AppSpacing.space1,
      ),
      decoration: ShapeDecoration(
        color: background,
        shape: const StadiumBorder(),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: AppIconSize.inline, color: foreground),
          const SizedBox(width: AppSpacing.space2),
          Flexible(
            child: Text(
              label,
              style: text.labelMedium?.copyWith(
                color: foreground,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A plain vertical bullet list (next steps / student recommendations).
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

/// The document's action bar: Regenerate (secondary) and Read aloud over the
/// shared [ResultActionsBar] — Copy and Share. The export carries no student
/// name, because scanning collects none, so nothing identifying can leave the
/// device through the share sheet.
///
/// NO SAVE, and that is a verified constraint rather than an oversight. The
/// scanner's own backend persists its result under the content type
/// `assessment-submission` (`persist()` in
/// `sahayakai-main/src/ai/flows/assessment-scanner.ts`), and that string is NOT
/// a member of `ContentTypeSchema` in
/// `sahayakai-main/src/ai/schemas/content-schemas.ts` — the enum
/// `POST /api/content/save` validates its body against. A client Save would
/// therefore be rejected 400 by the route no matter how well-formed the rest of
/// the body was; sending `assessment` instead would file a scanner payload
/// under the assess-assignment shape, which `mapSavedAssessment` cannot decode,
/// so the Library would show a permanently blank "Ready" row. Both options are
/// worse than not offering the button. (The flow already files the scan
/// server-side under the right type, so the scan is not lost.)
class _ActionBar extends StatelessWidget {
  const _ActionBar({required this.result, required this.onRegenerate});

  final AssessmentResult result;
  final VoidCallback onRegenerate;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = _resultAsText(result, l10n);

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
          shareSubject: l10n.assessmentScannerResultTitle,
        ),
      ],
    );
  }
}

/// A plain-text export of the scorecard, for the clipboard.
String _resultAsText(AssessmentResult result, AppLocalizations l10n) {
  final b = StringBuffer();
  b.writeln('${result.scorePercent} ${l10n.assessmentScannerScoreOutOf}');
  if (result.totalMaxMarks > 0) {
    b.writeln(
      l10n.assessmentScannerScoreCaption(
        _fmt(result.totalAwardedMarks),
        _fmt(result.totalMaxMarks),
      ),
    );
  }

  if (result.questions.isNotEmpty) {
    b
      ..writeln()
      ..writeln(l10n.assessmentScannerQuestionsSection);
    var n = 0;
    for (final q in result.questions) {
      n++;
      final marks = q.isScored
          ? ' (${l10n.assessmentScannerMarks(_fmt(q.marksAwarded), _fmt(q.marksMax))})'
          : '';
      b.writeln('$n. ${q.questionText}$marks');
      if (q.feedback != null && q.feedback!.trim().isNotEmpty) {
        b.writeln('   ${q.feedback}');
      }
    }
  }

  void bulletSection(String title, Iterable<String> lines) {
    final items = lines.where((l) => l.trim().isNotEmpty).toList();
    if (items.isEmpty) return;
    b
      ..writeln()
      ..writeln(title);
    for (final line in items) {
      b.writeln('- $line');
    }
  }

  bulletSection(
    l10n.assessmentScannerNextStepsSection,
    result.recommendedNextSteps,
  );
  bulletSection(
    l10n.assessmentScannerStudentSection,
    result.studentRecommendations,
  );
  return b.toString().trimRight();
}

/// Formats a marks value for a badge: a whole number drops its `.0`
/// (`4.0` -> `4`), a decimal is kept (`2.5` -> `2.5`).
String _fmt(num value) {
  if (value == value.roundToDouble()) return value.toInt().toString();
  return value.toString();
}
