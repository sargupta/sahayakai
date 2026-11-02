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
import '../../vidya/presentation/vidya_sheet.dart';
import '../data/staffroom_providers.dart';
import '../domain/community_post.dart';
import '../domain/group.dart';
import '../domain/staffroom_results.dart';
import '../domain/teacher.dart';
import 'widgets/feed_item_view.dart';
import 'widgets/group_chip.dart';
import 'widgets/post_type_style.dart';
import 'widgets/teacher_suggestion_card.dart';

/// U-SI2 — the Staffroom home (SPEC §A3.1). A scroll of editorial registers: a
/// hero masthead, the "Your groups" strip, "Discover groups", the unified feed
/// ("From your groups"), and "People you may know".
///
/// State mapping mirrors the U-SI1 inbox, driven by [unifiedFeedProvider] (the
/// primary surface) + [currentStaffroomUserId]:
///
///   - null uid (signed-out / awaiting Firebase) → the sign-in `EmptyView`
///     ("Sign in to join the staffroom") — what the deferred transport shows
///     on-device;
///   - `loading`  → an `AppSkeleton` feed;
///   - `error`    → an `ErrorView` + retry (never a hang);
///   - `ready` empty → the "Your feed is quiet" `EmptyView`;
///   - `ready` non-empty → the feed cards + the group / people sections.
///
/// **Firebase-gated:** on-device the bound transport is deferred (empty reads)
/// and the uid is null, so this always resolves to the sign-in surface (verified
/// by code + test, not live). [StaffroomFeedView] is the body, so the Network hub
/// can host it under its own chrome without a nested app bar.
class StaffroomScreen extends StatelessWidget {
  const StaffroomScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: GlassAppBar(
        title: Text(l10n.staffroomTitle),
        actions: const [VidyaAppBarAction()],
      ),
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

