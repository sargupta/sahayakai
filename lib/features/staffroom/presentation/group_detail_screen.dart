import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/map_card.dart';
import '../../../shared/widgets/map_icon_tile.dart';
import '../../../shared/widgets/map_page_header.dart';
import '../../inbox/presentation/inbox_time.dart';
import '../data/chat_stream_provider.dart';
import '../data/staffroom_providers.dart';
import '../domain/chat_quote.dart';
import '../domain/group.dart';
import 'widgets/feed_post_card.dart';
import 'widgets/group_chip.dart';
import 'widgets/join_button.dart';
import 'widgets/post_composer.dart';
import 'widgets/post_type_style.dart';

/// "N teachers · active 2h ago" for [group]: the member count and, when the
/// server gave one, how long ago the group last had activity. Never invented:
/// no `lastActivityAt` → just the count.
String groupMemberLine(
  AppLocalizations l10n,
  Group group, {
  int memberDelta = 0,
  DateTime? now,
}) {
  final count = l10n.cmGroupTeacherCount(group.memberCount + memberDelta);
  final active = groupActiveLabel(l10n, group.lastActivityAt, now: now);
  return active == null ? count : '$count · $active';
}

/// "active 2h ago" / "active now" from an ISO time, or null when there is
/// none (or it cannot be read).
String? groupActiveLabel(AppLocalizations l10n, String? iso, {DateTime? now}) {
  final at = now ?? DateTime.now();
  final ago = inboxRelativeTime(iso, at, l10n);
  if (ago.isEmpty) return null;
  return ago == l10n.inboxTimeNow
      ? l10n.cmGroupActiveNow
      : l10n.cmGroupActiveAgo(ago);
}

