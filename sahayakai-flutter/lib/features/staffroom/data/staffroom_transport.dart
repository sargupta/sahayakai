import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/firebase/firebase_init.dart';
import '../../inbox/data/block_c_transport.dart';
import '../domain/chat_message.dart';
import '../domain/community_post.dart';
import '../domain/connection.dart';
import '../domain/group.dart';
import '../domain/persona_pulse.dart';
import '../domain/staffroom_results.dart';
import '../domain/teacher.dart';

part 'staffroom_transport.g.dart';

/// # StaffroomTransport — the Staffroom seam (Pillar 04)
///
/// The contract U-SI2..U-SI4 build the Staffroom home, Group detail, Staff Room
/// chat, directory, and connection lifecycle against. Same split as the Pro
/// Inbox (SPEC §0): **two chat rooms are live Firestore `onSnapshot`s**;
/// **everything else is a REST wrapper** over the existing server actions (groups
/// / community / connections). One route — `triggerPersonaPulse` — is the single
/// already-deployed REST endpoint.
///
/// Shares [TransportSnapshot] / [TransportUnavailable] with the inbox (Block C is
/// one block). Each method's doc names the exact Firestore query / server action
/// the real impl must satisfy.
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

  // ── Server-derived reads (REST wrappers; one-shot / poll) ──────────────────

  /// REST wrapper of `ensureUserGroupsAction()` → `string[]` (groupIds).
  /// Idempotent; call once on Staffroom first-open.
  Future<List<String>> ensureUserGroups();

  /// REST wrapper of `getMyGroupsAction()` → `Group[]`.
  Future<List<Group>> getMyGroups();

  /// REST wrapper of `getGroupAction(groupId)` → `Group | null`.
  Future<Group?> getGroup(String groupId);

  /// REST wrapper of `discoverGroupsAction()` → suggested (not-yet-joined) groups.
  Future<List<Group>> discoverGroups();

  /// REST wrapper of `getGroupPostsAction(groupId, limit, startAfter?)`.
  /// **Member-gated** (throws Forbidden if not a member — surface as a locked
  /// preview). Cursor = last postId.
  Future<List<GroupPost>> getGroupPosts(
    String groupId, {
    int limit = 20,
    String? startAfterPostId,
  });

  /// REST wrapper of `getUnifiedFeedAction(limit, startAfterTimestamp?)`. NOT
  /// realtime (focus + 45s poll upstream); empty if the user has no groups.
  Future<List<FeedItem>> getUnifiedFeed({
    int limit = 20,
    String? startAfterTimestamp,
  });

  /// REST wrapper of `getRecommendedTeachersAction()` ("People You May Know",
  /// ≤5, 60s server cache).
  Future<List<TeacherSuggestion>> getRecommendedTeachers();

  /// REST wrapper of `getAllTeachersAction()` (the directory; PII-stripped,
  /// rate-limited).
  Future<List<TeacherSuggestion>> getAllTeachers();

  /// REST wrapper of `getPublicProfileAction(uid)` → `PublicProfile | null`.
  /// **email present only if mutually connected** (server-enforced). Flutter must
  /// NEVER read `users/*` directly — go through this or the harvest hole reopens.
  Future<PublicProfile?> getPublicProfile(String uid);

  /// REST wrapper of `getLikedItemIdsAction()` → `{ groupPostIds[], resourceIds[] }`.
  /// Hydrates filled hearts on mount.
  Future<LikedItemIds> getLikedItemIds();

  /// REST wrapper of `getMyConnectionDataAction()` — the one-round-trip bundle
  /// that resolves every teacher's [ConnectionStatus] (and the DM gate).
  Future<MyConnectionData> getMyConnectionData();

  // ── Writes (REST wrappers over server actions) ─────────────────────────────

  /// REST wrapper of `joinGroupAction(groupId)` → `{ joined }`.
  Future<bool> joinGroup(String groupId);

  /// REST wrapper of `leaveGroupAction(groupId)`.
  Future<void> leaveGroup(String groupId);

  /// REST wrapper of `createGroupPostAction(groupId, content, postType,
  /// attachments)` → postId. Rate-limited; member-gated; content ≤2000; ≤5
  /// attachments.
  Future<String> createGroupPost({
    required String groupId,
    required String content,
    required PostType postType,
    List<Map<String, dynamic>> attachments = const <Map<String, dynamic>>[],
  });

  /// REST wrapper of `likeGroupPostAction(groupId, postId)` →
  /// `{ isLiked, newCount }`. Transactional toggle — apply optimistically, then
  /// reconcile against this authoritative reply (roll back on error).
  Future<LikeResult> likeGroupPost(String groupId, String postId);

  /// REST wrapper of `sendGroupChatMessageAction(groupId, text, audioUrl?)` →
  /// msgId. Member-gated; text ≤500; audioUrl must be Firebase Storage https.
  Future<String> sendGroupChatMessage(
    String groupId, {
    required String text,
    String? audioUrl,
  });

  /// REST wrapper of `sendChatMessageAction(text, audioUrl?)` → void (writes the
  /// global `community_chat`; triggers the AI reactive reply server-side).
  Future<void> sendCommunityChatMessage({
    required String text,
    String? audioUrl,
  });

  /// REST wrapper of `sendConnectionRequestAction(toUid)` →
  /// `{ status: 'sent' | 'already_connected' | 'already_pending' }`.
  Future<ConnectionRequestResult> sendConnectionRequest(String toUid);

  /// REST wrapper of `acceptConnectionRequestAction(requestId)` (recipient only).
  Future<void> acceptConnectionRequest(String requestId);

  /// REST wrapper of `declineConnectionRequestAction(requestId)` (either party).
  Future<void> declineConnectionRequest(String requestId);

  /// REST wrapper of `disconnectAction(otherUid)`.
  Future<void> disconnect(String otherUid);

  /// REST wrapper of `followTeacherAction(followingId)` — the **directed follow**
  /// graph (distinct from the mutual connection graph; does NOT unlock the DM).
  Future<void> followTeacher(String followingId);

  // ── Real REST route (already deployed) ─────────────────────────────────────

  /// `POST /api/community/persona-pulse` — the demo AI-teacher heartbeat. The
  /// **only already-deployed** Block-C route (reachable via the existing Dio
  /// `ApiClient` today). Returns the [PersonaPulse] on 200, or **null** on a 503
  /// (the `communityPersonas` flag is off) — a null means "permanently disarm the
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

@Riverpod(keepAlive: true)
StaffroomTransport staffroomTransport(Ref ref) {
  if (FirebaseInit.isConfigured) {
    throw StateError(
      'Firebase is configured but the live StaffroomTransport is not wired. Bind '
      'FirestoreStaffroomTransport in staffroomTransport() (cloud_firestore chat '
      'reads + Dio REST-wrapper reads/writes) as part of the Block C handoff — '
      'see docs/flutter/HANDOFF.md.',
    );
  }
  return const DeferredStaffroomTransport();
}
