import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/staffroom/data/dto/chat_message_dto.dart';
import 'package:sahayakai/features/staffroom/data/dto/connection_dto.dart';
import 'package:sahayakai/features/staffroom/data/dto/feed_dto.dart';
import 'package:sahayakai/features/staffroom/data/dto/group_dto.dart';
import 'package:sahayakai/features/staffroom/data/dto/persona_pulse_dto.dart';
import 'package:sahayakai/features/staffroom/data/dto/teacher_dto.dart';
import 'package:sahayakai/features/staffroom/domain/community_post.dart';
import 'package:sahayakai/features/staffroom/domain/connection.dart';
import 'package:sahayakai/features/staffroom/domain/group.dart';
import 'package:sahayakai/features/staffroom/domain/persona_pulse.dart';

/// Golden-decode + request-shape pinning for the Staffroom (Pillar 04) DTOs.
/// Wire shapes mirror `src/types/community.ts` / `src/types/index.ts` + the
/// community/groups/connections server actions.
void main() {
  group('GroupDto — groups/{id} golden', () {
    test('decodes the full document', () {
      final g = GroupDto.fromJson({
        'id': 'grp-sci-8',
        'name': 'Class 8 Science',
        'description': 'Science teachers, Class 8',
        'type': 'subject_grade',
        'coverColor': 'linear-gradient(135deg, #fb923c, #f59e0b)',
        'memberCount': 42,
        'autoJoinRules': {
          'subjects': ['Science'],
          'grades': ['Class 8'],
          'board': 'CBSE',
        },
        'lastActivityAt': '2026-07-18T10:00:00.000Z',
        'createdAt': '2026-07-01T00:00:00.000Z',
        'createdBy': 'system',
      }).toDomain();
      expect(g.id, 'grp-sci-8');
      expect(g.type, GroupType.subjectGrade);
      expect(g.memberCount, 42);
      expect(g.isSystemCreated, isTrue);
      expect(g.autoJoinRules.subjects, ['Science']);
      expect(g.autoJoinRules.board, 'CBSE');
      expect(g.coverColor, startsWith('linear-gradient'));
    });

    test('unknown type → interest; missing createdBy → system', () {
      final g = GroupDto.fromJson({'id': 'g', 'type': 'wormhole'}).toDomain();
      expect(g.type, GroupType.interest);
      expect(g.createdBy, 'system');
      expect(g.memberCount, 0);
    });
  });

  group('GroupPostDto — groups/{id}/posts/{id} golden', () {
    test('decodes a post with the four post-type templates', () {
      for (final entry in {
        'share': PostType.share,
        'ask_help': PostType.askHelp,
        'celebrate': PostType.celebrate,
        'resource': PostType.resource,
      }.entries) {
        final p = GroupPostDto.fromJson({
          'id': 'p1',
          'groupId': 'g1',
          'authorUid': 'u1',
          'authorName': 'Asha',
          'content': 'hello',
          'postType': entry.key,
          'likesCount': 3,
          'commentsCount': 1,
        }).toDomain();
        expect(p.postType, entry.value);
        expect(p.likesCount, 3);
      }
    });

    test('decodes attachments + translations; unknown type → share', () {
      final p = GroupPostDto.fromJson({
        'id': 'p2',
        'groupId': 'g1',
        'authorUid': 'u1',
        'authorName': 'Asha',
        'content': 'x',
        'postType': 'mystery',
        'attachments': [
          {'type': 'image', 'url': 'https://img/1', 'title': 'photo'},
          'junk',
        ],
        'translations': {'Hindi': 'नमस्ते', 'bad': 42},
      }).toDomain();
      expect(p.postType, PostType.share);
      expect(p.attachments, hasLength(1));
      expect(p.attachments.single.url, 'https://img/1');
      expect(p.translations['Hindi'], 'नमस्ते');
      expect(p.translations.containsKey('bad'), isFalse);
    });
  });

  group('group write DTOs + responses', () {
    test('CreateGroupPostRequestDto.build sends wire postType', () {
      final json = CreateGroupPostRequestDto.build(
        groupId: 'g1',
        content: '  I tried this  ',
        postType: PostType.askHelp,
      ).toJson();
      expect(json['groupId'], 'g1');
      expect(json['content'], 'I tried this');
      expect(json['postType'], 'ask_help');
      expect(json.containsKey('attachments'), isFalse);
    });

    test('JoinGroupResponseDto decodes { joined }', () {
      expect(JoinGroupResponseDto.fromJson({'joined': true}).value, isTrue);
      expect(JoinGroupResponseDto.fromJson(<String, dynamic>{}).value, isFalse);
    });

    test('LikeResultDto decodes { isLiked, newCount }', () {
      final r = LikeResultDto.fromJson({
        'isLiked': true,
        'newCount': 5,
      }).toDomain();
      expect(r.isLiked, isTrue);
      expect(r.newCount, 5);
    });

    test('LikedItemIdsDto decodes both id lists', () {
      final ids = LikedItemIdsDto.fromJson({
        'groupPostIds': ['p1', 'p2'],
        'resourceIds': ['r1'],
      }).toDomain();
      expect(ids.likedPost('p1'), isTrue);
      expect(ids.likedResource('r1'), isTrue);
      expect(ids.likedPost('nope'), isFalse);
    });
  });

  group('ChatMessageDto — community_chat / group chat golden', () {
    test('decodes a global staff-room message', () {
      final m = ChatMessageDto.fromJson({
        'id': 'c1',
        'text': 'Anyone teaching fractions?',
        'authorId': 'u1',
        'authorName': 'Asha',
        'authorPhotoURL': 'https://img/1',
        'createdAt': '2026-07-18T10:00:00.000Z',
      }).toDomain();
      expect(m.id, 'c1');
      expect(m.text, 'Anyone teaching fractions?');
      expect(m.isDemoPersona, isFalse);
      expect(m.groupId, isNull);
    });

    test('flags an AI persona message + carries groupId for a group room', () {
      final m = ChatMessageDto.fromJson({
        'id': 'c2',
        'text': 'Try chapati cutting!',
        'authorId': 'persona-1',
        'authorName': 'Meera (AI)',
        'isDemoPersona': true,
      }).toDomain(groupId: 'g1');
      expect(m.isDemoPersona, isTrue);
      expect(m.groupId, 'g1');
    });

    test('a voice-only message has audio + empty text', () {
      final m = ChatMessageDto.fromJson({
        'id': 'c3',
        'text': '',
        'authorId': 'u1',
        'authorName': 'Asha',
        'audioUrl': 'https://firebasestorage.googleapis.com/v.mp3',
      }).toDomain();
      expect(m.hasAudio, isTrue);
      expect(m.text, '');
    });

    test(
      'SendChatMessageRequestDto.build drops groupId for the global room',
      () {
        final global = SendChatMessageRequestDto.build(text: 'hi').toJson();
        expect(global, {'text': 'hi'});
        expect(global.containsKey('groupId'), isFalse);

        final group = SendChatMessageRequestDto.build(
          text: 'hi',
          groupId: 'g1',
        ).toJson();
        expect(group['groupId'], 'g1');
      },
    );
  });

  group('CommunityPostDto — top-level posts/{id} golden', () {
    test('decodes a public post', () {
      final p = CommunityPostDto.fromJson({
        'id': 'cp1',
        'authorId': 'u1',
        'content': 'My results improved!',
        'visibility': 'public',
        'gradeLevel': 'Class 10',
        'subject': 'Mathematics',
        'likesCount': 12,
        'createdAt': '2026-07-18T10:00:00.000Z',
      }).toDomain();
      expect(p.id, 'cp1');
      expect(p.visibility, 'public');
      expect(p.likesCount, 12);
    });

    test('missing visibility defaults to public', () {
      final p = CommunityPostDto.fromJson({
        'id': 'cp2',
        'authorId': 'u1',
        'content': 'x',
      }).toDomain();
      expect(p.visibility, 'public');
    });
  });

  group('FeedItemDto — polymorphic unified feed', () {
    test('group_post carries a GroupPost payload', () {
      final f = FeedItemDto.fromJson({
        'id': 'f1',
        'type': 'group_post',
        'groupId': 'g1',
        'groupName': 'Class 8 Science',
        'timestamp': '2026-07-18T10:00:00.000Z',
        'post': {
          'id': 'p1',
          'groupId': 'g1',
          'authorUid': 'u1',
          'authorName': 'Asha',
          'content': 'hello',
          'postType': 'share',
        },
      }).toDomain();
      expect(f.type, FeedItemType.groupPost);
      expect(f.post!.content, 'hello');
      expect(f.groupName, 'Class 8 Science');
    });

    test(
      'connection_suggestion + resource_share + chat_highlight payloads',
      () {
        final conn = FeedItemDto.fromJson({
          'id': 'f2',
          'type': 'connection_suggestion',
          'connectionSuggestion': {
            'uid': 'u9',
            'displayName': 'Ravi',
            'reason': 'Same district',
            'sharedSubjects': ['Science'],
          },
        }).toDomain();
        expect(conn.type, FeedItemType.connectionSuggestion);
        expect(conn.connectionSuggestion!.reason, 'Same district');

        final res = FeedItemDto.fromJson({
          'id': 'f3',
          'type': 'resource_share',
          'resource': {
            'id': 'r1',
            'title': 'Worksheet',
            'type': 'worksheet',
            'authorName': 'Asha',
            'authorUid': 'u1',
            'likes': 4,
          },
        }).toDomain();
        expect(res.resource!.likes, 4);

        final chat = FeedItemDto.fromJson({
          'id': 'f4',
          'type': 'chat_highlight',
          'chatHighlight': {
            'groupId': 'g1',
            'groupName': 'Class 8 Science',
            'messageCount': 7,
            'latestMessage': 'See you there',
          },
        }).toDomain();
        expect(chat.chatHighlight!.messageCount, 7);
      },
    );

    test('group_suggestion carries a Group; unknown type → group_post', () {
      final f = FeedItemDto.fromJson({
        'id': 'f5',
        'type': 'group_suggestion',
        'groupSuggestion': {'id': 'g2', 'name': 'Region: Karnataka'},
      }).toDomain();
      expect(f.type, FeedItemType.groupSuggestion);
      expect(f.groupSuggestion!.name, 'Region: Karnataka');

      final unknown = FeedItemDto.fromJson({
        'id': 'f6',
        'type': 'meteor',
      }).toDomain();
      expect(unknown.type, FeedItemType.groupPost);
    });

    test('a malformed payload degrades to null, never throws', () {
      final f = FeedItemDto.fromJson({
        'id': 'f7',
        'type': 'resource_share',
        'resource': {'title': 'no id'},
      }).toDomain();
      expect(f.resource, isNull);
    });
  });

  group('connection DTOs — TWO graphs kept distinct', () {
    test('MyConnectionDataDto resolves ConnectionStatus + DM gate', () {
      final data = MyConnectionDataDto.fromJson({
        'connectedUids': ['u2'],
        'sentRequestUids': ['u3'],
        'receivedRequests': [
          {'uid': 'u4', 'requestId': 'req-4'},
          {'uid': '', 'requestId': 'bad'},
        ],
      }).toDomain();
      expect(data.statusFor('u2'), ConnectionStatus.connected);
      expect(data.isConnectedTo('u2'), isTrue); // the DM gate
      expect(data.statusFor('u3'), ConnectionStatus.pendingSent);
      expect(data.statusFor('u4'), ConnectionStatus.pendingReceived);
      expect(data.statusFor('u5'), ConnectionStatus.none);
      expect(data.requestIdFrom('u4'), 'req-4');
      // the malformed received request was dropped
      expect(data.receivedRequests, hasLength(1));
    });

    test('ConnectionRequestResponseDto maps the three statuses', () {
      expect(
        ConnectionRequestResponseDto.fromJson({'status': 'sent'}).toDomain(),
        ConnectionRequestResult.sent,
      );
      expect(
        ConnectionRequestResponseDto.fromJson({
          'status': 'already_connected',
        }).toDomain(),
        ConnectionRequestResult.alreadyConnected,
      );
      expect(
        ConnectionRequestResponseDto.fromJson({
          'status': 'already_pending',
        }).toDomain(),
        ConnectionRequestResult.alreadyPending,
      );
    });

    test(
      'FollowEdge (directed) and MutualConnection (sorted) are distinct',
      () {
        // follow doc id is NOT sorted (direction matters)
        const follow = FollowEdge(followerId: 'zeta', followingId: 'alpha');
        expect(follow.docId, 'zeta_alpha');
        // mutual connection resolves the "other" participant
        const mutual = MutualConnection(
          id: 'alpha_zeta',
          uids: ['alpha', 'zeta'],
          initiatedBy: 'alpha',
        );
        expect(mutual.other('alpha'), 'zeta');
      },
    );

    test('request DTOs send only the id fields (server-derived caller)', () {
      expect(const SendConnectionRequestDto(toUid: 'u2').toJson(), {
        'toUid': 'u2',
      });
      expect(const ConnectionRequestActionDto(requestId: 'r1').toJson(), {
        'requestId': 'r1',
      });
      expect(const DisconnectRequestDto(otherUid: 'u2').toJson(), {
        'otherUid': 'u2',
      });
      expect(const FollowTeacherRequestDto(followingId: 'u2').toJson(), {
        'followingId': 'u2',
      });
    });
  });

  group('teacher DTOs — PII discipline', () {
    test('TeacherSuggestionDto decodes the recommendation surface', () {
      final t = TeacherSuggestionDto.fromJson({
        'uid': 'u9',
        'displayName': 'Ravi Kumar',
        'schoolName': 'Govt HS',
        'subjects': ['Science', 'Maths'],
        'recommendationReason': 'Same school',
        'impactScore': 88,
      }).toDomain();
      expect(t.uid, 'u9');
      expect(t.subjects, ['Science', 'Maths']);
      expect(t.recommendationReason, 'Same school');
      expect(t.impactScore, 88);
    });

    test('PublicProfileResponseDto includes email ONLY when present', () {
      final connected = PublicProfileResponseDto.fromJson({
        'profile': {
          'id': 'u9',
          'displayName': 'Ravi',
          'subjects': ['Science'],
          'email': 'ravi@example.com',
        },
      }).toDomain();
      expect(connected!.hasEmail, isTrue);
      expect(connected.email, 'ravi@example.com');

      final stripped = PublicProfileResponseDto.fromJson({
        'profile': {'id': 'u9', 'displayName': 'Ravi'},
      }).toDomain();
      expect(stripped!.hasEmail, isFalse);
      expect(stripped.email, isNull);
    });

    test('a null profile decodes to null (target not found)', () {
      expect(
        PublicProfileResponseDto.fromJson({'profile': null}).toDomain(),
        isNull,
      );
    });
  });

  group('persona-pulse DTOs — the one real REST route', () {
    test('request serialises recentMessages + drops empties', () {
      final json = PersonaPulseRequestDto.fromDomain(
        const PersonaPulseRequest(
          recentMessages: [
            PersonaPulseContext(authorName: 'Asha', text: 'Hi all'),
          ],
          mode: 'auto',
        ),
      ).toJson();
      expect(json['mode'], 'auto');
      expect((json['recentMessages'] as List).single, {
        'authorName': 'Asha',
        'text': 'Hi all',
      });
      expect(json.containsKey('personaId'), isFalse);
    });

    test('empty recentMessages is omitted', () {
      final json = PersonaPulseRequestDto.fromDomain(
        const PersonaPulseRequest(),
      ).toJson();
      expect(json.containsKey('recentMessages'), isFalse);
    });

    test('response decodes { message, personaName, ... }', () {
      final p = PersonaPulseResponseDto.fromJson({
        'message': 'Try teaching with local examples!',
        'personaName': 'Meera',
        'personaState': 'Karnataka',
        'personaSubject': 'Science',
      }).toDomain();
      expect(p.message, 'Try teaching with local examples!');
      expect(p.personaName, 'Meera');
    });
  });
}
