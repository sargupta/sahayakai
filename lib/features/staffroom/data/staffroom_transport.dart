import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/firebase/firebase_init.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/api_providers.dart';
import '../../inbox/data/block_c_transport.dart';
import '../domain/chat_message.dart';
import '../domain/community_post.dart';
import '../domain/connection.dart';
import '../domain/group.dart';
import '../domain/persona_pulse.dart';
import '../domain/staffroom_results.dart';
import '../domain/teacher.dart';
import 'dto/chat_message_dto.dart';
import 'dto/connection_dto.dart';
import 'dto/feed_dto.dart';
import 'dto/group_dto.dart';
import 'dto/persona_pulse_dto.dart';
import 'dto/teacher_dto.dart';

part 'staffroom_transport.g.dart';

/// # StaffroomTransport — the Staffroom seam (Pillar 04)
///
/// The contract the Staffroom home, Group detail, the two chat rooms, the
/// network screen and the connection lifecycle are built against. Same split as
/// the Pro Inbox: **the two chat rooms are live Firestore `onSnapshot`s**
/// (read-only from the client); **every read and write is a REST call** over the
/// app's `ApiClient` (which attaches the Firebase bearer token) to the
/// `sahayakai-main` route handlers under `/api/groups/**`, `/api/community/**`
/// and `/api/connections/**`.
///
/// Shares [TransportSnapshot] / [TransportUnavailable] with the inbox. Each
/// method's doc names the exact route it calls.
abstract interface class StaffroomTransport {
  // ── Realtime (Firestore onSnapshot, Firebase-gated) ────────────────────────

  /// **LIVE.** The global Staff Room. Real impl:
  /// `onSnapshot(collection('community_chat') orderBy createdAt asc
  ///   limitToLast(limit))`, mapped via [ChatMessageDto].
  Stream<TransportSnapshot<List<ChatMessage>>> watchStaffRoomChat({
    int limit = 100,
  });

  /// **LIVE.** A per-group chat. Real impl:
  /// `onSnapshot(collection('groups/$groupId/chat') orderBy createdAt asc
  ///   limitToLast(limit))`, mapped via `ChatMessageDto.toDomain(groupId: groupId)`.
  /// Member-gated by `firestore.rules`.
  Stream<TransportSnapshot<List<ChatMessage>>> watchGroupChat(
    String groupId, {
    int limit = 100,
  });

  // ── Server-derived reads (REST, one-shot) ─────────────────────────────────

  /// `POST /api/groups/ensure` → `string[]` (groupIds). Idempotent
  /// auto-provisioning of the teacher's default groups; called once per session
  /// before the first groups / feed read.
  Future<List<String>> ensureUserGroups();

  /// `GET /api/groups` → the teacher's `Group[]` (lastActivityAt desc).
  Future<List<Group>> getMyGroups();

  /// `GET /api/groups/{id}` → `Group | null`. Readable by non-members.
  Future<Group?> getGroup(String groupId);

  /// `GET /api/groups/discover` → suggested, not-yet-joined groups.
  Future<List<Group>> discoverGroups();

  /// `GET /api/groups/{id}/posts?limit&startAfter`. **Member-gated**: a
  /// non-member gets a 403 (surface as the locked preview). Cursor = last postId.
  Future<List<GroupPost>> getGroupPosts(
    String groupId, {
    int limit = 20,
    String? startAfterPostId,
  });

  /// `GET /api/groups/feed?limit&startAfter` → `FeedItem[]` across the
  /// teacher's groups. Not realtime; empty when the teacher has no groups.
  Future<List<FeedItem>> getUnifiedFeed({
    int limit = 20,
    String? startAfterTimestamp,
  });

  /// `GET /api/community/teachers/recommended` ("People you may know", ≤5,
  /// 60s server cache).
  Future<List<TeacherSuggestion>> getRecommendedTeachers();

  /// `GET /api/community/teachers` (the directory; PII-stripped, rate-limited).
  Future<List<TeacherSuggestion>> getAllTeachers();

  /// `GET /api/profile/public/{uid}` → `PublicProfile | null`. **email present
  /// only if mutually connected** (server-enforced). Flutter must NEVER read
  /// `users/*` directly.
  Future<PublicProfile?> getPublicProfile(String uid);

