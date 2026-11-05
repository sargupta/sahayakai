import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/ai_text.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/glass_app_bar.dart';
import '../data/staffroom_providers.dart';
import '../domain/group.dart';
import 'widgets/chat_entry_tile.dart';
import 'widgets/feed_post_card.dart';
import 'widgets/join_button.dart';
import 'widgets/post_composer.dart';

/// U-SI2 — the Group detail. A group header (name, member count, description,
/// an optimistic join/joined control) over the group's posts (the same
/// [FeedPostCard] grammar with optimistic likes), a "What did you do today?"
/// composer for members, and the group-chat entry.
///
/// States:
///   - null uid → the sign-in `EmptyView`;
///   - group `loading` → an `AppSkeleton`; group `error` → an `ErrorView`;
///   - group `null` → a "group not found" `EmptyView`.
///
/// **Membership is tri-state, never guessed.** The posts route is the
/// authority: posts that load prove membership; a 403 proves non-membership
/// (→ the locked "members only" preview + Join). Until either answers, the
/// teacher's own groups list is consulted; if neither has resolved the
/// membership is UNKNOWN and the join control shows a placeholder rather than
/// a "Join" that might be wrong. Any other posts error is a real failure →
/// `ErrorView` + retry, not a lock.
///
/// The app bar paints instantly from the [group] handed through the route
/// `extra`; a cold deep link resolves it from [staffroomGroupProvider] by id.
class GroupDetailScreen extends ConsumerStatefulWidget {
  const GroupDetailScreen({super.key, required this.groupId, this.group});

  final String groupId;

  /// The group handed through the route `extra` for an instant header paint;
  /// null on a cold deep link (resolved from [staffroomGroupProvider]).
  final Group? group;

  @override
  ConsumerState<GroupDetailScreen> createState() => _GroupDetailScreenState();
}

class _GroupDetailScreenState extends ConsumerState<GroupDetailScreen> {
  /// Optimistic member-count bump while a just-tapped join is in flight /
  /// settled, until a fresh group read carries the server's count (then 0).
  int _memberDelta = 0;