/// U-SI2 — the Group page. A hero card (the group's tinted band, its class /
/// subject / board chips, name, description, member line and the join /
/// joined + group-chat actions) over, for members, a group-chat preview, the
/// "What did you do today?" composer and the group's posts (filterable by
/// kind); for everyone else a "For members" card and the shapes of what is
/// shared here.
///
/// States:
///   - null uid → the sign-in `EmptyView`;
///   - group `loading` → an `AppSkeleton`; group `error` → an `ErrorView`;
///   - group `null` → a "group not found" `EmptyView`.
///
/// **Membership is tri-state, never guessed.** The posts route is the
/// authority: posts that load prove membership; a 403 proves non-membership
/// (→ the "For members" card + Join). Until either answers, the teacher's own
/// groups list is consulted; if neither has resolved the membership is UNKNOWN
/// and the join control shows a placeholder rather than a "Join" that might be
/// wrong. Any other posts error is a real failure → `ErrorView` + retry, not a
/// lock.
///
/// The header paints instantly from the [group] handed through the route
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
  /// The page's padding: the map gutter, and room under the last post for
  /// VIDYA's floating orb.
  static const EdgeInsets _padding = EdgeInsets.fromLTRB(
    AppSpacing.mapGutter,
    AppSpacing.space2,
    AppSpacing.mapGutter,
    AppSpacing.mapBottomClearance,
  );

  /// How many posts one read of the group's posts returns (the transport's
  /// default page). A full page may have more behind it, so the "That is
  /// everything" line only shows under a short page.
  static const int _postsPage = 20;

  /// Optimistic member-count bump while a just-tapped join is in flight /
  /// settled, until a fresh group read carries the server's count (then 0).
  int _memberDelta = 0;

  /// The post kind the teacher is looking at; null is every kind.
  PostType? _filter;

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

  void _openChat(Group group) => context.push(
    Routes.groupChatPath(group.id),
    extra: ChatRouteArgs(title: group.name),
  );

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final uid = ref.watch(currentStaffroomUserIdProvider);

    if (uid == null) {
      return _page([
        EmptyView(
          icon: LucideIcons.users,
          title: l10n.staffroomSignInTitle,
          message: l10n.staffroomSignInBody,
        ),
      ]);
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

    // No header data yet: honour the group read's lifecycle.
    if (group == null) {
      if (groupAsync.isLoading) {
        return _page(const [AppSkeleton(lines: 6)]);
      }
      if (groupAsync.hasError) {
        return _page([
          ErrorView(
            message: l10n.staffroomErrorBody,
            onRetry: () =>
                ref.invalidate(staffroomGroupProvider(widget.groupId)),
          ),
        ]);
      }
      // Ready, but the group is null → removed / not found.
      return _page([
        EmptyView(
          icon: LucideIcons.users,
          title: l10n.staffroomGroupNotFoundTitle,
          message: l10n.staffroomGroupNotFoundBody,
        ),
      ]);
    }

    return _page(_groupChildren(context, group), onRefresh: _refresh);
  }

  Future<void> _refresh() async {
    ref
      ..invalidate(groupPostsProvider(widget.groupId))
      ..invalidate(staffroomGroupProvider(widget.groupId))
      ..invalidate(myGroupsProvider)
      ..invalidate(likedItemIdsProvider);
    await ref
        .read(groupPostsProvider(widget.groupId).future)
        .catchError((Object _) => const <GroupPost>[]);
  }

  /// The page frame: the round back button over [children], on the map
  /// ground (the app paints it behind a transparent scaffold).
  Widget _page(List<Widget> children, {Future<void> Function()? onRefresh}) {
    final list = ListView(
      padding: _padding,
      children: [
        const MapPageHeader(),
        const SizedBox(height: AppSpacing.space2),
        ...children,
      ],
    );
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: onRefresh == null
            ? list
            : RefreshIndicator(onRefresh: onRefresh, child: list),
      ),
    );
  }

  List<Widget> _groupChildren(BuildContext context, Group group) {
    final postsAsync = ref.watch(groupPostsProvider(widget.groupId));
    final myGroupsAsync = ref.watch(myGroupsProvider);
    final isMember = _membership(postsAsync, myGroupsAsync);

    return [
      _GroupHero(
        group: group,
        memberDelta: _memberDelta,
        membership: isMember,
        onOpenChat: () => _openChat(group),
        onJoinedChanged: (joined) =>
            setState(() => _memberDelta = (joined && isMember != true) ? 1 : 0),
      ),
      if (isMember == true) ...[
        const SizedBox(height: AppSpacing.space7),
        // The group's live chat — member-gated, like its Firestore rule.
        _GroupChatCard(groupId: group.id, onTap: () => _openChat(group)),
        const SizedBox(height: AppSpacing.space7),
        PostComposer(groups: const <Group>[], fixedGroupId: group.id),
      ],
      const SizedBox(height: AppSpacing.space6),
      ...postsAsync.when(
        skipLoadingOnRefresh: true,
        loading: () => const [
          Padding(
            padding: EdgeInsets.only(top: AppSpacing.space2),
            child: AppSkeleton(lines: 4),
          ),
        ],
        error: (error, _) => isMembershipGate(error)
            // A 403 is the membership gate → the members-only preview.
            ? const [_MembersOnly()]
            // Anything else (offline, 5xx) is a real failure → error + retry.
            : [
                ErrorView(
                  message: context.l10n.staffroomErrorBody,
                  onRetry: () =>
                      ref.invalidate(groupPostsProvider(widget.groupId)),
                ),
              ],
        data: (posts) => _posts(context, group, posts),
      ),
    ];
  }

  List<Widget> _posts(
    BuildContext context,
    Group group,
    List<GroupPost> posts,
  ) {
    final l10n = context.l10n;
    if (posts.isEmpty) {
      return [
        EmptyView(
          icon: LucideIcons.messagesSquare,
          title: l10n.staffroomGroupPostsEmptyTitle,
          message: l10n.staffroomGroupPostsEmptyBody,
        ),
      ];
    }
    final liked = ref.watch(likedItemIdsProvider).valueOrNull;
    final filter = _filter;
    final shown = filter == null
        ? posts
        : posts.where((p) => p.postType == filter).toList();
    return [
      MapOverline(l10n.cmGroupInThisGroup, color: AppColors.textEyebrow),
      const SizedBox(height: AppSpacing.space2),
      _PostFilters(
        selected: filter,
        onSelected: (type) => setState(() => _filter = type),
      ),
      const SizedBox(height: AppSpacing.space3),
      if (shown.isEmpty)
        MapCard(
          child: MapEmptyNote(
            icon: filter == null
                ? LucideIcons.messagesSquare
                : postTypeIcon(filter),
            message: l10n.cmGroupFilterEmpty,
          ),
        ),
      for (final post in shown)
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.space3),
          child: FeedPostCard(
            key: ValueKey<String>('group-post-${post.id}'),
            post: post,
            initialLiked: liked?.likedPost(post.id) ?? false,
          ),
        ),
      if (posts.length < _postsPage) ...[
        const SizedBox(height: AppSpacing.space3),
        Text(
          l10n.cmGroupEnd(group.name),
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            fontSize: 13,
            color: AppColors.textMuted,
          ),
        ),
      ],
    ];
  }
}

