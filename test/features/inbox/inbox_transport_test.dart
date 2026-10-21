import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/inbox/data/block_c_transport.dart';
import 'package:sahayakai/features/inbox/data/inbox_transport.dart';
import 'package:sahayakai/features/inbox/data/notifications_transport.dart';
import 'package:sahayakai/features/inbox/data/presence_transport.dart';
import 'package:sahayakai/features/inbox/domain/conversation_id.dart';
import 'package:sahayakai/features/inbox/domain/inbox_models.dart';
import 'package:sahayakai/features/inbox/domain/presence_status.dart';

import '../../support/fake_block_c_transports.dart';

/// Contract tests for the Pro Inbox transport seam (U-SI0):
///  1. the DEFERRED impl keeps the APK green — live streams emit the typed
///     `awaitingFirebase` snapshot, and every write throws a typed
///     [TransportUnavailable] — so U-SI1+ can rely on the signed-out/empty state;
///  2. the FAKE impl drives streams + writes, proving the interface is a usable
///     contract for the UI units to build against.
void main() {
  group('TransportSnapshot — value semantics', () {
    test('list payloads compare by value (no rebuild thrash)', () {
      const a = TransportSnapshot<List<int>>.ready([1, 2, 3]);
      const b = TransportSnapshot<List<int>>.ready([1, 2, 3]);
      expect(a, b);
      expect(a.hashCode, b.hashCode);
    });

    test('the state constructors set the right flags', () {
      const awaiting = TransportSnapshot<List<int>>.awaitingFirebase(<int>[]);
      expect(awaiting.isAwaitingFirebase, isTrue);
      expect(awaiting.isEmptyByDesign, isTrue);
      expect(awaiting.data, isEmpty);

      const signedOut = TransportSnapshot<List<int>>.signedOut(<int>[]);
      expect(signedOut.isSignedOut, isTrue);
      expect(signedOut.isEmptyByDesign, isTrue);

      final err = TransportSnapshot<List<int>>.error(
        const <int>[],
        StateError('x'),
      );
      expect(err.hasError, isTrue);
      expect(err.isEmptyByDesign, isFalse);
      expect(err.error, isA<StateError>());

      const ready = TransportSnapshot<List<int>>.ready([1]);
      expect(ready.isReady, isTrue);
      expect(ready.isEmptyByDesign, isFalse);
    });

    test(
      'an error→ready transition CLEARS the error (no stale error retained)',
      () {
        // The named constructors, not a copyWith, are the only way to build a
        // snapshot — so a live impl moving error→ready cannot silently keep the
        // stale error object.
        final errored = TransportSnapshot<List<int>>.error(
          const <int>[],
          StateError('missing index'),
        );
        expect(errored.error, isNotNull);

        const recovered = TransportSnapshot<List<int>>.ready([1, 2]);
        expect(recovered.error, isNull);
        expect(recovered.hasError, isFalse);
        expect(recovered.isReady, isTrue);
      },
    );
  });

  group('DeferredInboxTransport — keeps the APK green (no Firebase)', () {
    const transport = DeferredInboxTransport();

    test('watchInbox emits a single awaitingFirebase empty snapshot', () async {
      final snap = await transport.watchInbox().first;
      expect(snap.isAwaitingFirebase, isTrue);
      expect(snap.data, isEmpty);
    });

    test(
      'watchThread + watchUnreadConversations emit awaitingFirebase',
      () async {
        final thread = await transport
            .watchThread(const ConversationId('u1_u2'))
            .first;
        expect(thread.isAwaitingFirebase, isTrue);
        expect(thread.data, isEmpty);

        final unread = await transport.watchUnreadConversations().first;
        expect(unread.isAwaitingFirebase, isTrue);
        expect(unread.data, 0);
      },
    );

    test('one-shot reads return safe empties', () async {
      expect(await transport.getTotalUnreadCount(), 0);
      expect(
        await transport.loadOlderMessages(
          const ConversationId('u1_u2'),
          beforeMessageId: 'm1',
        ),
        isEmpty,
      );
    });

    test(
      'every write throws a typed TransportUnavailable (awaitingFirebase)',
      () async {
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

        await expectUnavailable(
          () => transport.getOrCreateDirectConversation('u2'),
        );
        await expectUnavailable(
          () => transport.createGroupConversation(
            participantUids: const ['u1', 'u2'],
            name: 'g',
          ),
        );
        await expectUnavailable(
          () => transport.sendMessage(
            const SendMessageInput(
              conversationId: ConversationId('u1_u2'),
              type: MessageType.text,
              text: 'hi',
            ),
          ),
        );
        await expectUnavailable(
          () => transport.markConversationRead(const ConversationId('u1_u2')),
        );
        await expectUnavailable(
          () => transport.acknowledgeDelivery(
            const ConversationId('u1_u2'),
            const ['m1'],
          ),
        );
      },
    );

    test('TransportUnavailable names the surface + is awaitingFirebase', () {
      const e = TransportUnavailable.awaitingFirebase('sendMessage');
      expect(e.surface, 'sendMessage');
      expect(e.isAwaitingFirebase, isTrue);
      expect(e.toString(), contains('sendMessage'));
    });
  });

  group(
    'inboxTransportProvider — binds the deferred impl while Firebase-gated',
    () {
      test('resolves to DeferredInboxTransport (Firebase not configured)', () {
        final container = ProviderContainer();
        addTearDown(container.dispose);
        expect(
          container.read(inboxTransportProvider),
          isA<DeferredInboxTransport>(),
        );
        expect(
          container.read(notificationsTransportProvider),
          isA<DeferredNotificationsTransport>(),
        );
        expect(
          container.read(presenceTransportProvider),
          isA<DeferredPresenceTransport>(),
        );
      });

      test('a UI unit can override the provider with the fake', () async {
        final fake = FakeInboxTransport();
        addTearDown(fake.dispose);
        final container = ProviderContainer(
          overrides: [inboxTransportProvider.overrideWithValue(fake)],
        );
        addTearDown(container.dispose);

        final transport = container.read(inboxTransportProvider);
        fake.emitInbox(
          const TransportSnapshot<List<Conversation>>.ready([
            Conversation(
              id: ConversationId('u1_u2'),
              type: ConversationType.direct,
              participantIds: ['u1', 'u2'],
              participants: {},
              lastMessage: 'hi',
              lastMessageSenderId: 'u2',
              unreadCount: {'u1': 1},
            ),
          ]),
        );
        final snap = await transport.watchInbox().first;
        expect(snap.isReady, isTrue);
        expect(snap.data.single.lastMessage, 'hi');
      });
    },
  );

  group('FakeInboxTransport — drives streams + records writes', () {
    test('emit pushes a new inbox snapshot to a live listener', () async {
      final fake = FakeInboxTransport();
      addTearDown(fake.dispose);

      final seen = <TransportSnapshot<List<Conversation>>>[];
      final sub = fake.watchInbox().listen(seen.add);
      await Future<void>.delayed(Duration.zero);

      fake.emitInbox(
        TransportSnapshot<List<Conversation>>.error(
          const <Conversation>[],
          StateError('missing index'),
        ),
      );
      await Future<void>.delayed(Duration.zero);
      await sub.cancel();

      // Seeded ready snapshot, then the pushed error snapshot.
      expect(seen.first.isReady, isTrue);
      expect(seen.last.hasError, isTrue);
    });

    test(
      'sendMessage records the input and returns the configured id',
      () async {
        final fake = FakeInboxTransport()..sendMessageResult = 'm-99';
        addTearDown(fake.dispose);

        final id = await fake.sendMessage(
          const SendMessageInput(
            conversationId: ConversationId('u1_u2'),
            type: MessageType.text,
            text: 'hello',
            clientMessageId: 'uuid-1',
          ),
        );
        expect(id, 'm-99');
        expect(fake.sentMessages.single.text, 'hello');
        expect(fake.sentMessages.single.clientMessageId, 'uuid-1');
      },
    );

    test(
      'a configured sendMessage error surfaces (failed-send path)',
      () async {
        final fake = FakeInboxTransport()
          ..sendMessageError = StateError('boom');
        addTearDown(fake.dispose);
        await expectLater(
          () => fake.sendMessage(
            const SendMessageInput(
              conversationId: ConversationId('u1_u2'),
              type: MessageType.text,
            ),
          ),
          throwsA(isA<StateError>()),
        );
      },
    );

    test(
      'markConversationRead + thread emit are recorded/observable',
      () async {
        final fake = FakeInboxTransport();
        addTearDown(fake.dispose);

        const id = ConversationId('u1_u2');
        await fake.markConversationRead(id);
        expect(fake.markedRead, [id]);

        fake.emitThread(
          id,
          const TransportSnapshot<List<Message>>.ready([
            Message(
              id: 'm1',
              type: MessageType.text,
              text: 'yo',
              senderId: 'u2',
              senderName: 'Bina',
            ),
          ]),
        );
        final snap = await fake.watchThread(id).first;
        expect(snap.data.single.text, 'yo');
      },
    );
  });

  group('DeferredNotificationsTransport', () {
    const transport = DeferredNotificationsTransport();

    test('unread stream emits awaitingFirebase; list is empty', () async {
      final snap = await transport.watchUnreadNotifications().first;
      expect(snap.isAwaitingFirebase, isTrue);
      expect(await transport.getNotifications(), isEmpty);
    });

    test('mark-read writes throw TransportUnavailable', () async {
      await expectLater(
        () => transport.markNotificationRead('n1'),
        throwsA(isA<TransportUnavailable>()),
      );
      await expectLater(
        transport.markAllNotificationsRead,
        throwsA(isA<TransportUnavailable>()),
      );
    });
  });

  group('DeferredPresenceTransport — best-effort, writes are no-ops', () {
    const transport = DeferredPresenceTransport();

    test('presence is unknown (no dot); typing is empty', () async {
      final p = await transport.watchPresence('u2').first;
      expect(p.presence, Presence.unknown);
      expect(p.showsDot, isFalse);

      final t = await transport
          .watchTyping(const ConversationId('u1_u2'))
          .first;
      expect(t.isAnyoneTyping, isFalse);
    });

    test('presence/typing writes are no-ops (do NOT throw)', () async {
      await transport.setPresence(online: true); // must not throw
      await transport.setTyping(const ConversationId('u1_u2'), typing: true);
    });
  });

  group('FakeNotificationsTransport + FakePresenceTransport', () {
    test('notifications fake records mark-read + mark-all', () async {
      final fake = FakeNotificationsTransport();
      addTearDown(fake.dispose);
      await fake.markNotificationRead('n1');
      await fake.markAllNotificationsRead();
      expect(fake.markedRead, ['n1']);
      expect(fake.markAllCalls, 1);
    });

    test('presence fake pushes a green-dot status + records writes', () async {
      final fake = FakePresenceTransport();
      addTearDown(fake.dispose);

      final seen = <PresenceStatus>[];
      final sub = fake.watchPresence('u2').listen(seen.add);
      await Future<void>.delayed(Duration.zero);
      fake.emitPresence(
        const PresenceStatus(uid: 'u2', presence: Presence.online),
      );
      await Future<void>.delayed(Duration.zero);
      await sub.cancel();
      expect(seen.last.showsDot, isTrue);

      await fake.setPresence(online: true);
      expect(fake.presenceWrites, [true]);
    });
  });
}
