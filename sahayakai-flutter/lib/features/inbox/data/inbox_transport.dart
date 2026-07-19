import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/firebase/firebase_init.dart';
import '../domain/conversation_id.dart';
import '../domain/inbox_models.dart';
import 'block_c_transport.dart';

part 'inbox_transport.g.dart';

/// # InboxTransport — the Pro Inbox seam (Pillar 05)
///
/// The stable contract U-SI1 builds the inbox list + conversation thread against.
/// It splits the two web transports (SPEC §0) into typed Dart:
///
///   - **live-read streams** = the `onSnapshot` equivalents (Firebase-gated,
///     `cloud_firestore`), typed `Stream<TransportSnapshot<...>>` so the deferred
///     seam can emit `awaitingFirebase` and the real impl can emit `ready`/`error`;
///   - **write / one-shot futures** = the server-action equivalents, reached via
///     Dio REST wrappers (backend task) — reusing the action authz verbatim.
///
/// Every method's doc states the exact Firestore query / REST route the real
/// implementation must satisfy. Two implementations bind to [inboxTransportProvider]:
/// [DeferredInboxTransport] now (keeps the APK green, no Firebase import), and a
/// `FirestoreInboxTransport` after the handoff (see `firebase_init.dart`).
abstract interface class InboxTransport {
  /// **LIVE.** The inbox list. Real impl:
  /// `onSnapshot(collection('conversations')
  ///   .where('participantIds', arrayContains: myUid)
  ///   .orderBy('lastMessageAt', descending: true))`, mapping each doc to
  /// [ConversationDto] with `{ 'id': doc.id, ...doc.data() }`.
  ///
  /// A **missing composite index / permission-denied** MUST surface as
  /// `TransportSnapshot.error` (→ `ErrorView` + retry), never a hang — the web
  /// shipped that bug twice.
  Stream<TransportSnapshot<List<Conversation>>> watchInbox();

  /// **LIVE.** The tail of a thread. Real impl:
  /// `onSnapshot(conversations/{id}/messages orderBy createdAt asc
  ///   limitToLast(tailLimit))`, mapped via [MessageDto]. Referentially stable
  /// output (dedup by [Message.id]) so the auto-scroll effect doesn't thrash.
  Stream<TransportSnapshot<List<Message>>> watchThread(
    ConversationId conversationId, {
    int tailLimit = 30,
  });

  /// **STATIC.** Older pages, above the live tail. Real impl:
  /// `getDocs(conversations/{id}/messages orderBy createdAt asc
  ///   endBefore(cursorFor beforeMessageId) limitToLast(limit))`; the caller
  /// merges/dedups these with the tail by id. One-shot (not a stream).
  Future<List<Message>> loadOlderMessages(
    ConversationId conversationId, {
    required String beforeMessageId,
    int limit = 30,
  });

  /// **LIVE.** The app-shell inbox badge. Real impl: the same
  /// `conversations array-contains me` snapshot as [watchInbox], reduced to
  /// `sum(unreadCount[myUid])`.
  Stream<TransportSnapshot<int>> watchUnreadConversations();

  /// **ONE-SHOT.** The sidebar badge count (capped 500 convos). REST wrapper of
  /// `getTotalUnreadCountAction(userId)`.
  Future<int> getTotalUnreadCount();

  /// **WRITE.** Get-or-create the deterministic DM doc. REST wrapper of
  /// `getOrCreateDirectConversationAction(myUid, otherUid)` →
  /// `{ conversationId }`. `myUid` is server-derived; the returned id equals
  /// [ConversationId.direct]`(myUid, otherUid)`.
  Future<ConversationId> getOrCreateDirectConversation(String otherUid);

  /// **WRITE.** Create a group conversation (2–50 members). REST wrapper of
  /// `createGroupConversationAction(creatorUid, participantUids, name)`.
  Future<ConversationId> createGroupConversation({
    required List<String> participantUids,
    required String name,
  });

  /// **WRITE.** Send a message. REST wrapper of `sendMessageAction(...)` →
  /// `{ messageId }`. Pass a client-generated `clientMessageId` (UUID) for an
  /// **idempotent**, offline-safe send: a retry with the same id transactionally
  /// dedups server-side (no double message, no double unread increment).
  Future<String> sendMessage(SendMessageInput input);

  /// **WRITE.** Clear unread + the bell badge on open. REST wrapper of
  /// `markConversationReadAction(conversationId, userId)`: resets
  /// `unreadCount[me]=0`, `arrayUnion(readBy)` on the last 50, and pages the
  /// matching `MESSAGE` notifications read.
  Future<void> markConversationRead(ConversationId conversationId);

