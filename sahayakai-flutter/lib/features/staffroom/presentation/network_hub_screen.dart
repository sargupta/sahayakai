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
import '../../../shared/widgets/secondary_button.dart';
import '../../inbox/data/messages_stream_provider.dart';
import '../../inbox/presentation/widgets/conversation_row.dart';
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
/// instead of clipping. The **notifications** surface is the third Network tab
/// and lands with U-SI5 (the notifications screen); the app-bar actions slot is
/// reserved for its bell.
class NetworkHubScreen extends StatefulWidget {
  const NetworkHubScreen({super.key});

  @override
  State<NetworkHubScreen> createState() => _NetworkHubScreenState();
}

class _NetworkHubScreenState extends State<NetworkHubScreen> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.networkTitle)),
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
                  Offstage(
                    offstage: _index != 1,
                    child: const _MessagesTab(),
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
