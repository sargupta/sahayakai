import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/bullet_dot.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/section_label.dart';
import '../../domain/assessment.dart';

/// Renders a graded [Assessment] as a scorecard: score, transcript, per-
/// criterion feedback, strengths, improvements, next steps and a teacher note.
///
/// It renders DEFENSIVELY — every section appears only when the model returned
/// it — because the shape varies by mode: a `transcribe`-only pass leads with
/// the transcript and shows no score, while a `full` grade shows everything.
/// The whole thing is a plain vertical [Column] of cards (never a nested
/// unbounded scroller), so it composes inside ToolScaffold's page scroll. All
/// model prose flows through [AiText] (line-height 1.7 + Indic height
/// behaviour). See DESIGN_RUBRIC §3 / §8 / §12.
class AssessAssignmentResultView extends StatelessWidget {
  const AssessAssignmentResultView({super.key, required this.assessment});

  final Assessment assessment;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    if (assessment.isEmpty) {
      return EmptyView(
        message: l10n.assessNoContent,
        icon: LucideIcons.fileText,
      );
    }

    final sections = <Widget>[
      if (assessment.hasScore) _ScoreCard(assessment: assessment),
      if (assessment.warnings.isNotEmpty)
        _WarningsCard(warnings: assessment.warnings),
      if (assessment.displayTranscript != null)
        _ProseSection(
          title: l10n.assessTranscriptSection,
          icon: LucideIcons.fileText,
          body: assessment.displayTranscript!,
        ),
      if (assessment.perCriterionScores.isNotEmpty)
        _CriteriaSection(scores: assessment.perCriterionScores),
      if (assessment.strengths.isNotEmpty)
        _BulletSection(
          title: l10n.assessStrengthsSection,
          icon: LucideIcons.thumbsUp,
          items: assessment.strengths,
        ),
      if (assessment.improvements.isNotEmpty)
        _BulletSection(
          title: l10n.assessImprovementsSection,
          icon: LucideIcons.trendingUp,
          items: assessment.improvements,
        ),
      if (assessment.nextSteps.isNotEmpty)
        _BulletSection(
          title: l10n.assessNextStepsSection,
          icon: LucideIcons.arrowRight,
          items: assessment.nextSteps,
        ),
      if (assessment.teacherNote != null)
        _ProseSection(
          title: l10n.assessTeacherNoteSection,
          icon: LucideIcons.messageCircle,
          body: assessment.teacherNote!,
        ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < sections.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space6),
          sections[i],
        ],
      ],
    );
  }
}

/// The headline: a large, high-contrast score with its points, confidence and
/// the rubric it was measured against. The number is [onSurface] (maximum
/// contrast, AA in both themes); saffron is confined to the accent bar and the
/// meter, never used as the score text on white.
class _ScoreCard extends StatelessWidget {
  const _ScoreCard({required this.assessment});

  final Assessment assessment;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    final percent = assessment.scorePercent;
    final meta = <Widget>[
      if (assessment.pointsPossible != null && assessment.pointsPossible! > 0)
        AppBadge(
          icon: LucideIcons.target,
          label: l10n.assessPoints(
            _formatNum(assessment.pointsEarned ?? 0),
            _formatNum(assessment.pointsPossible!),
          ),
        ),
      if (assessment.confidencePercent != null)
        AppBadge(
          icon: LucideIcons.gauge,
          label: l10n.assessConfidence('${assessment.confidencePercent}'),
        ),
    ];

    return AppCard(
      accentBar: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          SectionLabel(l10n.assessScoreLabel, icon: LucideIcons.award),
          const SizedBox(height: AppSpacing.space3),
          if (percent != null) ...[
            // Baseline-aligned "NN out of 100": the number is the hero, the
            // caption sits beside it. Wraps if a large textScale needs it.
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.end,
              spacing: AppSpacing.space2,
              children: [
                Text(
                  '$percent',
                  style: text.displaySmall?.copyWith(color: scheme.onSurface),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.space1),
                  child: Text(
                    l10n.assessScoreOutOf,
                    style: text.titleMedium
                        ?.copyWith(color: scheme.onSurfaceVariant),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.space3),
            // The score as a proportion of the cap: a legible meter, saffron on
            // a muted track (both AA), never a bare number on colour.
            ClipRRect(
              borderRadius: AppRadius.rSm,
              child: LinearProgressIndicator(
                value: percent / 100,
                minHeight: AppSpacing.space2,
                backgroundColor: scheme.surfaceContainerHigh,
                color: scheme.primary,
              ),
            ),
          ],
          if (meta.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space4),
            Wrap(
              spacing: AppSpacing.space2,
              runSpacing: AppSpacing.space2,
              children: meta,
            ),
          ],
          if (assessment.rubric != null &&
              assessment.rubric!.title.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space3),
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
                    l10n.assessRubricUsed(assessment.rubric!.title),
                    style: text.bodySmall
                        ?.copyWith(color: scheme.onSurfaceVariant, height: 1.4),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
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
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    final messages = warnings
        .map((w) => _warningMessage(l10n, w))
        .where((m) => m != null)
        .cast<String>()
        .toList(growable: false);
    if (messages.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(AppSpacing.space4),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHigh,
        borderRadius: AppRadius.rLg,
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(
                LucideIcons.alertTriangle,
                size: AppIconSize.inline,
                color: scheme.onSurfaceVariant,
              ),
              const SizedBox(width: AppSpacing.space2),
              Flexible(
                child: Text(
                  l10n.assessWarningsSection,
                  style: text.titleSmall
                      ?.copyWith(color: scheme.onSurfaceVariant),
                ),
              ),
            ],
          ),
          for (final message in messages) ...[
            const SizedBox(height: AppSpacing.space2),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const BulletDot(),
                const SizedBox(width: AppSpacing.space3),
                Expanded(child: AiText(message)),
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

/// One SectionLabel + a card of AI prose (transcript / teacher note).
class _ProseSection extends StatelessWidget {
  const _ProseSection({
    required this.title,
    required this.icon,
    required this.body,
  });

  final String title;
  final IconData icon;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionLabel(title, icon: icon),
        const SizedBox(height: AppSpacing.space3),
        AppCard(child: AiText(body)),
      ],
    );
  }
}

class _CriteriaSection extends StatelessWidget {
  const _CriteriaSection({required this.scores});

  final List<CriterionScore> scores;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionLabel(
          context.l10n.assessCriteriaSection,
          icon: LucideIcons.listChecks,
        ),
        const SizedBox(height: AppSpacing.space3),
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

/// A titled bullet list (strengths / improvements / next steps).
class _BulletSection extends StatelessWidget {
  const _BulletSection({
    required this.title,
    required this.icon,
    required this.items,
  });

  final String title;
  final IconData icon;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionLabel(title, icon: icon),
        const SizedBox(height: AppSpacing.space3),
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

/// Formats a points value for a badge: a whole number drops its `.0`
/// (`4.0` -> `4`), a decimal is kept (`2.5` -> `2.5`).
String _formatNum(num value) {
  if (value == value.roundToDouble()) return value.toInt().toString();
  return value.toString();
}
