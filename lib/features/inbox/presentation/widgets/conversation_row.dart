import 'package:flutter/material.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/map_card.dart';
import '../../domain/inbox_models.dart';
import '../inbox_time.dart';
import 'inbox_avatar.dart';

/// One conversation in a Messages list (SPEC §B3.1), in the map's chat-row
/// look: a 44px avatar, the name (bold while unread) with the time on the
/// right (accent and bold while unread), and the last message on one line with
/// an accent unread-count pill.
///
/// The row is built to sit inside a [MapCard] list whose rows are divided by
/// hairlines: pass `framed: false` and let the host draw the card and the
/// dividers. By default ([framed] true) the row carries its own [MapCard], so
/// a host that lists rows one under another still gets a card per row.
///
/// The whole row is one ≥74dp tap target that reads as one sentence: name,
/// time, preview, unread count. Unread is carried by weight, the accent time
/// and the counted pill — never by colour alone.
///
/// Contrast (light, on the near-white card): name ink-900 ≈ 17:1; preview and
/// read time (muted) ≈ 5.6:1; unread time saffron-600 ≈ 5.4:1; the pill's
/// white figures on saffron-600 ≈ 5.4:1.
class ConversationRow extends StatelessWidget {
  const ConversationRow({
    super.key,
    required this.conversation,
    required this.myUid,
    required this.onTap,
    this.now,
    this.framed = true,
  });

  final Conversation conversation;
  final String myUid;
  final VoidCallback onTap;

  /// Injectable clock so a widget test renders a deterministic relative time.
  final DateTime? now;

  /// Wrap the row in its own [MapCard]. A host that lists rows inside one
  /// shared card (hairline-divided) passes false.
  final bool framed;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;

    final unread = conversation.unreadFor(myUid);
    final isUnread = unread > 0;
    final label = _label(context);
    final timestamp = inboxRelativeTime(
      conversation.lastMessageAt,
      now ?? DateTime.now(),
      l10n,
    );
    final last = conversation.lastMessage.trim();
    // "You: …" when I wrote the last message, as in any chat list.
    final preview = last.isEmpty
        ? ''
        : (conversation.lastMessageSenderId == myUid
              ? l10n.cmThreadYouSaid(last)
              : last);

    final row = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 74),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            InboxAvatarShim(conversation: conversation, myUid: myUid, size: 44),
            const SizedBox(width: AppSpacing.space3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Expanded(
                        // A name wraps rather than being cut short.
                        child: Text(
                          label,
                          style: text.titleLarge?.copyWith(
                            fontWeight: isUnread
                                ? FontWeight.w700
                                : FontWeight.w600,
                            color: AppColors.textStrong,
                          ),
                        ),
                      ),
                      if (timestamp.isNotEmpty) ...[
                        const SizedBox(width: AppSpacing.space2),
                        Text(
                          timestamp,
                          style: text.labelMedium?.copyWith(
                            fontWeight: isUnread ? FontWeight.w700 : null,
                            color: isUnread
                                ? AppColors.textLink
                                : AppColors.textMuted,
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Expanded(
                        child: preview.isEmpty
                            // A conversation before its first message: a
                            // dignified placeholder, not an empty gap.
                            ? Text(
                                l10n.inboxNoMessagesYet,
                                style: text.bodyLarge?.copyWith(
                                  fontSize: 13.5,
                                  color: AppColors.textMuted,
                                  fontStyle: FontStyle.italic,
                                ),
                              )
                            // A one-line message preview may ellipsize; the
                            // whole message is a tap away.
                            : Text(
                                preview,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: text.bodyLarge?.copyWith(
                                  fontSize: 13.5,
                                  fontWeight: isUnread ? FontWeight.w600 : null,
                                  color: isUnread
                                      ? AppColors.textStrong
                                      : AppColors.textMuted,
                                ),
                              ),
                      ),
                      if (isUnread) ...[
                        const SizedBox(width: AppSpacing.space2),
                        _UnreadBadge(_countLabel(unread)),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );

    final spoken = [
      label,
      if (timestamp.isNotEmpty) timestamp,
      if (preview.isEmpty) l10n.inboxNoMessagesYet else preview,
      if (isUnread) l10n.inboxUnreadLabel(unread),
    ].join(', ');

    return Semantics(
      button: true,
      label: spoken,
      excludeSemantics: true,
      child: framed
          ? MapCard(padding: EdgeInsets.zero, onTap: onTap, child: row)
          : Material(
              type: MaterialType.transparency,
              child: InkWell(onTap: onTap, child: row),
            ),
    );
  }

  /// The row label: the group name, or the *other* participant's denormalized
  /// display name, falling back to a neutral "Conversation" so a degenerate
  /// participant snapshot never renders a blank line.
  String _label(BuildContext context) {
    final l10n = context.l10n;
    if (conversation.isGroup) {
      final name = conversation.name?.trim();
      return (name != null && name.isNotEmpty)
          ? name
          : l10n.inboxThreadFallbackTitle;
    }
    final other = conversation.otherParticipant(myUid)?.displayName.trim();
    return (other != null && other.isNotEmpty)
        ? other
        : l10n.inboxThreadFallbackTitle;
  }

  /// Cap the pill at "99+" so a runaway unread count never widens the row.
  static String _countLabel(int n) => n > 99 ? '99+' : '$n';
}

/// Bridges the row's [Conversation] to the shared [InboxAvatar] shape (the label
/// + photo the fallback initial is derived from) so the avatar widget stays
/// conversation-agnostic and is reused by the thread header.
class InboxAvatarShim extends StatelessWidget {
  const InboxAvatarShim({
    super.key,
    required this.conversation,
    required this.myUid,
    this.size = AppIconSize.wellBox,
  });

  final Conversation conversation;
  final String myUid;
  final double size;

  @override
  Widget build(BuildContext context) {
    final other = conversation.otherParticipant(myUid);
    final name = conversation.isGroup
        ? (conversation.name ?? '')
        : (other?.displayName ?? '');
    final photo = conversation.isGroup
        ? conversation.groupPhotoURL
        : other?.photoURL;
    return InboxAvatar(
      name: name,
      photoUrl: photo,
      isGroup: conversation.isGroup,
      size: size,
    );
  }
}

/// The map's unread badge: an accent pill (20px, wider for "99+") with white
/// figures — white on saffron-600 clears 4.5:1.
class _UnreadBadge extends StatelessWidget {
  const _UnreadBadge(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
      padding: const EdgeInsets.symmetric(horizontal: 6),
      alignment: Alignment.center,
      decoration: const ShapeDecoration(
        color: AppColors.accentFill,
        shape: StadiumBorder(),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          fontWeight: FontWeight.w700,
          color: AppColors.textOnAccent,
          fontFeatures: const [FontFeature.tabularFigures()],
        ),
      ),
    );
  }
}
