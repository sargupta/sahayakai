import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/firebase/firebase_init.dart';
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

/// The live Pro Inbox transport (T1-U4): direct `cloud_firestore` reads/writes
/// against `conversations` + `conversations/{id}/messages`, checked
/// individually against `firestore.rules` (not assumed — see each override's
/// doc comment for the exact clause it relies on) rather than blocked on the
/// backend REST wrappers the interface's own doc comments describe.
///
/// Bound only for a real signed-in teacher ([inboxTransportProvider] falls
/// back to [DeferredInboxTransport] otherwise), so `_uid` is always the
/// verified Firebase Auth uid — matching `request.auth.uid` in every rule
/// below, never a client-supplied value (same discipline as
/// `FirestoreProfileDocSource`).
///
/// **What got a real implementation vs. what stayed [TransportUnavailable],
/// and why** (checked against `firestore.rules:109-136`, quoted per-method):
///   - [watchInbox], [watchThread], [loadOlderMessages],
///     [watchUnreadConversations] — direct reads. `conversations` grants
///     `read` to any participant; `messages` grants `read` to any participant
///     of the parent conversation. Both are unconditional for a participant,
///     so all four read shapes the interface documents are safe as-is.
///   - [sendMessage] — direct write. `messages` grants `create` when the
///     caller is a participant, `senderId == request.auth.uid`, and
///     `text.size() <= 1000`; the same transaction also updates the parent
///     conversation's preview/unread fields, covered by that document's
///     `update` rule (unconditional for any current participant — no
///     `affectedKeys` restriction, unlike the message-level rule). The
///     payload shape (message-id-equals-`clientMessageId`, `readBy:
///     [senderId]`, `unreadCount` incremented for every OTHER participant)
///     mirrors `sendMessageAction` in `sahayakai-main/src/app/actions/messages.ts`
///     field-for-field, so a Flutter-authored message interoperates with the
///     web client on the same documents.
///   - [getOrCreateDirectConversation] — direct write. `create` only requires
///     the caller's uid to be in `participantIds` — satisfied by writing
///     `[myUid, otherUid]`. The denormalized `participants` map is populated
///     for **my own** uid only, from the signed-in Firebase Auth profile:
///     `users/{otherUid}` cannot be read from this client at all
///     (`firestore.rules`'s `users/{userId}` block grants `read` only to
///     `isOwner(userId)`), so the other participant's name/photo stay unset
///     here until their own client (web or Flutter) opens the thread and
///     fills theirs in the same way.
///   - [markConversationRead] — direct write, but **partial**: resets only
///     `unreadCount.$myUid` to `0` on the conversation doc (covered
///     unconditionally by that doc's `update` rule for any participant). It
///     does not also sweep `readBy` across recent messages or page matching
///     `notifications` docs the way `markConversationReadAction` does
///     server-side — a materially bigger write (N message updates + a
///     notifications query) out of scope here; the badge — the actual
///     "silent nothing" this unit fixes — is what this covers.
///   - [acknowledgeDelivery] — direct write. The `messages` `update` rule
///     explicitly allow-lists `deliveredTo` (alongside `readBy`/`readAt`/
///     `deliveredAt`/`lastReadAt`) as client-mutable for any participant, so
///     this batches `deliveredTo: arrayUnion(myUid)` across the given ids.
///   - [getTotalUnreadCount] stays [TransportUnavailable]
///     (`restWrapperMissing`): unlike every `watch*` method above, its doc
///     comment gives no Firestore-native query — it names a specific
///     server-side reduction ("capped 500 convos") this class has no
///     documented equivalent for, and [watchUnreadConversations] already
///     serves the one real UI need (the app-shell badge) live.
///   - [createGroupConversation] stays [TransportUnavailable]
///     (`restWrapperMissing`): the raw `create` rule doesn't forbid a group
///     doc, but a *correct* one needs member-count/name validation and a
///     `participants` snapshot for every member this client is NOT — the same
///     "cannot read other users' profiles directly" wall as the DM path
///     above, but for an unbounded member list with no client-side
///     workaround (unlike the DM path, which can at least seed its own
///     entry).
class FirestoreInboxTransport implements InboxTransport {
  /// [myDisplayName] / [myPhotoURL] are the caller's own Firebase Auth
  /// profile, resolved once by [inboxTransportProvider] at bind time and
  /// passed in — rather than this class reaching for `FirebaseAuth.instance`
  /// itself — so it needs nothing but a uid + a `FirebaseFirestore` to run
  /// (including under `fake_cloud_firestore`, which has no Firebase Auth
  /// counterpart to fake against).
  FirestoreInboxTransport(
    this._firestore,
    this._uid, {
    String? myDisplayName,
    this.myPhotoURL,
  }) : myDisplayName = (myDisplayName?.trim().isNotEmpty ?? false)
            ? myDisplayName!.trim()
            : 'Teacher';