  /// `GET /api/community/likes` → `{ groupPostIds[], resourceIds[] }`.
  /// Hydrates filled hearts on mount.
  Future<LikedItemIds> getLikedItemIds();

  /// `GET /api/connections/mine` — the one-round-trip bundle that resolves
  /// every teacher's [ConnectionStatus] (and the DM gate).
  Future<MyConnectionData> getMyConnectionData();

  // ── Writes (REST) ──────────────────────────────────────────────────────────

  /// `POST /api/groups/{id}/membership` → `{ joined }` (false = already a
  /// member; idempotent).
  Future<bool> joinGroup(String groupId);

  /// `DELETE /api/groups/{id}/membership`.
  Future<void> leaveGroup(String groupId);

  /// `POST /api/groups/{id}/posts` `{ content, postType, attachments? }` →
  /// postId. Rate-limited (429); member-gated (403); content 1–2000 chars; ≤5
  /// attachments.
  Future<String> createGroupPost({
    required String groupId,
    required String content,
    required PostType postType,
    List<Map<String, dynamic>> attachments = const <Map<String, dynamic>>[],
  });

  /// `POST /api/groups/{id}/posts/{postId}/like` → `{ isLiked, newCount }`.
  /// Transactional toggle — apply optimistically, then reconcile against this
  /// authoritative reply (roll back on error).
  Future<LikeResult> likeGroupPost(String groupId, String postId);

  /// `POST /api/groups/{id}/chat` `{ text, audioUrl? }` → msgId. Member-gated;
  /// rate-limited; text ≤500; audioUrl must be Firebase Storage https.
  Future<String> sendGroupChatMessage(
    String groupId, {
    required String text,
    String? audioUrl,
  });

  /// `POST /api/community/chat` `{ text, audioUrl? }` (writes the global
  /// `community_chat` with the server-derived author; rate-limited).
  Future<void> sendCommunityChatMessage({
    required String text,
    String? audioUrl,
  });

  /// `POST /api/connections/request` `{ toUid }` →
  /// `{ status: 'sent' | 'already_connected' | 'already_pending' }`.
  Future<ConnectionRequestResult> sendConnectionRequest(String toUid);

  /// `POST /api/connections/request/accept` `{ requestId }` (recipient only).
  Future<void> acceptConnectionRequest(String requestId);

  /// `POST /api/connections/request/decline` `{ requestId }` (either party).
  Future<void> declineConnectionRequest(String requestId);

  /// `POST /api/connections/disconnect` `{ otherUid }`.
  Future<void> disconnect(String otherUid);

  /// `POST /api/community/follows` `{ followingId }` — the **directed follow**
  /// graph (distinct from the mutual connection graph; does NOT unlock the DM).
  Future<void> followTeacher(String followingId);

  /// `POST /api/community/persona-pulse` — the demo AI-teacher heartbeat.
  /// Returns the [PersonaPulse] on 200, or **null** on a 503 (the
  /// `communityPersonas` flag is off) — a null means "permanently disarm the
  /// polling timer for this session" (web parity), NOT an error.
  Future<PersonaPulse?> triggerPersonaPulse(PersonaPulseRequest request);
}

/// The default, **Firebase-free** implementation (U-SI0). Keeps the APK green
/// (no Firebase import, no socket): the two chat streams emit one
/// `awaitingFirebase` snapshot, the server-derived reads return empty/null, and
/// the writes throw a typed [TransportUnavailable]. [triggerPersonaPulse] returns
/// `null` (the 503-equivalent stop signal) so a persona-pulse timer simply never
/// arms while deferred — quietly, without an error.
class DeferredStaffroomTransport implements StaffroomTransport {
  const DeferredStaffroomTransport();

  @override
  Stream<TransportSnapshot<List<ChatMessage>>> watchStaffRoomChat({
    int limit = 100,
  }) =>
      Stream<TransportSnapshot<List<ChatMessage>>>.value(
        const TransportSnapshot<List<ChatMessage>>.awaitingFirebase(
          <ChatMessage>[],
        ),
      );

  @override
  Stream<TransportSnapshot<List<ChatMessage>>> watchGroupChat(
    String groupId, {
    int limit = 100,
  }) =>
      Stream<TransportSnapshot<List<ChatMessage>>>.value(
        const TransportSnapshot<List<ChatMessage>>.awaitingFirebase(
          <ChatMessage>[],
        ),
      );

