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
import '../../../../shared/widgets/note_banner.dart';
import '../../../../shared/widgets/read_aloud_button.dart';
import '../../../../shared/widgets/secondary_button.dart';
import '../../domain/lesson_plan.dart';

/// Renders a generated [LessonPlan] as a printed document, not a chat dump
/// (PREMIUM_DESIGN_SPEC.md §5 / §6b U8 — the reference every other tool copies).
///
/// The 5E plan is wrapped in a [DocumentSheet]: a masthead ("LESSON PLAN · 5E"
/// eyebrow, Fraunces title, saffron rule, meta badges), section headers with a
/// saffron tick, numbered activities as inset cards with saffron numeral
/// medallions, and a footer action bar. Each block inks in on the Ink-settle
/// reveal. All model-authored prose still flows through [AiText] (line-height
/// 1.7 + Indic height behaviour) so matras and vowel signs never clip, and long
/// compound words wrap instead of scrolling — the matra-safety guarantee is
/// untouched. See DESIGN_RUBRIC §3 / §8.
class LessonPlanResultView extends StatelessWidget {
  const LessonPlanResultView({
    super.key,
    required this.plan,
    this.onRegenerate,
  });

  final LessonPlan plan;

  /// Re-runs generation from the current form (the controller's `generate`).
  /// When null (e.g. a saved item re-rendered read-only from the Library, or a
  /// direct render in a test) the footer action bar is omitted, mirroring
  /// every other tool's result view.
  final VoidCallback? onRegenerate;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    // The document blocks, in reading order. Content is unchanged from the flat
    // renderer — only the composition around it is new.
    final blocks = <Widget>[
      if (plan.validationWarning != null)
        NoteBanner(
          icon: LucideIcons.info,
          label: l10n.lessonPlanNoteLabel,
          body: plan.validationWarning!.message,
        ),
      if (plan.objectives.isNotEmpty)
        DocumentSheetSection(
          title: l10n.lessonPlanObjectives,
          child: _Bullets(items: plan.objectives),
        ),
      if (plan.keyVocabulary.isNotEmpty)
        DocumentSheetSection(
          title: l10n.lessonPlanVocabulary,
          child: _Vocabulary(terms: plan.keyVocabulary),
        ),
      if (plan.materials.isNotEmpty)
        DocumentSheetSection(
          title: l10n.lessonPlanMaterials,
          child: _Bullets(items: plan.materials),
        ),
      if (plan.activities.isNotEmpty)
        DocumentSheetSection(
          title: l10n.lessonPlanActivities,
          child: _Activities(activities: plan.activities),
        ),
      if (plan.assessment != null)
        DocumentSheetSection(
          title: l10n.lessonPlanAssessment,
          child: AiText(plan.assessment!),
        ),
      if (plan.homework != null)
        DocumentSheetSection(
          title: l10n.lessonPlanHomework,
          child: AiText(plan.homework!),
        ),
    ];

    // Ink-settle: each block fades + rises in turn, so the document assembles
    // itself. Degrades to the static composed frame under reduce-motion.
    final revealed = <Widget>[
      for (var i = 0; i < blocks.length; i++)
        inkSettle(context, blocks[i], index: i),
    ];

    final meta = <Widget>[
      if (plan.gradeLevel != null)
        AppBadge(
          icon: LucideIcons.graduationCap,
          label: plan.gradeLevel!,
          tone: AppBadgeTone.accent,
        ),
      if (plan.subject != null)
        AppBadge(icon: LucideIcons.bookOpen, label: plan.subject!),
      if (plan.duration != null)
        AppBadge(icon: LucideIcons.clock, label: plan.duration!),
    ];

    return DocumentSheet(
      docType: '${l10n.lessonPlanTitle} · 5E',
      title: plan.title,
      meta: meta,
      footer: onRegenerate == null
          ? null
          : _ActionBar(plan: plan, onRegenerate: onRegenerate!),
      children: revealed,
    );
  }
}

/// The document's action bar: Regenerate (secondary) over a Copy ghost. Copy
/// exports the plan as plain text to the clipboard — a presentation-only action,
/// no controller involved.
class _ActionBar extends StatelessWidget {
  const _ActionBar({required this.plan, required this.onRegenerate});

