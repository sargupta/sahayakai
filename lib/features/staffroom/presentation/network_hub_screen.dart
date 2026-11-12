import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/map_card.dart';
import '../../../shared/widgets/secondary_button.dart';
import '../../inbox/data/messages_stream_provider.dart';
import '../../inbox/presentation/widgets/conversation_row.dart';
import '../../notifications/data/notifications_store.dart';
import '../../notifications/presentation/notifications_view.dart';
import '../data/staffroom_providers.dart';
import '../data/teacher_profiles.dart';
import '../domain/connection.dart';
import '../domain/teacher.dart';
import 'community_network_screen.dart';
import 'staffroom_screen.dart';
import 'widgets/community_sections.dart';
import 'widgets/connection_action.dart';
import 'widgets/staffroom_avatar.dart';

/// The **Community** hub (UX map `community`, route `/network`): the title
/// with the Updates bell, the deck line naming the open section, and three
/// panes that all stay mounted:
///   - **Staffroom** → [StaffroomFeedView] (feed, composer, groups, people);
///   - **Messages**  → connection requests + the Pro Inbox conversations;
///   - **Updates**   → [NotificationsView], the per-teacher on-device record of
///     call outcomes, absence runs and queued generations.
///
/// The sections are not a bar across the top: a slim grip on the left edge
/// (with a dot while anything is unread) pulls out a side panel listing the
/// three with their unread counts. Tap the grip or swipe in from the edge to
/// open it; tap outside, the chevron, Back, or swipe left to close it.
///
/// The bell badges the unread Updates count and selects that pane, so the
/// count is visible from the other two.
class NetworkHubScreen extends ConsumerStatefulWidget {
  const NetworkHubScreen({super.key});

  @override
  ConsumerState<NetworkHubScreen> createState() => _NetworkHubScreenState();
}

class _NetworkHubScreenState extends ConsumerState<NetworkHubScreen> {
  int _index = 0;
  bool _sectionsOpen = false;

  /// Whether the panel is on screen at all: true while open and while it
  /// slides away, false once it has gone (then it is Offstage, so its rows
  /// are neither painted, tappable nor announced).
  bool _panelShown = false;

  /// The Updates pane's index in both the side panel and the pane stack.
  static const int _updatesIndex = 2;

  /// Where the grip sits: beside the header, clear of the dock.
  static const double _gripTop = 120;

  void _select(int index) => setState(() {
    _index = index;
    _sectionsOpen = false;
  });

  void _setOpen(bool open) {
    if (open == _sectionsOpen) return;
    setState(() {
      _sectionsOpen = open;
      if (open) _panelShown = true;
    });
  }

