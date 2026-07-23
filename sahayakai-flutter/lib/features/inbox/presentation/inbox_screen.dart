import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/secondary_button.dart';
import '../data/block_c_transport.dart';
import '../data/messages_stream_provider.dart';
import '../domain/inbox_models.dart';
import 'widgets/conversation_row.dart';

/// U-SI1 — the Pro Inbox list (SPEC §B3.1). A live `StreamProvider` of the
/// teacher's conversations, ordered `lastMessageAt desc`, mapped by
/// [TransportSnapshot] state:
///
///   - `awaitingFirebase` / `signedOut` (or a null uid) → the sign-in
///     `EmptyView` — the DM-gate surface;
///   - `error` (missing index / permission-denied) → an `ErrorView` + retry,
///     **never** an infinite spinner (the web shipped that hang twice);
///   - `loading` → an `AppSkeleton` list;
///   - `ready` empty → "No conversations yet"; `ready` non-empty → the rows.
///
/// **Firebase-gated:** the bound transport is [DeferredInboxTransport], so
/// on-device this always resolves to `awaitingFirebase` → the sign-in state
/// (verified by code + test, not live). Widget tests drive the fake transport +
/// override [currentInboxUserIdProvider] to exercise the ready/empty/error rows.
class InboxScreen extends ConsumerWidget {
  const InboxScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final async = ref.watch(inboxListProvider);
    final myUid = ref.watch(currentInboxUserIdProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.inboxTitle)),
      body: SafeArea(
        child: async.when(
          loading: () => const Padding(
            padding: AppSpacing.pagePadding,
            child: AppSkeleton(lines: 5),
          ),
          // A stream-level error (the transport maps Firestore failures into a
          // ready `TransportSnapshot.error` instead, so this is the defensive
          // outer path) — still an ErrorView, never a hang.
          error: (_, _) => const _InboxError(),
          data: (snapshot) => _InboxBody(snapshot: snapshot, myUid: myUid),
        ),
      ),
    );
  }
}

class _InboxBody extends StatelessWidget {
  const _InboxBody({required this.snapshot, required this.myUid});

  final TransportSnapshot<List<Conversation>> snapshot;
  final String? myUid;

  @override
  Widget build(BuildContext context) {
    if (snapshot.hasError) {
      return const _InboxError();
    }
    if (snapshot.isLoading) {
      return const Padding(
        padding: AppSpacing.pagePadding,
        child: AppSkeleton(lines: 5),
      );
    }
    // Not wired to Firebase / no identity → the DM-gate sign-in surface.
    if (snapshot.isEmptyByDesign || myUid == null) {
      return const _InboxSignIn();
    }
    // Ready.
    final conversations = snapshot.data;
    if (conversations.isEmpty) {
      return const _InboxEmpty();
    }
    return _InboxList(conversations: conversations, myUid: myUid!);
  }
}

/// The live list of conversation rows. A `ListView.separated` of [ConversationRow]
/// register cards; the transport already orders them `lastMessageAt desc`.
class _InboxList extends StatelessWidget {
  const _InboxList({required this.conversations, required this.myUid});

  final List<Conversation> conversations;
  final String myUid;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: AppSpacing.pagePadding,
      itemCount: conversations.length,
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.space3),
      itemBuilder: (context, index) {
        final conversation = conversations[index];
        return ConversationRow(
          key: ValueKey<String>('inbox-row-${conversation.id.value}'),
          conversation: conversation,
          myUid: myUid,
          onTap: () => context.push(
            Routes.conversationThreadPath(conversation.id.value),
            extra: conversation,
          ),
        );
      },
    );
  }
}

/// The DM-gate / signed-out surface: a dignified sign-in prompt. On-device (the
/// deferred transport) this is what the inbox always shows.
class _InboxSignIn extends ConsumerWidget {
  const _InboxSignIn();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    return SingleChildScrollView(
      padding: AppSpacing.pagePadding,
      child: EmptyView(
        icon: LucideIcons.messageCircle,
        title: l10n.inboxSignInTitle,
        message: l10n.inboxSignInBody,
        action: SecondaryButton(
          label: l10n.actionSignIn,
          icon: LucideIcons.logIn,
          // See vidya_home_screen.dart's _TerminalPanel for why: the router's
          // separate stub authControllerProvider can still read signedIn from
          // an earlier onboarding pass, which silently bounces a bare push to
          // /login straight back — clear it first so the push actually lands.
          onPressed: () {
            ref.read(authControllerProvider.notifier).signOut();
            context.push(Routes.login);
          },
        ),
      ),
    );
  }
}

/// A genuinely empty inbox (`ready`, no conversations): the cold-start state.
class _InboxEmpty extends StatelessWidget {
  const _InboxEmpty();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return SingleChildScrollView(
      padding: AppSpacing.pagePadding,
      child: EmptyView(
        icon: LucideIcons.messagesSquare,
        title: l10n.inboxEmptyTitle,
        message: l10n.inboxEmptyBody,
      ),
    );
  }
}

/// The inbox error surface (a stream error, or a `TransportSnapshot.error` from
/// a missing composite index / permission-denied). Retry re-attaches the live
/// listener by invalidating the provider — never an infinite spinner.
class _InboxError extends ConsumerWidget {
  const _InboxError();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
