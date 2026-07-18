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
import '../../../../shared/widgets/bullet_dot.dart';
import '../../../../shared/widgets/document_sheet.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/note_banner.dart';
import '../../../../shared/widgets/score_ring.dart';
import '../../../../shared/widgets/secondary_button.dart';
import '../../domain/assessment.dart';

/// Renders a graded [Assessment] as a printed scorecard, not a chat dump
/// (PREMIUM_DESIGN_SPEC.md §5 / §6b U8 — the reference every other tool copies).
///
/// The scorecard is wrapped in a [DocumentSheet]: a masthead ("ASSESS
/// ASSIGNMENT" eyebrow, a Fraunces "Assessment" title, saffron rule, points /
/// confidence meta badges), a hero [ScoreRing] gauge (overallScore over 100),
/// per-criterion inset cards, and the strengths / to-work-on / next-steps /
/// transcript / teacher-note sections.
///
/// It renders DEFENSIVELY — every section appears only when the model returned
/// it — because the shape varies by mode: a `transcribe`-only pass leads with
/// the transcript and shows no ScoreRing, while a `full` grade shows everything.
/// All model prose flows through [AiText] (line-height 1.7 + Indic height
/// behaviour) so matras never clip. Each block inks in on the Ink-settle reveal;
/// a footer action bar offers Regenerate / Copy. See DESIGN_RUBRIC §3 / §8 /
/// §12.
class AssessAssignmentResultView extends StatelessWidget {
  const AssessAssignmentResultView({
    super.key,
    required this.assessment,
    this.onRegenerate,
  });

  final Assessment assessment;

  /// Re-runs grading from the current form (the controller's `assess`). When
  /// null (e.g. a direct render in a test) the footer action bar is omitted.
  final VoidCallback? onRegenerate;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    if (assessment.isEmpty) {
      return EmptyView(
        message: l10n.assessNoContent,
        icon: LucideIcons.fileText,
      );
    }

    final percent = assessment.scorePercent;
    final hasRubric = assessment.rubric?.title.isNotEmpty ?? false;

    // Points and confidence ride in the masthead; the score is the hero gauge.
    final meta = <Widget>[
      if (assessment.pointsPossible != null && assessment.pointsPossible! > 0)
        AppBadge(
          icon: LucideIcons.target,
          label: l10n.assessPoints(
            _formatNum(assessment.pointsEarned ?? 0),
            _formatNum(assessment.pointsPossible!),
          ),
          tone: AppBadgeTone.accent,
        ),
      if (assessment.confidencePercent != null)
        AppBadge(
          icon: LucideIcons.gauge,
          label: l10n.assessConfidence('${assessment.confidencePercent}'),
        ),
    ];

    // The document blocks, in reading order. Content is unchanged from the flat
    // renderer — only the composition around it is new.
    final blocks = <Widget>[
      if (percent != null || hasRubric)
        _ScoreHero(assessment: assessment, percent: percent),
      if (assessment.warnings.isNotEmpty)
        _WarningsCard(warnings: assessment.warnings),
      if (assessment.displayTranscript != null)
        DocumentSheetSection(
          title: l10n.assessTranscriptSection,
          child: AiText(assessment.displayTranscript!),
        ),
      if (assessment.perCriterionScores.isNotEmpty)
        DocumentSheetSection(
          title: l10n.assessCriteriaSection,
          child: _CriteriaList(scores: assessment.perCriterionScores),
        ),
      if (assessment.strengths.isNotEmpty)
        DocumentSheetSection(
          title: l10n.assessStrengthsSection,
          child: _Bullets(items: assessment.strengths),
        ),
      if (assessment.improvements.isNotEmpty)
        DocumentSheetSection(
          title: l10n.assessImprovementsSection,
          child: _Bullets(items: assessment.improvements),
        ),
      if (assessment.nextSteps.isNotEmpty)
        DocumentSheetSection(
          title: l10n.assessNextStepsSection,
          child: _Bullets(items: assessment.nextSteps),
        ),
      if (assessment.teacherNote != null)
        DocumentSheetSection(
          title: l10n.assessTeacherNoteSection,
          child: AiText(assessment.teacherNote!),
        ),
    ];

    // Ink-settle: each block fades + rises in turn, so the document assembles
    // itself. Degrades to the static composed frame under reduce-motion.
    final revealed = <Widget>[
      for (var i = 0; i < blocks.length; i++)
        inkSettle(context, blocks[i], index: i),
    ];

    return DocumentSheet(
      docType: l10n.assessTitle,
      title: l10n.assessResultTitle,
      meta: meta,
      footer: onRegenerate == null
          ? null
          : _ActionBar(assessment: assessment, onRegenerate: onRegenerate!),
      children: revealed,
    );
  }
}

/// The scorecard headline: a hero [ScoreRing] gauge (the overall score out of
/// 100) over the rubric it was measured against. The number lives inside the
/// ring in `onSurface` (maximum contrast, AA in both themes); saffron is
/// confined to the ring's progress arc and the tick, never used as score text.
class _ScoreHero extends StatelessWidget {
  const _ScoreHero({required this.assessment, required this.percent});