/// The hero card: the group's tinted band with its icon tile, the class /
/// subject / board chips the group really has, the name, the description, the
/// member line, and the actions — "Joined ✓" beside "Group chat" for a member,
/// one full-width "Join group" otherwise (a placeholder while membership is
/// still unknown).
class _GroupHero extends StatelessWidget {
  const _GroupHero({
    required this.group,
    required this.memberDelta,
    required this.membership,
    required this.onOpenChat,
    required this.onJoinedChanged,
  });

  final Group group;
  final int memberDelta;
  final bool? membership;
  final VoidCallback onOpenChat;
  final ValueChanged<bool> onJoinedChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final tint = groupTint(group);
    final membership = this.membership;
    final rules = group.autoJoinRules;
    final board = rules.board?.trim();
    final chips = <(String, MapTint?)>[
      for (final grade in rules.grades)
        if (grade.trim().isNotEmpty) (grade.trim(), tint),
      for (final subject in rules.subjects)
        if (subject.trim().isNotEmpty) (subject.trim(), tint),
      if (board != null && board.isNotEmpty) (board, null),
    ];

    return MapCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // The band: the group's tint, its glyph on a white tile.
          Container(
            height: 92,
            color: tint.fill,
            padding: const EdgeInsets.symmetric(horizontal: 18),
            alignment: AlignmentDirectional.centerStart,
            child: ExcludeSemantics(
              child: Container(
                width: 56,
                height: 56,
                decoration: const BoxDecoration(
                  color: AppColors.surfaceMapCard,
                  borderRadius: AppRadius.rTile,
                ),
                child: Icon(groupIcon(group), size: 26, color: tint.ink),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (chips.isNotEmpty) ...[
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final (label, chipTint) in chips)
                        _InfoChip(label: label, tint: chipTint),
                    ],
                  ),
                  const SizedBox(height: 10),
                ],
                Semantics(
                  header: true,
                  child: Text(
                    group.name,
                    style: text.displayMedium?.copyWith(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.4,
                      color: AppColors.textStrong,
                    ),
                  ),
                ),
                if (group.description.trim().isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                    group.description.trim(),
                    style: text.bodyMedium?.copyWith(
                      fontSize: 14,
                      height: 1.5,
                      color: AppColors.textBody,
                    ),
                  ),
                ],
                const SizedBox(height: 10),
                Row(
                  children: [
                    const Icon(
                      LucideIcons.users,
                      size: AppIconSize.micro,
                      color: AppColors.textMuted,
                    ),
                    const SizedBox(width: AppSpacing.space2),
                    Expanded(
                      child: Text(
                        groupMemberLine(l10n, group, memberDelta: memberDelta),
                        style: text.bodyMedium?.copyWith(
                          fontSize: 13,
                          color: AppColors.textBody,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.space4),
                if (membership == null)
                  const AppSkeleton(lines: 1)
                else if (membership)
                  IntrinsicHeight(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(
                          child: JoinButton(
                            key: ValueKey<String>('join-${group.id}-true'),
                            groupId: group.id,
                            initialJoined: true,
                            onJoinedChanged: onJoinedChanged,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.space2),
                        Expanded(
                          child: _ChatButton(
                            label: l10n.staffroomGroupChatEntry,
                            onTap: onOpenChat,
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  JoinButton(
                    key: ValueKey<String>('join-${group.id}-false'),
                    groupId: group.id,
                    label: l10n.cmGroupJoin,
                    onJoinedChanged: onJoinedChanged,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A small fact chip on the hero (class, subject, board): the group's tint,
/// or the neutral page tone for the board.
class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label, this.tint});

  final String label;
  final MapTint? tint;

  @override
  Widget build(BuildContext context) {
    final tint = this.tint;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: tint?.fill ?? AppColors.surfacePage,
        shape: const StadiumBorder(),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            fontSize: 11.5,
            fontWeight: FontWeight.w600,
            color: tint?.ink ?? AppColors.textBody,
          ),
        ),
      ),
    );
  }
}

/// The filled saffron "Group chat" pill beside "Joined ✓". Its label wraps
/// rather than clipping at large text sizes.
class _ChatButton extends StatelessWidget {
  const _ChatButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      onTap: onTap,
      child: Material(
        color: AppColors.accentFill,
        shape: const StadiumBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.space3,
                vertical: AppSpacing.space2,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    LucideIcons.messageCircle,
                    size: AppIconSize.inline,
                    color: AppColors.textOnAccent,
                  ),
                  const SizedBox(width: AppSpacing.space2),
                  Flexible(
                    child: Text(
                      label,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textOnAccent,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The group-chat card for members: "Group chat", the newest message as
/// "Name: text" on one line with its time, from the live group-chat stream.
/// Until the stream answers (or if it fails) the card still opens the chat,
/// just without a preview line.
class _GroupChatCard extends ConsumerWidget {
  const _GroupChatCard({required this.groupId, required this.onTap});

  final String groupId;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final snapshot = ref.watch(groupChatProvider(groupId)).valueOrNull;
    final messages = snapshot != null && snapshot.isReady
        ? snapshot.data
        : null;
    final last = messages?.lastOrNull;
    final lastText = last?.text.trim().replaceAll(RegExp(r'\s+'), ' ') ?? '';
    final who = last?.authorName.trim() ?? '';
    final String? preview;
    if (last != null && lastText.isNotEmpty) {
      preview = who.isEmpty ? lastText : '$who: $lastText';
    } else if (messages != null && messages.isEmpty) {
      preview = l10n.staffroomChatEmptyTitle;
    } else {
      preview = null;
    }
    final time = last == null
        ? ''
        : inboxRelativeTime(last.createdAt, DateTime.now(), l10n);

    return Semantics(
      button: true,
      child: MapCard(
        onTap: onTap,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            ExcludeSemantics(
              child: Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: MapTint.saffron.fill,
                  borderRadius: AppRadius.rRow,
                ),
                child: Icon(
                  LucideIcons.messagesSquare,
                  size: 20,
                  color: MapTint.saffron.ink,
                ),
              ),
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
                          l10n.staffroomGroupChatEntry,
                          style: text.titleLarge?.copyWith(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textStrong,
                          ),
                        ),
                      ),
                      if (time.isNotEmpty) ...[
                        const SizedBox(width: AppSpacing.space2),
                        Text(
                          time,
                          style: text.bodySmall?.copyWith(
                            fontSize: 12,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (preview != null) ...[
                    const SizedBox(height: 2),
                    // A one-line message PREVIEW: the full message is a tap
                    // away in the chat, so this one line may be cut short.
                    Text(
                      preview,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.bodyMedium?.copyWith(
                        fontSize: 13,
                        color: AppColors.textBody,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.space2),
            const Icon(
              LucideIcons.chevronRight,
              size: AppIconSize.inline,
              color: AppColors.textMuted,
            ),
          ],
        ),
      ),
    );
  }
}

/// The post-kind filters: "All" and the four kinds, one selected. A
/// horizontally scrolling row so long labels never squeeze.
class _PostFilters extends StatelessWidget {
  const _PostFilters({required this.selected, required this.onSelected});

  final PostType? selected;
  final ValueChanged<PostType?> onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Semantics(
      container: true,
      label: l10n.cmGroupShowPosts,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        child: Row(
          children: [
            for (final type in <PostType?>[null, ...kPostKinds]) ...[
              if (type != null) const SizedBox(width: AppSpacing.space2),
              _FilterPill(
                key: ValueKey<String>('group-filter-${type?.wire ?? 'all'}'),
                label: postTypeLabel(l10n, type),
                selected: selected == type,
                onTap: () => onSelected(type),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _FilterPill extends StatelessWidget {
  const _FilterPill({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      onTap: onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 44, minWidth: 48),
        child: Center(
          widthFactor: 1,
          heightFactor: 1,
          child: Material(
            color: selected ? AppColors.accentFill : AppColors.surfaceCard,
            shape: StadiumBorder(
              side: BorderSide(
                color: selected ? AppColors.accentFill : AppColors.borderAskBar,
              ),
            ),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: onTap,
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 40),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.space4,
                    vertical: AppSpacing.space2,
                  ),
                  child: Center(
                    widthFactor: 1,
                    heightFactor: 1,
                    child: Text(
                      label,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: selected
                            ? AppColors.textOnAccent
                            : AppColors.textStrong,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Before joining: the "For members" card, and under "What teachers share
/// here" two post shapes that show only their kind strips — no real posts.
class _MembersOnly extends StatelessWidget {
  const _MembersOnly();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        MapCard(
          padding: const EdgeInsets.all(AppSpacing.space4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ExcludeSemantics(
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: const BoxDecoration(
                    color: AppColors.surfacePage,
                    borderRadius: AppRadius.rRow,
                  ),
                  child: const Icon(
                    LucideIcons.lock,
                    size: 18,
                    color: AppColors.textBody,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.space7),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      l10n.cmGroupForMembersTitle,
                      style: text.titleLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: AppColors.textStrong,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.space1),
                    Text(
                      l10n.cmGroupForMembersBody,
                      style: text.bodyMedium?.copyWith(
                        fontSize: 13.5,
                        height: 1.45,
                        color: AppColors.textBody,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.space6),
        MapOverline(l10n.cmGroupWhatShared, color: AppColors.textEyebrow),
        const SizedBox(height: 10),
        const _KindShape(type: PostType.askHelp, lines: 2),
        const SizedBox(height: AppSpacing.space3),
        const _KindShape(type: PostType.share, lines: 1),
      ],
    );
  }
}

/// A post's outline with only its kind strip in words: grey bars where the
/// author and text would be. Hidden from screen readers (it carries no
/// content).
class _KindShape extends StatelessWidget {
  const _KindShape({required this.type, required this.lines});

  final PostType type;
  final int lines;

  @override
  Widget build(BuildContext context) {
    final tint = postTypeTint(type);
    return ExcludeSemantics(
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.surfaceMapCard,
          borderRadius: AppRadius.rPanel,
          border: Border.all(color: AppColors.borderHairline),
        ),
        child: ClipRRect(
          borderRadius: AppRadius.rPanel,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              ColoredBox(
                color: tint.fill,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.space4,
                    vertical: 9,
                  ),
                  child: Row(
                    children: [
                      Icon(
                        postTypeIcon(type),
                        size: AppIconSize.micro,
                        color: tint.ink,
                      ),
                      const SizedBox(width: AppSpacing.space2),
                      Expanded(
                        child: Text(
                          postKindLine(context.l10n, type),
                          style: Theme.of(context).textTheme.labelMedium
                              ?.copyWith(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                color: tint.ink,
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Row(
                      children: [
                        _Bar(width: 40, height: 40, round: true),
                        SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _Bar(width: 104, height: 10, strong: true),
                            SizedBox(height: 6),
                            _Bar(width: 68, height: 8),
                          ],
                        ),
                      ],
                    ),
                    for (var i = 0; i < lines; i++) ...[
                      const SizedBox(height: 10),
                      FractionallySizedBox(
                        widthFactor: i == lines - 1 && lines > 1 ? 0.72 : 1,
                        child: const _Bar(height: 10),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One still grey placeholder bar (no shimmer: it stands for nothing loading).
class _Bar extends StatelessWidget {
  const _Bar({
    this.width,
    required this.height,
    this.round = false,
    this.strong = false,
  });

  final double? width;
  final double height;
  final bool round;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: strong ? AppColors.borderStrong : AppColors.borderHairline,
        borderRadius: round
            ? AppRadius.rPill
            : const BorderRadius.all(Radius.circular(6)),
      ),
    );
  }
}