  /// **WRITE.** Stamp delivery receipts (≤50 ids/batch). REST wrapper of
  /// `acknowledgeDeliveryAction(conversationId, messageIds)`.
  Future<void> acknowledgeDelivery(
    ConversationId conversationId,
    List<String> messageIds,
  );
}

/// The typed input for [InboxTransport.sendMessage] — keeps the (large) send
/// signature to one value object and mirrors `sendMessageAction`'s params.
class SendMessageInput {
  const SendMessageInput({
    required this.conversationId,
    required this.type,
    this.text = '',
    this.resource,
    this.audioUrl,
    this.audioDuration,
    this.clientMessageId,
  });

  final ConversationId conversationId;
  final MessageType type;
  final String text;

  /// The `SharedResource` payload as raw JSON when [type] is
  /// [MessageType.resource].
  final Map<String, dynamic>? resource;
  final String? audioUrl;
  final int? audioDuration;

  /// UUID for idempotent sends. Strongly recommended for every send.
  final String? clientMessageId;
}

/// The default, **Firebase-free** implementation (U-SI0). Keeps the APK green:
/// it imports **no** Firebase package, its live-read streams emit a single
/// `TransportSnapshot.awaitingFirebase(<empty>)` (so U-SI1's UI renders the
/// pillar's `EmptyView` "coming soon" and stays widget-testable), and **every
/// write throws a typed [TransportUnavailable]** (so send/mark-read affordances
/// render disabled rather than hit a dead endpoint).
///
/// This is what lets U-SI1..U-SI6 build real UI against the real interface,
/// on-device, before Firebase is wired — swapped for the live Firestore impl at
/// the handoff with no UI change.
class DeferredInboxTransport implements InboxTransport {
  const DeferredInboxTransport();

  @override
  Stream<TransportSnapshot<List<Conversation>>> watchInbox() =>
      Stream<TransportSnapshot<List<Conversation>>>.value(
        const TransportSnapshot<List<Conversation>>.awaitingFirebase(
          <Conversation>[],
        ),
      );

  @override
  Stream<TransportSnapshot<List<Message>>> watchThread(
    ConversationId conversationId, {
    int tailLimit = 30,
  }) =>
      Stream<TransportSnapshot<List<Message>>>.value(
        const TransportSnapshot<List<Message>>.awaitingFirebase(<Message>[]),
      );

  @override
  Future<List<Message>> loadOlderMessages(
    ConversationId conversationId, {
    required String beforeMessageId,
    int limit = 30,
  }) async =>
      const <Message>[];

  @override
  Stream<TransportSnapshot<int>> watchUnreadConversations() =>
      Stream<TransportSnapshot<int>>.value(
        const TransportSnapshot<int>.awaitingFirebase(0),
      );

  @override
  Future<int> getTotalUnreadCount() async => 0;

  @override
  Future<ConversationId> getOrCreateDirectConversation(String otherUid) async =>
      throw const TransportUnavailable.awaitingFirebase(
        'getOrCreateDirectConversation',
      );

  @override
  Future<ConversationId> createGroupConversation({
    required List<String> participantUids,
    required String name,
  }) async =>
      throw const TransportUnavailable.awaitingFirebase(
        'createGroupConversation',
      );

  @override
  Future<String> sendMessage(SendMessageInput input) async =>
      throw const TransportUnavailable.awaitingFirebase('sendMessage');

  @override
  Future<void> markConversationRead(ConversationId conversationId) async =>
      throw const TransportUnavailable.awaitingFirebase(
        'markConversationRead',
      );

  @override
  Future<void> acknowledgeDelivery(
    ConversationId conversationId,
    List<String> messageIds,
  ) async =>
      throw const TransportUnavailable.awaitingFirebase('acknowledgeDelivery');
}

/// The Pro-Inbox transport. Bound to [DeferredInboxTransport] until Firebase is
/// wired; swap to `FirestoreInboxTransport` at the handoff (see the throw below —
/// it fails loudly if someone flips `FirebaseInit.isConfigured` without wiring
/// the live impl, rather than silently staying deferred).
@Riverpod(keepAlive: true)
InboxTransport inboxTransport(Ref ref) {
  if (FirebaseInit.isConfigured) {
    throw StateError(
      'Firebase is configured but the live InboxTransport is not wired. Bind '
      'FirestoreInboxTransport in inboxTransport() (cloud_firestore reads + Dio '
      'REST-wrapper writes) as part of the Block C handoff — see '
      'docs/flutter/HANDOFF.md.',
    );
  }
  return const DeferredInboxTransport();
}