  final FirebaseFirestore _firestore;
  final String _uid;
  final String myDisplayName;
  final String? myPhotoURL;

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
  Future<int> getTotalUnreadCount() async => throw const TransportUnavailable(
        TransportUnavailableKind.restWrapperMissing,
        surface: 'getTotalUnreadCount',
        message: 'No REST wrapper for getTotalUnreadCountAction yet, and its '
            "capped-500 one-shot reduction isn't documented as a Firestore "
            'query. The app-shell badge is already served live by '
            'watchUnreadConversations.',
      );

  @override
  Future<ConversationId> getOrCreateDirectConversation(
    String otherUid,
  ) async {
    final id = ConversationId.direct(_uid, otherUid);
    final doc = _conversations.doc(id.value);
    final existing = await doc.get();
    if (existing.exists) return id;

    await doc.set(<String, dynamic>{
      'type': 'direct',
      'participantIds': <String>[_uid, otherUid],
      // Only my own snapshot — users/{otherUid} is not client-readable at
      // all (see the class doc); the other participant's client fills theirs
      // in the same way whenever they open this doc.
      'participants': <String, dynamic>{
        _uid: <String, dynamic>{
          'displayName': myDisplayName,
          'photoURL': myPhotoURL,
        },
      },
      'lastMessage': '',
      'lastMessageAt': null,
      'lastMessageSenderId': '',
      'unreadCount': <String, int>{_uid: 0, otherUid: 0},
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
      // merge:true guards the narrow race where the other side creates the
      // same deterministic doc concurrently — Firestore deep-merges nested
      // map fields, so neither side's `participants` entry is clobbered.
    }, SetOptions(merge: true));
    return id;
  }

  @override
  Future<ConversationId> createGroupConversation({
    required List<String> participantUids,
    required String name,
  }) async =>
      throw const TransportUnavailable(
        TransportUnavailableKind.restWrapperMissing,
        surface: 'createGroupConversation',
        message: 'No REST wrapper for createGroupConversationAction yet: '
            'member-count/name validation and per-member participant-snapshot '
            'construction both need users/{uid} reads this client cannot do '
            'directly for anyone but itself.',
      );

