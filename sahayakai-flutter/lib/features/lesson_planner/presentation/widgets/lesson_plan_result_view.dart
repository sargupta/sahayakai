import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/bullet_dot.dart';
import '../../../../shared/widgets/section_label.dart';
import '../../domain/lesson_plan.dart';

/// Renders a generated [LessonPlan]. All model-authored prose flows through
/// [_AiText] (line-height 1.7 + Indic height behaviour) so matras and vowel
/// signs never clip, and long compound words wrap instead of scrolling.
/// See DESIGN_RUBRIC §3 / §8.
class LessonPlanResultView extends StatelessWidget {
  const LessonPlanResultView({super.key, required this.plan});

  final LessonPlan plan;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    final sections = <Widget>[
      _Header(plan: plan),
      if (plan.validationWarning != null)
        _NoteBanner(message: plan.validationWarning!.message),
      if (plan.objectives.isNotEmpty)
        _BulletSection(title: l10n.lessonPlanObjectives, items: plan.objectives),
      if (plan.keyVocabulary.isNotEmpty)
        _VocabularySection(terms: plan.keyVocabulary),
      if (plan.materials.isNotEmpty)
        _BulletSection(title: l10n.lessonPlanMaterials, items: plan.materials),
      if (plan.activities.isNotEmpty) _ActivitiesSection(plan: plan),
      if (plan.assessment != null)
        _ProseSection(title: l10n.lessonPlanAssessment, body: plan.assessment!),
      if (plan.homework != null)
        _ProseSection(title: l10n.lessonPlanHomework, body: plan.homework!),
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

class _Header extends StatelessWidget {
  const _Header({required this.plan});

  final LessonPlan plan;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final meta = <Widget>[
      if (plan.gradeLevel != null)
        _MetaChip(icon: LucideIcons.graduationCap, label: plan.gradeLevel!),
      if (plan.subject != null)
        _MetaChip(icon: LucideIcons.bookOpen, label: plan.subject!),
      if (plan.duration != null)
        _MetaChip(icon: LucideIcons.clock, label: plan.duration!),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(plan.title, style: text.headlineSmall),
        if (meta.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.space3),
          Wrap(
            spacing: AppSpacing.space2,
            runSpacing: AppSpacing.space2,
            children: meta,
          ),
        ],
      ],
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.space3,
        vertical: AppSpacing.space2,
      ),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHigh,
        borderRadius: AppRadius.rSm,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: scheme.onSurfaceVariant),
          const SizedBox(width: AppSpacing.space2),
          Flexible(
            child: Text(
              label,
              style: text.labelMedium?.copyWith(color: scheme.onSurface),
            ),
          ),
        ],
      ),
    );
  }
}

class _NoteBanner extends StatelessWidget {
  const _NoteBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.space4),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHigh,
        borderRadius: AppRadius.rMd,
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(LucideIcons.info,
              size: AppIconSize.inline, color: scheme.onSurfaceVariant),
          const SizedBox(width: AppSpacing.space3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  context.l10n.lessonPlanNoteLabel,
                  style: text.titleSmall?.copyWith(color: scheme.onSurface),
                ),
                const SizedBox(height: AppSpacing.space1),
                _AiText(message),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BulletSection extends StatelessWidget {
  const _BulletSection({required this.title, required this.items});

  final String title;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionLabel(title),
        const SizedBox(height: AppSpacing.space3),
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space2),
          _Bullet(items[i]),
        ],
      ],
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const BulletDot(),
        const SizedBox(width: AppSpacing.space3),
        Expanded(child: _AiText(text)),
      ],
    );
  }
}

class _VocabularySection extends StatelessWidget {
  const _VocabularySection({required this.terms});

  final List<VocabularyTerm> terms;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionLabel(context.l10n.lessonPlanVocabulary),
        const SizedBox(height: AppSpacing.space3),
        for (var i = 0; i < terms.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space3),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(terms[i].term, style: text.bodyLarge),
              if (terms[i].meaning.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.space1),
                _AiText(terms[i].meaning, muted: true),
              ],
            ],
          ),
        ],
      ],
    );
  }
}

