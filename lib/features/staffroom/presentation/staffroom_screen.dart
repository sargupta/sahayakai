import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/glass_app_bar.dart';
import '../../../shared/widgets/map_card.dart';
import '../../../shared/widgets/map_chip.dart';
import '../../../shared/widgets/secondary_button.dart';
import '../data/staffroom_providers.dart';
import '../domain/community_post.dart';
import '../domain/daily_briefing.dart';
import '../domain/group.dart';
import '../domain/staffroom_results.dart';
import '../domain/teacher.dart';
import 'community_network_screen.dart';
import 'widgets/feed_item_view.dart';
import 'widgets/post_type_style.dart';
import 'widgets/staffroom_sections.dart';

/// The Staffroom home: the two hub tiles (the live staff room, and "Your
/// network"), the "What did you do today?" composer, the typed feed with its
/// filter chips, and the teacher's groups / suggestions / people below.
///
/// State mapping, driven by [unifiedFeedProvider] (the primary surface) +
/// [currentStaffroomUserId]:
///
///   - null uid (signed out) → the sign-in note;
///   - `loading`  → an `AppSkeleton` feed;
///   - `error`    → an `ErrorView` + retry (never a hang);
///   - `ready` empty → the "Your feed is quiet" note;
///   - `ready` non-empty → the feed cards + the group / people sections.
///
/// [StaffroomFeedView] is the body, so the Network hub can host it under its
/// own chrome without a nested app bar.
class StaffroomScreen extends StatelessWidget {
  const StaffroomScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: GlassAppBar(title: Text(l10n.staffroomTitle)),
      body: const SafeArea(child: StaffroomFeedView()),
    );
  }
}

/// The Staffroom body, without a Scaffold/app bar — so it embeds cleanly as the
/// Staffroom tab of the Network hub.
class StaffroomFeedView extends ConsumerWidget {
  const StaffroomFeedView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final uid = ref.watch(currentStaffroomUserIdProvider);
    if (uid == null) {
      return const _StaffroomSignIn();
    }

    final feedAsync = ref.watch(unifiedFeedProvider);
    return feedAsync.when(
      loading: () => const Padding(
        padding: AppSpacing.pagePadding,
        child: AppSkeleton(lines: 6),
      ),
      error: (_, _) =>
          _StaffroomError(onRetry: () => ref.invalidate(unifiedFeedProvider)),
      data: (feed) => _StaffroomReady(feed: feed),
    );
  }
}

/// The ready scroll: hero + groups + discover + feed + people. Each secondary
/// section watches its own provider and degrades to nothing on loading/error, so
/// a failed groups read never breaks the feed.
///
/// Stateful for the feed filter chips (v2 Group H "Community"): the row filters
/// the unified feed by the app's REAL post types (Posts / Resources /
/// Highlights) — never invented categories the backend does not tag.
class _StaffroomReady extends ConsumerStatefulWidget {
  const _StaffroomReady({required this.feed});

  final List<FeedItem> feed;

  @override
  ConsumerState<_StaffroomReady> createState() => _StaffroomReadyState();
}

class _StaffroomReadyState extends ConsumerState<_StaffroomReady> {
  /// null = "All". Otherwise the one post type the chips have narrowed to.
  PostType? _filter;

  /// The chips, in the map's order: All, Resource, Tried this, Celebrate,
  /// Need help. Each is a real [PostType] the feed carries.
  static const _chips = <PostType?>[
    null,
    PostType.resource,
    PostType.share,
    PostType.celebrate,
    PostType.askHelp,
  ];

  Future<void> _refresh() async {
    ref
      ..invalidate(unifiedFeedProvider)
      ..invalidate(myGroupsProvider)
      ..invalidate(discoverGroupsProvider)
      ..invalidate(recommendedTeachersProvider)
      ..invalidate(likedItemIdsProvider);
    // A failed refresh must settle the indicator, not throw out of it: the
    // feed provider itself carries the error into the error surface.
    await ref
        .read(unifiedFeedProvider.future)
        .catchError((Object _) => const <FeedItem>[]);
  }