  @override
  Future<List<String>> ensureUserGroups() async => const <String>[];

  @override
  Future<List<Group>> getMyGroups() async => const <Group>[];

  @override
  Future<Group?> getGroup(String groupId) async => null;

  @override
  Future<List<Group>> discoverGroups() async => const <Group>[];

  @override
  Future<List<GroupPost>> getGroupPosts(
    String groupId, {
    int limit = 20,
    String? startAfterPostId,
  }) async =>
      const <GroupPost>[];

  @override
  Future<List<FeedItem>> getUnifiedFeed({
    int limit = 20,
    String? startAfterTimestamp,
  }) async =>
      const <FeedItem>[];

  @override
  Future<List<TeacherSuggestion>> getRecommendedTeachers() async =>
      const <TeacherSuggestion>[];

  @override
  Future<List<TeacherSuggestion>> getAllTeachers() async =>
      const <TeacherSuggestion>[];

  @override
  Future<PublicProfile?> getPublicProfile(String uid) async => null;

  @override
  Future<LikedItemIds> getLikedItemIds() async => const LikedItemIds();

  @override
  Future<MyConnectionData> getMyConnectionData() async =>
      const MyConnectionData();

  @override
  Future<bool> joinGroup(String groupId) async =>
      throw const TransportUnavailable.awaitingFirebase('joinGroup');

  @override
  Future<void> leaveGroup(String groupId) async =>
      throw const TransportUnavailable.awaitingFirebase('leaveGroup');

  @override
  Future<String> createGroupPost({
    required String groupId,
    required String content,
    required PostType postType,
    List<Map<String, dynamic>> attachments = const <Map<String, dynamic>>[],
  }) async =>
      throw const TransportUnavailable.awaitingFirebase('createGroupPost');

  @override
  Future<LikeResult> likeGroupPost(String groupId, String postId) async =>
      throw const TransportUnavailable.awaitingFirebase('likeGroupPost');

  @override
  Future<String> sendGroupChatMessage(
    String groupId, {
    required String text,
    String? audioUrl,
  }) async =>
      throw const TransportUnavailable.awaitingFirebase('sendGroupChatMessage');

  @override
  Future<void> sendCommunityChatMessage({
    required String text,
    String? audioUrl,
  }) async =>
      throw const TransportUnavailable.awaitingFirebase(
        'sendCommunityChatMessage',
      );

  @override
  Future<ConnectionRequestResult> sendConnectionRequest(String toUid) async =>
      throw const TransportUnavailable.awaitingFirebase(
        'sendConnectionRequest',
      );

  @override
  Future<void> acceptConnectionRequest(String requestId) async =>
      throw const TransportUnavailable.awaitingFirebase(
        'acceptConnectionRequest',
      );

  @override
  Future<void> declineConnectionRequest(String requestId) async =>
      throw const TransportUnavailable.awaitingFirebase(
        'declineConnectionRequest',
      );

  @override
  Future<void> disconnect(String otherUid) async =>
      throw const TransportUnavailable.awaitingFirebase('disconnect');

  @override
  Future<void> followTeacher(String followingId) async =>
      throw const TransportUnavailable.awaitingFirebase('followTeacher');

  @override
  Future<PersonaPulse?> triggerPersonaPulse(
    PersonaPulseRequest request,
  ) async =>
      // 503-equivalent: the demo heartbeat is off while deferred, so the timer
      // never arms. Not an error — quietly disarmed (web parity).
      null;
}

/// Thrown by [StaffroomTransport.sendCommunityChatMessage] and
/// [StaffroomTransport.sendGroupChatMessage] when the trimmed text exceeds the
/// 500-character cap both chat services enforce server-side and no audio URL is
/// present. Checked **client-side, before the request**, so a too-long message
/// fails with a clear typed error instead of a 400 round-trip.
///
/// **Characters, matching the production web app** (`String.length`, UTF-16
/// code units) — not UTF-8 bytes, which would under-cut the real limit about
/// 3x for Indic scripts.
class ChatMessageTooLongException implements Exception {
  const ChatMessageTooLongException(this.length);

  /// The 500-character cap this exception is thrown against.
  static const int maxLength = 500;

  /// The (too-long) trimmed text's length in UTF-16 code units, matching the
  /// web's `String.length` cap. See class doc.
  final int length;

