import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/inbox/data/dto/conversation_dto.dart';
import 'package:sahayakai/features/inbox/data/dto/message_dto.dart';
import 'package:sahayakai/features/inbox/data/dto/notification_dto.dart';
import 'package:sahayakai/features/inbox/data/dto/presence_dto.dart';
import 'package:sahayakai/features/inbox/data/dto/wire_time.dart';
import 'package:sahayakai/features/inbox/domain/conversation_id.dart';
import 'package:sahayakai/features/inbox/domain/inbox_models.dart';
import 'package:sahayakai/features/inbox/domain/notification_item.dart';
import 'package:sahayakai/features/inbox/domain/presence_status.dart';

/// Golden-decode + request-shape pinning for the Pro Inbox (Pillar 05) DTOs.
/// Pure DTO logic — no network. Every wire shape mirrors
/// `src/types/messages.ts` / `src/types/index.ts` + the server actions in
/// `sahayakai-main`; enum tolerance mirrors the `VidyaFlow.fromWire` guard.
void main() {
  group('buildDirectConversationId — deterministic, sort-stable', () {
    test('is idempotent regardless of argument order (matches web sort)', () {
      expect(buildDirectConversationId('bbb', 'aaa'), 'aaa_bbb');
      expect(buildDirectConversationId('aaa', 'bbb'), 'aaa_bbb');
      expect(
        buildDirectConversationId('u2', 'u1'),
        buildDirectConversationId('u1', 'u2'),
      );
    });

    test('ConversationId.direct wraps the deterministic id', () {
      final id = ConversationId.direct('zeta', 'alpha');
      expect(id.value, 'alpha_zeta');
      expect(id, ConversationId.direct('alpha', 'zeta'));
    });

    test('directPair recovers both uids from a DM id, null for a group id', () {
      expect(const ConversationId('alpha_zeta').directPair, (
        a: 'alpha',
        b: 'zeta',
      ));
      expect(const ConversationId('groupid123').directPair, isNull);
      expect(const ConversationId('a_').directPair, isNull);
    });
  });

  group('ConversationDto — conversations/{id} golden', () {
    Map<String, dynamic> body() => {
      'id': 'u1_u2',
      'type': 'direct',
      'participantIds': ['u1', 'u2'],
      'participants': {
        'u1': {
          'displayName': 'Asha Rao',
          'photoURL': 'https://img/1',
          'preferredLanguage': 'Kannada',
        },
        'u2': {'displayName': 'Bina Das', 'photoURL': null},
      },
      'lastMessage': 'See you at the workshop',
      'lastMessageAt': '2026-07-18T10:00:00.000Z',
      'lastMessageSenderId': 'u2',
      'unreadCount': {'u1': 3, 'u2': 0},
      'createdAt': '2026-07-01T09:00:00.000Z',
      'updatedAt': '2026-07-18T10:00:00.000Z',
    };

    test('decodes the full document', () {
      final c = ConversationDto.fromJson(body()).toDomain();
      expect(c.id, const ConversationId('u1_u2'));
      expect(c.type, ConversationType.direct);
      expect(c.isGroup, isFalse);
      expect(c.participantIds, ['u1', 'u2']);
      expect(c.participants['u1']!.displayName, 'Asha Rao');
      expect(c.participants['u1']!.preferredLanguage, 'Kannada');
      expect(c.participants['u2']!.photoURL, isNull);
      expect(c.lastMessage, 'See you at the workshop');
      expect(c.lastMessageSenderId, 'u2');
      expect(c.unreadFor('u1'), 3);
      expect(c.unreadFor('u2'), 0);
    });

    test(
      'otherParticipant / otherParticipantId resolve the DM counterpart',
      () {
        final c = ConversationDto.fromJson(body()).toDomain();
        expect(c.otherParticipantId('u1'), 'u2');
        expect(c.otherParticipant('u1')!.displayName, 'Bina Das');
        // A group has no single "other".
        final g = ConversationDto.fromJson({
          ...body(),
          'type': 'group',
        }).toDomain();
        expect(g.otherParticipantId('u1'), isNull);
      },
    );

    test('a group conversation carries name + createdBy', () {
      final g = ConversationDto.fromJson({
        ...body(),
        'id': 'grp-1',
        'type': 'group',
        'name': 'Class 8 Science',
        'createdBy': 'u1',
        'participantIds': ['u1', 'u2', 'u3'],
      }).toDomain();
      expect(g.isGroup, isTrue);
      expect(g.name, 'Class 8 Science');
      expect(g.createdBy, 'u1');
    });

    test('tolerates a half-written / empty document (no crash)', () {
      final c = ConversationDto.fromJson(<String, dynamic>{}).toDomain();
      expect(c.id.value, '');
      expect(c.type, ConversationType.direct); // safe default
      expect(c.participantIds, isEmpty);
      expect(c.participants, isEmpty);
      expect(c.lastMessage, '');
      expect(c.unreadCount, isEmpty);
    });

    test(
      'unreadCount tolerates num / numeric-string, drops junk & negatives',
      () {
        final c = ConversationDto.fromJson({
          ...body(),
          'unreadCount': {'u1': 2.0, 'u2': '5', 'u3': 'x', 'u4': -1},
        }).toDomain();
        expect(c.unreadFor('u1'), 2);
        expect(c.unreadFor('u2'), 5);
        expect(c.unreadCount.containsKey('u3'), isFalse);
        expect(c.unreadCount.containsKey('u4'), isFalse);
      },
    );

    test('a malformed participant entry is dropped, not thrown', () {
      final c = ConversationDto.fromJson({
        ...body(),
        'participants': {
          'u1': {'displayName': 'Asha'},
          'u2': 'not-an-object',
        },
      }).toDomain();
      expect(c.participants.containsKey('u1'), isTrue);
      expect(c.participants.containsKey('u2'), isFalse);
    });
  });

  group('ConversationType.fromWire — tolerant', () {
    test('known + unknown', () {
      expect(ConversationType.fromWire('group'), ConversationType.group);
      expect(ConversationType.fromWire('squad'), ConversationType.direct);
      expect(ConversationType.fromWire(null), ConversationType.direct);
    });
  });

  group('MessageDto — conversations/{id}/messages/{id} golden', () {
    test('decodes a text message with read/delivery receipts', () {
      final m = MessageDto.fromJson({
        'id': 'm1',
        'type': 'text',
        'text': 'Namaste',
        'senderId': 'u2',
        'senderName': 'Bina',
        'senderPhotoURL': null,
        'readBy': ['u1', 'u2'],
        'deliveredTo': ['u1'],
        'createdAt': '2026-07-18T10:00:00.000Z',
        'deliveryStatus': 'read',
      }).toDomain();
      expect(m.id, 'm1');
      expect(m.type, MessageType.text);
      expect(m.text, 'Namaste');
      expect(m.isReadBy('u1'), isTrue);
      expect(m.deliveredTo, ['u1']);
      expect(m.deliveryStatus, MessageDeliveryStatus.read);
    });

    test('decodes a resource share into the SharedResource card', () {
      final m = MessageDto.fromJson({
        'id': 'm2',
        'type': 'resource',
        'text': 'Sharing this plan',
        'senderId': 'u1',
        'senderName': 'Asha',
        'resource': {
          'id': 'lp-9',
          'type': 'lesson-plan',
          'title': 'Fractions via chapati',
          'gradeLevel': 'Class 6',
          'subject': 'Mathematics',
          'route': 'lesson-planner',
        },
      }).toDomain();
      expect(m.type, MessageType.resource);
      expect(m.isResource, isTrue);
      expect(m.resource!.kind, SharedResourceKind.lessonPlan);
      expect(m.resource!.title, 'Fractions via chapati');
      expect(m.resource!.route, 'lesson-planner');
    });

    test(
      'a resource card missing id/route degrades to null (renders caption)',
      () {
        final m = MessageDto.fromJson({
          'id': 'm3',
          'type': 'resource',
          'text': 'oops',
          'senderId': 'u1',
          'senderName': 'Asha',
          'resource': {'type': 'quiz', 'title': 'No route'},
        }).toDomain();
        expect(m.resource, isNull);
      },
    );

    test('decodes an audio message', () {
      final m = MessageDto.fromJson({
        'id': 'm4',
        'type': 'audio',
        'text': '',
        'senderId': 'u1',
        'senderName': 'Asha',
        'audioUrl': 'https://firebasestorage.googleapis.com/voice.mp3',
        'audioDuration': 12,
      }).toDomain();
      expect(m.isAudio, isTrue);
      expect(m.audioUrl, endsWith('voice.mp3'));
      expect(m.audioDuration, 12);
    });

    test('falls back to clientMessageId as the id (idempotent send)', () {
      final m = MessageDto.fromJson({
        'type': 'text',
        'text': 'optimistic',
        'senderId': 'u1',
        'senderName': 'Asha',
        'clientMessageId': 'uuid-123',
      }).toDomain();
      expect(m.id, 'uuid-123');
      expect(m.clientMessageId, 'uuid-123');
    });

    test('unknown type / status fall back to safe defaults', () {
      final m = MessageDto.fromJson({
        'id': 'm5',
        'type': 'sticker',
        'text': 'hi',
        'senderId': 'u1',
        'senderName': 'Asha',
        'deliveryStatus': 'teleported',
      }).toDomain();
      expect(m.type, MessageType.text);
      expect(m.deliveryStatus, MessageDeliveryStatus.sent);
    });
  });

  group('SendMessageRequestDto.build — POST /api/messages/send body', () {
    test('carries the exact fields incl. wire type + clientMessageId', () {
      final json = SendMessageRequestDto.build(
        conversationId: 'u1_u2',
        type: MessageType.text,
        text: '  Hello  ',
        clientMessageId: 'uuid-9',
      ).toJson();
      expect(json, {
        'conversationId': 'u1_u2',
        'text': 'Hello',
        'type': 'text',
        'clientMessageId': 'uuid-9',
      });
    });

    test('NEVER includes senderId (server-derived trust boundary)', () {
      final json = SendMessageRequestDto.build(
        conversationId: 'u1_u2',
        type: MessageType.audio,
        audioUrl: 'https://firebasestorage.googleapis.com/v.mp3',
        audioDuration: 8,
      ).toJson();
      expect(json.containsKey('senderId'), isFalse);
      expect(json['type'], 'audio');
      expect(json['audioUrl'], endsWith('v.mp3'));
      expect(json['audioDuration'], 8);
    });

    test('drops empty optionals (resource/audio absent for a text send)', () {
      final json = SendMessageRequestDto.build(
        conversationId: 'u1_u2',
        type: MessageType.text,
        text: 'hi',
      ).toJson();
      expect(json.containsKey('resource'), isFalse);
      expect(json.containsKey('audioUrl'), isFalse);
      expect(json.containsKey('clientMessageId'), isFalse);
    });
  });

  group('response DTOs', () {
    test('ConversationIdResponseDto trims; blank → empty (malformed)', () {
      expect(
        ConversationIdResponseDto.fromJson({'conversationId': ' c1 '}).id,
        'c1',
      );
      expect(ConversationIdResponseDto.fromJson(<String, dynamic>{}).id, '');
    });

    test('SendMessageResponseDto decodes { messageId }', () {
      expect(SendMessageResponseDto.fromJson({'messageId': 'm9'}).id, 'm9');
    });

    test('GetOrCreateDirectRequestDto sends only { otherUid }', () {
      final json = const GetOrCreateDirectRequestDto(otherUid: 'u2').toJson();
      expect(json, {'otherUid': 'u2'});
      expect(json.containsKey('myUid'), isFalse);
    });
  });

  group('NotificationDto — notifications/{id} golden', () {
    test('decodes a MESSAGE notification with conversation deep link', () {
      final n = NotificationDto.fromJson({
        'id': 'n1',
        'recipientId': 'u1',
        'type': 'MESSAGE',
        'title': 'Bina',
        'message': 'New message',
        'link': '/messages?open=u1_u2',
        'metadata': {'conversationId': 'u1_u2'},
        'isRead': false,
        'createdAt': '2026-07-18T10:00:00.000Z',
      }).toDomain();
      expect(n.kind, NotificationKind.message);
      expect(n.kind.isMessage, isTrue);
      expect(n.isRead, isFalse);
      expect(n.conversationId, 'u1_u2');
    });

    test('MESSAGE is modelled even though absent from the types union', () {
      // sendMessageAction writes type:'MESSAGE' at runtime; must not fall to
      // SYSTEM.
      expect(NotificationKind.fromWire('MESSAGE'), NotificationKind.message);
    });

    test('CONNECT_REQUEST exposes requestId for inline accept/decline', () {
      final n = NotificationDto.fromJson({
        'id': 'n2',
        'recipientId': 'u1',
        'type': 'CONNECT_REQUEST',
        'title': 'Connection request',
        'message': 'Asha wants to connect',
        'metadata': {'requestId': 'req-7'},
        'isRead': false,
      }).toDomain();
      expect(n.kind.isConnectRequest, isTrue);
      expect(n.requestId, 'req-7');
    });

    test('conversationId falls back to the open= querystring in link', () {
      final n = NotificationDto.fromJson({
        'id': 'n3',
        'recipientId': 'u1',
        'type': 'MESSAGE',
        'title': 't',
        'message': 'm',
        'link': '/messages?open=grp-42&foo=bar',
        'isRead': true,
      }).toDomain();
      expect(n.conversationId, 'grp-42');
    });

    test('the open= parse is anchored on ?/& (no reopen= false-match)', () {
      NotificationItem withLink(String link) => NotificationDto.fromJson({
        'id': 'n',
        'recipientId': 'u1',
        'type': 'MESSAGE',
        'title': 't',
        'message': 'm',
        'link': link,
      }).toDomain();

      // Real delimiters match.
      expect(withLink('/messages?open=abc').conversationId, 'abc');
      expect(withLink('/x?a=1&open=abc').conversationId, 'abc');
      // A longer key ending in "open" must NOT match (metadata absent → null).
      expect(withLink('/messages?reopen=xyz').conversationId, isNull);
    });

    test('unknown type → system; isRead tolerant of missing/truthy', () {
      expect(NotificationKind.fromWire('WHATSIT'), NotificationKind.system);
      final n = NotificationDto.fromJson({
        'id': 'n4',
        'recipientId': 'u1',
        'type': 'LIKE',
        'title': 't',
        'message': 'm',
      }).toDomain();
      expect(n.isRead, isFalse); // missing → unread (safe: stays visible)
    });

    test('metadata drops non-string values', () {
      final n = NotificationDto.fromJson({
        'id': 'n5',
        'recipientId': 'u1',
        'type': 'GROUP_POST_LIKE',
        'title': 't',
        'message': 'm',
        'metadata': {'groupId': 'g1', 'count': 3, 'blank': ''},
      }).toDomain();
      expect(n.metadata['groupId'], 'g1');
      expect(n.metadata.containsKey('count'), isFalse);
      expect(n.metadata.containsKey('blank'), isFalse);
    });

    test('MarkNotificationReadRequestDto sends only { notificationId }', () {
      expect(
        const MarkNotificationReadRequestDto(notificationId: 'n1').toJson(),
        {'notificationId': 'n1'},
      );
    });
  });

  group('PresenceDto.fromRtdbValue — RTDB onValue shapes', () {
    test('a bare boolean', () {
      expect(PresenceDto.fromRtdbValue('u1', true).presence, Presence.online);
      expect(PresenceDto.fromRtdbValue('u1', false).presence, Presence.offline);
    });

    test('the { online, lastChanged } object shape', () {
      final s = PresenceDto.fromRtdbValue('u1', {
        'online': true,
        'lastChanged': 1710000000000,
      });
      expect(s.isOnline, isTrue);
      expect(s.showsDot, isTrue);
      expect(s.lastChangedMs, 1710000000000);
    });

    test('null / unknown node → unknown (no dot)', () {
      expect(PresenceDto.fromRtdbValue('u1', null).presence, Presence.unknown);
      expect(
        PresenceDto.fromRtdbValue('u1', 'weird').presence,
        Presence.unknown,
      );
      expect(PresenceDto.fromRtdbValue('u1', null).showsDot, isFalse);
    });
  });

  group('wireTimeToIso — normalises the timestamp shapes', () {
    test('ISO string passes through trimmed', () {
      expect(
        wireTimeToIso('  2026-07-18T10:00:00.000Z '),
        '2026-07-18T10:00:00.000Z',
      );
    });

    test('epoch millis int → ISO', () {
      expect(wireTimeToIso(0), '1970-01-01T00:00:00.000Z');
    });

    test('{seconds, nanoseconds} Firestore Timestamp shape → ISO', () {
      expect(
        wireTimeToIso({'seconds': 0, 'nanoseconds': 0}),
        '1970-01-01T00:00:00.000Z',
      );
      expect(
        wireTimeToIso({'_seconds': 1, '_nanoseconds': 0}),
        '1970-01-01T00:00:01.000Z',
      );
    });

    test('null / blank / junk → null', () {
      expect(wireTimeToIso(null), isNull);
      expect(wireTimeToIso('   '), isNull);
      expect(wireTimeToIso(true), isNull);
      expect(wireTimeToIso({'foo': 'bar'}), isNull);
    });
  });
}