  final LessonPlan plan;
  final VoidCallback onRegenerate;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final text = Theme.of(context).textTheme;
    final saffron = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;
    final messenger = ScaffoldMessenger.of(context);

    void copy() {
      Clipboard.setData(ClipboardData(text: _planAsText(plan, l10n)));
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
        ReadAloudButton(
          text: _planAsText(plan, l10n),
          language: plan.language,
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

/// A plain-text export of the plan, for the clipboard.
String _planAsText(LessonPlan plan, AppLocalizations l10n) {
  final b = StringBuffer()..writeln(plan.title);
  final metaBits = [plan.gradeLevel, plan.subject, plan.duration]
      .whereType<String>()
      .toList();
  if (metaBits.isNotEmpty) b.writeln(metaBits.join(' · '));

  void bulletSection(String title, Iterable<String> lines) {
    if (lines.isEmpty) return;
    b
      ..writeln()
      ..writeln(title);
    for (final line in lines) {
      b.writeln('- $line');
    }
  }

  bulletSection(l10n.lessonPlanObjectives, plan.objectives);
  if (plan.keyVocabulary.isNotEmpty) {
    b
      ..writeln()
      ..writeln(l10n.lessonPlanVocabulary);
    for (final term in plan.keyVocabulary) {
      final meaning = term.meaning.isEmpty ? '' : ' — ${term.meaning}';
      b.writeln('- ${term.term}$meaning');
    }
  }
  bulletSection(l10n.lessonPlanMaterials, plan.materials);
  if (plan.activities.isNotEmpty) {
    b
      ..writeln()
      ..writeln(l10n.lessonPlanActivities);
    for (var i = 0; i < plan.activities.length; i++) {
      final a = plan.activities[i];
      b.writeln('${i + 1}. ${a.name}');
      if (a.description.isNotEmpty) b.writeln('   ${a.description}');
    }
  }
  if (plan.assessment != null) {
    b
      ..writeln()
      ..writeln(l10n.lessonPlanAssessment)
      ..writeln(plan.assessment);
  }
  if (plan.homework != null) {
    b
      ..writeln()
      ..writeln(l10n.lessonPlanHomework)
      ..writeln(plan.homework);
  }
  return b.toString().trimRight();
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

class _Vocabulary extends StatelessWidget {
  const _Vocabulary({required this.terms});

  final List<VocabularyTerm> terms;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < terms.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space3),
          Text(terms[i].term, style: text.bodyLarge),
          if (terms[i].meaning.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space1),
            AiText(terms[i].meaning, muted: true),
          ],
        ],
      ],
    );
  }
}

/// The 5E activities as numbered inset cards, each led by a saffron numeral
/// medallion.
class _Activities extends StatelessWidget {
  const _Activities({required this.activities});

  final List<LessonActivity> activities;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < activities.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space3),
          _ActivityCard(index: i + 1, activity: activities[i]),
        ],
      ],
    );
  }
}

class _ActivityCard extends StatelessWidget {
  const _ActivityCard({required this.index, required this.activity});

  final int index;
  final LessonActivity activity;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return AppCard(
      variant: AppCardVariant.inset,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Medallion(index: index),
          const SizedBox(width: AppSpacing.space3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    if (activity.phase.isNotEmpty)
                      AppBadge(
                        label: activity.phase,
                        tone: AppBadgeTone.accent,
                        size: AppBadgeSize.small,
                      ),
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
                                style: text.labelMedium?.copyWith(
                                  color: scheme.onSurfaceVariant,
                                ),
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
                  AiText(activity.description),
                ],
                if (activity.teacherTips != null) ...[
                  const SizedBox(height: AppSpacing.space3),
                  NoteBanner(
                    icon: LucideIcons.lightbulb,
                    label: l10n.lessonPlanTeacherTip,
                    body: activity.teacherTips!,
                  ),
                ],
                if (activity.understandingCheck != null) ...[
                  const SizedBox(height: AppSpacing.space3),
                  NoteBanner(
                    icon: LucideIcons.checkCircle,
                    label: l10n.lessonPlanUnderstandingCheck,
                    body: activity.understandingCheck!,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The saffron numeral medallion that numbers a 5E activity.
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
