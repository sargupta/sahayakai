import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/inbox/data/inbox_transport.dart';
import 'package:sahayakai/features/inbox/domain/conversation_id.dart';
import 'package:sahayakai/features/inbox/domain/inbox_models.dart';

import '../../support/fake_api_client.dart';

/// T1-U4 — [FirestoreInboxTransport]: live reads against an in-memory
/// [FakeFirebaseFirestore], every write against a [FakeApiClient] (no live
/// project, no network). Proves:
///
///   1. `watchInbox` returns the right conversations for the right uid,
///      ordered `lastMessageAt desc`.
///   2. Every write is one REST call whose body matches the route's zod
///      schema, with the caller's uid wherever the route checks it, and a
///      failure propagates rather than passing silently.
///   3. A retried send carries the same `clientMessageId`, so the server
///      dedupes it.
///
/// `firestore.rules` itself is NOT exercised here (`fake_cloud_firestore`
/// does not evaluate security rules) — these tests pin the *query/write
/// shape*, not the authz. Rule-shape matching is verified by inspection
/// against `firestore.rules:109-136` in the transport's own doc comments.
void main() {
  group('FirestoreInboxTransport.watchInbox', () {
    test(
      'scopes to participantIds array-contains myUid, ordered desc',
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

        final transport = FirestoreInboxTransport(
          firestore,
          'u1',
          FakeApiClient(),
        );
        final snapshot = await transport.watchInbox().first;

        expect(snapshot.isReady, isTrue);
        expect(snapshot.data.map((c) => c.id.value), ['u1_u3', 'u1_u2']);
        expect(
          snapshot.data.every((c) => c.participantIds.contains('u1')),
          isTrue,
        );
      },
    );
  });

  group('FirestoreInboxTransport.sendMessage', () {
    test('POSTs the zod body to /api/messages/send and returns the server '
        'messageId — the server owns sender, preview and unread', () async {
      final firestore = FakeFirebaseFirestore();
      final api = FakeApiClient(
        postResponsesByPath: const {
          '/api/messages/send': {'messageId': 'cmid-1'},
        },
      );
      final transport = FirestoreInboxTransport(firestore, 'u1', api);

      final messageId = await transport.sendMessage(
        const SendMessageInput(
          conversationId: ConversationId('u1_u2'),
          type: MessageType.text,
          text: '  Hello Bina  ',
          clientMessageId: 'cmid-1',
        ),
      );

      expect(messageId, 'cmid-1');
      expect(api.posts.single.path, '/api/messages/send');
      expect(api.posts.single.data, {
        'conversationId': 'u1_u2',
        'text': 'Hello Bina',
        'type': 'text',
        'clientMessageId': 'cmid-1',
      });
      // No client-side Firestore write at all.
      final conversations = await firestore.collection('conversations').get();
      expect(conversations.docs, isEmpty);
    });

    test('a retry re-sends the SAME clientMessageId, so the server dedupes '
        'it (no double message, unread bump or notification)', () async {
      final api = FakeApiClient(
        postResponsesByPath: const {
          '/api/messages/send': {'messageId': 'cmid-retry'},
        },
      );
      final transport = FirestoreInboxTransport(
        FakeFirebaseFirestore(),
        'u1',
        api,
      );
      const input = SendMessageInput(
        conversationId: ConversationId('u1_u2'),
        type: MessageType.text,
        text: 'retry me',
        clientMessageId: 'cmid-retry',
      );

      await transport.sendMessage(input);
      await transport.sendMessage(input);

      expect(api.posts, hasLength(2));
      expect(api.posts.map((p) => (p.data! as Map)['clientMessageId']), [
        'cmid-retry',
        'cmid-retry',
      ]);
    });

    test('a failed send propagates, never a silent success', () async {
      final transport = FirestoreInboxTransport(
        FakeFirebaseFirestore(),
        'u1',
        FakeApiClient(
          postErrorsByPath: const {
            '/api/messages/send': ApiException(
              ApiErrorKind.network,
              'No connection.',
            ),
          },
        ),
      );
      await expectLater(
        () => transport.sendMessage(
          const SendMessageInput(
            conversationId: ConversationId('u1_u2'),
            type: MessageType.text,
            text: 'hi',
          ),
        ),
        throwsA(isA<ApiException>()),
      );
    });
  });

  group('FirestoreInboxTransport.getOrCreateDirectConversation', () {
    test('POSTs { myUid, otherUid } with myUid == the bound caller', () async {
      final api = FakeApiClient(
        postResponsesByPath: const {
          '/api/messages/conversations/direct': {'conversationId': 'u1_u2'},
        },
      );
      final transport = FirestoreInboxTransport(
        FakeFirebaseFirestore(),
        'u1',
        api,
      );

      final id = await transport.getOrCreateDirectConversation('u2');

      expect(id, const ConversationId('u1_u2'));
      expect(api.posts.single.path, '/api/messages/conversations/direct');
      expect(api.posts.single.data, {'myUid': 'u1', 'otherUid': 'u2'});
    });

    test('falls back to the deterministic sorted pair if a reply omits the '
        'id', () async {
      final transport = FirestoreInboxTransport(
        FakeFirebaseFirestore(),
        'u2',
        FakeApiClient(
          postResponsesByPath: const {
            '/api/messages/conversations/direct': <String, dynamic>{},
          },
        ),
      );
      expect(
        await transport.getOrCreateDirectConversation('u1'),
        ConversationId.direct('u1', 'u2'),
      );
    });
  });

  group('FirestoreInboxTransport.createGroupConversation', () {
    test('POSTs the creator, the de-duplicated members and the trimmed '
        'name', () async {
      final api = FakeApiClient(
        postResponsesByPath: const {
          '/api/messages/conversations/group': {'conversationId': 'grp-1'},
        },
      );
      final transport = FirestoreInboxTransport(
        FakeFirebaseFirestore(),
        'u1',
        api,
      );

      final id = await transport.createGroupConversation(
        participantUids: const ['u1', 'u2', 'u3'],
        name: '  Grade 5 Teachers ',
      );

      expect(id, const ConversationId('grp-1'));
      final body = api.posts.single.data! as Map;
      expect(body['creatorUid'], 'u1');
      expect(body['participantUids'], ['u1', 'u2', 'u3']);
      expect(body['name'], 'Grade 5 Teachers');
    });

    test('a reply with no conversationId fails loudly', () async {
      final transport = FirestoreInboxTransport(
        FakeFirebaseFirestore(),
        'u1',
        FakeApiClient(
          postResponsesByPath: const {
            '/api/messages/conversations/group': <String, dynamic>{},
          },
        ),
      );
      await expectLater(
        () => transport.createGroupConversation(
          participantUids: const ['u2'],
          name: 'x',
        ),
        throwsA(isA<FormatException>()),
      );
    });
  });

  group('FirestoreInboxTransport.markConversationRead', () {
    test(
      'POSTs { conversationId, userId } with userId == the caller',
      () async {
        final api = FakeApiClient(
          postResponsesByPath: const {
            '/api/messages/mark-read': {'success': true},
          },
        );
        final transport = FirestoreInboxTransport(
          FakeFirebaseFirestore(),
          'u1',
          api,
        );

        await transport.markConversationRead(const ConversationId('u1_u2'));

        expect(api.posts.single.path, '/api/messages/mark-read');
        expect(api.posts.single.data, {
          'conversationId': 'u1_u2',
          'userId': 'u1',
        });
      },
    );
  });

  group('FirestoreInboxTransport.acknowledgeDelivery', () {
    test('POSTs the ids in chunks of 50, dropping blanks, so none are '
        'lost', () async {
      final api = FakeApiClient(
        postResponsesByPath: const {
          '/api/messages/ack-delivery': {'success': true},
        },
      );
      final transport = FirestoreInboxTransport(
        FakeFirebaseFirestore(),
        'u2',
        api,
      );
      final ids = [for (var i = 0; i < 120; i++) 'm$i', ''];

      await transport.acknowledgeDelivery(const ConversationId('u1_u2'), ids);

      expect(api.posts, hasLength(3));
      final chunks = [
        for (final p in api.posts) ((p.data! as Map)['messageIds'] as List),
      ];
      expect(chunks.map((c) => c.length), [50, 50, 20]);
      expect(chunks.expand((c) => c), [for (var i = 0; i < 120; i++) 'm$i']);
      expect(
        api.posts.every((p) => (p.data! as Map)['conversationId'] == 'u1_u2'),
        isTrue,
      );
    });

    test('nothing to acknowledge makes no request', () async {
      final api = FakeApiClient();
      final transport = FirestoreInboxTransport(
        FakeFirebaseFirestore(),
        'u2',
        api,
      );
      await transport.acknowledgeDelivery(
        const ConversationId('u1_u2'),
        const [],
      );
      expect(api.posts, isEmpty);
    });
  });

  group('FirestoreInboxTransport.getTotalUnreadCount', () {
    test('sums unreadCount for my uid across my conversations only', () async {
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

      final transport = FirestoreInboxTransport(
        firestore,
        'u1',
        FakeApiClient(),
      );
      expect(await transport.getTotalUnreadCount(), 7);
    });

    test('returns 0 when the caller has no conversations', () async {
      final transport = FirestoreInboxTransport(
        FakeFirebaseFirestore(),
        'u1',
        FakeApiClient(),
      );
      expect(await transport.getTotalUnreadCount(), 0);
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

      final transport = FirestoreInboxTransport(
        firestore,
        'u1',
        FakeApiClient(),
      );
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

      final transport = FirestoreInboxTransport(
        firestore,
        'u1',
        FakeApiClient(),
      );
      final older = await transport.loadOlderMessages(
        const ConversationId('u1_u2'),
        beforeMessageId: 'm3',
        limit: 10,
      );

      expect(older.map((m) => m.id), ['m0', 'm1', 'm2']);
    });
  });

  group('FirestoreInboxTransport.watchUnreadConversations', () {
    test('sums unreadCount[myUid] across every conversation I am in', () async {
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

      final transport = FirestoreInboxTransport(
        firestore,
        'u1',
        FakeApiClient(),
      );
      final snapshot = await transport.watchUnreadConversations().first;

      expect(snapshot.isReady, isTrue);
      expect(snapshot.data, 7);
    });
  });
}
