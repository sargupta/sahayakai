import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/auth/auth_providers.dart';
import '../domain/conversation_id.dart';
import '../domain/inbox_models.dart';
import 'block_c_transport.dart';
import 'inbox_transport.dart';

part 'messages_stream_provider.g.dart';

/// # Pro Inbox realtime providers (U-SI1)
///
/// Thin Riverpod wrappers over the [InboxTransport] live-read streams (SPEC §0 /
/// §B / §C). Each is a `StreamProvider<TransportSnapshot<...>>`, so the UI reads
/// **both** the payload and the listener lifecycle off one value and maps it:
///
///   - `awaitingFirebase` / `signedOut` → the sign-in `EmptyView` (DM gate);
///   - `loading`                        → an `AppSkeleton`;
///   - `ready` (possibly empty)         → the list / the empty-list `EmptyView`;
///   - `error` (missing index / denied) → an `ErrorView` + retry — never a hang.
///
/// While Firebase is gated the bound transport is [DeferredInboxTransport], so
/// every stream emits a single `awaitingFirebase` snapshot and the screens
/// render their signed-out/awaiting surface on-device (verified by code + test,
/// not live). At the handoff `inboxTransportProvider` swaps to the Firestore
/// impl and these providers stream live `onSnapshot` data with **no UI change**.

/// **LIVE.** The inbox list — a `StreamProvider` over
/// [InboxTransport.watchInbox]. The rows are ordered `lastMessageAt desc` by the
/// transport; the UI keeps that order.
@riverpod
Stream<TransportSnapshot<List<Conversation>>> inboxList(Ref ref) =>
    ref.watch(inboxTransportProvider).watchInbox();

/// **LIVE.** The tail of one thread — a `StreamProvider.family` keyed by
/// [ConversationId] over [InboxTransport.watchThread]. Referentially stable
/// (the transport dedups by [Message.id]) so the reversed list does not thrash.
@riverpod
Stream<TransportSnapshot<List<Message>>> conversationThread(
  Ref ref,
  ConversationId conversationId,
) =>
    ref.watch(inboxTransportProvider).watchThread(conversationId);

/// **LIVE.** The app-shell / entry-point unread badge — a `StreamProvider` over
/// [InboxTransport.watchUnreadConversations] (`sum(unreadCount[me])`).
@riverpod
Stream<TransportSnapshot<int>> unreadConversations(Ref ref) =>
    ref.watch(inboxTransportProvider).watchUnreadConversations();

/// The current user's uid, used to interpret a [Conversation] (which participant
/// is "the other", `unreadCount[me]`) and a [Message] (mine vs theirs).
///
/// **LIVE (T1-U4).** Watches [authControllerProvider] — the same source of
/// truth the router and [inboxTransportProvider] already agree on — and
/// resolves to `FirebaseAuth.instance.currentUser?.uid` for a real signed-in
/// teacher, `null` otherwise. A `null` uid is itself treated as "signed out"
/// by the screens (defensive — a `ready` snapshot can never be interpreted
/// without an identity), which also covers the on-device deferred case: while
/// Firebase isn't wired the transport only ever emits `awaitingFirebase`, so
/// this uid is irrelevant to what renders either way.
///
/// It is a deliberately thin, overridable seam — widget tests override it
/// with a fixed uid to exercise the rows, the other-participant label, the
/// unread badge and mine-vs-theirs bubbles without touching real auth.
@riverpod
String? currentInboxUserId(Ref ref) {
  final status = ref.watch(authControllerProvider);
  if (status != AuthStatus.signedIn) return null;
  return FirebaseAuth.instance.currentUser?.uid;
}