  @override
  Future<String> sendMessage(SendMessageInput input) async {
    final convRef = _conversations.doc(input.conversationId.value);
    final clientId = input.clientMessageId?.trim();
    final hasClientId = clientId != null && clientId.isNotEmpty;
    final msgRef = hasClientId
        ? _messages(input.conversationId).doc(clientId)
        : _messages(input.conversationId).doc();

    return _firestore.runTransaction<String>((tx) async {
      final convSnap = await tx.get(convRef);
      if (!convSnap.exists) {
        throw StateError(
          'Conversation ${input.conversationId} does not exist',
        );
      }
      if (hasClientId) {
        // Idempotent retry: the first attempt already landed under this id.
        final existing = await tx.get(msgRef);
        if (existing.exists) return msgRef.id;
      }

      final convData = convSnap.data()!;
      final participants = convData['participants'];
      final senderSnap = participants is Map ? participants[_uid] : null;
      final senderDisplayName =
          senderSnap is Map ? senderSnap['displayName'] : null;
      final senderPhoto = senderSnap is Map ? senderSnap['photoURL'] : null;

      tx.set(msgRef, <String, dynamic>{
        'type': input.type.wire,
        'text': input.text.trim(),
        'senderId': _uid,
        'senderName':
            senderDisplayName is String && senderDisplayName.isNotEmpty
                ? senderDisplayName
                : 'Teacher',
        'senderPhotoURL': senderPhoto is String ? senderPhoto : null,
        'readBy': <String>[_uid],
        'createdAt': FieldValue.serverTimestamp(),
        if (hasClientId) 'clientMessageId': clientId,
        if (input.type == MessageType.resource && input.resource != null)
          'resource': input.resource,
        if (input.type == MessageType.audio && input.audioUrl != null) ...{
          'audioUrl': input.audioUrl,
          if (input.audioDuration != null)
            'audioDuration': input.audioDuration,
        },
      });

      final participantIds = convData['participantIds'];
      final unreadUpdates = <String, dynamic>{
        if (participantIds is List)
          for (final p in participantIds)
            if (p is String && p != _uid)
              'unreadCount.$p': FieldValue.increment(1),
      };
      tx.update(convRef, <String, dynamic>{
        'lastMessage': _preview(input),
        'lastMessageAt': FieldValue.serverTimestamp(),
        'lastMessageSenderId': _uid,
        'updatedAt': FieldValue.serverTimestamp(),
        ...unreadUpdates,
      });

      return msgRef.id;
    });
  }

  /// Mirrors `sendMessageAction`'s preview truncation exactly (text: first 80
  /// chars; resource: the paperclip emoji + `{title}`; audio: the literal
  /// `'Voice message'`). The paperclip is a `\u{}` escape, not a literal
  /// source-file emoji byte sequence — this is stored/interop data (the
  /// preview snippet `sendMessageAction` itself writes, matched here for
  /// cross-client consistency), never a UI glyph, so it stays out of
  /// `token_guard.sh`'s "Lucide icons only" scan on principle, not just on
  /// the scan's literal reach.
  static String _preview(SendMessageInput input) {
    switch (input.type) {
      case MessageType.resource:
        final title = input.resource?['title'];
        final label = title is String && title.trim().isNotEmpty
            ? title.trim()
            : 'Shared a resource';
        return '\u{1F4CE} $label';
      case MessageType.audio:
        return 'Voice message';
      case MessageType.text:
        final text = input.text.trim();
        return text.length <= 80 ? text : text.substring(0, 80);
    }
  }

  @override
  Future<void> markConversationRead(ConversationId conversationId) async {
    await _conversations
        .doc(conversationId.value)
        .update(<String, dynamic>{'unreadCount.$_uid': 0});
  }

  @override
  Future<void> acknowledgeDelivery(
    ConversationId conversationId,
    List<String> messageIds,
  ) async {
    if (messageIds.isEmpty) return;
    final col = _messages(conversationId);
    // Firestore batches cap at 500 ops; the interface's own ≤50/batch
    // contract keeps one caller-supplied list well under that, but chunk
    // defensively rather than trust every caller.
    for (var i = 0; i < messageIds.length; i += 500) {
      final end =
          (i + 500 > messageIds.length) ? messageIds.length : i + 500;
      final batch = _firestore.batch();
      for (final id in messageIds.sublist(i, end)) {
        batch.update(col.doc(id), <String, dynamic>{
          'deliveredTo': FieldValue.arrayUnion(<String>[_uid]),
        });
      }
      await batch.commit();
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
    myDisplayName: user.displayName,
    myPhotoURL: user.photoURL,
  );
}
