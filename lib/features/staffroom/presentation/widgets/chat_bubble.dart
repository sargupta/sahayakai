import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/avatar_initials.dart';
import '../../domain/chat_message.dart';
import 'chat_parts.dart';
import 'staffroom_avatar.dart';

/// One message in the Staff Room / group chat (SPEC §A3.2), drawn as a chat
/// bubble rather than a card.
///
///   • **OWN** (`authorId == myUid`, and never the demo persona) → aligned
///     end, the filled accent (saffron-600) with white text, the tail at the
///     bottom-end. No author line.
///   • **OTHERS** → aligned start with a 32px [StaffroomAvatar] beside a
///     card-surface bubble: the author's name in their avatar tint's ink, the
///     text, then the time small and right-aligned. The tail is bottom-start.
///   • **AI PERSONA** (`isDemoPersona`) → the same as others, honestly
///     disclosed twice: a small sparkles badge on the avatar AND an
///     "AI teacher" chip after the name. A real bubble, never posing as a
///     real teacher.
///
/// In a run of messages from one author only the first shows the name and the
/// avatar ([showAuthor]); the rest keep the avatar's slot so the run lines up,
/// and a [continued] bubble tucks its top corner on the tail side.
///
/// A voice note (`audioUrl`) is shown honestly as a "Voice note" row: this
/// build has no player for a chat recording, so it offers no play button.
///
/// The screen reader hears one sentence per bubble: author, "AI teacher",
/// the text, the time.
///
/// Contrast (light): white on saffron-600 ≈ 5.4:1; ink-900 on the card
/// surface ≈ 17:1; the muted time ≈ 5.6:1; each avatar tint's ink on the card
/// surface ≥ 5:1; the AI chip's ink on its tint ≥ 4.5:1.
class ChatBubble extends StatelessWidget {
  const ChatBubble({
    super.key,
    required this.message,
    required this.myUid,
    this.showAuthor = true,
    this.continued = false,
  });

  final ChatMessage message;
  final String myUid;

  /// First of a run from this author: show the avatar and the name line.
  final bool showAuthor;

  /// Same author as the bubble above (tucks the tail-side top corner).
  final bool continued;

  /// An AI persona message is never "mine", even if the demo reuses my uid.
  bool get _mine => message.authorId == myUid && !message.isDemoPersona;
  bool get _persona => message.isDemoPersona;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final width = MediaQuery.sizeOf(context).width;
    final time = chatTimeLabel(context, message.createdAt);
    final name = message.authorName.trim();
    final body = message.text.trim();

    final spoken = [
      if (_mine) l10n.cmChatYou else if (name.isNotEmpty) name,
      if (_persona) l10n.staffroomChatAiBadge,
      if (message.hasAudio) l10n.inboxVoiceNoteLabel,
      if (body.isNotEmpty) body,
      if (time.isNotEmpty) time,
    ].join(', ');

    final content = IntrinsicWidth(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (!_mine && showAuthor && (name.isNotEmpty || _persona)) ...[
            _AuthorLine(name: name, persona: _persona),
            const SizedBox(height: 3),
          ],
          if (message.hasAudio) ...[
            _VoiceNoteRow(mine: _mine),
            if (body.isNotEmpty) const SizedBox(height: AppSpacing.space1),
          ],
          if (body.isNotEmpty)
            Text(
              message.text,
              textHeightBehavior: kChatTextHeight,
              style: chatBodyStyle(context, mine: _mine),
            ),
          if (time.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              time,
              textAlign: TextAlign.end,
              style: chatTimeStyle(context, mine: _mine),
            ),
          ],
        ],
      ),
    );

    final bubble = DecoratedBox(
      decoration: _mine
          ? chatMineBubbleDecoration(continued: continued)
          : chatOtherBubbleDecoration(continued: continued),
      child: Padding(padding: kChatBubblePadding, child: content),
    );

    final Widget laidOut;
    if (_mine) {
      laidOut = Align(
        alignment: AlignmentDirectional.centerEnd,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: width * 0.78),
          child: bubble,
        ),
      );
    } else {
      laidOut = Align(
        alignment: AlignmentDirectional.centerStart,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: width * 0.88),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (showAuthor)
                _ChatAvatar(message: message)
              else
                const SizedBox(width: _avatarSize),
              const SizedBox(width: AppSpacing.space2),
              Flexible(child: bubble),
            ],
          ),
        ),
      );
    }

    return Semantics(
      container: true,
      label: spoken,
      excludeSemantics: true,
      child: laidOut,
    );
  }
}

const double _avatarSize = 32;

/// The 32px avatar; an AI persona carries a small sparkles badge on it.
class _ChatAvatar extends StatelessWidget {
  const _ChatAvatar({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final avatar = StaffroomAvatar(
      name: message.authorName,
      photoUrl: message.authorPhotoURL,
      size: _avatarSize,
    );
    if (!message.isDemoPersona) return avatar;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        avatar,
        PositionedDirectional(
          end: -3,
          bottom: -3,
          child: Container(
            width: 15,
            height: 15,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.surfaceCard,
            ),
            alignment: Alignment.center,
            child: const Icon(
              LucideIcons.sparkles,
              size: 9,
              color: AppColors.tileSaffronInk,
            ),
          ),
        ),
      ],
    );
  }
}

/// The name in the author's own avatar ink, then the honest "AI teacher" chip
/// for a persona. Wraps (never truncates) at large text sizes.
class _AuthorLine extends StatelessWidget {
  const _AuthorLine({required this.name, required this.persona});

  final String name;
  final bool persona;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final (_, ink) = avatarTint(name);
    return Wrap(
      spacing: 6,
      runSpacing: 2,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        if (name.isNotEmpty)
          Text(
            name,
            style: text.labelMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: ink,
            ),
          ),
        if (persona)
          DecoratedBox(
            decoration: const BoxDecoration(
              color: AppColors.tileSaffronBg,
              borderRadius: AppRadius.rPill,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
              child: Text(
                context.l10n.staffroomChatAiBadge,
                style: text.labelSmall?.copyWith(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.tileSaffronInk,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// An honest voice-note line: a mic glyph and the words "Voice note". There is
/// no chat-audio player in this build, so there is no play button and no
/// pretend waveform.
class _VoiceNoteRow extends StatelessWidget {
  const _VoiceNoteRow({required this.mine});

  final bool mine;

  @override
  Widget build(BuildContext context) {
    final ink = mine ? AppColors.textOnAccent : AppColors.tileSaffronInk;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(LucideIcons.mic, size: 16, color: ink),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            context.l10n.inboxVoiceNoteLabel,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              fontWeight: FontWeight.w600,
              color: ink,
            ),
          ),
        ),
      ],
    );
  }
}
