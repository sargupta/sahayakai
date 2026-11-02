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
import '../../../shared/widgets/map_segmented.dart';
import '../../../shared/widgets/secondary_button.dart';
import '../../inbox/data/messages_stream_provider.dart';
import '../../inbox/presentation/widgets/conversation_row.dart';
import '../../notifications/data/notifications_store.dart';
import '../../notifications/presentation/notifications_view.dart';
import 'staffroom_screen.dart';

/// U-SI2 — the **Network** hub (the SPEC's "Network" surface = Staffroom (04) +
/// Pro Inbox (05) + notifications). Given the 4-slot bottom nav
/// (Home / Create / Library / Me), the Network surface is a hub screen reached
/// from the voice-home app bar's network entry (next to the messages entry) —
/// **option (a)**, not a 5th tab (a 5-slot floating nav on a 360dp screen would
/// crowd, and the SPEC does not insist on a tab).
///
/// It hosts an `AppSegmented [Staffroom | Messages]` over an [IndexedStack]:
///   - **Staffroom** → [StaffroomFeedView] (the U-SI2 feed body, no nested app
///     bar);
///   - **Messages**  → the U-SI1 inbox list, reused via [inboxListProvider] +
///     [ConversationRow] with the same state→surface mapping as `InboxScreen`.
///
/// The segmented control sits at the top of the body (not in a fixed-height app-
/// bar bottom), so its chip fallback in Indic locales at textScale 1.3 wraps
/// instead of clipping.
///
/// The reserved third tab is now filled: **Updates** → [NotificationsView], the
/// on-device record of call outcomes, absence runs and queued generations. The
/// app-bar slot the reservation kept for its bell holds [_NotificationsBell],
/// which badges the unread count and selects that tab — so the count is visible
/// from the other two panes, which is the only thing a bell buys once the
/// surface itself is a tab.
class NetworkHubScreen extends StatefulWidget {
  const NetworkHubScreen({super.key});

  @override
  State<NetworkHubScreen> createState() => _NetworkHubScreenState();
}

class _NetworkHubScreenState extends State<NetworkHubScreen> {
  int _index = 0;

  /// The Updates pane's index in both the segmented control and the pane stack.
  static const int _updatesIndex = 2;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    // The UX map's Community header: the title with the Updates bell, the deck
    // line, and the segmented control. No app bar: VIDYA is docked in the tab
    // bar, so the sparkle launcher is not repeated here. The wash comes from
    // AppBackground (app.dart), as on the other tabs.
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        bottom: false,
        child: Column(
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
                      _NotificationsBell(
                        onPressed: () => setState(() => _index = _updatesIndex),
                      ),
                    ],
                  ),
                  Text(
                    l10n.communityDeck,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      fontSize: 13,
                      color: AppColors.textBody,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space2),
                  MapSegmented<int>(
                    value: _index,
                    onChanged: (value) => setState(() => _index = value),
                    segments: [
                      MapSegment<int>(
                        value: 0,
                        label: l10n.networkTabStaffroom,
                      ),
                      MapSegment<int>(value: 1, label: l10n.networkTabMessages),
                      MapSegment<int>(
                        value: _updatesIndex,
                        label: l10n.networkTabUpdates,
                      ),
                    ],
                  ),
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
                  Offstage(
                    offstage: _index != 0,
                    child: const StaffroomFeedView(),
                  ),
                  Offstage(offstage: _index != 1, child: const _MessagesTab()),
                  Offstage(
                    offstage: _index != _updatesIndex,
                    child: const NotificationsView(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
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

/// The Messages tab: the U-SI1 Pro Inbox list, reused. Same
/// [TransportSnapshot]-state mapping as `InboxScreen` (sign-in / empty / error /
/// rows) over [inboxListProvider] + [currentInboxUserId], routing a tap into the
/// conversation thread. On-device the deferred inbox transport streams
/// `awaitingFirebase`, so this shows the sign-in surface — verified by code +
/// test, not live.
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
                  // Real auth landed — a plain push is correct now. See
                  // inbox_screen.dart's _InboxSignIn for the Firestore-handoff
                  // caveat this button still carries (same shape here).
                  onPressed: () =>
                      context.push(Routes.loginWithReturnTo(Routes.network)),
                ),
              ),
            ),
          );
        }
        final conversations = snapshot.data;
        if (conversations.isEmpty) {
          return SingleChildScrollView(
            padding: _panePadding,
            child: MapCard(
              child: MapEmptyNote(
                icon: LucideIcons.messagesSquare,
                title: l10n.inboxEmptyTitle,
                message: l10n.inboxEmptyBody,
              ),
            ),
          );
        }
        return ListView.separated(
          padding: _panePadding,
          // +1 leading slot for the map's "Conversations · N" label.
          itemCount: conversations.length + 1,
          separatorBuilder: (_, index) => SizedBox(
            height: index == 0 ? AppSpacing.space2 : AppSpacing.space3,
          ),
          itemBuilder: (context, index) {
            if (index == 0) {
              return MapOverline(
                l10n.communityConversationsCount(conversations.length),
              );
            }
            final conversation = conversations[index - 1];
            return ConversationRow(
              key: ValueKey<String>('network-inbox-${conversation.id.value}'),
              conversation: conversation,
              myUid: myUid,
              onTap: () => context.push(
                Routes.conversationThreadPath(conversation.id.value),
                extra: conversation,
              ),
            );
          },
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