  /// Membership derived from the posts route (authoritative) and the teacher's
  /// groups list; null = not known yet.
  bool? _membership(
    AsyncValue<List<GroupPost>> posts,
    AsyncValue<List<Group>> myGroups,
  ) {
    if (posts.hasError && isMembershipGate(posts.error)) return false;
    if (posts.hasValue) return true;
    final mine = myGroups.valueOrNull;
    if (mine != null && mine.any((g) => g.id == widget.groupId)) return true;
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final uid = ref.watch(currentStaffroomUserIdProvider);

    if (uid == null) {
      return Scaffold(
        appBar: GlassAppBar(title: Text(l10n.staffroomTitle)),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: AppSpacing.pagePadding,
            child: EmptyView(
              icon: LucideIcons.users,
              title: l10n.staffroomSignInTitle,
              message: l10n.staffroomSignInBody,
            ),
          ),
        ),
      );
    }

    // A fresh group read carries the server's member count — drop the
    // optimistic bump so the join is not counted twice.
    ref.listen<AsyncValue<Group?>>(staffroomGroupProvider(widget.groupId), (
      previous,
      next,
    ) {
      if (next.hasValue && !next.isLoading && _memberDelta != 0) {
        setState(() => _memberDelta = 0);
      }
    });

    final groupAsync = ref.watch(staffroomGroupProvider(widget.groupId));
    // Prefer the freshest server read; the route `extra` paints until it lands.
    final group = groupAsync.valueOrNull ?? widget.group;

    return Scaffold(
      appBar: GlassAppBar(title: Text(group?.name ?? l10n.staffroomTitle)),
      body: SafeArea(child: _body(context, groupAsync, group)),
    );
  }

  Widget _body(
    BuildContext context,
    AsyncValue<Group?> groupAsync,
    Group? group,
  ) {
    final l10n = context.l10n;

    // No header data yet: honour the group read's lifecycle.
    if (group == null) {
      if (groupAsync.isLoading) {
        return const Padding(
          padding: AppSpacing.pagePadding,
          child: AppSkeleton(lines: 6),
        );
      }
      if (groupAsync.hasError) {
        return SingleChildScrollView(
          padding: AppSpacing.pagePadding,
          child: ErrorView(
            message: l10n.staffroomErrorBody,
            onRetry: () =>
                ref.invalidate(staffroomGroupProvider(widget.groupId)),
          ),
        );
      }
      // Ready, but the group is null → removed / not found.
      return SingleChildScrollView(
        padding: AppSpacing.pagePadding,
        child: EmptyView(
          icon: LucideIcons.users,
          title: l10n.staffroomGroupNotFoundTitle,
          message: l10n.staffroomGroupNotFoundBody,
        ),
      );
    }

    final postsAsync = ref.watch(groupPostsProvider(widget.groupId));
    final myGroupsAsync = ref.watch(myGroupsProvider);
    final isMember = _membership(postsAsync, myGroupsAsync);
    final liked = ref.watch(likedItemIdsProvider).valueOrNull;

    return RefreshIndicator(
      onRefresh: () async {
        ref
          ..invalidate(groupPostsProvider(widget.groupId))
          ..invalidate(staffroomGroupProvider(widget.groupId))
          ..invalidate(myGroupsProvider)
          ..invalidate(likedItemIdsProvider);
        await ref
            .read(groupPostsProvider(widget.groupId).future)
            .catchError((Object _) => const <GroupPost>[]);
      },
      child: ListView(
        padding: AppSpacing.pagePadding,
        children: [
          _GroupHeader(
            group: group,
            memberDelta: _memberDelta,
            membership: isMember,
            onJoinedChanged: (joined) => setState(
              () => _memberDelta = (joined && isMember != true) ? 1 : 0,
            ),
          ),
          if (isMember == true) ...[
            const SizedBox(height: AppSpacing.space4),
            // The group's live chat — member-gated, like its Firestore rule.
            ChatEntryTile(
              title: l10n.staffroomGroupChatEntry,
              onTap: () => context.push(
                Routes.groupChatPath(group.id),
                extra: group.name,
              ),
            ),
            const SizedBox(height: AppSpacing.space4),
            PostComposer(groups: const <Group>[], fixedGroupId: group.id),
          ],
          const SizedBox(height: AppSpacing.space5),
          ...postsAsync.when(
            skipLoadingOnRefresh: true,
            loading: () => const [
              Padding(
                padding: EdgeInsets.only(top: AppSpacing.space2),
                child: AppSkeleton(lines: 4),
              ),
            ],
            error: (error, _) => [
              // A 403 is the membership gate → the locked preview. Anything
              // else (offline, 5xx) is a real failure → error + retry.
              if (isMembershipGate(error))
                EmptyView(
                  icon: LucideIcons.users,
                  title: l10n.staffroomGroupLockedTitle,
                  message: l10n.staffroomGroupLockedBody,
                )
              else
                ErrorView(
                  message: l10n.staffroomErrorBody,
                  onRetry: () =>
                      ref.invalidate(groupPostsProvider(widget.groupId)),
                ),
            ],
            data: (posts) => posts.isEmpty
                ? [
                    EmptyView(
                      icon: LucideIcons.messagesSquare,
                      title: l10n.staffroomGroupPostsEmptyTitle,
                      message: l10n.staffroomGroupPostsEmptyBody,
                    ),
                  ]
                : [
                    for (final post in posts)
                      Padding(
                        padding: const EdgeInsets.only(
                          bottom: AppSpacing.space3,
                        ),
                        child: FeedPostCard(
                          key: ValueKey<String>('group-post-${post.id}'),
                          post: post,
                          initialLiked: liked?.likedPost(post.id) ?? false,
                        ),
                      ),
                  ],
          ),
        ],
      ),
    );
  }
}

/// The group header: serif name, member count, description, and the optimistic
/// join control (a placeholder while membership is still unknown).
class _GroupHeader extends StatelessWidget {
  const _GroupHeader({
    required this.group,
    required this.memberDelta,
    required this.membership,
    required this.onJoinedChanged,
  });

  final Group group;
  final int memberDelta;
  final bool? membership;
  final ValueChanged<bool> onJoinedChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final text = theme.textTheme;
    final extras = AppTextExtras.of(context);
    final memberCount = group.memberCount + memberDelta;
    final membership = this.membership;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(group.name, style: text.titleLarge),
        const SizedBox(height: AppSpacing.space2),
        Text(
          // Full-ink on the scaffold ground (onSurfaceVariant is 4.36:1 there,
          // below AA) — "muted only on white cards".
          l10n.staffroomMemberCount(memberCount),
          style: extras.dataMedium.copyWith(color: scheme.onSurface),
        ),
        if (group.description.trim().isNotEmpty) ...[
          const SizedBox(height: AppSpacing.space3),
          AiText(group.description),
        ],
        const SizedBox(height: AppSpacing.space4),
        if (membership == null)
          const AppSkeleton(lines: 1)
        else
          JoinButton(
            key: ValueKey<String>('join-${group.id}-$membership'),
            groupId: group.id,
            initialJoined: membership,
            onJoinedChanged: onJoinedChanged,
          ),
      ],
    );
  }
}
