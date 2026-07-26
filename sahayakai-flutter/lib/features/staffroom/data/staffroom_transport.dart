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
import 'dto/persona_pulse_dto.dart';

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

/// Thrown by [StaffroomTransport.sendCommunityChatMessage] (and reserved for
/// the future group-chat send) when [text] exceeds the 500-**byte** cap
/// `community_chat`'s `create` rule enforces (`firestore.rules:139-145`) and
/// no [audioUrl] is present to bypass it (the rule's
/// `text.size() <= 500 || audioUrl is string` clause). Checked **client-side,
/// before the write**, so a too-long message fails with a clear typed error
/// instead of the raw `PERMISSION_DENIED` the rule would otherwise produce.
///
/// **Bytes, not characters.** Firestore rules' `string.size()` counts UTF-8
/// bytes, not Dart's UTF-16 code-unit `.length` — for this app's Indic
/// scripts (Bengali/Hindi/Tamil/Devanagari etc, all 3 bytes/char in UTF-8) a
/// message well under 500 *characters* can still exceed 500 *bytes*. Checking
/// `.length` here would let exactly that message through the client guard
/// and still fail server-side with a raw `PERMISSION_DENIED` — the silent/
/// confusing failure this guard exists to prevent, on the one script family
/// this app is built for. [length] is therefore the UTF-8 byte count.
class ChatMessageTooLongException implements Exception {
  const ChatMessageTooLongException(this.length);

  /// The 500-byte cap this exception is thrown against.
  static const int maxLength = 500;

  /// The (too-long) trimmed text's UTF-8 byte length that triggered this —
  /// NOT its `String.length` (UTF-16 code units). See class doc.
  final int length;

  @override
  String toString() => 'ChatMessageTooLongException: $length bytes exceeds '
      'the $maxLength-byte cap.';
}

/// The live Staff Room transport (T1-U5): a real `cloud_firestore`
/// `community_chat` read/write pair, checked directly against
/// `firestore.rules:139-145` (quoted below — not assumed), plus the one
/// already-deployed REST route (`triggerPersonaPulse`) reached via the
/// existing Dio [ApiClient]. Every other method is intentionally left exactly
/// as [DeferredStaffroomTransport] left it — same body, same
/// [TransportUnavailable] / empty-list behavior — because none of them has a
/// matching REST route yet (`sahayakai-main/src/app/api` has none besides
/// `persona-pulse`) and several depend on server-side logic (PII-stripping
/// the teacher directory, group-membership validation) that must not move to
/// raw client Firestore reads even where a rule might technically permit one.
/// Groups/Directory/Feed get a real backend punch-list in Tranche 3, not a
/// client-side workaround here.
///
/// Bound only for a real signed-in teacher ([staffroomTransportProvider]
/// falls back to [DeferredStaffroomTransport] otherwise), so `_uid` is always
/// the verified Firebase Auth uid — matching `request.auth.uid` in the rule
/// below, never a client-supplied value (same discipline as
/// `FirestoreInboxTransport`).
///
/// **The `community_chat/{messageId}` rule, verbatim:**
/// ```
/// allow read: if isSignedIn();
/// allow create: if isSignedIn()
///   && request.resource.data.authorId == request.auth.uid
///   && (request.resource.data.text.size() <= 500
///       || request.resource.data.audioUrl is string);
/// allow update, delete: if false;
/// ```
/// [watchStaffRoomChat] relies only on `read` (unconditional for any signed-in
/// teacher — a global room, not a membership-gated one). [sendCommunityChatMessage]
/// relies only on `create`, writing `authorId: _uid` and pre-checking the
/// 500-char cap itself ([ChatMessageTooLongException]) so a too-long message
/// never round-trips to the rule just to be denied. `update`/`delete` are
/// `false` — this class never attempts either, matching the rule exactly.
class FirestoreStaffroomTransport implements StaffroomTransport {
  /// [myDisplayName] / [myPhotoURL] are the caller's own Firebase Auth
  /// profile, resolved once by [staffroomTransportProvider] at bind time and
  /// passed in — rather than this class reaching for `FirebaseAuth.instance`
  /// itself — so it needs nothing but a uid + a `FirebaseFirestore` to run the
  /// chat surface (including under `fake_cloud_firestore`, which has no
  /// Firebase Auth counterpart to fake against). [apiClient] backs only
  /// [triggerPersonaPulse] — the one method that is a real REST call, not a
  /// Firestore read/write.
  FirestoreStaffroomTransport(
    this._firestore,
    this._uid,
    this._apiClient, {
    String? myDisplayName,
    this.myPhotoURL,
  }) : myDisplayName = (myDisplayName?.trim().isNotEmpty ?? false)
            ? myDisplayName!.trim()
            : 'Teacher';

