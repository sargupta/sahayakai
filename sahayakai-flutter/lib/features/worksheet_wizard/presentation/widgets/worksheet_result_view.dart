import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/bullet_dot.dart';
import '../../../../shared/widgets/document_sheet.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/inline_error.dart';
import '../../../../shared/widgets/note_banner.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../../../shared/widgets/read_aloud_button.dart';
import '../../../../shared/widgets/rich_markdown.dart';
import '../../../../shared/widgets/secondary_button.dart';
import '../../domain/worksheet.dart';
import '../worksheet_controller.dart';

/// Renders a generated [Worksheet] as a printed document, not a chat dump
/// (PREMIUM_DESIGN_SPEC.md §5 / §6b U8 — the reference every other tool copies).
///
/// The worksheet is wrapped in a [DocumentSheet]: a masthead ("WORKSHEET"
/// eyebrow, the worksheet title as a Fraunces title, saffron rule,
/// grade/subject meta badges), then the learning objectives, student
/// instructions, numbered activities (as inset cards with saffron numeral
/// medallions) and the answer key. Each block inks in on the Ink-settle reveal,
/// and a footer action bar offers Regenerate / Copy.
///
/// All model-authored content flows through [RichMarkdown] — the worksheet flow is
/// instructed to emit math as LaTeX (`$…$` / `$$…$$`) and may use markdown, so it
/// is typeset, not printed raw; it keeps [AiText]'s line-height 1.7 metrics so
/// matras and vowel signs never clip. See DESIGN_RUBRIC §3 / §8.
class WorksheetResultView extends StatelessWidget {
  const WorksheetResultView({
    super.key,
    required this.worksheet,
    this.onRegenerate,
    this.saveRequest,
  });

  final Worksheet worksheet;

  /// Re-runs generation from the current form (the controller's `generate`).
  /// When null (e.g. a direct render in a test) the footer action bar is
  /// omitted.
  final VoidCallback? onRegenerate;

  /// The request that produced [worksheet]. Supplies the prompt / language the
  /// `POST /api/content/save` body needs (the model output alone carries no
  /// prompt or language). When null — or when [onRegenerate] is null, so there
  /// is no live generation behind the result — the Save action is omitted and
  /// the footer falls back to Regenerate / Copy only.
  final WorksheetRequest? saveRequest;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    if (worksheet.isEmpty) {
      return EmptyView(
        message: l10n.worksheetNoContent,
        icon: LucideIcons.fileText,
      );
    }

    final title =
        worksheet.title.isNotEmpty ? worksheet.title : l10n.worksheetTitle;

    final meta = <Widget>[
      if (worksheet.gradeLevel != null)
        AppBadge(
          icon: LucideIcons.graduationCap,
          label: worksheet.gradeLevel!,
          tone: AppBadgeTone.accent,
        ),
      if (worksheet.subject != null)
        AppBadge(icon: LucideIcons.bookOpen, label: worksheet.subject!),
    ];

    // The document blocks, in reading order. Content is unchanged from the flat
    // renderer — only the composition around it is new.
    final blocks = <Widget>[
      if (worksheet.learningObjectives.isNotEmpty)
        DocumentSheetSection(
          title: l10n.worksheetObjectives,
          child: _Bullets(items: worksheet.learningObjectives),
        ),
      if (worksheet.studentInstructions != null)
        DocumentSheetSection(
          title: l10n.worksheetInstructions,
          child: RichMarkdown(worksheet.studentInstructions!),
        ),
      if (worksheet.activities.isNotEmpty)
        DocumentSheetSection(
          title: l10n.worksheetActivities,
          child: _Activities(activities: worksheet.activities),
        ),
      if (worksheet.answerKey.isNotEmpty)
        DocumentSheetSection(
          title: l10n.worksheetAnswerKey,
          child: _AnswerKey(entries: worksheet.answerKey),
        ),
    ];

    // Ink-settle: each block fades + rises in turn, so the document assembles
    // itself. Degrades to the static composed frame under reduce-motion.
    final revealed = <Widget>[
      for (var i = 0; i < blocks.length; i++)
        inkSettle(context, blocks[i], index: i),
    ];

    return DocumentSheet(
      docType: l10n.worksheetTitle,
      title: title,
      meta: meta,
      footer: onRegenerate == null
          ? null
          : _ActionBar(
              worksheet: worksheet,
              onRegenerate: onRegenerate!,
              saveRequest: saveRequest,
            ),
      children: revealed,
    );
  }
}

/// The document's action bar: the PUT-to-library Save (when a [saveRequest] is
/// available) over Regenerate (secondary) and a Copy ghost. Copy exports the
/// worksheet as plain text to the clipboard — a presentation-only action, no
/// controller involved.
class _ActionBar extends StatelessWidget {
  const _ActionBar({
    required this.worksheet,
    required this.onRegenerate,
    this.saveRequest,
  });

  final Worksheet worksheet;
  final VoidCallback onRegenerate;
  final WorksheetRequest? saveRequest;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final text = Theme.of(context).textTheme;
    final saffron = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;
    final messenger = ScaffoldMessenger.of(context);