  @override
  String toString() => 'ChatMessageTooLongException: $length characters '
      'exceeds the $maxLength-character cap.';
}

/// The live Staffroom transport, bound for a real signed-in teacher.
///
/// **Reads that must be live** — the global Staff Room (`community_chat`) and a
/// group chat (`groups/{id}/chat`) — are Firestore `onSnapshot`s, allowed by
/// `firestore.rules` (any signed-in teacher for `community_chat`; members only
/// for a group's `chat`). A permission-denied or missing-index failure surfaces
/// as a [TransportSnapshot.error], never a silent hang.
///
/// **Everything else** goes through [ApiClient] to the deployed route handlers,
/// matching each handler's zod body and response shape exactly:
///
/// | method | route |
/// |---|---|
/// | [ensureUserGroups] | `POST /api/groups/ensure` → `string[]` |
/// | [getMyGroups] | `GET /api/groups` → `Group[]` |
/// | [discoverGroups] | `GET /api/groups/discover` → `Group[]` |
/// | [getGroup] | `GET /api/groups/{id}` → `Group \| null` |
/// | [getGroupPosts] | `GET /api/groups/{id}/posts?limit&startAfter` (403 for non-members) |
/// | [createGroupPost] | `POST /api/groups/{id}/posts {content, postType, attachments?}` → `{id}` |
/// | [likeGroupPost] | `POST /api/groups/{id}/posts/{postId}/like` → `{isLiked, newCount}` |
/// | [joinGroup] | `POST /api/groups/{id}/membership` → `{joined}` |
/// | [sendGroupChatMessage] | `POST /api/groups/{id}/chat {text, audioUrl?}` → `{id}` |
/// | [getUnifiedFeed] | `GET /api/groups/feed?limit&startAfter` → `FeedItem[]` |
/// | [sendCommunityChatMessage] | `POST /api/community/chat {text, audioUrl?}` → `{ok}` |
/// | [getRecommendedTeachers] | `GET /api/community/teachers/recommended` |
/// | [getAllTeachers] | `GET /api/community/teachers` |
/// | [getLikedItemIds] | `GET /api/community/likes` |
/// | [followTeacher] | `POST /api/community/follows {followingId}` |
/// | [getPublicProfile] | `GET /api/profile/public/{uid}` → `{profile}` |
/// | [getMyConnectionData] | `GET /api/connections/mine` |
/// | [sendConnectionRequest] | `POST /api/connections/request {toUid}` → `{status}` |
/// | [acceptConnectionRequest] | `POST /api/connections/request/accept {requestId}` |
/// | [declineConnectionRequest] | `POST /api/connections/request/decline {requestId}` |
/// | [disconnect] | `POST /api/connections/disconnect {otherUid}` |
/// | [triggerPersonaPulse] | `POST /api/community/persona-pulse` (null on 503) |
///
/// Author identity, display name and photo for posts and chat messages are
/// derived **server-side** from the verified uid — the client never sends them.
/// Rate-limited routes answer 429 (`Rate limit exceeded. Please wait N
/// minutes.`); that surfaces as an [ApiException] of kind
/// [ApiErrorKind.rateLimited] for the UI to translate.
///
/// [leaveGroup] is the one exception: its route is `DELETE
/// /api/groups/{id}/membership`, and [ApiClient] exposes no DELETE verb, so it
/// throws a typed [TransportUnavailable] (`restWrapperMissing`). No screen
/// offers "Leave" until the client gains that verb.
class FirestoreStaffroomTransport implements StaffroomTransport {
  FirestoreStaffroomTransport(this._firestore, this._apiClient);

  final FirebaseFirestore _firestore;
  final ApiClient _apiClient;

  CollectionReference<Map<String, dynamic>> get _communityChat =>
      _firestore.collection('community_chat');

  static String _group(String groupId) =>
      '/api/groups/${Uri.encodeComponent(groupId)}';

  // ── LIVE: the two chat rooms ─────────────────────────────────────────────

  @override
  Stream<TransportSnapshot<List<ChatMessage>>> watchStaffRoomChat({
    int limit = 100,
  }) =>
      _watchChat(_communityChat, limit: limit);

