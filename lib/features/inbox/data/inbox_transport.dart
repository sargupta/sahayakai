import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/firebase/firebase_init.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../domain/conversation_id.dart';
import '../domain/inbox_models.dart';
import 'block_c_transport.dart';
import 'dto/conversation_dto.dart';
import 'dto/message_dto.dart';

part 'inbox_transport.g.dart';

/// # InboxTransport — the Pro Inbox seam (Pillar 05)
///
/// The stable contract U-SI1 builds the inbox list + conversation thread against.
/// It splits the two web transports (SPEC §0) into typed Dart:
///
///   - **live-read streams** = the `onSnapshot` equivalents (Firebase-gated,
///     `cloud_firestore`), typed `Stream<TransportSnapshot<...>>` so the deferred
///     seam can emit `awaitingFirebase` and the real impl can emit `ready`/`error`;
///   - **write futures** = REST calls over the app's `ApiClient` to the
///     `/api/messages/**` route handlers (server-side authz and fan-out).
///
/// Every method's doc states the exact Firestore query / REST route the real
/// implementation must satisfy. Two implementations bind to [inboxTransportProvider]:
/// [DeferredInboxTransport] (signed out / Firebase not configured) and
/// [FirestoreInboxTransport] (a signed-in teacher).
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

  /// **ONE-SHOT.** The sidebar badge count (capped 500 convos server-side as
  /// `GET /api/messages/unread-count`; the live impl reads the same
  /// conversations query once).
  Future<int> getTotalUnreadCount();

  /// **WRITE.** Get-or-create the deterministic DM doc. `POST
  /// /api/messages/conversations/direct {myUid, otherUid}` →
  /// `{ conversationId }`. `myUid` is server-derived; the returned id equals
  /// [ConversationId.direct]`(myUid, otherUid)`.
  Future<ConversationId> getOrCreateDirectConversation(String otherUid);

  /// **WRITE.** Create a group conversation (2–50 members). `POST
  /// /api/messages/conversations/group {creatorUid, participantUids, name}`.
  Future<ConversationId> createGroupConversation({
    required List<String> participantUids,
    required String name,
  });

  /// **WRITE.** Send a message. `POST /api/messages/send` →
  /// `{ messageId }`. Pass a client-generated `clientMessageId` (UUID) for an
  /// **idempotent**, offline-safe send: a retry with the same id transactionally
  /// dedups server-side (no double message, no double unread increment).
  Future<String> sendMessage(SendMessageInput input);

  /// **WRITE.** Clear unread + the bell badge on open. `POST
  /// /api/messages/mark-read {conversationId, userId}`: resets
  /// `unreadCount[me]=0`, `arrayUnion(readBy)` on the last 50, and pages the
  /// matching `MESSAGE` notifications read.
  Future<void> markConversationRead(ConversationId conversationId);

  /// **WRITE.** Stamp delivery receipts (≤50 ids/batch). `POST
  /// /api/messages/ack-delivery {conversationId, messageIds}`.
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

/// The live Pro Inbox transport for a signed-in teacher.
///
/// **Live reads are Firestore** (`firestore.rules` grants a participant read on
/// `conversations` and their `messages`): [watchInbox], [watchThread],
/// [loadOlderMessages], [watchUnreadConversations], [getTotalUnreadCount].
///
/// **Every write is a REST call** over [ApiClient] (Firebase bearer token
/// attached) to the `sahayakai-main` handlers, matching each zod body exactly,
/// so the server owns sender identity, the unread fan-out, notifications,
/// block enforcement and idempotency:
///
/// | method | route |
/// |---|---|
/// | [getOrCreateDirectConversation] | `POST /api/messages/conversations/direct {myUid, otherUid}` → `{conversationId}` |
/// | [createGroupConversation] | `POST /api/messages/conversations/group {creatorUid, participantUids, name}` → `{conversationId}` |
/// | [sendMessage] | `POST /api/messages/send {conversationId, text, type, resource?, audioUrl?, audioDuration?, clientMessageId?}` → `{messageId}` |
/// | [markConversationRead] | `POST /api/messages/mark-read {conversationId, userId}` |
/// | [acknowledgeDelivery] | `POST /api/messages/ack-delivery {conversationId, messageIds}` |
///
/// `myUid` / `userId` / `creatorUid` must equal the verified caller (the
/// services reject anything else with 403), so they are always [_uid] — the
/// Firebase Auth uid the provider bound this instance to.
class FirestoreInboxTransport implements InboxTransport {
  FirestoreInboxTransport(this._firestore, this._uid, this._apiClient);

