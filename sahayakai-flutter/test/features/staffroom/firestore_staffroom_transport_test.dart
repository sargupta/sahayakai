import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
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
///   2. `sendCommunityChatMessage` writes with the correct `authorId` and
///      client-guards over-length text before ever writing.
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

      final transport = FirestoreStaffroomTransport(
        firestore,
        'u1',
        FakeApiClient(),
      );
      final snapshot =
          await transport.watchStaffRoomChat(limit: 2).first;

      expect(snapshot.isReady, isTrue);
      expect(snapshot.data.map((m) => m.text), ['msg 1', 'msg 2']);
    });

    test('a genuinely empty room resolves ready-empty, not an error',
        () async {
      final transport = FirestoreStaffroomTransport(
        FakeFirebaseFirestore(),
        'u1',
        FakeApiClient(),
      );
      final snapshot = await transport.watchStaffRoomChat().first;
      expect(snapshot.isReady, isTrue);
      expect(snapshot.data, isEmpty);
    });
  });

  group('FirestoreStaffroomTransport.sendCommunityChatMessage', () {
    test('writes authorId == caller uid with the right shape', () async {
      final firestore = FakeFirebaseFirestore();
      final transport = FirestoreStaffroomTransport(
        firestore,
        'u1',
        FakeApiClient(),
        myDisplayName: 'Asha Rao',
        myPhotoURL: 'https://img/asha',
      );

      await transport.sendCommunityChatMessage(text: 'Namaste staff room');

      final docs = await firestore.collection('community_chat').get();
      expect(docs.docs, hasLength(1));
      final data = docs.docs.single.data();
      expect(data['authorId'], 'u1');
      expect(data['authorName'], 'Asha Rao');
      expect(data['authorPhotoURL'], 'https://img/asha');
      expect(data['text'], 'Namaste staff room');
      expect(data.containsKey('audioUrl'), isFalse);
    });

    test('rejects over-length text (no audio) with a typed error BEFORE '
        'writing', () async {
      final firestore = FakeFirebaseFirestore();
      final transport = FirestoreStaffroomTransport(
        firestore,
        'u1',
        FakeApiClient(),
      );
      final tooLong = 'x' * 501;

      await expectLater(
        () => transport.sendCommunityChatMessage(text: tooLong),
        throwsA(isA<ChatMessageTooLongException>()),
      );

      // The client-side guard fires before any write — no orphaned doc.
      final docs = await firestore.collection('community_chat').get();
      expect(docs.docs, isEmpty);
    });

    test('over-length text is allowed when an audioUrl is present '
        '(mirrors the rule\'s bypass clause)', () async {
      final firestore = FakeFirebaseFirestore();
      final transport = FirestoreStaffroomTransport(
        firestore,
        'u1',
        FakeApiClient(),
      );
      final longCaption = 'x' * 501;

      await transport.sendCommunityChatMessage(
        text: longCaption,
        audioUrl: 'https://storage.googleapis.com/voice.m4a',
      );

      final docs = await firestore.collection('community_chat').get();
      expect(docs.docs, hasLength(1));
      expect(docs.docs.single.data()['audioUrl'],
          'https://storage.googleapis.com/voice.m4a');
    });

    test('exactly 500 chars (no audio) is allowed — the cap is inclusive',
        () async {
      final firestore = FakeFirebaseFirestore();
      final transport = FirestoreStaffroomTransport(
        firestore,
        'u1',
        FakeApiClient(),
      );
      final exactly500 = 'x' * 500;

      await transport.sendCommunityChatMessage(text: exactly500);

      final docs = await firestore.collection('community_chat').get();
      expect(docs.docs, hasLength(1));
    });

    test(
        'rejects Devanagari text over 500 UTF-8 BYTES even though it is '
        'under 500 characters — the rule counts bytes, not code units',
        () async {
      final firestore = FakeFirebaseFirestore();
      final transport = FirestoreStaffroomTransport(
        firestore,
        'u1',
        FakeApiClient(),
      );
      // 'न' is 1 UTF-16 code unit but 3 UTF-8 bytes — 167 of them is 167
      // chars (under the old, wrong char-based 500 cap) but 501 bytes (over
      // the real firestore.rules `text.size() <= 500` cap).
      final devanagari167Chars = 'न' * 167;
      expect(devanagari167Chars.length, 167);

      await expectLater(
        () => transport.sendCommunityChatMessage(text: devanagari167Chars),
        throwsA(isA<ChatMessageTooLongException>()
            .having((e) => e.length, 'byte length', 501)),
      );
      final docs = await firestore.collection('community_chat').get();
      expect(docs.docs, isEmpty);
    });

    test(
        'allows Devanagari text within 500 UTF-8 bytes '
        '(not over-conservative on multi-byte scripts)', () async {
      final firestore = FakeFirebaseFirestore();
      final transport = FirestoreStaffroomTransport(
        firestore,
        'u1',
        FakeApiClient(),
      );
      // 166 * 3 = 498 bytes — under the cap.
      final devanagari166Chars = 'न' * 166;

      await transport.sendCommunityChatMessage(text: devanagari166Chars);

      final docs = await firestore.collection('community_chat').get();
      expect(docs.docs, hasLength(1));
    });
  });

  group('FirestoreStaffroomTransport.triggerPersonaPulse', () {
    test('a 200 decodes the persona message via the existing ApiClient',
        () async {
      final api = FakeApiClient(
        postResponse: const {
          'message': 'Good morning, teachers!',
          'personaName': 'Priya',
          'personaState': 'WB',
          'personaSubject': 'Math',
        },
      );
      final transport =
          FirestoreStaffroomTransport(FakeFirebaseFirestore(), 'u1', api);

      final pulse =
          await transport.triggerPersonaPulse(const PersonaPulseRequest());

      expect(pulse, isNotNull);
      expect(pulse!.message, 'Good morning, teachers!');
      expect(pulse.personaName, 'Priya');
      expect(api.posts.single.path, '/api/community/persona-pulse');
    });

    test('a 503 (flag off) returns null — the documented stop signal, not '
        'an error', () async {
      final api = FakeApiClient(
        postError: const ApiException(
          ApiErrorKind.server,
          'Something went wrong on our side.',
          statusCode: 503,
        ),
      );
      final transport =
          FirestoreStaffroomTransport(FakeFirebaseFirestore(), 'u1', api);

      final pulse =
          await transport.triggerPersonaPulse(const PersonaPulseRequest());

      expect(pulse, isNull);
    });

    test('any other error (e.g. 401) propagates, is NOT swallowed to null',
        () async {
      final api = FakeApiClient(
        postError: const ApiException(
          ApiErrorKind.unauthorized,
          'Please sign in again.',
          statusCode: 401,
        ),
      );
      final transport =
          FirestoreStaffroomTransport(FakeFirebaseFirestore(), 'u1', api);

      await expectLater(
        () => transport.triggerPersonaPulse(const PersonaPulseRequest()),
        throwsA(isA<ApiException>()),
      );
    });
  });

  group('FirestoreStaffroomTransport — everything else stays unavailable, '
      'unchanged from DeferredStaffroomTransport', () {
    late FirestoreStaffroomTransport transport;

    setUp(() {
      transport = FirestoreStaffroomTransport(
        FakeFirebaseFirestore(),
        'u1',
        FakeApiClient(),
      );
    });

    test('watchGroupChat still emits awaitingFirebase (no REST wrapper / '
        'membership validation path yet)', () async {
      final snap = await transport.watchGroupChat('g1').first;
      expect(snap.isAwaitingFirebase, isTrue);
      expect(snap.data, isEmpty);
    });

    test('server-derived reads still return safe empties / nulls', () async {
      expect(await transport.ensureUserGroups(), isEmpty);
      expect(await transport.getMyGroups(), isEmpty);
      expect(await transport.getGroup('g1'), isNull);
      expect(await transport.discoverGroups(), isEmpty);
      expect(await transport.getGroupPosts('g1'), isEmpty);
      expect(await transport.getUnifiedFeed(), isEmpty);
      expect(await transport.getRecommendedTeachers(), isEmpty);
      expect(await transport.getAllTeachers(), isEmpty);
      expect(await transport.getPublicProfile('u2'), isNull);
      expect((await transport.getLikedItemIds()).groupPostIds, isEmpty);
      expect((await transport.getMyConnectionData()).connectedUids, isEmpty);
    });

    test('every group/connection write still throws a typed '
        'TransportUnavailable', () async {
      Future<void> expectUnavailable(Future<void> Function() op) async {
        await expectLater(
          op,
          throwsA(
            isA<TransportUnavailable>().having(
              (e) => e.kind,
              'kind',
              TransportUnavailableKind.awaitingFirebase,
            ),
          ),
        );
      }

      await expectUnavailable(() => transport.joinGroup('g1'));
      await expectUnavailable(() => transport.leaveGroup('g1'));
      await expectUnavailable(() => transport.sendGroupChatMessage(
            'g1',
            text: 'hi',
          ));
      await expectUnavailable(() => transport.sendConnectionRequest('u2'));
      await expectUnavailable(() => transport.acceptConnectionRequest('r1'));
      await expectUnavailable(() => transport.declineConnectionRequest('r1'));
      await expectUnavailable(() => transport.disconnect('u2'));
      await expectUnavailable(() => transport.followTeacher('u2'));
    });
  });
}
