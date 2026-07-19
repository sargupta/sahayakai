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
import '../data/staffroom_providers.dart';
import '../domain/group.dart';
import 'widgets/chat_entry_tile.dart';
import 'widgets/feed_post_card.dart';
import 'widgets/join_button.dart';

/// U-SI2 — the Group detail (SPEC §A3.3). A group header (name, member count,
/// description, an optimistic join/joined control) over the group's posts (the
/// same [FeedPostCard] grammar with optimistic likes).
///
/// States mirror the Staffroom home:
///   - null uid → the sign-in `EmptyView`;
///   - group `loading` → an `AppSkeleton`; group `error` → an `ErrorView`;
///   - group `null` → a "group not found" `EmptyView`;
///   - posts **member-gated**: `getGroupPosts` throws Forbidden for a non-member,
///     which (for a teacher who is not in the group) surfaces the locked
///     "members only" preview; a genuine load error for a member surfaces an
///     `ErrorView`.
///
/// The app bar paints instantly from the [group] handed through the route `extra`
/// (a feed / strip tap); a cold deep link resolves it from
/// [staffroomGroupProvider] by id.
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
  /// Optimistic member-count bump while a just-tapped join is in flight / settled
  /// (reset to 0 on rollback), so the header count moves with the button.
  int _memberDelta = 0;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final uid = ref.watch(currentStaffroomUserIdProvider);

    if (uid == null) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.staffroomTitle)),
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

    final groupAsync = ref.watch(staffroomGroupProvider(widget.groupId));
    // Prefer the route `extra` for instant paint; else the resolved async value.
    final group = widget.group ?? groupAsync.valueOrNull;

    return Scaffold(
      appBar: AppBar(
        title: Text(group?.name ?? l10n.staffroomTitle),
      ),
      body: SafeArea(
        child: _body(context, groupAsync, group),
      ),
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

    final isMember =
        ref.watch(myGroupsProvider).valueOrNull?.any((g) => g.id == group.id) ??
            false;
    final postsAsync = ref.watch(groupPostsProvider(widget.groupId));

    return RefreshIndicator(
      onRefresh: () async {
        ref
          ..invalidate(groupPostsProvider(widget.groupId))
          ..invalidate(staffroomGroupProvider(widget.groupId));
        await ref.read(groupPostsProvider(widget.groupId).future).catchError(
              (_) => const <GroupPost>[],
            );
      },
      child: ListView(
        padding: AppSpacing.pagePadding,
        children: [
          _GroupHeader(
            group: group,
            memberDelta: _memberDelta,
            initialJoined: isMember,
            onJoinedChanged: (joined) => setState(
              () => _memberDelta = (joined && !isMember) ? 1 : 0,
            ),
          ),
          // The group's live chat — member-gated (non-members see the locked
          // preview below and must join first, mirroring the chat's
          // `firestore.rules` membership gate).
          if (isMember) ...[
            const SizedBox(height: AppSpacing.space4),
            ChatEntryTile(
              title: l10n.staffroomGroupChatEntry,
              onTap: () => context.push(
                Routes.groupChatPath(group.id),
                extra: group.name,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.space5),
          ...postsAsync.when(
            loading: () => const [
              Padding(
                padding: EdgeInsets.only(top: AppSpacing.space2),
                child: AppSkeleton(lines: 4),
              ),
            ],
            error: (_, _) => [
              // Non-member → the member-gated (Forbidden) locked preview; a
              // member with a genuine load error → a real ErrorView + retry.
              if (!isMember)
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
                        padding:
                            const EdgeInsets.only(bottom: AppSpacing.space3),
                        child: FeedPostCard(
                          key: ValueKey<String>('group-post-${post.id}'),
                          post: post,
                          initialLiked: ref
                                  .watch(likedItemIdsProvider)
                                  .valueOrNull
                                  ?.likedPost(post.id) ??
                              false,
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
/// join control.
class _GroupHeader extends StatelessWidget {
  const _GroupHeader({
    required this.group,
    required this.memberDelta,
    required this.initialJoined,
    required this.onJoinedChanged,
  });

  final Group group;
  final int memberDelta;
  final bool initialJoined;
  final ValueChanged<bool> onJoinedChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final text = theme.textTheme;
    final extras = AppTextExtras.of(context);
    final memberCount = group.memberCount + memberDelta;

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
        JoinButton(
          groupId: group.id,
          initialJoined: initialJoined,
          onJoinedChanged: onJoinedChanged,
        ),
      ],
    );
  }
}
