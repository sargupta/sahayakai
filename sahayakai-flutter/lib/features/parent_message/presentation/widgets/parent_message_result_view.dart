import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/platform/share_service.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/document_sheet.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/secondary_button.dart';
import '../../domain/parent_message.dart';

/// Renders a drafted [ParentMessage] as a printed letter, not a chat dump
/// (PREMIUM_DESIGN_SPEC.md §5 / §6b U8 — the reference every other tool copies).
///
/// The message is wrapped in a [DocumentSheet]: a masthead ("PARENT MESSAGE"
/// eyebrow, a Fraunces "Message home" title, saffron rule, language/word-count
/// meta badges), the parent-facing message body, and a footer action bar with
/// the two result actions that are the point of this screen — copy-to-clipboard
/// and share — plus an optional Regenerate.
///
/// THE MESSAGE IS IN THE PARENT'S LANGUAGE, whose script may differ from the
/// app's UI locale (a Tamil message drafted from an English UI). It is rendered
/// through [AiText] — line-height 1.7, height applied to first ascent / last
/// descent, and the Indic font fallback baked into `bodyMedium` — so the Tamil
/// glyphs shape and no matra clips even though the surrounding chrome is Latin.
class ParentMessageResultView extends StatelessWidget {
  const ParentMessageResultView({
    super.key,
    required this.message,
    this.onRegenerate,
  });

  final ParentMessage message;

  /// Re-drafts the message from the current form (the controller's `draft`).
  /// Copy and Share are always present; Regenerate appears only when a callback
  /// is provided (e.g. omitted in a direct-render test).
  final VoidCallback? onRegenerate;

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

    final meta = <Widget>[
      if (message.languageCode != null)
        AppBadge(
          icon: LucideIcons.languages,
          label: message.languageCode!,
          tone: AppBadgeTone.accent,
        ),
      if (message.wordCount != null)
        AppBadge(
          icon: LucideIcons.type,
          label: l10n.parentMessageWordCount(message.wordCount!),
        ),
    ];

    // The letter body is the whole document, so it is the single block — the
    // DocumentSheet itself is the paper (no card-in-card). Indic-safe AiText.
    final revealed = <Widget>[
      inkSettle(context, AiText(message.message), index: 0),
    ];

    return DocumentSheet(
      docType: l10n.parentMessageTitle,
      title: l10n.parentMessageResultTitle,
      meta: meta,
      footer: _ActionBar(message: message.message, onRegenerate: onRegenerate),
      children: revealed,
    );
  }
}

/// The document's action bar: an optional Regenerate over Copy + Share — the
/// reason this screen exists. Both actions are >= 48dp and wrap to two lines
/// rather than clipping a long translated label at textScale 1.3. Share is
/// behind [ShareService] so a test can assert it was invoked without popping the
/// real OS sheet; Copy writes the system clipboard and confirms with a snackbar.
class _ActionBar extends ConsumerWidget {
  const _ActionBar({required this.message, this.onRegenerate});

  final String message;
  final VoidCallback? onRegenerate;

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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (onRegenerate != null) ...[
          SecondaryButton(
            label: l10n.actionRegenerate,
            icon: LucideIcons.refreshCw,
            onPressed: onRegenerate,
          ),
          const SizedBox(height: AppSpacing.space3),
        ],
        Wrap(
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
        ),
      ],
    );
  }
}