  final FirebaseFirestore _firestore;
  final String _uid;
  final ApiClient _apiClient;

  CollectionReference<Map<String, dynamic>> get _conversations =>
      _firestore.collection('conversations');

  CollectionReference<Map<String, dynamic>> _messages(ConversationId id) =>
      _conversations.doc(id.value).collection('messages');

  @override
  Stream<TransportSnapshot<List<Conversation>>> watchInbox() async* {
    final query = _conversations
        .where('participantIds', arrayContains: _uid)
        .orderBy('lastMessageAt', descending: true);
    var last = const <Conversation>[];
    try {
      await for (final snapshot in query.snapshots()) {
        last = _toConversations(snapshot);
        yield TransportSnapshot<List<Conversation>>.ready(last);
      }
    } catch (error) {
      // Missing composite index / permission-denied MUST surface here, never
      // a silent hang — the web shipped exactly that bug twice.
      yield TransportSnapshot<List<Conversation>>.error(last, error);
    }
  }

  @override
  Stream<TransportSnapshot<List<Message>>> watchThread(
    ConversationId conversationId, {
    int tailLimit = 30,
  }) async* {
    final query =
        _messages(conversationId).orderBy('createdAt').limitToLast(tailLimit);
    var last = const <Message>[];
    try {
      await for (final snapshot in query.snapshots()) {
        last = _toMessages(snapshot);
        yield TransportSnapshot<List<Message>>.ready(last);
      }
    } catch (error) {
      yield TransportSnapshot<List<Message>>.error(last, error);
    }
  }

  @override
  Future<List<Message>> loadOlderMessages(
    ConversationId conversationId, {
    required String beforeMessageId,
    int limit = 30,
  }) async {
    final cursor = await _messages(conversationId).doc(beforeMessageId).get();
    if (!cursor.exists) return const <Message>[];
    final snapshot = await _messages(conversationId)
        .orderBy('createdAt')
        .endBeforeDocument(cursor)
        .limitToLast(limit)
        .get();
    return _toMessages(snapshot);
  }

  @override
  Stream<TransportSnapshot<int>> watchUnreadConversations() async* {
    final query = _conversations.where('participantIds', arrayContains: _uid);
    var last = 0;
    try {
      await for (final snapshot in query.snapshots()) {
        var sum = 0;
        for (final doc in snapshot.docs) {
          final unreadCount = doc.data()['unreadCount'];
          if (unreadCount is Map) {
            final mine = unreadCount[_uid];
            if (mine is num) sum += mine.round();
          }
        }
        last = sum;
        yield TransportSnapshot<int>.ready(last);
      }
    } catch (error) {
      yield TransportSnapshot<int>.error(last, error);
    }
  }

  @override
  Future<int> getTotalUnreadCount() async {
    // A one-shot `.get()` on the exact query `watchUnreadConversations` keeps
    // live — not a distinct server-side reduction, just that same read taken
    // once instead of streamed.
    final snapshot = await _conversations
        .where('participantIds', arrayContains: _uid)
        .get();
    var sum = 0;
    for (final doc in snapshot.docs) {
      final unreadCount = doc.data()['unreadCount'];
      if (unreadCount is Map) {
        final mine = unreadCount[_uid];
        if (mine is num) sum += mine.round();
      }
    }
    return sum;
  }

  @override
  Future<ConversationId> getOrCreateDirectConversation(
    String otherUid,
  ) async {
    final id = await _apiClient.post<String>(
      '/api/messages/conversations/direct',
      data: <String, dynamic>{'myUid': _uid, 'otherUid': otherUid},
      decode: (json) => (json['conversationId'] as String?)?.trim() ?? '',
    );
    // The server id is the deterministic sorted pair; fall back to computing
    // it only if a reply ever omits it.
    return id.isEmpty ? ConversationId.direct(_uid, otherUid) : ConversationId(id);
  }

  @override
  Future<ConversationId> createGroupConversation({
    required List<String> participantUids,
    required String name,
  }) async {
    final id = await _apiClient.post<String>(
      '/api/messages/conversations/group',
      data: <String, dynamic>{
        'creatorUid': _uid,
        'participantUids': <String>{_uid, ...participantUids}.toList(),
        'name': name.trim(),
      },
      decode: (json) => (json['conversationId'] as String?)?.trim() ?? '',
    );
    if (id.isEmpty) {
      throw const FormatException(
        'POST /api/messages/conversations/group: no conversationId',
      );
    }
    return ConversationId(id);
  }

