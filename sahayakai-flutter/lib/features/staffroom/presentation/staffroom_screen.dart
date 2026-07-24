import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/secondary_button.dart';
import '../data/staffroom_providers.dart';
import '../domain/community_post.dart';
import '../domain/group.dart';
import '../domain/staffroom_results.dart';
import '../domain/teacher.dart';
import 'widgets/chat_entry_tile.dart';
import 'widgets/feed_item_view.dart';
import 'widgets/group_chip.dart';
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
      appBar: AppBar(title: Text(l10n.staffroomTitle)),
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
      error: (_, _) => _StaffroomError(
        onRetry: () => ref.invalidate(unifiedFeedProvider),
      ),
      data: (feed) => _StaffroomReady(feed: feed),
    );
  }
}

/// The ready scroll: hero + groups + discover + feed + people. Each secondary
/// section watches its own provider and degrades to nothing on loading/error, so
/// a failed groups read never breaks the feed.
class _StaffroomReady extends ConsumerStatefulWidget {
  const _StaffroomReady({required this.feed});

  final List<FeedItem> feed;

  @override
  ConsumerState<_StaffroomReady> createState() => _StaffroomReadyState();
}

class _StaffroomReadyState extends ConsumerState<_StaffroomReady> {
  final ScrollController _controller = ScrollController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref
      ..invalidate(unifiedFeedProvider)
      ..invalidate(myGroupsProvider)
      ..invalidate(discoverGroupsProvider)
      ..invalidate(recommendedTeachersProvider)
      ..invalidate(likedItemIdsProvider);
    await ref.read(unifiedFeedProvider.future);
  }

  /// Reveal the inline "Discover groups" / feed below (the browse affordance in
  /// U-SI2 — there is no separate browse screen). Reduce-motion jumps instead.
  void _browse() {
    if (!_controller.hasClients) return;
    final target = _controller.position.maxScrollExtent;
    if (context.motionEnabled) {
      _controller.animateTo(
        target,
        duration: AppMotion.medium,
        curve: AppMotion.easeOutQuart,
      );
    } else {
      _controller.jumpTo(target);
    }
  }

  @override
  Widget build(BuildContext context) {
    final feed = widget.feed;
    final l10n = context.l10n;
    final likedIds =
        ref.watch(likedItemIdsProvider).valueOrNull ?? const LikedItemIds();
    final myGroups = ref.watch(myGroupsProvider).valueOrNull ?? const <Group>[];
    final discover =
        ref.watch(discoverGroupsProvider).valueOrNull ?? const <Group>[];
    final people = ref.watch(recommendedTeachersProvider).valueOrNull ??
        const <TeacherSuggestion>[];

    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView(
        controller: _controller,
        padding: AppSpacing.pagePadding,
        children: [
          const _StaffroomHero(),
          const SizedBox(height: AppSpacing.space5),

          // The Staff Room chat entry (SPEC §A3.1) — the community-wide live room.
          ChatEntryTile(
            title: l10n.staffroomChatTitle,
            subtitle: l10n.staffroomChatEntryBody,
            feature: true,
            onTap: () => context.push(Routes.staffRoomChat),
          ),
          const SizedBox(height: AppSpacing.space6),

          // Your groups.
          EditorialSectionHeader(l10n.staffroomSectionGroups),
          const SizedBox(height: AppSpacing.space3),
          if (myGroups.isEmpty)
            _GroupsEmpty(onBrowse: _browse)
          else
            _GroupStrip(groups: myGroups),
          const SizedBox(height: AppSpacing.space6),

          // Discover groups (only when there are suggestions).
          if (discover.isNotEmpty) ...[
            EditorialSectionHeader(l10n.staffroomSectionDiscover),
            const SizedBox(height: AppSpacing.space3),
            _GroupStrip(groups: discover),
            const SizedBox(height: AppSpacing.space6),
          ],

          // From your groups — the unified feed.
          EditorialSectionHeader(l10n.staffroomSectionFeed),
          const SizedBox(height: AppSpacing.space3),
          if (feed.isEmpty)
            _FeedEmpty()
          else
            ...feed.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.space3),
                child: FeedItemView(
                  key: ValueKey<String>('feed-${item.id}'),
                  item: item,
                  likedIds: likedIds,
                ),
              ),
            ),

          // People you may know (only when there are recommendations).
          if (people.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space3),
            EditorialSectionHeader(l10n.staffroomSectionPeople),
            const SizedBox(height: AppSpacing.space3),
            ...people.map(
              (t) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.space3),
                child: TeacherSuggestionCard(
                  key: ValueKey<String>('pymk-${t.uid}'),
                  teacher: t,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// A horizontal strip of [GroupChip]s. The height is bounded (and the chip
/// content maxLines-capped) so it never RenderFlex-overflows at textScale 1.3.
class _GroupStrip extends StatelessWidget {
  const _GroupStrip({required this.groups});

  final List<Group> groups;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 116,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        itemCount: groups.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.space3),
        itemBuilder: (context, index) {
          final group = groups[index];
          return GroupChip(
            key: ValueKey<String>('group-chip-${group.id}'),
            group: group,
            onTap: () => context.push(Routes.groupDetailPath(group.id)),
          );
        },
      ),
    );
  }
}

