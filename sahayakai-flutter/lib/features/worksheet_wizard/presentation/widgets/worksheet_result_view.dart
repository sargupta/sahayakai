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
import '../../../../shared/widgets/note_banner.dart';
import '../../../../shared/widgets/section_label.dart';
import '../../domain/worksheet.dart';

/// Renders a generated [Worksheet]. All model-authored prose flows through
/// [AiText] (line-height 1.7 + Indic height behaviour) so matras and vowel
/// signs never clip, and long compound words wrap instead of scrolling.
/// See DESIGN_RUBRIC §3 / §8.
class WorksheetResultView extends StatelessWidget {
  const WorksheetResultView({super.key, required this.worksheet});

  final Worksheet worksheet;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    if (worksheet.isEmpty) {
      return EmptyView(
        message: l10n.worksheetNoContent,
        icon: LucideIcons.fileText,
      );
    }

    final sections = <Widget>[
      if (worksheet.title.isNotEmpty ||
          worksheet.gradeLevel != null ||
          worksheet.subject != null)
        _Header(worksheet: worksheet),
      if (worksheet.learningObjectives.isNotEmpty)
        _BulletSection(
          title: l10n.worksheetObjectives,
          items: worksheet.learningObjectives,
        ),
      if (worksheet.studentInstructions != null)
        _ProseSection(
          title: l10n.worksheetInstructions,
          body: worksheet.studentInstructions!,
        ),
      if (worksheet.activities.isNotEmpty)
        _ActivitiesSection(activities: worksheet.activities),
      if (worksheet.answerKey.isNotEmpty)
        _AnswerKeySection(entries: worksheet.answerKey),
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
  const _Header({required this.worksheet});

  final Worksheet worksheet;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final meta = <Widget>[
      if (worksheet.gradeLevel != null)
        AppBadge(icon: LucideIcons.graduationCap, label: worksheet.gradeLevel!),
      if (worksheet.subject != null)
        AppBadge(icon: LucideIcons.bookOpen, label: worksheet.subject!),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (worksheet.title.isNotEmpty)
          Text(worksheet.title, style: text.headlineSmall),
        if (worksheet.title.isNotEmpty && meta.isNotEmpty)
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
        AiText(body),
      ],
    );
  }
}

class _ActivitiesSection extends StatelessWidget {
  const _ActivitiesSection({required this.activities});

  final List<WorksheetActivity> activities;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionLabel(context.l10n.worksheetActivities),
        const SizedBox(height: AppSpacing.space3),
        for (var i = 0; i < activities.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space3),
          _ActivityCard(number: i + 1, activity: activities[i]),
        ],
      ],
    );
  }
}

class _ActivityCard extends StatelessWidget {
  const _ActivityCard({required this.number, required this.activity});

  final int number;
  final WorksheetActivity activity;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppBadge.count('$number'),
              const SizedBox(width: AppSpacing.space3),
              Expanded(child: AiText(activity.content)),
            ],
          ),
          if (activity.type != null) ...[
            const SizedBox(height: AppSpacing.space3),
            Align(
              alignment: Alignment.centerLeft,
              child: AppBadge(
                label: _activityTypeLabel(l10n, activity.type!),
                size: AppBadgeSize.small,
              ),
            ),
          ],
          if (activity.explanation != null) ...[
            const SizedBox(height: AppSpacing.space3),
            NoteBanner(
              icon: LucideIcons.lightbulb,
              label: l10n.worksheetExplanation,
              body: activity.explanation!,
            ),
          ],
          if (activity.chalkboardNote != null) ...[
            const SizedBox(height: AppSpacing.space3),
            NoteBanner(
              icon: LucideIcons.penTool,
              label: l10n.worksheetChalkboardNote,
              body: activity.chalkboardNote!,
            ),
          ],
        ],
      ),
    );
  }
}

/// The answer key. Each entry points back at the activity it answers via its
/// 1-based number (from the backend's 0-based `activityIndex`); a missing index
/// falls back to a bullet so the answer is never orphaned.
class _AnswerKeySection extends StatelessWidget {
  const _AnswerKeySection({required this.entries});

  final List<AnswerKeyEntry> entries;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionLabel(context.l10n.worksheetAnswerKey, icon: LucideIcons.key),
        const SizedBox(height: AppSpacing.space3),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 0; i < entries.length; i++) ...[
                if (i > 0) const SizedBox(height: AppSpacing.space3),
                _AnswerRow(entry: entries[i]),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _AnswerRow extends StatelessWidget {
  const _AnswerRow({required this.entry});

  final AnswerKeyEntry entry;

  @override
  Widget build(BuildContext context) {
    final number = entry.displayNumber;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (number != null)
          AppBadge.count('$number')
        else
          const Padding(
            padding: EdgeInsets.only(top: AppSpacing.space2),
            child: BulletDot(),
          ),
        const SizedBox(width: AppSpacing.space3),
        Expanded(child: AiText(entry.answer)),
      ],
    );
  }
}

String _activityTypeLabel(AppLocalizations l10n, WorksheetActivityType type) =>
    switch (type) {
      WorksheetActivityType.question => l10n.worksheetActivityQuestion,
      WorksheetActivityType.puzzle => l10n.worksheetActivityPuzzle,
      WorksheetActivityType.creativeTask => l10n.worksheetActivityCreativeTask,
    };