  @override
  Stream<TransportSnapshot<List<ChatMessage>>> watchGroupChat(
    String groupId, {
    int limit = 100,
  }) =>
      _watchChat(
        _firestore.collection('groups').doc(groupId).collection('chat'),
        limit: limit,
        groupId: groupId,
      );

  Stream<TransportSnapshot<List<ChatMessage>>> _watchChat(
    CollectionReference<Map<String, dynamic>> collection, {
    required int limit,
    String? groupId,
  }) async* {
    final query = collection.orderBy('createdAt').limitToLast(limit);
    var last = const <ChatMessage>[];
    try {
      await for (final snapshot in query.snapshots()) {
        last = snapshot.docs
            .map(
              (doc) => ChatMessageDto.fromJson(_withId(doc))
                  .toDomain(groupId: groupId),
            )
            .toList(growable: false);
        yield TransportSnapshot<List<ChatMessage>>.ready(last);
      }
    } catch (error) {
      // Missing index / permission-denied (a non-member on a group chat) MUST
      // surface here, never a silent hang.
      yield TransportSnapshot<List<ChatMessage>>.error(last, error);
    }
  }

  /// `{ 'id': doc.id, ...doc.data() }`, with `createdAt` converted from a raw
  /// `Timestamp` to millis first — [ChatMessageDto]'s `createdAt` goes through
  /// `wireTimeToIso`, which does not understand a raw `Timestamp` object.
  static Map<String, dynamic> _withId(
    QueryDocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = Map<String, dynamic>.from(doc.data());
    final createdAt = data['createdAt'];
    if (createdAt is Timestamp) {
      data['createdAt'] = createdAt.millisecondsSinceEpoch;
    }
    return <String, dynamic>{'id': doc.id, ...data};
  }

  // ── Chat sends (REST) ────────────────────────────────────────────────────

  @override
  Future<void> sendCommunityChatMessage({
    required String text,
    String? audioUrl,
  }) async {
    final body = _chatBody(text, audioUrl);
    await _apiClient.post<void>(
      '/api/community/chat',
      data: body,
      decode: (_) {},
    );
  }

  @override
  Future<String> sendGroupChatMessage(
    String groupId, {
    required String text,
    String? audioUrl,
  }) async {
    final body = _chatBody(text, audioUrl);
    return _apiClient.post<String>(
      '${_group(groupId)}/chat',
      data: body,
      decode: (json) => (json['id'] as String?)?.trim() ?? '',
    );
  }

  /// `{ text, audioUrl? }` — both chat routes' zod body. The 500-character cap
  /// both services enforce (`Message too long` / `must be 500 characters or
  /// less`) is pre-checked here in characters (`String.length`, the web's unit)
  /// so an over-long message fails with a typed error instead of a 400.
  static Map<String, dynamic> _chatBody(String text, String? audioUrl) {
    final trimmedText = text.trim();
    final trimmedAudio = audioUrl?.trim();
    final hasAudio = trimmedAudio != null && trimmedAudio.isNotEmpty;
    if (!hasAudio &&
        trimmedText.length > ChatMessageTooLongException.maxLength) {
      throw ChatMessageTooLongException(trimmedText.length);
    }
    return <String, dynamic>{
      'text': trimmedText,
      if (hasAudio) 'audioUrl': trimmedAudio,
    };
  }

  // ── Groups ───────────────────────────────────────────────────────────────

  @override
  Future<List<String>> ensureUserGroups() async {
    // The route answers a bare JSON array, which [ApiClient.post] (a
    // Map-decoding verb) cannot hand back — so read it raw and decode here.
    final raw = await _apiClient.postRaw('/api/groups/ensure');
    final decoded = raw.bytes.isEmpty ? null : jsonDecode(utf8.decode(raw.bytes));
    if (decoded is! List) {
      throw const FormatException('POST /api/groups/ensure: expected an array');
    }
    return decoded
        .whereType<String>()
        .map((id) => id.trim())
        .where((id) => id.isNotEmpty)
        .toList(growable: false);
  }

  @override
  Future<List<Group>> getMyGroups() => _apiClient.get<List<Group>>(
        '/api/groups',
        decode: (json) => _list(json, '/api/groups', _decodeGroup),
      );

  @override
  Future<List<Group>> discoverGroups() => _apiClient.get<List<Group>>(
        '/api/groups/discover',
        decode: (json) => _list(json, '/api/groups/discover', _decodeGroup),
      );

