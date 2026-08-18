import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/platform/link_opener.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/document_sheet.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/icon_well.dart';
import '../../../../shared/widgets/read_aloud_button.dart';
import '../../../../shared/widgets/result_actions_bar.dart';
import '../../../../shared/widgets/secondary_button.dart';
import '../../data/instant_answer_repository.dart';
import '../../domain/instant_answer.dart';
import 'answer_markdown_view.dart';

/// Renders an [InstantAnswer] as a printed document, not a chat dump
/// (PREMIUM_DESIGN_SPEC.md §5 / §6b U8 — the reference every other tool copies).
///
/// The answer is wrapped in a [DocumentSheet]: a masthead ("INSTANT ANSWER"
/// eyebrow, the teacher's [question] as the Fraunces title, saffron rule,
/// grade/subject meta badges), then an "Answer" section carrying the model's
/// Markdown body and — only when the model actually suggested one — a tappable
/// card that opens the video outside the app. Each block inks in on the
/// Ink-settle reveal, and a footer action bar offers Regenerate / Copy.
///
/// The Markdown flows through the app's own [AnswerMarkdownView] (line-height
/// 1.7 + Indic height behaviour) so matras and vowel signs never clip — the
/// matra-safe path is untouched. See DESIGN_RUBRIC §3 / §8.
class InstantAnswerResultView extends ConsumerWidget {
  const InstantAnswerResultView({
    super.key,
    required this.answer,
    this.question,
    this.onRegenerate,
    this.saveRequest,
  });

  final InstantAnswer answer;

  /// The teacher's question, used as the masthead title. Null when the view is
  /// rendered without the originating request (e.g. a direct render in a test),
  /// in which case the title falls back to the localized "Answer".
  final String? question;

  /// Re-runs the ask from the current form (the controller's `ask`). When null
  /// the footer action bar is omitted.
  final VoidCallback? onRegenerate;

  /// The request that produced [answer]. Supplies the question / grade /
  /// language the `POST /api/content/save` body needs (the model output alone
  /// carries no question). When null — or when the answer carries no verbatim
  /// [InstantAnswer.raw] to persist — the Save action is withheld and the bar
  /// offers Copy / Share only.
  final InstantAnswerRequest? saveRequest;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;

    // The model can come back with nothing usable; that is an empty state the
    // teacher can act on, not a blank card.
    if (!answer.hasAnswer) {
      return EmptyView(
        message: l10n.instantAnswerNoAnswer,
        icon: LucideIcons.helpCircle,
      );
    }

    final video = answer.videoSuggestionUrl;
    final hasQuestion = question != null && question!.trim().isNotEmpty;
    final title = hasQuestion
        ? question!.trim()
        : l10n.instantAnswerResultTitle;

    final meta = <Widget>[
      if (answer.gradeLevel != null)
        AppBadge(
          icon: LucideIcons.graduationCap,
          label: answer.gradeLevel!,
          tone: AppBadgeTone.accent,
        ),
      if (answer.subject != null)
        AppBadge(icon: LucideIcons.bookOpen, label: answer.subject!),
    ];

    // The document blocks, in reading order. Content is unchanged from the flat
    // renderer — only the composition around it is new.
    final blocks = <Widget>[
      DocumentSheetSection(
        title: l10n.instantAnswerResultTitle,
        child: AnswerMarkdownView(source: answer.answer),
      ),
      // videoSuggestionUrl is optional and null far more often than not. The DTO
      // layer already normalized it to a validated http(s) Uri, so the tap is
      // safe.
      if (video != null)
        _VideoCard(
          url: video,
          onOpen: () => ref.read(linkOpenerProvider).open(video),
        ),
    ];

    // Ink-settle: each block fades + rises in turn. Degrades to the static
    // composed frame under reduce-motion.
    final revealed = <Widget>[
      for (var i = 0; i < blocks.length; i++)
        inkSettle(context, blocks[i], index: i),
    ];

    return DocumentSheet(
      docType: l10n.instantAnswerTitle,
      title: title,
      meta: meta,
      footer: onRegenerate == null
          ? null
          : _ActionBar(
              answer: answer,
              question: hasQuestion ? question!.trim() : null,
              onRegenerate: onRegenerate!,
              saveRequest: saveRequest,
            ),
      children: revealed,
    );
  }
}

/// The document's action bar: Regenerate (secondary) and Read aloud over the
/// shared [ResultActionsBar] — Save to Library / Copy / Share.
///
/// Copy and Share both carry the question (when known) followed by the answer's
/// Markdown, which is what a teacher forwards to a colleague. Save posts the
/// verbatim model output and is offered only when there is a request behind the
/// answer AND an [InstantAnswer.raw] to persist.
class _ActionBar extends ConsumerWidget {
  const _ActionBar({
    required this.answer,
    required this.question,
    required this.onRegenerate,
    this.saveRequest,
  });

  final InstantAnswer answer;
  final String? question;
  final VoidCallback onRegenerate;
  final InstantAnswerRequest? saveRequest;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final spoken =
        ((question != null ? '$question\n\n' : '') + answer.answer.trim())
            .trimRight();
    final request = saveRequest;
    final canSave = request != null && answer.raw != null;

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
        ReadAloudButton(text: spoken),
        const SizedBox(height: AppSpacing.space3),
        ResultActionsBar(
          text: spoken,
          shareSubject: question,
          saveResetKey: answer,
          onSave: canSave
              ? () => ref
                    .read(instantAnswerRepositoryProvider)
                    .save(answer: answer, request: request)
              : null,
        ),
      ],
    );
  }
}

/// The video suggestion. A full-width card, not a link buried in prose: the
/// whole card is the target, so it clears 48dp comfortably, and the copy says
/// where the tap leads before the teacher leaves the app.
class _VideoCard extends StatelessWidget {
  const _VideoCard({required this.url, required this.onOpen});

  final Uri url;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final l10n = context.l10n;

    return AppCard(
      onTap: onOpen,
      child: Row(
        children: [
          const IconWell(icon: LucideIcons.playCircle),
          const SizedBox(width: AppSpacing.space4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(l10n.instantAnswerVideoTitle, style: text.titleMedium),
                const SizedBox(height: AppSpacing.space1),
                Text(
                  l10n.instantAnswerVideoBody,
                  style: text.bodyMedium?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.space2),
          Icon(
            LucideIcons.externalLink,
            size: AppIconSize.inline,
            color: scheme.onSurfaceVariant,
          ),
        ],
      ),
    );
  }
}
