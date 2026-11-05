import 'dart:convert';
import 'dart:typed_data';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_client.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/inbox/data/block_c_transport.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_transport.dart';
import 'package:sahayakai/features/staffroom/domain/persona_pulse.dart';

import '../../support/fake_api_client.dart';

/// T1-U5 — [FirestoreStaffroomTransport] against an in-memory
/// [FakeFirebaseFirestore] (test-only; no live project, no emulator) plus a
/// [FakeApiClient] for the one real REST route. Proves the gate's three
/// load-bearing behaviors:
///
///   1. `watchStaffRoomChat` returns messages in the right order (`createdAt`
///      asc) for a populated `community_chat` collection.
///   2. Chat sends go through the REST routes (the server stamps the author)
///      and over-length text is refused before any request.
///   3. `triggerPersonaPulse` reaches the deployed REST route and treats a 503
///      as the documented "disarm" stop signal (null), not an error.
///
/// `firestore.rules` itself is NOT exercised here (`fake_cloud_firestore` does
/// not evaluate security rules) — these tests pin the *query/write shape*,
/// not the authz. Rule-shape matching is verified by inspection against
/// `firestore.rules:139-145` in the transport's own doc comment.
void main() {
  group('FirestoreStaffroomTransport.watchStaffRoomChat', () {
    test('orders createdAt asc and limits to the tail', () async {
      final firestore = FakeFirebaseFirestore();
      final chat = firestore.collection('community_chat');
      for (var i = 0; i < 3; i++) {
        await chat.doc('m$i').set({
          'text': 'msg $i',
          'authorId': 'u1',
          'authorName': 'Asha',
          'createdAt': Timestamp.fromMillisecondsSinceEpoch(1000 + i),
        });
      }

      final transport = FirestoreStaffroomTransport(firestore, FakeApiClient());
      final snapshot = await transport.watchStaffRoomChat(limit: 2).first;

      expect(snapshot.isReady, isTrue);
      expect(snapshot.data.map((m) => m.text), ['msg 1', 'msg 2']);
    });

    test('a genuinely empty room resolves ready-empty, not an error', () async {
      final transport = FirestoreStaffroomTransport(
        FakeFirebaseFirestore(),
        FakeApiClient(),
      );
      final snapshot = await transport.watchStaffRoomChat().first;
      expect(snapshot.isReady, isTrue);
      expect(snapshot.data, isEmpty);
    });
  });

  group('FirestoreStaffroomTransport.sendCommunityChatMessage', () {
    FakeApiClient okApi() => FakeApiClient(
      postResponsesByPath: const {
        '/api/community/chat': {'ok': true},
      },
    );

    test('POSTs { text } to /api/community/chat — the server stamps the '
        'author, never the client', () async {
      final firestore = FakeFirebaseFirestore();
      final api = okApi();
      final transport = FirestoreStaffroomTransport(firestore, api);

      await transport.sendCommunityChatMessage(text: '  Namaste staff room  ');

      expect(api.posts.single.path, '/api/community/chat');
      expect(api.posts.single.data, {'text': 'Namaste staff room'});
      // No direct Firestore write: the route is the only writer.
      final docs = await firestore.collection('community_chat').get();
      expect(docs.docs, isEmpty);
    });

    test('rejects over-length text (no audio) with a typed error BEFORE '
        'any request', () async {
      final api = okApi();
      final transport = FirestoreStaffroomTransport(
        FakeFirebaseFirestore(),
        api,
      );

      await expectLater(
        () => transport.sendCommunityChatMessage(text: 'x' * 501),
        throwsA(isA<ChatMessageTooLongException>()),
      );
      expect(api.posts, isEmpty);
    });

    test('over-length text is allowed when an audioUrl is present', () async {
      final api = okApi();
      final transport = FirestoreStaffroomTransport(
        FakeFirebaseFirestore(),
        api,
      );

      await transport.sendCommunityChatMessage(
        text: 'x' * 501,
        audioUrl: 'https://storage.googleapis.com/voice.m4a',
      );

      expect(
        (api.posts.single.data! as Map)['audioUrl'],
        'https://storage.googleapis.com/voice.m4a',
      );
    });

    test(
      'exactly 500 chars (no audio) is allowed — the cap is inclusive',
      () async {
        final api = okApi();
        final transport = FirestoreStaffroomTransport(
          FakeFirebaseFirestore(),
          api,
        );
        await transport.sendCommunityChatMessage(text: 'x' * 500);
        expect(api.posts, hasLength(1));
      },
    );

    test('a normal-length Indic message (under 500 CHARACTERS) SENDS — the cap '
        'is characters (matching the web), not UTF-8 bytes', () async {
      final api = okApi();
      final transport = FirestoreStaffroomTransport(
        FakeFirebaseFirestore(),
        api,
      );
      // 'न' is 1 UTF-16 code unit but 3 UTF-8 bytes: 167 characters, 501 bytes.
      final devanagari167Chars = 'न' * 167;
      expect(devanagari167Chars.length, 167);

      await transport.sendCommunityChatMessage(text: devanagari167Chars);
      expect(api.posts, hasLength(1));
    });

    test('rejects Indic text over 500 CHARACTERS (no audio)', () async {
      final api = okApi();
      final transport = FirestoreStaffroomTransport(
        FakeFirebaseFirestore(),
        api,
      );

      await expectLater(
        () => transport.sendCommunityChatMessage(text: 'न' * 501),
        throwsA(
          isA<ChatMessageTooLongException>().having(
            (e) => e.length,
            'character length',
            501,
          ),
        ),
      );
      expect(api.posts, isEmpty);
    });

    test('a failed send propagates (the composer keeps the text and offers '
        'Retry), never a silent success', () async {
      final transport = FirestoreStaffroomTransport(
        FakeFirebaseFirestore(),
        FakeApiClient(
          postErrorsByPath: const {
            '/api/community/chat': ApiException(
              ApiErrorKind.network,
              'No connection.',
            ),
          },
        ),
      );
      await expectLater(
        () => transport.sendCommunityChatMessage(text: 'hi'),
        throwsA(isA<ApiException>()),
      );
    });
  });

  group('FirestoreStaffroomTransport group chat', () {
    test('watchGroupChat reads groups/{id}/chat oldest-first', () async {
      final firestore = FakeFirebaseFirestore();
      final chat = firestore.collection('groups').doc('g1').collection('chat');
      for (var i = 0; i < 2; i++) {
        await chat.doc('m$i').set({
          'text': 'g msg $i',
          'authorId': 'u2',
          'authorName': 'Bina',
          'createdAt': Timestamp.fromMillisecondsSinceEpoch(1000 + i),
        });
      }
      final transport = FirestoreStaffroomTransport(firestore, FakeApiClient());

      final snap = await transport.watchGroupChat('g1').first;

      expect(snap.isReady, isTrue);
      expect(snap.data.map((m) => m.text), ['g msg 0', 'g msg 1']);
    });

    test('sendGroupChatMessage POSTs to the group route and returns the new '
        'message id', () async {
      final api = FakeApiClient(
        postResponsesByPath: const {
          '/api/groups/g%201/chat': {'id': 'msg-9'},
        },
      );
      final transport = FirestoreStaffroomTransport(
        FakeFirebaseFirestore(),
        api,
      );

      final id = await transport.sendGroupChatMessage('g 1', text: 'hello');

      expect(id, 'msg-9');
      expect(api.posts.single.path, '/api/groups/g%201/chat');
      expect(api.posts.single.data, {'text': 'hello'});
    });
  });

  group('FirestoreStaffroomTransport groups and connections (REST)', () {
    test(
      'ensureUserGroups decodes the bare id array, dropping blanks',
      () async {
        final api = FakeApiClient(
          postRawResponse: RawResponse(
            bytes: Uint8List.fromList(utf8.encode('["g1", " ", "g2", 3]')),
            contentType: 'application/json',
          ),
        );
        final transport = FirestoreStaffroomTransport(
          FakeFirebaseFirestore(),
          api,
        );

        expect(await transport.ensureUserGroups(), ['g1', 'g2']);
        expect(api.postRaws.single.path, '/api/groups/ensure');
      },
    );

    test('ensureUserGroups fails loudly on a non-array reply', () async {
      final transport = FirestoreStaffroomTransport(
        FakeFirebaseFirestore(),
        FakeApiClient(
          postRawResponse: RawResponse(
            bytes: Uint8List.fromList(utf8.encode('{"error":"x"}')),
            contentType: 'application/json',
          ),
        ),
      );
      await expectLater(
        transport.ensureUserGroups,
        throwsA(isA<FormatException>()),
      );
    });

    test('joinGroup POSTs to the membership route', () async {
      final api = FakeApiClient(
        postResponsesByPath: const {
          '/api/groups/g1/membership': {'joined': true},
        },
      );
      final transport = FirestoreStaffroomTransport(
        FakeFirebaseFirestore(),
        api,
      );

      await transport.joinGroup('g1');
      expect(api.posts.single.path, '/api/groups/g1/membership');
    });

    test('leaveGroup is honestly unavailable (no DELETE verb yet), and makes '
        'no request', () async {
      final api = FakeApiClient();
      final transport = FirestoreStaffroomTransport(
        FakeFirebaseFirestore(),
        api,
      );
      await expectLater(
        () => transport.leaveGroup('g1'),
        throwsA(
          isA<TransportUnavailable>().having(
            (e) => e.kind,
            'kind',
            TransportUnavailableKind.restWrapperMissing,
          ),
        ),
      );
      expect(api.posts, isEmpty);
    });

    test('connection writes POST the bodies the routes validate', () async {
      final api = FakeApiClient(
        postResponsesByPath: const {
          '/api/connections/request': {'status': 'pending', 'requestId': 'r1'},
          '/api/connections/request/accept': {'success': true},
          '/api/connections/request/decline': {'success': true},
          '/api/connections/disconnect': {'success': true},
          '/api/community/follows': {'ok': true},
        },
      );
      final transport = FirestoreStaffroomTransport(
        FakeFirebaseFirestore(),
        api,
      );

      await transport.sendConnectionRequest('u2');
      await transport.acceptConnectionRequest('r1');
      await transport.declineConnectionRequest('r2');
      await transport.disconnect('u3');
      await transport.followTeacher('u4');

      expect(api.posts.map((p) => p.path), [
        '/api/connections/request',
        '/api/connections/request/accept',
        '/api/connections/request/decline',
        '/api/connections/disconnect',
        '/api/community/follows',
      ]);
      expect(api.posts.map((p) => p.data), [
        {'toUid': 'u2'},
        {'requestId': 'r1'},
        {'requestId': 'r2'},
        {'otherUid': 'u3'},
        {'followingId': 'u4'},
      ]);
    });

    test('getMyConnectionData fails loudly on a non-object reply', () async {
      final transport = FirestoreStaffroomTransport(
        FakeFirebaseFirestore(),
        FakeApiClient(
          getResponsesByPath: const {'/api/connections/mine': <Object>[]},
        ),
      );
      await expectLater(
        transport.getMyConnectionData,
        throwsA(isA<FormatException>()),
      );
    });
  });

  group('FirestoreStaffroomTransport.triggerPersonaPulse', () {
    test(
      'a 200 decodes the persona message via the existing ApiClient',
      () async {
        final api = FakeApiClient(
          postResponse: const {
            'message': 'Good morning, teachers!',
            'personaName': 'Priya',
            'personaState': 'WB',
            'personaSubject': 'Math',
          },
        );
        final transport = FirestoreStaffroomTransport(
          FakeFirebaseFirestore(),
          api,
        );

        final pulse = await transport.triggerPersonaPulse(
          const PersonaPulseRequest(),
        );

        expect(pulse, isNotNull);
        expect(pulse!.message, 'Good morning, teachers!');
        expect(pulse.personaName, 'Priya');
        expect(api.posts.single.path, '/api/community/persona-pulse');
      },
    );

    test('a 503 (flag off) returns null — the documented stop signal, not '
        'an error', () async {
      final api = FakeApiClient(
        postError: const ApiException(
          ApiErrorKind.server,
          'Something went wrong on our side.',
          statusCode: 503,
        ),
      );
      final transport = FirestoreStaffroomTransport(
        FakeFirebaseFirestore(),
        api,
      );

      final pulse = await transport.triggerPersonaPulse(
        const PersonaPulseRequest(),
      );

      expect(pulse, isNull);
    });

    test(
      'any other error (e.g. 401) propagates, is NOT swallowed to null',
      () async {
        final api = FakeApiClient(
          postError: const ApiException(
            ApiErrorKind.unauthorized,
            'Please sign in again.',
            statusCode: 401,
          ),
        );
        final transport = FirestoreStaffroomTransport(
          FakeFirebaseFirestore(),
          api,
        );

        await expectLater(
          () => transport.triggerPersonaPulse(const PersonaPulseRequest()),
          throwsA(isA<ApiException>()),
        );
      },
    );
  });
}