  @override
  Future<Group?> getGroup(String groupId) => _apiClient.get<Group?>(
        _group(groupId),
        decode: (json) => json is Map ? _decodeGroup(json.cast()) : null,
      );

  static Group? _decodeGroup(Map<String, dynamic> json) {
    final group = GroupDto.fromJson(json).toDomain();
    return group.id.isEmpty ? null : group;
  }

  @override
  Future<List<GroupPost>> getGroupPosts(
    String groupId, {
    int limit = 20,
    String? startAfterPostId,
  }) =>
      _apiClient.get<List<GroupPost>>(
        '${_group(groupId)}/posts',
        query: <String, dynamic>{
          'limit': '$limit',
          if (startAfterPostId != null && startAfterPostId.isNotEmpty)
            'startAfter': startAfterPostId,
        },
        decode: (json) => _list(json, 'group posts', (m) {
          final post = GroupPostDto.fromJson(m).toDomain();
          return post.id.isEmpty ? null : post;
        }),
      );

  @override
  Future<List<FeedItem>> getUnifiedFeed({
    int limit = 20,
    String? startAfterTimestamp,
  }) =>
      _apiClient.get<List<FeedItem>>(
        '/api/groups/feed',
        query: <String, dynamic>{
          'limit': '$limit',
          if (startAfterTimestamp != null && startAfterTimestamp.isNotEmpty)
            'startAfter': startAfterTimestamp,
        },
        decode: (json) => _list(json, '/api/groups/feed', (m) {
          final item = FeedItemDto.fromJson(m).toDomain();
          // A group post with no decodable payload has nothing to render.
          if (item.type == FeedItemType.groupPost && item.post == null) {
            return null;
          }
          return item;
        }),
      );

  @override
  Future<bool> joinGroup(String groupId) => _apiClient.post<bool>(
        '${_group(groupId)}/membership',
        decode: (json) => JoinGroupResponseDto.fromJson(json).value,
      );

  @override
  Future<void> leaveGroup(String groupId) async => throw const TransportUnavailable(
        TransportUnavailableKind.restWrapperMissing,
        surface: 'leaveGroup',
        message: 'DELETE /api/groups/{id}/membership needs a DELETE verb that '
            'ApiClient does not expose yet.',
      );

  @override
  Future<String> createGroupPost({
    required String groupId,
    required String content,
    required PostType postType,
    List<Map<String, dynamic>> attachments = const <Map<String, dynamic>>[],
  }) =>
      _apiClient.post<String>(
        '${_group(groupId)}/posts',
        // The route's CreateSchema: { content, postType, attachments? }. The
        // group comes from the path; the author from the verified uid.
        data: <String, dynamic>{
          'content': content.trim(),
          'postType': postType.wire,
          if (attachments.isNotEmpty) 'attachments': attachments,
        },
        decode: (json) => (json['id'] as String?)?.trim() ?? '',
      );

  @override
  Future<LikeResult> likeGroupPost(String groupId, String postId) =>
      _apiClient.post<LikeResult>(
        '${_group(groupId)}/posts/${Uri.encodeComponent(postId)}/like',
        decode: (json) => LikeResultDto.fromJson(json).toDomain(),
      );

  // ── Community ────────────────────────────────────────────────────────────

  @override
  Future<List<TeacherSuggestion>> getRecommendedTeachers() =>
      _apiClient.get<List<TeacherSuggestion>>(
        '/api/community/teachers/recommended',
        decode: (json) => _list(json, 'recommended teachers', _decodeTeacher),
      );

  @override
  Future<List<TeacherSuggestion>> getAllTeachers() =>
      _apiClient.get<List<TeacherSuggestion>>(
        '/api/community/teachers',
        decode: (json) => _list(json, 'teachers', _decodeTeacher),
      );

  static TeacherSuggestion? _decodeTeacher(Map<String, dynamic> json) {
    final teacher = TeacherSuggestionDto.fromJson(json).toDomain();
    return teacher.uid.isEmpty ? null : teacher;
  }

  @override
  Future<PublicProfile?> getPublicProfile(String uid) =>
      _apiClient.get<PublicProfile?>(
        '/api/profile/public/${Uri.encodeComponent(uid)}',
        decode: (json) => json is Map
            ? PublicProfileResponseDto.fromJson(json.cast()).toDomain()
            : null,
      );