/// The compact "Your groups" empty prompt (not a full halo — the feed owns the
/// prominent empty state below). "Browse groups" scrolls to the inline Discover
/// section rather than a screen U-SI2 does not have.
class _GroupsEmpty extends StatelessWidget {
  const _GroupsEmpty({required this.onBrowse});

  final VoidCallback onBrowse;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final text = theme.textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(l10n.staffroomGroupsEmptyTitle, style: text.titleSmall),
        const SizedBox(height: AppSpacing.space1),
        // Full-ink on the scaffold ground ("muted only on white cards").
        Text(
          l10n.staffroomGroupsEmptyBody,
          style: text.bodyMedium?.copyWith(color: scheme.onSurface),
        ),
        const SizedBox(height: AppSpacing.space3),
        SecondaryButton(
          label: l10n.staffroomBrowseGroups,
          icon: LucideIcons.users,
          onPressed: onBrowse,
        ),
      ],
    );
  }
}

/// The prominent feed-empty state (ready, no items).
class _FeedEmpty extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return EmptyView(
      icon: LucideIcons.messagesSquare,
      title: l10n.staffroomFeedEmptyTitle,
      message: l10n.staffroomFeedEmptyBody,
    );
  }
}

/// The hero masthead: saffron eyebrow → serif greeting → saffron rule → deck.
class _StaffroomHero extends StatelessWidget {
  const _StaffroomHero();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final text = theme.textTheme;
    final extras = AppTextExtras.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        EditorialSectionHeader(l10n.staffroomTitle, rule: false),
        const SizedBox(height: AppSpacing.space3),
        Text(l10n.staffroomHeroTitle, style: text.displaySmall),
        const SizedBox(height: AppSpacing.space3),
        const SizedBox(
          width: 48,
          height: 2,
          child: DecoratedBox(
            decoration: BoxDecoration(gradient: AppGradients.accentBar),
          ),
        ),
        const SizedBox(height: AppSpacing.space3),
        Text(
          // Full-ink on the scaffold ground: onSurfaceVariant is only 4.36:1 on
          // the ground (< AA); the deck stays subordinate via the lighter `lead`
          // weight, not a muted colour ("muted only on white cards").
          l10n.staffroomHeroDeck,
          style: extras.lead.copyWith(color: scheme.onSurface),
        ),
      ],
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
      padding: AppSpacing.pagePadding,
      child: EmptyView(
        icon: LucideIcons.users,
        title: l10n.staffroomSignInTitle,
        message: l10n.staffroomSignInBody,
        action: SecondaryButton(
          label: l10n.actionSignIn,
          icon: LucideIcons.logIn,
          // Real auth landed — a plain push is correct now. See
          // inbox_screen.dart's _InboxSignIn for the Firestore-handoff
          // caveat this button still carries (same shape here).
          onPressed: () => context.push(Routes.login),
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
      padding: AppSpacing.pagePadding,
      child: ErrorView(message: l10n.staffroomErrorBody, onRetry: onRetry),
    );
  }
}
