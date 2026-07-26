import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/inbox/data/block_c_transport.dart';
import 'package:sahayakai/features/inbox/data/inbox_transport.dart';
import 'package:sahayakai/features/inbox/domain/conversation_id.dart';
import 'package:sahayakai/features/inbox/domain/inbox_models.dart';

/// T1-U4 — [FirestoreInboxTransport] against an in-memory
/// [FakeFirebaseFirestore] (test-only; no live project, no emulator). Proves
/// the three load-bearing behaviors the unit's gate requires:
///
///   1. `watchInbox` returns the right conversations for the right uid,
///      ordered `lastMessageAt desc`.
///   2. `sendMessage` writes a message with the correct `senderId` (and
///      bumps the parent conversation's preview/unread fields).
///   3. `getOrCreateDirectConversation` is idempotent — two calls resolve to
///      the same id and never create a second document.
///
/// `firestore.rules` itself is NOT exercised here (`fake_cloud_firestore`
/// does not evaluate security rules) — these tests pin the *query/write
/// shape*, not the authz. Rule-shape matching is verified by inspection
/// against `firestore.rules:109-136` in the transport's own doc comments.
void main() {
  group('FirestoreInboxTransport.watchInbox', () {
    test('scopes to participantIds array-contains myUid, ordered desc',
        () async {
      final firestore = FakeFirebaseFirestore();
      final conversations = firestore.collection('conversations');

      await conversations.doc('u1_u2').set({
        'type': 'direct',
        'participantIds': ['u1', 'u2'],
        'participants': <String, dynamic>{},
        'lastMessage': 'older',
        'lastMessageAt': Timestamp.fromMillisecondsSinceEpoch(1000),
        'lastMessageSenderId': 'u2',
        'unreadCount': {'u1': 1, 'u2': 0},
      });
      await conversations.doc('u1_u3').set({
        'type': 'direct',
        'participantIds': ['u1', 'u3'],
        'participants': <String, dynamic>{},
        'lastMessage': 'newer',
        'lastMessageAt': Timestamp.fromMillisecondsSinceEpoch(2000),
        'lastMessageSenderId': 'u3',
        'unreadCount': {'u1': 2, 'u3': 0},
      });
      // A conversation the caller is NOT part of — must never appear.
      await conversations.doc('u4_u5').set({
        'type': 'direct',
        'participantIds': ['u4', 'u5'],
        'participants': <String, dynamic>{},
        'lastMessage': 'not mine',
        'lastMessageAt': Timestamp.fromMillisecondsSinceEpoch(3000),
        'lastMessageSenderId': 'u5',
        'unreadCount': {'u4': 0, 'u5': 0},
      });

      final transport = FirestoreInboxTransport(firestore, 'u1');
      final snapshot = await transport.watchInbox().first;

      expect(snapshot.isReady, isTrue);
      expect(snapshot.data.map((c) => c.id.value), ['u1_u3', 'u1_u2']);
      expect(snapshot.data.every((c) => c.participantIds.contains('u1')),
          isTrue);
    });

  });

  group('FirestoreInboxTransport.sendMessage', () {
    test('writes senderId == caller uid and bumps the conversation preview',
        () async {
      final firestore = FakeFirebaseFirestore();
      await firestore.collection('conversations').doc('u1_u2').set({
        'type': 'direct',
        'participantIds': ['u1', 'u2'],
        'participants': {
          'u1': {'displayName': 'Asha Rao', 'photoURL': 'https://img/1'},
          'u2': {'displayName': 'Bina Das', 'photoURL': null},
        },
        'lastMessage': '',
        'lastMessageAt': null,
        'lastMessageSenderId': '',
        'unreadCount': {'u1': 0, 'u2': 0},
      });

      final transport = FirestoreInboxTransport(firestore, 'u1');
      final messageId = await transport.sendMessage(
        const SendMessageInput(
          conversationId: ConversationId('u1_u2'),
          type: MessageType.text,
          text: 'Hello Bina',
          clientMessageId: 'cmid-1',
        ),
      );

      // The message doc: correct id (== clientMessageId), correct sender,
      // denormalized senderName pulled from the conversation's own snapshot.
      expect(messageId, 'cmid-1');
      final msgSnap = await firestore
          .collection('conversations')
          .doc('u1_u2')
          .collection('messages')
          .doc('cmid-1')
          .get();
      expect(msgSnap.exists, isTrue);
      final msg = msgSnap.data()!;
      expect(msg['senderId'], 'u1');
      expect(msg['senderName'], 'Asha Rao');
      expect(msg['text'], 'Hello Bina');
      expect(msg['readBy'], ['u1']);
      expect(msg['clientMessageId'], 'cmid-1');

      // The parent conversation: preview + unread bumped for the OTHER
      // participant only, never the sender.
      final convSnap =
          await firestore.collection('conversations').doc('u1_u2').get();
      final conv = convSnap.data()!;
      expect(conv['lastMessage'], 'Hello Bina');
      expect(conv['lastMessageSenderId'], 'u1');
      expect(conv['unreadCount']['u2'], 1);
      expect(conv['unreadCount']['u1'], 0);
    });

    test('a retry with the same clientMessageId is idempotent (no double send)',
        () async {
      final firestore = FakeFirebaseFirestore();
      await firestore.collection('conversations').doc('u1_u2').set({
        'type': 'direct',
        'participantIds': ['u1', 'u2'],
        'participants': <String, dynamic>{},
        'lastMessage': '',
        'lastMessageAt': null,
        'lastMessageSenderId': '',
        'unreadCount': {'u1': 0, 'u2': 0},
      });
      final transport = FirestoreInboxTransport(firestore, 'u1');
      const input = SendMessageInput(
        conversationId: ConversationId('u1_u2'),
        type: MessageType.text,
        text: 'retry me',
        clientMessageId: 'cmid-retry',
      );

      final first = await transport.sendMessage(input);
      final second = await transport.sendMessage(input);
      expect(first, second);

      final messages = await firestore
          .collection('conversations')
          .doc('u1_u2')
          .collection('messages')
          .get();
      expect(messages.docs, hasLength(1));

      // The retry must NOT double-increment the other participant's unread
      // count — the transaction returns early once it sees the id exists.
      final convSnap =
          await firestore.collection('conversations').doc('u1_u2').get();
      expect(convSnap.data()!['unreadCount']['u2'], 1);
    });
  });

  group('FirestoreInboxTransport.getOrCreateDirectConversation', () {
    test('is idempotent — two calls resolve to the same id, one document',
        () async {
      final firestore = FakeFirebaseFirestore();
      final transport = FirestoreInboxTransport(
        firestore,
        'u1',
        myDisplayName: 'Asha Rao',
        myPhotoURL: 'https://img/asha',
      );

      final first = await transport.getOrCreateDirectConversation('u2');
      final second = await transport.getOrCreateDirectConversation('u2');

      expect(first, second);
      expect(first, ConversationId.direct('u1', 'u2'));

      final docs = await firestore.collection('conversations').get();
      expect(docs.docs, hasLength(1));
      final data = docs.docs.single.data();
      expect(data['type'], 'direct');
      expect(
        (data['participantIds'] as List).cast<String>()..sort(),
        ['u1', 'u2'],
      );
      expect(data['unreadCount'], {'u1': 0, 'u2': 0});
      // My own snapshot is seeded from the injected auth profile; the other
      // participant's is intentionally absent (users/{otherUid} isn't
      // client-readable — see the class doc).
      final participants = data['participants'] as Map;
      expect(participants['u1']['displayName'], 'Asha Rao');
      expect(participants['u1']['photoURL'], 'https://img/asha');
      expect(participants.containsKey('u2'), isFalse);
    });

    test('is symmetric — direct(a, b) resolves the same doc as direct(b, a)',
        () async {
      final firestore = FakeFirebaseFirestore();
      final asU1 = FirestoreInboxTransport(firestore, 'u1');
      final asU2 = FirestoreInboxTransport(firestore, 'u2');

      final fromU1 = await asU1.getOrCreateDirectConversation('u2');
      final fromU2 = await asU2.getOrCreateDirectConversation('u1');

      expect(fromU1, fromU2);
      final docs = await firestore.collection('conversations').get();
      expect(docs.docs, hasLength(1));
    });

    test('does not overwrite an already-existing conversation', () async {
      final firestore = FakeFirebaseFirestore();
      final id = ConversationId.direct('u1', 'u2');
      await firestore.collection('conversations').doc(id.value).set({
        'type': 'direct',
        'participantIds': ['u1', 'u2'],
        'participants': {
          'u2': {'displayName': 'Bina Das', 'photoURL': null},
        },
        'lastMessage': 'already talking',
        'lastMessageAt': Timestamp.fromMillisecondsSinceEpoch(42),
        'lastMessageSenderId': 'u2',
        'unreadCount': {'u1': 3, 'u2': 0},
      });

      final transport = FirestoreInboxTransport(firestore, 'u1');
      final resolved = await transport.getOrCreateDirectConversation('u2');

      expect(resolved, id);
      final data =
          (await firestore.collection('conversations').doc(id.value).get())
              .data()!;
      // Untouched — the pre-existing preview/unread state survives.
      expect(data['lastMessage'], 'already talking');
      expect(data['unreadCount']['u1'], 3);
    });
  });

  group('FirestoreInboxTransport.getTotalUnreadCount', () {
    test('sums unreadCount for my uid across my conversations only',
        () async {
      final firestore = FakeFirebaseFirestore();
      final conversations = firestore.collection('conversations');
      await conversations.doc('u1_u2').set({
        'participantIds': ['u1', 'u2'],
        'unreadCount': {'u1': 2, 'u2': 0},
      });
      await conversations.doc('u1_u3').set({
        'participantIds': ['u1', 'u3'],
        'unreadCount': {'u1': 5, 'u3': 1},
      });
      // Not mine — must not be counted.
      await conversations.doc('u2_u3').set({
        'participantIds': ['u2', 'u3'],
        'unreadCount': {'u2': 9, 'u3': 9},
      });

      final transport = FirestoreInboxTransport(firestore, 'u1');
      expect(await transport.getTotalUnreadCount(), 7);
    });

    test('returns 0 when the caller has no conversations', () async {
      final transport =
          FirestoreInboxTransport(FakeFirebaseFirestore(), 'u1');
      expect(await transport.getTotalUnreadCount(), 0);
    });
  });

  group('FirestoreInboxTransport — methods left TransportUnavailable', () {
    test('createGroupConversation throws restWrapperMissing', () async {
      final transport =
          FirestoreInboxTransport(FakeFirebaseFirestore(), 'u1');
      await expectLater(
        () => transport.createGroupConversation(
          participantUids: const ['u1', 'u2', 'u3'],
          name: 'Grade 5 Teachers',
        ),
        throwsA(
          isA<TransportUnavailable>().having(
            (e) => e.kind,
            'kind',
            TransportUnavailableKind.restWrapperMissing,
          ),
        ),
      );
    });
  });

  group('FirestoreInboxTransport.markConversationRead', () {
    test('resets only unreadCount for the caller uid', () async {
      final firestore = FakeFirebaseFirestore();
      await firestore.collection('conversations').doc('u1_u2').set({
        'type': 'direct',
        'participantIds': ['u1', 'u2'],
        'participants': <String, dynamic>{},
        'lastMessage': 'hi',
        'lastMessageAt': Timestamp.fromMillisecondsSinceEpoch(1),
        'lastMessageSenderId': 'u2',
        'unreadCount': {'u1': 5, 'u2': 2},
      });

      final transport = FirestoreInboxTransport(firestore, 'u1');
      await transport.markConversationRead(const ConversationId('u1_u2'));

      final data =
          (await firestore.collection('conversations').doc('u1_u2').get())
              .data()!;
      expect(data['unreadCount']['u1'], 0);
      expect(data['unreadCount']['u2'], 2); // untouched
    });
  });

  group('FirestoreInboxTransport.acknowledgeDelivery', () {
    test('stamps deliveredTo with the caller uid on every given message',
        () async {
      final firestore = FakeFirebaseFirestore();
      final messages = firestore
          .collection('conversations')
          .doc('u1_u2')
          .collection('messages');
      await messages.doc('m1').set({'text': 'a', 'deliveredTo': <String>[]});
      await messages.doc('m2').set({'text': 'b'});

      final transport = FirestoreInboxTransport(firestore, 'u2');
      await transport.acknowledgeDelivery(
        const ConversationId('u1_u2'),
        const ['m1', 'm2'],
      );

      final m1 = (await messages.doc('m1').get()).data()!;
      final m2 = (await messages.doc('m2').get()).data()!;
      expect(m1['deliveredTo'], ['u2']);
      expect(m2['deliveredTo'], ['u2']);
    });
  });

  group('FirestoreInboxTransport.watchThread + loadOlderMessages', () {
    test('watchThread orders createdAt asc and limits to the tail', () async {
      final firestore = FakeFirebaseFirestore();
      final messages = firestore
          .collection('conversations')
          .doc('u1_u2')
          .collection('messages');
      for (var i = 0; i < 3; i++) {
        await messages.doc('m$i').set({
          'type': 'text',
          'text': 'msg $i',
          'senderId': 'u1',
          'senderName': 'Asha',
          'readBy': <String>[],
          'createdAt': Timestamp.fromMillisecondsSinceEpoch(1000 + i),
        });
      }

      final transport = FirestoreInboxTransport(firestore, 'u1');
      final snapshot = await transport
          .watchThread(const ConversationId('u1_u2'), tailLimit: 2)
          .first;

      expect(snapshot.isReady, isTrue);
      expect(snapshot.data.map((m) => m.text), ['msg 1', 'msg 2']);
    });

    test('loadOlderMessages pages strictly before the cursor', () async {
      final firestore = FakeFirebaseFirestore();
      final messages = firestore
          .collection('conversations')
          .doc('u1_u2')
          .collection('messages');
      for (var i = 0; i < 5; i++) {
        await messages.doc('m$i').set({
          'type': 'text',
          'text': 'msg $i',
          'senderId': 'u1',
          'senderName': 'Asha',
          'readBy': <String>[],
          'createdAt': Timestamp.fromMillisecondsSinceEpoch(1000 + i),
        });
      }

      final transport = FirestoreInboxTransport(firestore, 'u1');
      final older = await transport.loadOlderMessages(
        const ConversationId('u1_u2'),
        beforeMessageId: 'm3',
        limit: 10,
      );

      expect(older.map((m) => m.id), ['m0', 'm1', 'm2']);
    });
  });

  group('FirestoreInboxTransport.watchUnreadConversations', () {
    test('sums unreadCount[myUid] across every conversation I am in',
        () async {
      final firestore = FakeFirebaseFirestore();
      final conversations = firestore.collection('conversations');
      await conversations.doc('u1_u2').set({
        'participantIds': ['u1', 'u2'],
        'unreadCount': {'u1': 2, 'u2': 0},
      });
      await conversations.doc('u1_u3').set({
        'participantIds': ['u1', 'u3'],
        'unreadCount': {'u1': 5, 'u3': 1},
      });
      await conversations.doc('u4_u5').set({
        'participantIds': ['u4', 'u5'],
        'unreadCount': {'u4': 9, 'u5': 9},
      });

      final transport = FirestoreInboxTransport(firestore, 'u1');
      final snapshot = await transport.watchUnreadConversations().first;

      expect(snapshot.isReady, isTrue);
      expect(snapshot.data, 7);
    });
  });
}