  @override
  Future<LikedItemIds> getLikedItemIds() => _apiClient.get<LikedItemIds>(
        '/api/community/likes',
        decode: (json) => json is Map
            ? LikedItemIdsDto.fromJson(json.cast()).toDomain()
            : const LikedItemIds(),
      );

  @override
  Future<void> followTeacher(String followingId) => _apiClient.post<void>(
        '/api/community/follows',
        data: FollowTeacherRequestDto(followingId: followingId).toJson(),
        decode: (_) {},
      );

  // ── Connections ──────────────────────────────────────────────────────────

  @override
  Future<MyConnectionData> getMyConnectionData() =>
      _apiClient.get<MyConnectionData>(
        '/api/connections/mine',
        decode: (json) {
          if (json is! Map) {
            throw const FormatException(
              'GET /api/connections/mine: expected an object',
            );
          }
          return MyConnectionDataDto.fromJson(json.cast()).toDomain();
        },
      );

  @override
  Future<ConnectionRequestResult> sendConnectionRequest(String toUid) =>
      _apiClient.post<ConnectionRequestResult>(
        '/api/connections/request',
        data: SendConnectionRequestDto(toUid: toUid).toJson(),
        decode: (json) => ConnectionRequestResponseDto.fromJson(json).toDomain(),
      );

  @override
  Future<void> acceptConnectionRequest(String requestId) =>
      _apiClient.post<void>(
        '/api/connections/request/accept',
        data: ConnectionRequestActionDto(requestId: requestId).toJson(),
        decode: (_) {},
      );

  @override
  Future<void> declineConnectionRequest(String requestId) =>
      _apiClient.post<void>(
        '/api/connections/request/decline',
        data: ConnectionRequestActionDto(requestId: requestId).toJson(),
        decode: (_) {},
      );

  @override
  Future<void> disconnect(String otherUid) => _apiClient.post<void>(
        '/api/connections/disconnect',
        data: DisconnectRequestDto(otherUid: otherUid).toJson(),
        decode: (_) {},
      );

  // ── Persona pulse ────────────────────────────────────────────────────────

  @override
  Future<PersonaPulse?> triggerPersonaPulse(
    PersonaPulseRequest request,
  ) async {
    try {
      final response = await _apiClient.post<PersonaPulseResponseDto>(
        '/api/community/persona-pulse',
        data: PersonaPulseRequestDto.fromDomain(request).toJson(),
        decode: PersonaPulseResponseDto.fromJson,
      );
      return response.toDomain();
    } on ApiException catch (e) {
      // A 503 means the communityPersonas flag is off — the transport models
      // that as null (a stop signal, NOT an error), matching the deferred
      // seam's contract; every other status propagates as itself.
      if (e.statusCode == 503) return null;
      rethrow;
    }
  }

  /// Decodes a JSON array route reply. A non-array body is a contract break
  /// and throws (so the screen shows its error state rather than a false
  /// "empty"); individual rows that fail to decode are dropped.
  static List<T> _list<T>(
    dynamic json,
    String route,
    T? Function(Map<String, dynamic> row) decode,
  ) {
    if (json is! List) {
      throw FormatException('$route: expected a JSON array');
    }
    return <T>[
      for (final row in json)
        if (row is Map) ?decode(row.cast<String, dynamic>()),
    ];
  }
}

/// The Staffroom transport. [FirestoreStaffroomTransport] once Firebase is
/// configured **and** a real teacher is signed in; [DeferredStaffroomTransport]
/// otherwise — including a genuinely signed-out teacher, so the signed-out UI
/// renders. Mirrors `inboxTransportProvider`'s branch on
/// [authControllerProvider] (`core/auth/auth_providers.dart`).
@Riverpod(keepAlive: true)
StaffroomTransport staffroomTransport(Ref ref) {
  if (!FirebaseInit.isConfigured) return const DeferredStaffroomTransport();
  final status = ref.watch(authControllerProvider);
  if (status != AuthStatus.signedIn) return const DeferredStaffroomTransport();
  if (FirebaseAuth.instance.currentUser == null) {
    return const DeferredStaffroomTransport();
  }
  return FirestoreStaffroomTransport(
    FirebaseFirestore.instance,
    ref.watch(apiClientProvider),
  );
}
