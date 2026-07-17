import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/platform/share_service.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../domain/parent_message.dart';

/// Renders a drafted [ParentMessage]: the language/word-count meta, the
/// parent-facing message body, and the two result actions that are the point of
/// this screen — copy-to-clipboard and share (to WhatsApp / SMS via the OS
/// sheet).
///
/// THE MESSAGE IS IN THE PARENT'S LANGUAGE, whose script may differ from the
/// app's UI locale (a Tamil message drafted from an English UI). It is rendered
/// through [AiText] — line-height 1.7, height applied to first ascent / last
/// descent, and the Indic font fallback baked into `bodyMedium` — so the Tamil
/// glyphs shape and no matra clips even though the surrounding chrome is Latin.
/// The body is a plain vertical column, so the page only ever scrolls vertically.
class ParentMessageResultView extends StatelessWidget {
  const ParentMessageResultView({super.key, required this.message});

  final ParentMessage message;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    // A blank completion is an empty state the teacher can act on, not a blank
    // card.
    if (message.isEmpty) {
      return EmptyView(
        message: l10n.parentMessageNoContent,
        icon: LucideIcons.messageSquare,
      );
    }

    final sections = <Widget>[
      if (message.languageCode != null || message.wordCount != null)
        _MetaRow(message: message),
      _MessageCard(text: message.message),
      _ActionBar(message: message.message),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < sections.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space4),
          sections[i],
        ],
      ],
    );
  }
}

/// The language the message was written in and its approximate length — the
/// envelope, so the teacher can confirm at a glance it came back in the parent's
/// language before sending.
class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.message});

  final ParentMessage message;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final chips = <Widget>[
      if (message.languageCode != null)
        AppBadge(icon: LucideIcons.languages, label: message.languageCode!),
      if (message.wordCount != null)
        AppBadge(
          icon: LucideIcons.type,
          label: l10n.parentMessageWordCount(message.wordCount!),
        ),
    ];
    if (chips.isEmpty) return const SizedBox.shrink();

    return Wrap(
      spacing: AppSpacing.space2,
      runSpacing: AppSpacing.space2,
      children: chips,
    );
  }
}

/// The drafted message body, in the app's single card grammar. This is the
/// teacher's voice — the exact text that will reach the parent — so it stands
/// on its own in a card and reads through the Indic-safe prose metrics.
class _MessageCard extends StatelessWidget {
  const _MessageCard({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return AppCard(child: AiText(text));
  }
}

/// Copy + share — the reason this screen exists. Both are >= 48dp; they wrap to
/// two lines rather than clipping a long translated label at textScale 1.3.
/// Share is behind [ShareService] so a test can assert it was invoked without
/// popping the real OS sheet; copy writes the system clipboard and confirms with
/// a snackbar.
class _ActionBar extends ConsumerWidget {
  const _ActionBar({required this.message});

  final String message;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;

    Future<void> copy() async {
      await Clipboard.setData(ClipboardData(text: message));
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(content: Text(l10n.parentMessageCopied)),
        );
    }

    Future<void> share() =>
        ref.read(shareServiceProvider).shareText(message);

    return Wrap(
      spacing: AppSpacing.space3,
      runSpacing: AppSpacing.space3,
      children: [
        FilledButton.tonalIcon(
          onPressed: copy,
          style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
          icon: const Icon(LucideIcons.copy, size: AppIconSize.inline),
          label: Text(l10n.parentMessageCopy),
        ),
        FilledButton.tonalIcon(
          onPressed: share,
          style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
          icon: const Icon(LucideIcons.share2, size: AppIconSize.inline),
          label: Text(l10n.parentMessageShare),
        ),
      ],
    );
  }
}