  @override
  Future<String> sendMessage(SendMessageInput input) {
    final clientId = input.clientMessageId?.trim();
    return _apiClient.post<String>(
      '/api/messages/send',
      data: <String, dynamic>{
        'conversationId': input.conversationId.value,
        'text': input.text.trim(),
        'type': input.type.wire,
        if (input.type == MessageType.resource && input.resource != null)
          'resource': input.resource,
        if (input.type == MessageType.audio && input.audioUrl != null)
          'audioUrl': input.audioUrl,
        if (input.type == MessageType.audio && input.audioDuration != null)
          'audioDuration': input.audioDuration,
        // The server writes the message under this id inside a transaction,
        // so a retry with the same id is deduped (no double message, no double
        // unread increment, no second notification).
        if (clientId != null && clientId.isNotEmpty) 'clientMessageId': clientId,
      },
      decode: (json) => (json['messageId'] as String?)?.trim() ?? '',
    );
  }

  @override
  Future<void> markConversationRead(ConversationId conversationId) =>
      _apiClient.post<void>(
        '/api/messages/mark-read',
        data: <String, dynamic>{
          'conversationId': conversationId.value,
          'userId': _uid,
        },
        decode: (_) {},
      );

  @override
  Future<void> acknowledgeDelivery(
    ConversationId conversationId,
    List<String> messageIds,
  ) async {
    final ids = messageIds.where((id) => id.isNotEmpty).toList();
    // The service stamps at most 50 per call; chunk so none are dropped.
    for (var i = 0; i < ids.length; i += 50) {
      final end = (i + 50 > ids.length) ? ids.length : i + 50;
      await _apiClient.post<void>(
        '/api/messages/ack-delivery',
        data: <String, dynamic>{
          'conversationId': conversationId.value,
          'messageIds': ids.sublist(i, end),
        },
        decode: (_) {},
      );
    }
  }

  List<Conversation> _toConversations(
    QuerySnapshot<Map<String, dynamic>> snapshot,
  ) =>
      snapshot.docs
          .map((doc) => ConversationDto.fromJson(_withId(doc)).toDomain())
          .toList(growable: false);

  List<Message> _toMessages(QuerySnapshot<Map<String, dynamic>> snapshot) =>
      snapshot.docs
          .map((doc) => MessageDto.fromJson(_withId(doc)).toDomain())
          .toList(growable: false);

  /// `{ 'id': doc.id, ...doc.data() }`, with every known `Timestamp` field
  /// converted to millis first — [wireTimeToIso] (in `dto/wire_time.dart`)
  /// does not understand a raw `Timestamp` object, only ISO strings / millis
  /// / a `{seconds,...}` map, per its own doc comment.
  static Map<String, dynamic> _withId(
    QueryDocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = Map<String, dynamic>.from(doc.data());
    for (final key in const ['lastMessageAt', 'createdAt', 'updatedAt']) {
      final value = data[key];
      if (value is Timestamp) data[key] = value.millisecondsSinceEpoch;
    }
    return <String, dynamic>{'id': doc.id, ...data};
  }
}

/// The Pro-Inbox transport. [FirestoreInboxTransport] once Firebase is
/// configured **and** a real teacher is signed in; [DeferredInboxTransport]
/// otherwise — including a genuinely signed-out teacher, so the signed-out UI
/// (the DM-gate `EmptyView`) renders exactly as it does today. Mirrors
/// `profileDocSource`'s branch on [authControllerProvider] (`core/auth/
/// auth_providers.dart`) for consistency: the same provider both the router
/// and every other Block-C-adjacent surface already agree is the source of
/// truth for "is this a real signed-in teacher."
@Riverpod(keepAlive: true)
InboxTransport inboxTransport(Ref ref) {
  if (!FirebaseInit.isConfigured) return const DeferredInboxTransport();
  final status = ref.watch(authControllerProvider);
  if (status != AuthStatus.signedIn) return const DeferredInboxTransport();
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) return const DeferredInboxTransport();
  return FirestoreInboxTransport(
    FirebaseFirestore.instance,
    user.uid,
    ref.watch(apiClientProvider),
  );
}
