import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../data/messages_repository.dart';
import '../../domain/message_models.dart';

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/// Fetches the current user's conversation list from the backend.
/// Auto-disposes when the widget tree no longer references it.
final conversationsProvider =
    FutureProvider.autoDispose<List<Conversation>>((ref) {
  final repo = ref.watch(messagesRepositoryProvider);
  return repo.getConversations();
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/// Displays the list of direct-message conversations for the logged-in user.
///
/// Each row shows the other participant's avatar, name, last message preview,
/// relative timestamp, and an unread badge. Tapping a row navigates to the
/// conversation detail screen.
class MessagesScreen extends ConsumerStatefulWidget {
  const MessagesScreen({super.key});

  @override
  ConsumerState<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends ConsumerState<MessagesScreen> {
  // Cache the current user's UID once to avoid repeated lookups.
  String? _myUid;

  @override
  void initState() {
    super.initState();
    _myUid = FirebaseAuth.instance.currentUser?.uid;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /// Returns the display name of the *other* participant in a conversation.
  String _getOtherParticipantName(Conversation conv, String myUid) {
    final otherId = conv.participantIds.firstWhere(
      (id) => id != myUid,
      orElse: () => myUid, // fallback: self-conversation
    );
    return conv.participantNames[otherId] ?? 'Unknown';
  }

  /// Returns the photo URL of the other participant, or `null`.
  String? _getOtherParticipantPhoto(Conversation conv, String myUid) {
    final otherId = conv.participantIds.firstWhere(
      (id) => id != myUid,
      orElse: () => myUid,
    );
    return conv.participantPhotos[otherId];
  }

  /// Returns a human-readable relative timestamp (e.g. "2h ago", "3d ago").
  String _formatRelativeTime(DateTime dateTime) {
    final now = DateTime.now();
    final diff = now.difference(dateTime);

    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    if (diff.inDays < 30) return '${(diff.inDays / 7).floor()}w ago';
    return '${(diff.inDays / 30).floor()}mo ago';
  }

  /// Returns the unread count for the current user in a conversation.
  int _unreadCount(Conversation conv, String myUid) {
    return conv.unreadCounts[myUid] ?? 0;
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final asyncConversations = ref.watch(conversationsProvider);

    return GlassScaffold(
      title: 'Messages',
      showBackButton: false,
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(bottom: GlassSpacing.lg),
        child: GlassFloatingButton(
          label: 'New Message',
          icon: Icons.edit_rounded,
          onPressed: () {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  'Select a teacher from Connections to message',
                  style: GlassTypography.bodyMedium(color: Colors.white),
                ),
                behavior: SnackBarBehavior.floating,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(GlassRadius.sm),
                ),
                backgroundColor: GlassColors.textPrimary,
              ),
            );
          },
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
      body: asyncConversations.when(
        loading: _buildLoading,
        error: (error, _) => _buildError(error),
        data: (conversations) {
          if (conversations.isEmpty) return _buildEmpty();

          // Sort by lastMessageAt descending (newest first).
          final sorted = List<Conversation>.from(conversations)
            ..sort((a, b) {
              final aTime = a.lastMessageAt ?? DateTime(2000);
              final bTime = b.lastMessageAt ?? DateTime(2000);
              return bTime.compareTo(aTime);
            });

          return RefreshIndicator(
            color: GlassColors.primary,
            onRefresh: () => ref.refresh(conversationsProvider.future),
            child: ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(
                horizontal: GlassSpacing.lg,
                vertical: GlassSpacing.md,
              ),
              itemCount: sorted.length,
              separatorBuilder: (_, __) =>
                  const SizedBox(height: GlassSpacing.md),
              itemBuilder: (context, index) =>
                  _buildConversationRow(sorted[index]),
            ),
          );
        },
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Conversation Row
  // ---------------------------------------------------------------------------

  Widget _buildConversationRow(Conversation conv) {
    final myUid = _myUid ?? '';
    final name = _getOtherParticipantName(conv, myUid);
    final photoUrl = _getOtherParticipantPhoto(conv, myUid);
    final unread = _unreadCount(conv, myUid);
    final hasUnread = unread > 0;

    return GlassCard(
      onTap: () => context.push('/messages/${conv.id}'),
      padding: const EdgeInsets.symmetric(
        horizontal: GlassSpacing.lg,
        vertical: GlassSpacing.md,
      ),
      child: Row(
        children: [
          // Avatar
          _buildAvatar(name, photoUrl),
          const SizedBox(width: GlassSpacing.md),

          // Name + last message
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: GlassTypography.labelLarge(
                    color: hasUnread
                        ? GlassColors.textPrimary
                        : GlassColors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (conv.lastMessage != null) ...[
                  const SizedBox(height: GlassSpacing.xs),
                  Text(
                    conv.lastMessage!,
                    style: GlassTypography.bodySmall(
                      color: hasUnread
                          ? GlassColors.textSecondary
                          : GlassColors.textTertiary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(width: GlassSpacing.sm),

          // Timestamp + unread badge
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (conv.lastMessageAt != null)
                Text(
                  _formatRelativeTime(conv.lastMessageAt!),
                  style: GlassTypography.labelSmall(
                    color: hasUnread
                        ? GlassColors.primary
                        : GlassColors.textTertiary,
                  ),
                ),
              if (hasUnread) ...[
                const SizedBox(height: GlassSpacing.xs),
                _buildUnreadBadge(unread),
              ],
            ],
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Sub-widgets
  // ---------------------------------------------------------------------------

  Widget _buildAvatar(String name, String? photoUrl) {
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';

    if (photoUrl != null && photoUrl.isNotEmpty) {
      return CircleAvatar(
        radius: 24,
        backgroundImage: NetworkImage(photoUrl),
        backgroundColor: GlassColors.primary.withOpacity(0.1),
      );
    }

    return CircleAvatar(
      radius: 24,
      backgroundColor: GlassColors.primary.withOpacity(0.1),
      child: Text(
        initial,
        style: GlassTypography.headline3(color: GlassColors.primary),
      ),
    );
  }

  Widget _buildUnreadBadge(int count) {
    final label = count > 99 ? '99+' : '$count';
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: GlassSpacing.sm,
        vertical: 2,
      ),
      constraints: const BoxConstraints(minWidth: 22, minHeight: 22),
      decoration: const BoxDecoration(
        color: GlassColors.error,
        shape: BoxShape.rectangle,
        borderRadius: BorderRadius.all(Radius.circular(GlassRadius.pill)),
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: GlassTypography.labelSmall(color: Colors.white).copyWith(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0,
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // State Widgets
  // ---------------------------------------------------------------------------

  Widget _buildLoading() {
    return const Center(
      child: CircularProgressIndicator(
        color: GlassColors.primary,
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xxxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.chat_bubble_outline_rounded,
              size: 72,
              color: GlassColors.textTertiary.withOpacity(0.5),
            ),
            const SizedBox(height: GlassSpacing.xl),
            Text(
              'No messages yet.',
              style: GlassTypography.headline3(
                color: GlassColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: GlassSpacing.sm),
            Text(
              'Connect with teachers in Community\nto start chatting.',
              style: GlassTypography.bodyMedium(
                color: GlassColors.textTertiary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildError(Object error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.xxxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.error_outline_rounded,
              size: 64,
              color: GlassColors.error.withOpacity(0.6),
            ),
            const SizedBox(height: GlassSpacing.xl),
            Text(
              'Something went wrong',
              style: GlassTypography.headline3(
                color: GlassColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: GlassSpacing.sm),
            Text(
              error.toString(),
              style: GlassTypography.bodySmall(
                color: GlassColors.textTertiary,
              ),
              textAlign: TextAlign.center,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: GlassSpacing.xxl),
            GlassSecondaryButton(
              label: 'Retry',
              icon: Icons.refresh_rounded,
              isExpanded: false,
              onPressed: () => ref.invalidate(conversationsProvider),
            ),
          ],
        ),
      ),
    );
  }
}