  /// Whether [item] belongs under the chip [filter] (null = All).
  ///
  /// A post matches its own type; a shared resource (`resource_share`) is a
  /// Resource whether it arrives as a post or as a resource card. Discovery
  /// cards (a connection or group suggestion, a chat highlight) carry no post
  /// type at all, so a post-type chip does not filter them out.
  static bool matchesFilter(FeedItem item, PostType? filter) {
    if (filter == null) return true;
    switch (item.type) {
      case FeedItemType.groupPost:
        return item.post?.postType == filter;
      case FeedItemType.resourceShare:
        return filter == PostType.resource;
      case FeedItemType.connectionSuggestion:
      case FeedItemType.chatHighlight:
      case FeedItemType.groupSuggestion:
        return true;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final feed = widget.feed;
    final likedIds =
        ref.watch(likedItemIdsProvider).valueOrNull ?? const LikedItemIds();
    final myGroups = ref.watch(myGroupsProvider).valueOrNull ?? const <Group>[];
    final people =
        ref.watch(recommendedTeachersProvider).valueOrNull ??
        const <TeacherSuggestion>[];

    // The newest Daily Briefing gets its own card near the top; the feed
    // below shows everything else.
    FeedItem? briefing;
    for (final item in feed) {
      final post = item.post;
      if (item.type == FeedItemType.groupPost &&
          post != null &&
          parseDailyBriefing(post.content) != null) {
        briefing = item;
        break;
      }
    }
    final rest = [
      for (final item in feed)
        if (!identical(item, briefing)) item,
    ];
    final shown = [
      for (final item in rest)
        if (matchesFilter(item, _filter)) item,
    ];
    // Teachers you may know sit inside the feed, after its second post (or
    // after the last one when there are fewer), and only under "All".
    final peopleAt = _filter == null && people.isNotEmpty
        ? (shown.length < 2 ? shown.length : 2)
        : -1;

    List<Widget> peopleBlock() => [
      const SizedBox(height: AppSpacing.space2),
      StaffroomSectionHead(
        label: l10n.staffroomSectionPeople,
        linkLabel: l10n.cmFeedSeeAll,
        onLink: () => openCommunityNetwork(context),
      ),
      PeopleRail(people: people),
      const SizedBox(height: AppSpacing.space4),
    ];

    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.mapGutter,
          AppSpacing.space3,
          AppSpacing.mapGutter,
          AppSpacing.mapBottomClearance,
        ),
        children: [
          const StaffRoomLiveCard(),

          // Share with teachers: every post belongs to a group, so it only
          // appears once the teacher has one to post to.
          if (myGroups.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space3),
            const ShareWithTeachersCard(),
          ],

          if (briefing != null) ...[
            const SizedBox(height: AppSpacing.space5),
            StaffroomSectionHead(label: l10n.cmFeedBriefing),
            const SizedBox(height: AppSpacing.space2),
            FeedItemView(
              key: ValueKey<String>('feed-${briefing.id}'),
              item: briefing,
              likedIds: likedIds,
            ),
          ],

          const SizedBox(height: AppSpacing.space5),
          StaffroomSectionHead(
            label: l10n.cmFeedYourGroups(myGroups.length),
            linkLabel: l10n.communityYourNetwork,
            onLink: () => openCommunityNetwork(context),
          ),
          if (myGroups.isEmpty)
            const MapCard(child: _GroupsEmpty())
          else
            YourGroupsRail(groups: myGroups),

          const SizedBox(height: AppSpacing.space5),
          StaffroomSectionHead(label: l10n.cmFeedFromGroups),
          const SizedBox(height: AppSpacing.space2),
          if (rest.isEmpty) ...[
            const MapCard(child: _FeedEmpty()),
            if (people.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.space3),
              ...peopleBlock(),
            ],
          ] else ...[
            // One row that scrolls sideways, so a long translation never
            // drops a chip onto a second line.
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              clipBehavior: Clip.none,
              child: Row(
                children: [
                  for (final (i, type) in _chips.indexed) ...[
                    if (i > 0) const SizedBox(width: 7),
                    MapChip(
                      label: postTypeLabel(l10n, type),
                      selected: _filter == type,
                      selectedFill: AppColors.accentFill,
                      idleFill: type == null ? null : postTypeTint(type).fill,
                      idleInk: type == null
                          ? AppColors.textStrong
                          : postTypeTint(type).ink,
                      onTap: () => setState(() => _filter = type),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.space3),
            if (shown.isEmpty) const MapCard(child: _FeedEmpty()),
            for (var i = 0; i < shown.length; i++) ...[
              if (i == peopleAt) ...peopleBlock(),
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.space3),
                child: staggeredItem(
                  context,
                  FeedItemView(
                    key: ValueKey<String>('feed-${shown[i].id}'),
                    item: shown[i],
                    likedIds: likedIds,
                  ),
                  index: i,
                ),
              ),
            ],
            if (peopleAt == shown.length && shown.isNotEmpty) ...peopleBlock(),
            if (shown.isNotEmpty) const _CaughtUp(),
          ],
        ],
      ),
    );
  }
}

