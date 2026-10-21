import 'package:flutter/material.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../domain/inbox_models.dart';
import '../inbox_time.dart';
import 'inbox_avatar.dart';

/// One inbox row (SPEC §B3.1): a `AppCard(flat)` **register row** — not a
/// chat-app row — carrying the avatar, the conversation label, the last-message
/// preview, a relative timestamp, and an unread pill.
///
/// The card is [AppCard]`(onTap:)`, so it already presses (scale 0.98, the app
/// tap-depress) and floors past the 48dp target via the 48dp avatar; tapping
/// opens the thread. Unread rows carry the saffron [AppBadge.count] pill (the
/// AA-fixed accent badge) and weight the label heavier — never a coloured fill.
///
/// WCAG AA, computed vs the ACTUAL fill (the flat card is `surface`, i.e. WHITE
/// in light — the "muted only on white" rule holds):
///   • preview + timestamp = `onSurfaceVariant` on white = **4.70:1** ✓ light /
///     `dMutedForeground` on `dCard` = ~7:1 ✓ dark;
///   • label = full-ink `onSurface` (~16.7:1);
///   • unread pill = saffron-text `#AC4815` on `primary@0.12` = ~5.14:1 ✓.
class ConversationRow extends StatelessWidget {
  const ConversationRow({
    super.key,
    required this.conversation,
    required this.myUid,
    required this.onTap,
    this.now,
  });

  final Conversation conversation;
  final String myUid;
  final VoidCallback onTap;

  /// Injectable clock so a widget test renders a deterministic relative time.
  final DateTime? now;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final text = theme.textTheme;
    final extras = AppTextExtras.of(context);

    final unread = conversation.unreadFor(myUid);
    final isUnread = unread > 0;
    final label = _label(context);
    final timestamp = inboxRelativeTime(
      conversation.lastMessageAt,
      now ?? DateTime.now(),
      l10n,
    );
    final preview = conversation.lastMessage.trim();

    return AppCard(
      onTap: onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            // Nudge the avatar to optically centre with the two text lines.
            padding: const EdgeInsets.only(top: AppSpacing.space1),
            child: InboxAvatarShim(conversation: conversation, myUid: myUid),
          ),
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
                      child: Text(
                        label,
                        style: text.titleMedium?.copyWith(
                          fontWeight: isUnread ? FontWeight.w700 : null,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (timestamp.isNotEmpty) ...[
                      const SizedBox(width: AppSpacing.space2),
                      Text(
                        timestamp,
                        style: extras.dataMedium
                            .copyWith(color: scheme.onSurfaceVariant),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: AppSpacing.space1),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: preview.isEmpty
                          // A conversation before its first message: a dignified
                          // placeholder, not an empty gap.
                          ? Text(
                              l10n.inboxNoMessagesYet,
                              style: text.bodyMedium?.copyWith(
                                color: scheme.onSurfaceVariant,
                                fontStyle: FontStyle.italic,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            )
                          // Server-authored preview prose → AiText (matra-safe).
                          // The denormalized preview is ≤80 chars (SPEC §B1).
                          : AiText(preview, muted: true),
                    ),
                    if (isUnread) ...[
                      const SizedBox(width: AppSpacing.space2),
                      Semantics(
                        label: l10n.inboxUnreadLabel(unread),
                        child: AppBadge.count(_countLabel(unread)),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
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
/// conversation-agnostic and is reused by the thread app bar.
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
    final photo =
        conversation.isGroup ? conversation.groupPhotoURL : other?.photoURL;
    return InboxAvatar(
      name: name,
      photoUrl: photo,
      isGroup: conversation.isGroup,
      size: size,
    );
  }
}