    void copy() {
      Clipboard.setData(ClipboardData(text: _worksheetAsText(worksheet, l10n)));
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(l10n.copyConfirmation)));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (saveRequest != null) ...[
          _SaveBar(worksheet: worksheet, request: saveRequest!),
          const SizedBox(height: AppSpacing.space3),
        ],
        SecondaryButton(
          label: l10n.actionRegenerate,
          icon: LucideIcons.refreshCw,
          onPressed: onRegenerate,
        ),
        const SizedBox(height: AppSpacing.space2),
        ReadAloudButton(
          text: _worksheetAsText(worksheet, l10n),
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

/// The POST-to-library save action. Reads the save controller so the button
/// reflects saving / saved / failed without ever disturbing the rendered
/// worksheet. Mirrors the exam-paper `_SaveBar`.
class _SaveBar extends ConsumerWidget {
  const _SaveBar({required this.worksheet, required this.request});

  final Worksheet worksheet;
  final WorksheetRequest request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final state = ref.watch(worksheetSaveControllerProvider);

    Future<void> save() =>
        ref.read(worksheetSaveControllerProvider.notifier).save(
              worksheet: worksheet,
              prompt: request.prompt,
              gradeLevel: request.gradeLevel,
              language: request.language,
            );

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
              l10n.worksheetSaved,
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
            title: l10n.worksheetSaveFailedTitle,
            message: l10n.worksheetSaveFailedBody,
          ),
          const SizedBox(height: AppSpacing.space3),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              onPressed: save,
              icon:
                  const Icon(LucideIcons.refreshCw, size: AppIconSize.inline),
              label: Text(l10n.worksheetSaveRetry),
            ),
          ),
        ],
      );
    }

    // Idle or saving — the primary action, a saffron CTA whose width holds while
    // it spins.
    final saving = state.isLoading;
    return PrimaryButton(
      label: saving ? l10n.worksheetSaving : l10n.worksheetSave,
      icon: saving ? null : LucideIcons.save,
      isBusy: saving,
      onPressed: save,
    );
  }
}

/// A plain-text export of the worksheet, for the clipboard.
String _worksheetAsText(Worksheet worksheet, AppLocalizations l10n) {
  final b = StringBuffer();
  if (worksheet.title.isNotEmpty) b.writeln(worksheet.title);
  final metaBits = [worksheet.gradeLevel, worksheet.subject]
      .whereType<String>()
      .toList();
  if (metaBits.isNotEmpty) b.writeln(metaBits.join(' · '));

  if (worksheet.learningObjectives.isNotEmpty) {
    b
      ..writeln()
      ..writeln(l10n.worksheetObjectives);
    for (final line in worksheet.learningObjectives) {
      b.writeln('- $line');
    }
  }
  if (worksheet.studentInstructions != null) {
    b
      ..writeln()
      ..writeln(l10n.worksheetInstructions)
      ..writeln(worksheet.studentInstructions);
  }
  if (worksheet.activities.isNotEmpty) {
    b
      ..writeln()
      ..writeln(l10n.worksheetActivities);
    for (var i = 0; i < worksheet.activities.length; i++) {
      b.writeln('${i + 1}. ${worksheet.activities[i].content}');
    }
  }
  if (worksheet.answerKey.isNotEmpty) {
    b
      ..writeln()
      ..writeln(l10n.worksheetAnswerKey);
    for (final entry in worksheet.answerKey) {
      final n = entry.displayNumber;
      b.writeln(n == null ? '- ${entry.answer}' : '$n. ${entry.answer}');
    }
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
              Expanded(child: RichMarkdown(items[i])),
            ],
          ),
        ],
      ],
    );
  }
}

/// The worksheet activities as numbered inset cards, each led by a saffron
/// numeral medallion (mirrors the U8 activity cards).
class _Activities extends StatelessWidget {
  const _Activities({required this.activities});

  final List<WorksheetActivity> activities;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
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
              Expanded(child: RichMarkdown(activity.content)),
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

/// The answer key as one inset panel. Each entry points back at the activity it
/// answers via its 1-based number (from the backend's 0-based `activityIndex`);
/// a missing index falls back to a bullet so the answer is never orphaned.
class _AnswerKey extends StatelessWidget {
  const _AnswerKey({required this.entries});

  final List<AnswerKeyEntry> entries;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      variant: AppCardVariant.inset,
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
        Expanded(child: RichMarkdown(entry.answer)),
      ],
    );
  }
}

/// The saffron numeral medallion that numbers an activity (mirrors U8).
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

String _activityTypeLabel(AppLocalizations l10n, WorksheetActivityType type) =>
    switch (type) {
      WorksheetActivityType.question => l10n.worksheetActivityQuestion,
      WorksheetActivityType.puzzle => l10n.worksheetActivityPuzzle,
      WorksheetActivityType.creativeTask => l10n.worksheetActivityCreativeTask,
    };