  /// The slide finished. With reduced motion it "finishes" inside the build
  /// that started it, so the panel is taken off screen after that frame.
  void _onPanelSettled() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !_sectionsOpen && _panelShown) {
        setState(() => _panelShown = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final motion = MediaQuery.disableAnimationsOf(context)
        ? Duration.zero
        : const Duration(milliseconds: 260);
    final unreadMessages = ref
        .watch(unreadConversationsProvider)
        .maybeWhen(
          data: (snapshot) => snapshot.isReady ? snapshot.data : 0,
          orElse: () => 0,
        );
    final unreadUpdates = ref.watch(unreadNotificationCountProvider);
    final sectionLabels = [
      l10n.networkTabStaffroom,
      l10n.networkTabMessages,
      l10n.networkTabUpdates,
    ];
    final panelWidth = (MediaQuery.sizeOf(context).width * 0.72).clamp(
      240.0,
      320.0,
    );
    // The UX map's Community header: the title with the Updates bell and the
    // deck line. No app bar: VIDYA is docked in the tab bar, so the sparkle
    // launcher is not repeated here. The wash comes from AppBackground
    // (app.dart), as on the other tabs.
    return PopScope(
      canPop: !_sectionsOpen,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _setOpen(false);
      },
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: SafeArea(
          bottom: false,
          child: Stack(
            children: [
              _hubBody(context, sectionLabels),
              // A thin strip on the left edge: a swipe in opens the panel.
              PositionedDirectional(
                start: 0,
                top: 0,
                bottom: 0,
                width: 16,
                child: GestureDetector(
                  behavior: HitTestBehavior.translucent,
                  onHorizontalDragEnd: (d) {
                    if ((d.primaryVelocity ?? 0) > 150) _setOpen(true);
                  },
                ),
              ),
              PositionedDirectional(
                start: 0,
                top: _gripTop,
                child: CommunitySectionsGrip(
                  key: const ValueKey('community-sections-grip'),
                  label: l10n.communitySectionsOpen(sectionLabels[_index]),
                  showDot: unreadMessages > 0 || unreadUpdates > 0,
                  onOpen: () => _setOpen(true),
                ),
              ),
              // The scrim: a tap anywhere outside the panel closes it.
              IgnorePointer(
                ignoring: !_sectionsOpen,
                child: AnimatedOpacity(
                  opacity: _sectionsOpen ? 1 : 0,
                  duration: motion,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => _setOpen(false),
                    child: ExcludeSemantics(
                      child: ColoredBox(
                        color: AppColors.ink900.withValues(alpha: 0.28),
                        child: const SizedBox.expand(),
                      ),
                    ),
                  ),
                ),
              ),
              AnimatedPositionedDirectional(
                duration: motion,
                curve: Curves.easeOutCubic,
                start: _sectionsOpen ? 0 : -(panelWidth + 40),
                top: 0,
                bottom: 0,
                width: panelWidth + 34,
                onEnd: _onPanelSettled,
                child: Offstage(
                  offstage: !_panelShown,
                  child: ExcludeSemantics(
                    excluding: !_sectionsOpen,
                    child: GestureDetector(
                      onHorizontalDragEnd: (d) {
                        if ((d.primaryVelocity ?? 0) < -150) _setOpen(false);
                      },
                      child: Stack(
                        children: [
                          PositionedDirectional(
                            start: 0,
                            top: 0,
                            bottom: 0,
                            width: panelWidth,
                            child: CommunitySectionsPanel(
                              selected: _index,
                              labels: sectionLabels,
                              unreadMessages: unreadMessages,
                              unreadUpdates: unreadUpdates,
                              onSelect: _select,
                            ),
                          ),
                          PositionedDirectional(
                            start: panelWidth,
                            top: _gripTop,
                            child: CommunitySectionsCloseTab(
                              key: const ValueKey('community-sections-close'),
                              label: l10n.communitySectionsClose,
                              onClose: () => _setOpen(false),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _hubBody(BuildContext context, List<String> sectionLabels) {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.mapGutter,
            AppSpacing.space4,
            AppSpacing.mapGutter,
            0,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Semantics(
                      header: true,
                      child: Text(
                        l10n.communityTitle,
                        style: Theme.of(context).textTheme.displayLarge
                            ?.copyWith(
                              fontSize: 27,
                              color: AppColors.textStrong,
                            ),
                      ),
                    ),
                  ),
                  _NotificationsBell(onPressed: () => _select(_updatesIndex)),
                ],
              ),
              Text(
                l10n.communityDeckWithSection(
                  sectionLabels[_index],
                  l10n.communityDeck,
                ),
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  fontSize: 13,
                  color: AppColors.textBody,
                ),
              ),
              const SizedBox(height: AppSpacing.space2),
            ],
          ),
        ),
        // All three panes stay mounted (warm) via a Stack of Offstage panes:
        // the inbox stream stays subscribed and the feed does not refetch
        // on a switch, but only the selected pane is laid out and painted
        // (so an offstage-respecting finder sees exactly the active pane).
        Expanded(
          child: Stack(
            fit: StackFit.expand,
            children: [
              Offstage(offstage: _index != 0, child: const StaffroomFeedView()),
              Offstage(offstage: _index != 1, child: const _MessagesTab()),
              Offstage(
                offstage: _index != _updatesIndex,
                child: const NotificationsView(),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// The Updates bell, drawn as the map's `iconbtn`: a 40px white disc with a
/// hairline ring, and a red dot ringed in white while anything is unread. Its
/// touch area is 48dp; its accessible label carries the unread count through
/// the same `inboxUnreadLabel` plural the inbox uses.
class _NotificationsBell extends ConsumerWidget {
  const _NotificationsBell({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final unread = ref.watch(unreadNotificationCountProvider);

    return Semantics(
      button: true,
      label: unread > 0
          ? '${l10n.networkTabUpdates}, ${l10n.inboxUnreadLabel(unread)}'
          : l10n.networkTabUpdates,
      excludeSemantics: true,
      onTap: onPressed,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onPressed,
        child: SizedBox.square(
          dimension: 48,
          child: Center(
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceMapCard,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.borderHairline),
                  ),
                  child: const Icon(
                    LucideIcons.bell,
                    size: 18,
                    color: AppColors.textStrong,
                  ),
                ),
                if (unread > 0)
                  PositionedDirectional(
                    top: 4,
                    end: 4,
                    child: Container(
                      width: 9,
                      height: 9,
                      decoration: BoxDecoration(
                        color: AppColors.danger,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The Messages pane (UX map `msgPane`), top to bottom:
///
///   - the indigo note: chat opens only once a teacher accepts a request;
///   - **Pending requests · N** — the connection requests other teachers sent
///     (`GET /api/connections/mine`, named via `POST /api/community/profiles`),
///     each with Accept / Decline; accepting unlocks the DM;
///   - **Conversations · N** — the live Pro Inbox list ([inboxListProvider]),
///     a row opens the thread;
///   - **Find more teachers** → the "Your network" screen.
///
/// Signed out → the sign-in note; an inbox stream error → `ErrorView` + retry.
class _MessagesTab extends ConsumerWidget {
  const _MessagesTab();

  /// The map's screen frame under the hub header.
  static const EdgeInsets _panePadding = EdgeInsets.fromLTRB(
    AppSpacing.mapGutter,
    AppSpacing.space3,
    AppSpacing.mapGutter,
    AppSpacing.mapBottomClearance,
  );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final async = ref.watch(inboxListProvider);
    final myUid = ref.watch(currentInboxUserIdProvider);

    return async.when(
      loading: () =>
          const Padding(padding: _panePadding, child: AppSkeleton(lines: 5)),
      error: (_, _) => _messagesError(context, ref),
      data: (snapshot) {
        if (snapshot.hasError) return _messagesError(context, ref);
        if (snapshot.isLoading) {
          return const Padding(
            padding: _panePadding,
            child: AppSkeleton(lines: 5),
          );
        }
        if (snapshot.isEmptyByDesign || myUid == null) {
          return SingleChildScrollView(
            padding: _panePadding,
            child: MapCard(
              child: MapEmptyNote(
                icon: LucideIcons.messageCircle,
                title: l10n.inboxSignInTitle,
                message: l10n.inboxSignInBody,
                action: SecondaryButton(
                  label: l10n.actionSignIn,
                  icon: LucideIcons.logIn,
                  onPressed: () =>
                      context.push(Routes.loginWithReturnTo(Routes.network)),
                ),
              ),
            ),
          );
        }
        final conversations = snapshot.data;
        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(connectionsControllerProvider);
            await ref
                .read(connectionsControllerProvider.future)
                .catchError((Object _) => const MyConnectionData());
          },
          child: ListView(
            padding: _panePadding,
            children: [
              const _DmGateNote(),
              const SizedBox(height: AppSpacing.space3),
              const _PendingRequests(),
              MapOverline(
                l10n.communityConversationsCount(conversations.length),
              ),
              const SizedBox(height: AppSpacing.space2),
              if (conversations.isEmpty)
                MapCard(
                  child: MapEmptyNote(
                    icon: LucideIcons.messagesSquare,
                    title: l10n.inboxEmptyTitle,
                    message: l10n.inboxEmptyBody,
                  ),
                )
              else
                for (final conversation in conversations)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.space3),
                    child: ConversationRow(
                      key: ValueKey<String>(
                        'network-inbox-${conversation.id.value}',
                      ),
                      conversation: conversation,
                      myUid: myUid,
                      onTap: () => context.push(
                        Routes.conversationThreadPath(conversation.id.value),
                        extra: conversation,
                      ),
                    ),
                  ),
              const _FindMoreTeachers(),
            ],
          ),
        );
      },
    );
  }

  Widget _messagesError(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    return SingleChildScrollView(
      padding: _panePadding,
      child: MapCard(
        child: ErrorView(
          message: l10n.inboxErrorBody,
          onRetry: () => ref.invalidate(inboxListProvider),
        ),
      ),
    );
  }
}

/// The map's indigo note: why a teacher cannot simply message anyone.
class _DmGateNote extends StatelessWidget {
  const _DmGateNote();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.space3),
      decoration: BoxDecoration(
        color: AppColors.mapNcertBg,
        borderRadius: AppRadius.rTile,
        border: Border.all(color: AppColors.mapNcertBorder),
      ),
      child: Text(
        context.l10n.communityMessagesNote,
        style: Theme.of(
          context,
        ).textTheme.bodyMedium?.copyWith(color: AppColors.tileIndigoInk),
      ),
    );
  }
}

/// "Pending requests · N": requests other teachers sent, with Accept and
/// Decline. Renders nothing while loading or when there are none; a failed
/// read gets its own retry so it never hides the conversations below.
///
/// Accepting is what opens chat (the UX map), so a teacher accepted here
/// stays on screen under "Just connected" with a Message button, instead of
/// vanishing from the list. The row goes once the chat is opened.
class _PendingRequests extends ConsumerStatefulWidget {
  const _PendingRequests();

  @override
  ConsumerState<_PendingRequests> createState() => _PendingRequestsState();
}

class _PendingRequestsState extends ConsumerState<_PendingRequests> {
  /// Teachers accepted while this pane is open, in the order accepted, with
  /// the profile they were shown with (it is no longer looked up once the
  /// request is gone).
  final Map<String, TeacherSuggestion?> _justConnected = {};

  /// The last resolved profiles of the pending requests.
  Map<String, TeacherSuggestion> _profiles = const {};

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    // A request that leaves the pending list AND joins the connections was
    // accepted (a declined one just leaves).
    ref.listen<AsyncValue<MyConnectionData>>(connectionsControllerProvider, (
      previous,
      next,
    ) {
      final before = previous?.valueOrNull;
      final after = next.valueOrNull;
      if (before == null || after == null) return;
      final stillPending = {for (final r in after.receivedRequests) r.uid};
      final accepted = [
        for (final r in before.receivedRequests)
          if (!stillPending.contains(r.uid) &&
              after.connectedUids.contains(r.uid))
            r.uid,
      ];
      if (accepted.isEmpty) return;
      setState(() {
        for (final uid in accepted) {
          _justConnected[uid] = _profiles[uid];
        }
      });
    });

    final connections = ref.watch(connectionsControllerProvider);
    if (connections.hasError && !connections.hasValue) {
      return Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.space3),
        child: MapCard(
          child: SectionRetry(
            onRetry: () => ref.invalidate(connectionsControllerProvider),
          ),
        ),
      );
    }
    final received =
        connections.valueOrNull?.receivedRequests ??
        const <ReceivedConnectionRequest>[];

    final uids = [for (final r in received) r.uid];
    final profiles = uids.isEmpty
        ? const AsyncValue<Map<String, TeacherSuggestion>>.data({})
        : ref.watch(teacherProfilesProvider(teacherProfilesKey(uids)));
    final byUid = profiles.valueOrNull ?? const <String, TeacherSuggestion>{};
    if (byUid.isNotEmpty) _profiles = {..._profiles, ...byUid};

    if (received.isEmpty && _justConnected.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (received.isNotEmpty) ...[
          MapOverline(l10n.communityPendingRequestsCount(received.length)),
          const SizedBox(height: AppSpacing.space2),
          for (final request in received)
            Padding(
              key: ValueKey<String>('pending-request-${request.uid}'),
              padding: const EdgeInsets.only(bottom: AppSpacing.space3),
              child: _PendingRequestCard(
                uid: request.uid,
                profile: byUid[request.uid],
                resolving: profiles.isLoading,
              ),
            ),
        ],
        if (_justConnected.isNotEmpty) ...[
          MapOverline(l10n.communityJustConnected),
          const SizedBox(height: AppSpacing.space2),
          for (final entry in _justConnected.entries)
            Padding(
              key: ValueKey<String>('just-connected-${entry.key}'),
              padding: const EdgeInsets.only(bottom: AppSpacing.space3),
              child: _JustConnectedCard(
                uid: entry.key,
                profile: entry.value,
                onOpened: () =>
                    setState(() => _justConnected.remove(entry.key)),
              ),
            ),
        ],
      ],
    );
  }
}

/// A teacher just accepted: "Connected · you can chat now" and a Message
/// button that opens (or creates) the direct chat.
class _JustConnectedCard extends ConsumerStatefulWidget {
  const _JustConnectedCard({
    required this.uid,
    required this.profile,
    required this.onOpened,
  });

  final String uid;
  final TeacherSuggestion? profile;
  final VoidCallback onOpened;

  @override
  ConsumerState<_JustConnectedCard> createState() => _JustConnectedCardState();
}

class _JustConnectedCardState extends ConsumerState<_JustConnectedCard> {
  bool _busy = false;

  Future<void> _message(String name) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await openDirectMessage(
        context,
        ref,
        otherUid: widget.uid,
        displayName: name,
        photoURL: widget.profile?.photoURL,
      );
      if (mounted) widget.onOpened();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.maybeOf(context)
        ?..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(content: Text(context.l10n.communityMessageFailed)),
        );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final shown = widget.profile?.displayName.trim() ?? '';
    final name = shown.isNotEmpty ? shown : l10n.communityUnknownTeacher;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.mapOptLeaf,
        borderRadius: AppRadius.rCard,
        border: Border.all(color: AppColors.mapOptLeafRing),
      ),
      child: Row(
        children: [
          StaffroomAvatar(
            name: name,
            photoUrl: widget.profile?.photoURL,
            size: 36,
          ),
          const SizedBox(width: AppSpacing.space3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  name,
                  style: text.bodyLarge?.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textStrong,
                  ),
                ),
                Text(
                  l10n.communityConnectedCanChat,
                  style: text.bodyMedium?.copyWith(color: AppColors.leaf700),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.space2),
          Semantics(
            button: true,
            enabled: !_busy,
            label: l10n.staffroomMessage,
            excludeSemantics: true,
            child: GestureDetector(
              key: ValueKey<String>('just-connected-message-${widget.uid}'),
              behavior: HitTestBehavior.opaque,
              onTap: _busy ? null : () => _message(name),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 44, minWidth: 44),
                child: Center(
                  widthFactor: 1,
                  child: Opacity(
                    opacity: _busy ? 0.55 : 1,
                    child: Container(
                      height: 28,
                      padding: const EdgeInsets.symmetric(horizontal: 11),
                      decoration: const ShapeDecoration(
                        color: AppColors.accentFill,
                        shape: StadiumBorder(),
                      ),
                      child: Center(
                        widthFactor: 1,
                        child: Text(
                          l10n.staffroomMessage,
                          style: text.labelMedium?.copyWith(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textOnAccent,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PendingRequestCard extends StatelessWidget {
  const _PendingRequestCard({
    required this.uid,
    required this.profile,
    required this.resolving,
  });

  final String uid;
  final TeacherSuggestion? profile;
  final bool resolving;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final name = profile?.displayName.trim().isNotEmpty == true
        ? profile!.displayName.trim()
        : l10n.communityUnknownTeacher;
    return MapCard(
      child: Row(
        children: [
          StaffroomAvatar(name: name, photoUrl: profile?.photoURL, size: 36),
          const SizedBox(width: AppSpacing.space3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (resolving && profile == null)
                  const AppSkeleton(lines: 0)
                else
                  Text(
                    name,
                    style: text.bodyLarge?.copyWith(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textStrong,
                    ),
                  ),
                Text(
                  l10n.staffroomConnectionWants,
                  style: text.bodyMedium?.copyWith(color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.space2),
          TeacherConnectionAction(
            uid: uid,
            displayName: profile?.displayName ?? '',
            photoURL: profile?.photoURL,
            compact: true,
            respond: true,
          ),
        ],
      ),
    );
  }
}

/// The map's closing block: a way to grow the network.
class _FindMoreTeachers extends StatelessWidget {
  const _FindMoreTeachers();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.space4),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const ExcludeSemantics(
            child: CircleAvatar(
              radius: 28,
              backgroundColor: AppColors.tileSaffronBg,
              child: Icon(
                LucideIcons.messageCircle,
                size: 22,
                color: AppColors.tileSaffronInk,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.space2),
          Text(
            l10n.communityFindMoreTitle,
            textAlign: TextAlign.center,
            style: text.bodyLarge?.copyWith(
              fontWeight: FontWeight.w700,
              color: AppColors.textMuted,
            ),
          ),
          Text(
            l10n.communityFindMoreBody,
            textAlign: TextAlign.center,
            style: text.bodyMedium?.copyWith(color: AppColors.textMuted),
          ),
          TextButton(
            onPressed: () => openCommunityNetwork(context),
            style: TextButton.styleFrom(
              foregroundColor: AppColors.textLink,
              minimumSize: const Size(48, 48),
            ),
            child: Text(l10n.communityFindMoreAction),
          ),
        ],
      ),
    );
  }
}