  /// The "Your network" tile scrolls here.
  final GlobalKey _networkKey = GlobalKey();

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
    await ref.read(unifiedFeedProvider.future);
  }

  void _showNetwork() {
    final target = _networkKey.currentContext;
    if (target == null) return;
    Scrollable.ensureVisible(
      target,
      duration: context.motionEnabled ? AppMotion.medium : Duration.zero,
      curve: AppMotion.emphasized,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final feed = widget.feed;
    final likedIds =
        ref.watch(likedItemIdsProvider).valueOrNull ?? const LikedItemIds();
    final myGroups = ref.watch(myGroupsProvider).valueOrNull ?? const <Group>[];
    final discover =
        ref.watch(discoverGroupsProvider).valueOrNull ?? const <Group>[];
    final people =
        ref.watch(recommendedTeachersProvider).valueOrNull ??
        const <TeacherSuggestion>[];

    final shown = _filter == null
        ? feed
        : [
            for (final item in feed)
              if (item.post?.postType == _filter) item,
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
          // The map's two tiles: the live staff room, and the teacher's own
          // network further down this page.
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: _HubTile(
                    title: l10n.staffroomChatTitle,
                    subtitle: l10n.communityOpenChat,
                    onTap: () => context.push(Routes.staffRoomChat),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _HubTile(
                    title: l10n.communityYourNetwork,
                    subtitle: l10n.communityGroupsAndPeople,
                    onTap: _showNetwork,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.space3),

          if (feed.isEmpty)
            const MapCard(child: _FeedEmpty())
          else ...[
            Wrap(
              spacing: 7,
              children: [
                for (final type in _chips)
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
            ),
            const SizedBox(height: AppSpacing.space1),
            if (shown.isEmpty)
              const MapCard(child: _FeedEmpty())
            else
              ...shown.asMap().entries.map(
                (entry) => Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.space3),
                  child: staggeredItem(
                    context,
                    FeedItemView(
                      key: ValueKey<String>('feed-${entry.value.id}'),
                      item: entry.value,
                      likedIds: likedIds,
                    ),
                    index: entry.key,
                  ),
                ),
              ),
          ],

          // Your network: groups, groups to discover, people you may know.
          const SizedBox(height: AppSpacing.space3),
          KeyedSubtree(
            key: _networkKey,
            child: MapOverline(l10n.staffroomSectionGroups),
          ),
          const SizedBox(height: AppSpacing.space2),
          if (myGroups.isEmpty)
            const MapCard(child: _GroupsEmpty())
          else
            _GroupStrip(groups: myGroups),

          if (discover.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space5),
            MapOverline(l10n.staffroomSectionDiscover),
            const SizedBox(height: AppSpacing.space2),
            _GroupStrip(groups: discover),
          ],

          if (people.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space5),
            MapOverline(l10n.staffroomSectionPeople),
            const SizedBox(height: AppSpacing.space2),
            ...people.asMap().entries.map(
              (entry) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.space3),
                child: staggeredItem(
                  context,
                  TeacherSuggestionCard(
                    key: ValueKey<String>('pymk-${entry.value.uid}'),
                    teacher: entry.value,
                  ),
                  index: entry.key,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// The map's `.tile`: a white rounded block with a bold name over a muted
/// line, tappable as a whole.
class _HubTile extends StatelessWidget {
  const _HubTile({
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Semantics(
      button: true,
      child: MapCard(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: text.bodyLarge?.copyWith(
                fontSize: 14.5,
                fontWeight: FontWeight.w700,
                color: AppColors.textStrong,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              subtitle,
              style: text.bodyMedium?.copyWith(color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}

/// A horizontal strip of [GroupChip]s, sized to the tallest chip.
///
/// ## Why this is measured, not a constant
/// This strip used to be a `SizedBox(height: 116)` wrapping a horizontal
/// `ListView.separated`. A horizontal list has to be given a cross-axis extent
/// from somewhere, and 116 was the number a Latin group name at textScale 1.0
/// happened to need. It is not a number the *content* agrees with: [GroupChip]
/// stacks a two-line `titleSmall` name over a `dataMedium` member count beside
/// a 48dp [IconWell], inside [AppCard]'s 16dp padding and 1dp glass border. A
/// Bengali name at textScale 1.3 wants 117dp of that box's 114dp of usable
/// height — the RenderFlex overflowed by exactly 3dp, and a teacher on a cheap
/// Android with large text saw the member count clipped.
///
/// Bumping 116 to 120 would only move the cliff: Devanagari and Malayalam stack
/// taller matras still, and textScale goes to 2.0. So the extent is now
/// **derived from the content**. [IntrinsicHeight] asks the row how tall its
/// tallest chip actually wants to be and tightens the strip to that, and
/// `CrossAxisAlignment.stretch` levels every chip to the same measured height
/// so the strip still reads as one even row.
///
/// The lazy `ListView` gives way to a `SingleChildScrollView` + `Row` because a
/// viewport reports no intrinsic dimensions — it cannot be measured, only
/// bounded. That trade is safe here: `groups` is a single teacher's group
/// membership (a handful of chips), not an unbounded feed, so the whole row is
/// cheap to build and to measure eagerly.
class _GroupStrip extends StatelessWidget {
  const _GroupStrip({required this.groups});

  final List<Group> groups;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: AppSpacing.space3,
          children: [
            for (final group in groups)
              GroupChip(
                key: ValueKey<String>('group-chip-${group.id}'),
                group: group,
                onTap: () => context.push(Routes.groupDetailPath(group.id)),
              ),
          ],
        ),
      ),
    );
  }
}

/// The compact "Your groups" empty prompt (not a full halo — the feed owns the
/// prominent empty state below).
///
/// It carries NO "Browse groups" button. The button used to scroll to the
/// inline "Discover groups" section, but that section only renders when
/// `discoverGroups()` returns suggestions — and the shipping Firestore transport
/// hardcodes it empty (a real backend gap, not a client bug; the Groups /
/// Directory / Feed reads land in a later tranche). With nothing to discover,
/// the button silently scrolled the page down to the "Your feed is quiet"
/// region — an affordance that led nowhere. An honest empty prompt (a plain
/// statement that you haven't joined a group yet) beats a button that lies about
/// having a destination; the browse affordance returns with the backend that
/// gives it somewhere real to go.
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

/// The signed-out / awaiting-Firebase surface — what the Staffroom shows
/// on-device (deferred reads + null uid). The DM-gate equivalent for Pillar 04.
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
