import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/document_sheet.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/read_aloud_button.dart';
import '../../../../shared/widgets/result_actions_bar.dart';
import '../../../../shared/widgets/secondary_button.dart';
import '../../domain/parent_message.dart';

/// Renders a drafted [ParentMessage] as a printed letter, not a chat dump
/// (PREMIUM_DESIGN_SPEC.md §5 / §6b U8 — the reference every other tool copies).
///
/// The message is wrapped in a [DocumentSheet]: a masthead ("PARENT MESSAGE"
/// eyebrow, a Fraunces "Message home" title, saffron rule, language/word-count
/// meta badges), the parent-facing message body, and a footer action bar with
/// the shared [ResultActionsBar] — the two result actions that are the point of
/// this screen, copy-to-clipboard and share — plus an optional Regenerate.
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
      footer: _ActionBar(
        message: message.message,
        language: message.languageCode,
        onRegenerate: onRegenerate,
      ),
      children: revealed,
    );
  }
}

/// The document's action bar: an optional Regenerate and Read aloud over the
/// shared [ResultActionsBar] — Copy and Share, the reason this screen exists.
///
/// NO SAVE, and that is a deliberate omission rather than an oversight. A
/// parent message is a one-off note addressed to one family; it is not one of
/// the eleven content types `POST /api/content/save` accepts
/// (`ContentTypeSchema` in `sahayakai-main/src/ai/schemas/content-schemas.ts`
/// has no `parent-message` member), so a Save button here would send a body the
/// route rejects with a 400 — and even if it did not, filing a note about a
/// named child in a reusable teaching Library is the wrong home for it. Copy
/// and Share are the whole job: the message leaves for WhatsApp and is done.
class _ActionBar extends StatelessWidget {
  const _ActionBar({required this.message, this.language, this.onRegenerate});

  final String message;
  final String? language;
  final VoidCallback? onRegenerate;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

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
        ReadAloudButton(text: message, language: language),
        const SizedBox(height: AppSpacing.space3),
        ResultActionsBar(text: message),
      ],
    );
  }
}
