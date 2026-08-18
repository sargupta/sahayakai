import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_segmented.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/glass_app_bar.dart';
import '../../../shared/widgets/secondary_button.dart';
import '../../inbox/data/messages_stream_provider.dart';
import '../../inbox/presentation/widgets/conversation_row.dart';
import '../../notifications/data/notifications_store.dart';
import '../../notifications/presentation/notifications_view.dart';
import '../../vidya/presentation/vidya_sheet.dart';
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
    return Scaffold(
      appBar: GlassAppBar(
        title: Text(l10n.networkTitle),
        actions: [
          _NotificationsBell(
            onPressed: () => setState(() => _index = _updatesIndex),
          ),
          const VidyaAppBarAction(),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.space4,
                AppSpacing.space3,
                AppSpacing.space4,
                AppSpacing.space2,
              ),
              child: AppSegmented<int>(
                value: _index,
                onChanged: (value) => setState(() => _index = value),
                segments: [
                  AppSegment<int>(value: 0, label: l10n.networkTabStaffroom),
                  AppSegment<int>(value: 1, label: l10n.networkTabMessages),
                  AppSegment<int>(
                    value: _updatesIndex,
                    label: l10n.networkTabUpdates,
                  ),
                ],
              ),
            ),
            // Both tabs stay mounted (warm) via a Stack of Offstage panes — the
            // inbox stream stays subscribed and the feed does not refetch on a
            // tab switch — but only the selected pane is laid out/painted (so an
            // offstage-respecting finder sees exactly the active tab).
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

/// The app-bar bell: a badged entry to the Updates pane, visible from all three
/// tabs. The badge is a dot, not a number — the count already sits on every
/// unread row, and a numeral in a 40dp app-bar target is the first thing to
/// clip at textScale 1.3 in an Indic locale. Its accessible label carries the
/// count instead, through the same `inboxUnreadLabel` plural the inbox uses.
///
/// The dot takes the saffron TEXT token, not `scheme.primary`: the brand fill
/// on the app bar's glass ground is ~2.26:1, under the 3:1 floor for a
/// meaningful non-text indicator.
class _NotificationsBell extends ConsumerWidget {
  const _NotificationsBell({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final unread = ref.watch(unreadNotificationCountProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return IconButton(
      tooltip: l10n.networkTabUpdates,
      onPressed: onPressed,
      icon: Semantics(
        label: unread > 0 ? l10n.inboxUnreadLabel(unread) : null,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Icon(unread > 0 ? LucideIcons.bellRing : LucideIcons.bell),
            if (unread > 0)
              PositionedDirectional(
                top: -1,
                end: -1,
                child: SizedBox(
                  width: 8,
                  height: 8,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isDark
                          ? AppColors.dPrimaryText
                          : AppColors.lPrimaryText,
                    ),
                  ),
                ),
              ),
          ],
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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final async = ref.watch(inboxListProvider);
    final myUid = ref.watch(currentInboxUserIdProvider);

    return async.when(
      loading: () => const Padding(
        padding: AppSpacing.pagePadding,
        child: AppSkeleton(lines: 5),
      ),
      error: (_, _) => _messagesError(context, ref),
      data: (snapshot) {
        if (snapshot.hasError) return _messagesError(context, ref);
        if (snapshot.isLoading) {
          return const Padding(
            padding: AppSpacing.pagePadding,
            child: AppSkeleton(lines: 5),
          );
        }
        if (snapshot.isEmptyByDesign || myUid == null) {
          return SingleChildScrollView(
            padding: AppSpacing.pagePadding,
            child: EmptyView(
              icon: LucideIcons.messageCircle,
              title: l10n.inboxSignInTitle,
              message: l10n.inboxSignInBody,
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
        final conversations = snapshot.data;
        if (conversations.isEmpty) {
          return SingleChildScrollView(
            padding: AppSpacing.pagePadding,
            child: EmptyView(
              icon: LucideIcons.messagesSquare,
              title: l10n.inboxEmptyTitle,
              message: l10n.inboxEmptyBody,
            ),
          );
        }
        return ListView.separated(
          padding: AppSpacing.pagePadding,
          itemCount: conversations.length,
          separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.space3),
          itemBuilder: (context, index) {
            final conversation = conversations[index];
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
      padding: AppSpacing.pagePadding,
      child: ErrorView(
        message: l10n.inboxErrorBody,
        onRetry: () => ref.invalidate(inboxListProvider),
      ),
    );
  }
}