/// The feed's last line: there is nothing older to scroll to.
class _CaughtUp extends StatelessWidget {
  const _CaughtUp();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.space2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            LucideIcons.checkCircle,
            size: 16,
            color: AppColors.tileLeafInk,
          ),
          const SizedBox(width: AppSpacing.space2),
          Flexible(
            child: Text(
              context.l10n.cmFeedCaughtUp,
              textAlign: TextAlign.center,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: AppColors.textMuted),
            ),
          ),
        ],
      ),
    );
  }
}

/// The compact "Your groups" empty prompt (not a full halo — the feed owns the
/// prominent empty state below).
///
/// Browsing for groups lives behind the "Your network" tile (suggested groups
/// with Join), so this stays a plain statement rather than a second button.
class _GroupsEmpty extends StatelessWidget {
  const _GroupsEmpty();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return MapEmptyNote(
      icon: LucideIcons.users,
      title: l10n.staffroomGroupsEmptyTitle,
      message: l10n.staffroomGroupsEmptyBody,
    );
  }
}

/// The prominent feed-empty state (ready, no items).
class _FeedEmpty extends StatelessWidget {
  const _FeedEmpty();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return MapEmptyNote(
      icon: LucideIcons.messagesSquare,
      title: l10n.staffroomFeedEmptyTitle,
      message: l10n.staffroomFeedEmptyBody,
    );
  }
}

/// The signed-out surface (null uid).
class _StaffroomSignIn extends StatelessWidget {
  const _StaffroomSignIn();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.mapGutter,
        AppSpacing.space3,
        AppSpacing.mapGutter,
        AppSpacing.mapBottomClearance,
      ),
      child: MapCard(
        child: MapEmptyNote(
          icon: LucideIcons.users,
          title: l10n.staffroomSignInTitle,
          message: l10n.staffroomSignInBody,
          action: SecondaryButton(
            label: l10n.actionSignIn,
            icon: LucideIcons.logIn,
            // Real auth landed — a plain push is correct now. See
            // inbox_screen.dart's _InboxSignIn for the Firestore-handoff
            // caveat this button still carries (same shape here).
            onPressed: () =>
                context.push(Routes.loginWithReturnTo(Routes.staffroom)),
          ),
        ),
      ),
    );
  }
}

/// The feed error surface — an `ErrorView` + retry, never an infinite spinner.
class _StaffroomError extends StatelessWidget {
  const _StaffroomError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.mapGutter,
        AppSpacing.space3,
        AppSpacing.mapGutter,
        AppSpacing.mapBottomClearance,
      ),
      child: MapCard(
        child: ErrorView(message: l10n.staffroomErrorBody, onRetry: onRetry),
      ),
    );
  }
}