class _ActivitiesSection extends StatelessWidget {
  const _ActivitiesSection({required this.plan});

  final LessonPlan plan;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionLabel(context.l10n.lessonPlanActivities),
        const SizedBox(height: AppSpacing.space3),
        for (var i = 0; i < plan.activities.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space3),
          _ActivityCard(activity: plan.activities[i]),
        ],
      ],
    );
  }
}

class _ActivityCard extends StatelessWidget {
  const _ActivityCard({required this.activity});

  final LessonActivity activity;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              if (activity.phase.isNotEmpty) _PhaseBadge(activity.phase),
              if (activity.phase.isNotEmpty && activity.duration != null)
                const SizedBox(width: AppSpacing.space2),
              if (activity.duration != null)
                Flexible(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        LucideIcons.clock,
                        size: AppIconSize.inline,
                        color: scheme.onSurfaceVariant,
                      ),
                      const SizedBox(width: AppSpacing.space1),
                      Flexible(
                        child: Text(
                          activity.duration!,
                          style: text.labelMedium
                              ?.copyWith(color: scheme.onSurfaceVariant),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          if (activity.name.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space3),
            Text(activity.name, style: text.titleMedium),
          ],
          if (activity.description.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space2),
            _AiText(activity.description),
          ],
          if (activity.teacherTips != null)
            _SubNote(
              icon: LucideIcons.lightbulb,
              label: l10n.lessonPlanTeacherTip,
              body: activity.teacherTips!,
            ),
          if (activity.understandingCheck != null)
            _SubNote(
              icon: LucideIcons.checkCircle,
              label: l10n.lessonPlanUnderstandingCheck,
              body: activity.understandingCheck!,
            ),
        ],
      ),
    );
  }
}

class _PhaseBadge extends StatelessWidget {
  const _PhaseBadge(this.phase);

  final String phase;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.space3,
        vertical: AppSpacing.space1,
      ),
      decoration: BoxDecoration(
        color: scheme.primary.withValues(alpha: 0.12),
        borderRadius: AppRadius.rSm,
      ),
      child: Text(
        phase,
        style: text.labelSmall?.copyWith(
          color: scheme.primary,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _SubNote extends StatelessWidget {
  const _SubNote({
    required this.icon,
    required this.label,
    required this.body,
  });

  final IconData icon;
  final String label;
  final String body;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Padding(
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
            Row(
              children: [
                Icon(icon, size: AppIconSize.inline, color: scheme.onSurfaceVariant),
                const SizedBox(width: AppSpacing.space2),
                Text(
                  label,
                  style: text.labelMedium?.copyWith(
                    color: scheme.onSurfaceVariant,
                    letterSpacing: 0.4,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.space1),
            _AiText(body),
          ],
        ),
      ),
    );
  }
}

class _ProseSection extends StatelessWidget {
  const _ProseSection({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionLabel(title),
        const SizedBox(height: AppSpacing.space3),
        _AiText(body),
      ],
    );
  }
}

/// AI-authored prose: line-height 1.7, height applied to first ascent / last
/// descent (so Indic top matras and bottom vowel signs are never cropped),
/// and always soft-wrapping. See DESIGN_RUBRIC §3.
class _AiText extends StatelessWidget {
  const _AiText(this.data, {this.muted = false});

  final String data;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final base = Theme.of(context).textTheme.bodyMedium!;
    return Text(
      data,
      softWrap: true,
      textHeightBehavior: const TextHeightBehavior(
        applyHeightToFirstAscent: true,
        applyHeightToLastDescent: true,
      ),
      style: base.copyWith(
        height: 1.7,
        color: muted ? scheme.onSurfaceVariant : scheme.onSurface,
      ),
    );
  }
}