  final FirebaseFirestore _firestore;
  final String _uid;
  final ApiClient _apiClient;
  final String myDisplayName;
  final String? myPhotoURL;

  CollectionReference<Map<String, dynamic>> get _communityChat =>
      _firestore.collection('community_chat');

  // ── LIVE: the global Staff Room ─────────────────────────────────────────

  @override
  Stream<TransportSnapshot<List<ChatMessage>>> watchStaffRoomChat({
    int limit = 100,
  }) async* {
    final query =
        _communityChat.orderBy('createdAt').limitToLast(limit);
    var last = const <ChatMessage>[];
    try {
      await for (final snapshot in query.snapshots()) {
        last = _toChatMessages(snapshot);
        yield TransportSnapshot<List<ChatMessage>>.ready(last);
      }
    } catch (error) {
      // Missing index / permission-denied MUST surface here, never a silent
      // hang — same discipline as FirestoreInboxTransport.watchInbox.
      yield TransportSnapshot<List<ChatMessage>>.error(last, error);
    }
  }

  @override
  Future<void> sendCommunityChatMessage({
    required String text,
    String? audioUrl,
  }) async {
    final trimmedText = text.trim();
    final trimmedAudio = audioUrl?.trim();
    final hasAudio = trimmedAudio != null && trimmedAudio.isNotEmpty;
    // Client-side pre-check mirroring the rule's `text.size() <= 500 ||
    // audioUrl is string` clause: fail with a typed error BEFORE the write
    // when there is no audio to bypass the cap, rather than let the rule
    // reject it as a raw permission-denied. UTF-8 BYTE length, matching the
    // rule's `string.size()` — NOT `.length` (UTF-16 code units), which
    // would under-count every non-Latin script this app is built for. See
    // ChatMessageTooLongException's class doc.
    final byteLength = utf8.encode(trimmedText).length;
    if (!hasAudio && byteLength > ChatMessageTooLongException.maxLength) {
      throw ChatMessageTooLongException(byteLength);
    }
    await _communityChat.add(<String, dynamic>{
      'text': trimmedText,
      'authorId': _uid,
      'authorName': myDisplayName,
      'authorPhotoURL': myPhotoURL,
      if (hasAudio) 'audioUrl': trimmedAudio,
      'isDemoPersona': false,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  List<ChatMessage> _toChatMessages(
    QuerySnapshot<Map<String, dynamic>> snapshot,
  ) =>
      snapshot.docs
          .map((doc) => ChatMessageDto.fromJson(_withId(doc)).toDomain())
          .toList(growable: false);

  /// `{ 'id': doc.id, ...doc.data() }`, with `createdAt` converted from a raw
  /// `Timestamp` to millis first — [ChatMessageDto]'s `createdAt` goes through
  /// `wireTimeToIso`, which does not understand a raw `Timestamp` object (only
  /// ISO strings / millis / a `{seconds,...}` map), per its own doc comment.
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

  // ── Real REST route (already deployed) ──────────────────────────────────

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

  // ── Everything else: unchanged from DeferredStaffroomTransport ──────────
  // No matching REST route exists yet (only persona-pulse is deployed), and
  // several of these depend on server-side logic (PII-stripping, membership
  // validation) that must not move to a raw client Firestore read even where
  // a rule might technically permit one. Left exactly as-is — Tranche 3
  // produces the backend punch-list for Groups/Directory/Feed.

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
}

/// The Staffroom transport. [FirestoreStaffroomTransport] once Firebase is
/// configured **and** a real teacher is signed in; [DeferredStaffroomTransport]
/// otherwise — including a genuinely signed-out teacher, so the signed-out UI
/// (the "sign in to join the staffroom" `EmptyView`) renders exactly as it
/// does today. Mirrors `inboxTransportProvider`'s branch on
/// [authControllerProvider] (`core/auth/auth_providers.dart`) for consistency:
/// the same provider both the router and every other Block-C-adjacent surface
/// already agree is the source of truth for "is this a real signed-in
/// teacher."
@Riverpod(keepAlive: true)
StaffroomTransport staffroomTransport(Ref ref) {
  if (!FirebaseInit.isConfigured) return const DeferredStaffroomTransport();
  final status = ref.watch(authControllerProvider);
  if (status != AuthStatus.signedIn) return const DeferredStaffroomTransport();
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) return const DeferredStaffroomTransport();
  return FirestoreStaffroomTransport(
    FirebaseFirestore.instance,
    user.uid,
    ref.watch(apiClientProvider),
    myDisplayName: user.displayName,
    myPhotoURL: user.photoURL,
  );
}