  final Assessment assessment;
  final int? percent;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final rubric = assessment.rubric;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (percent != null)
          Center(child: ScoreRing(score: percent!, max: 100)),
        if (rubric != null && rubric.title.isNotEmpty) ...[
          if (percent != null) const SizedBox(height: AppSpacing.space4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                LucideIcons.clipboardCheck,
                size: AppIconSize.inline,
                color: scheme.onSurfaceVariant,
              ),
              const SizedBox(width: AppSpacing.space2),
              Expanded(
                child: Text(
                  l10n.assessRubricUsed(rubric.title),
                  style: text.bodySmall
                      ?.copyWith(color: scheme.onSurfaceVariant, height: 1.4),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

/// Advisories from the grader (blank page, faint photo, partial writing,
/// language mismatch). Rendered as a calm note, not a red error — they are
/// guidance, and a blank-page warning is the most important thing a teacher can
/// read here.
class _WarningsCard extends StatelessWidget {
  const _WarningsCard({required this.warnings});

  final List<String> warnings;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    final messages = warnings
        .map((w) => _warningMessage(l10n, w))
        .where((m) => m != null)
        .cast<String>()
        .toList(growable: false);
    if (messages.isEmpty) return const SizedBox.shrink();

    return NoteBanner.custom(
      icon: LucideIcons.alertTriangle,
      label: l10n.assessWarningsSection,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < messages.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.space2),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const BulletDot(),
                const SizedBox(width: AppSpacing.space3),
                Expanded(child: AiText(messages[i])),
              ],
            ),
          ],
        ],
      ),
    );
  }

  String? _warningMessage(AppLocalizations l10n, String code) =>
      switch (code.trim()) {
        'page_appears_blank' => l10n.assessWarningBlank,
        'low_contrast' => l10n.assessWarningLowContrast,
        'partial_writing' => l10n.assessWarningPartial,
        'language_mismatch' => l10n.assessWarningLanguageMismatch,
        // An unknown code is skipped rather than shown raw — a machine token is
        // not teacher-facing copy.
        _ => null,
      };
}

/// The per-criterion scores as numbered-grammar inset cards.
class _CriteriaList extends StatelessWidget {
  const _CriteriaList({required this.scores});

  final List<CriterionScore> scores;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < scores.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space3),
          _CriterionCard(score: scores[i]),
        ],
      ],
    );
  }
}

class _CriterionCard extends StatelessWidget {
  const _CriterionCard({required this.score});

  final CriterionScore score;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;

    final badges = <Widget>[
      if (score.level != null && score.level!.isNotEmpty)
        AppBadge(label: score.level!, size: AppBadgeSize.small),
      if (score.points != null && score.maxPoints != null)
        AppBadge(
          tone: AppBadgeTone.accent,
          size: AppBadgeSize.small,
          label: l10n.assessCriterionPoints(
            _formatNum(score.points!),
            _formatNum(score.maxPoints!),
          ),
        ),
      if (score.isLowConfidence)
        AppBadge(
          icon: LucideIcons.gauge,
          size: AppBadgeSize.small,
          label: l10n.assessLowConfidence,
        ),
    ];

    return AppCard(
      variant: AppCardVariant.inset,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(score.criterionName, style: text.titleMedium),
          if (badges.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space3),
            Wrap(
              spacing: AppSpacing.space2,
              runSpacing: AppSpacing.space2,
              children: badges,
            ),
          ],
          if (score.feedback != null) ...[
            const SizedBox(height: AppSpacing.space3),
            AiText(score.feedback!),
          ],
        ],
      ),
    );
  }
}

/// A plain vertical bullet list (strengths / to-work-on / next-steps).
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

/// The document's action bar: Regenerate (secondary) over a Copy ghost. Copy
/// exports the scorecard as plain text to the clipboard — a presentation-only
/// action, no controller involved and no student name (grading carries none).
class _ActionBar extends StatelessWidget {
  const _ActionBar({required this.assessment, required this.onRegenerate});

  final Assessment assessment;
  final VoidCallback onRegenerate;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final text = Theme.of(context).textTheme;
    final saffron = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;
    final messenger = ScaffoldMessenger.of(context);

    void copy() {
      Clipboard.setData(ClipboardData(text: _assessmentAsText(assessment, l10n)));
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

/// A plain-text export of the scorecard, for the clipboard. Carries no student
/// name — grading collects none.
String _assessmentAsText(Assessment assessment, AppLocalizations l10n) {
  final b = StringBuffer();
  final percent = assessment.scorePercent;
  if (percent != null) {
    b.writeln('$percent ${l10n.assessScoreOutOf}');
  }
  if (assessment.pointsPossible != null && assessment.pointsPossible! > 0) {
    b.writeln(l10n.assessPoints(
      _formatNum(assessment.pointsEarned ?? 0),
      _formatNum(assessment.pointsPossible!),
    ));
  }

  void proseSection(String title, String? body) {
    if (body == null || body.trim().isEmpty) return;
    b
      ..writeln()
      ..writeln(title)
      ..writeln(body);
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

  proseSection(l10n.assessTranscriptSection, assessment.displayTranscript);
  if (assessment.perCriterionScores.isNotEmpty) {
    b
      ..writeln()
      ..writeln(l10n.assessCriteriaSection);
    for (final c in assessment.perCriterionScores) {
      final pts = (c.points != null && c.maxPoints != null)
          ? ' (${l10n.assessCriterionPoints(_formatNum(c.points!), _formatNum(c.maxPoints!))})'
          : '';
      b.writeln('- ${c.criterionName}$pts');
      if (c.feedback != null && c.feedback!.trim().isNotEmpty) {
        b.writeln('  ${c.feedback}');
      }
    }
  }
  bulletSection(l10n.assessStrengthsSection, assessment.strengths);
  bulletSection(l10n.assessImprovementsSection, assessment.improvements);
  bulletSection(l10n.assessNextStepsSection, assessment.nextSteps);
  proseSection(l10n.assessTeacherNoteSection, assessment.teacherNote);
  return b.toString().trimRight();
}

/// Formats a points value for a badge: a whole number drops its `.0`
/// (`4.0` -> `4`), a decimal is kept (`2.5` -> `2.5`).
String _formatNum(num value) {
  if (value == value.roundToDouble()) return value.toInt().toString();
  return value.toString();
}
