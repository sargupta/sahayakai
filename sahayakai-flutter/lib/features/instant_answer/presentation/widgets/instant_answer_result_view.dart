import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/platform/link_opener.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/icon_well.dart';
import '../../domain/instant_answer.dart';
import 'answer_markdown_view.dart';

/// Renders an [InstantAnswer]: the model's Markdown body, the grade/subject it
/// was tailored to, and — only when the model actually suggested one — a
/// tappable card that opens the video outside the app.
class InstantAnswerResultView extends ConsumerWidget {
  const InstantAnswerResultView({super.key, required this.answer});

  final InstantAnswer answer;

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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        _MetaRow(answer: answer),
        const SizedBox(height: AppSpacing.space4),
        AppCard(
          child: AnswerMarkdownView(source: answer.answer),
        ),
        // videoSuggestionUrl is optional and null far more often than not.
        if (video != null) ...[
          const SizedBox(height: AppSpacing.space4),
          _VideoCard(
            url: video,
            onOpen: () => ref.read(linkOpenerProvider).open(video),
          ),
        ],
      ],
    );
  }
}

/// Grade / subject the answer was written for. The envelope echoes back what
/// the flow resolved (it back-fills from the profile), so this is what the
/// answer is actually pitched at, not what the form asked for.
class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.answer});

  final InstantAnswer answer;

  @override
  Widget build(BuildContext context) {
    final chips = <Widget>[
      if (answer.gradeLevel != null)
        AppBadge(icon: LucideIcons.graduationCap, label: answer.gradeLevel!),
      if (answer.subject != null)
        AppBadge(icon: LucideIcons.bookOpen, label: answer.subject!),
    ];
    if (chips.isEmpty) return const SizedBox.shrink();

    return Wrap(
      spacing: AppSpacing.space2,
      runSpacing: AppSpacing.space2,
      children: chips,
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
