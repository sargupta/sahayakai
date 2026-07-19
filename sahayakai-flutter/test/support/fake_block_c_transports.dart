import 'dart:async';

import 'package:sahayakai/features/inbox/data/block_c_transport.dart';
import 'package:sahayakai/features/inbox/data/inbox_transport.dart';
import 'package:sahayakai/features/inbox/data/notifications_transport.dart';
import 'package:sahayakai/features/inbox/data/presence_transport.dart';
import 'package:sahayakai/features/inbox/domain/conversation_id.dart';
import 'package:sahayakai/features/inbox/domain/inbox_models.dart';
import 'package:sahayakai/features/inbox/domain/notification_item.dart';
import 'package:sahayakai/features/inbox/domain/presence_status.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_transport.dart';
import 'package:sahayakai/features/staffroom/domain/chat_message.dart';
import 'package:sahayakai/features/staffroom/domain/community_post.dart';
import 'package:sahayakai/features/staffroom/domain/connection.dart';
import 'package:sahayakai/features/staffroom/domain/group.dart';
import 'package:sahayakai/features/staffroom/domain/persona_pulse.dart';
import 'package:sahayakai/features/staffroom/domain/staffroom_results.dart';
import 'package:sahayakai/features/staffroom/domain/teacher.dart';

/// A "behaviour subject": replays the last value to every new listener, then
/// forwards live events. Lets a fake transport stream both seed an initial
/// snapshot (so a Riverpod `StreamProvider` renders immediately) AND push
/// updates/errors — the `onSnapshot` behaviour U-SI1..U-SI6 code against.
class _Seeded<T> {
  _Seeded(this._latest);

  final _controller = StreamController<T>.broadcast();
  T _latest;

  T get latest => _latest;

  Stream<T> get stream async* {
    yield _latest;
    yield* _controller.stream;
  }

  void emit(T value) {
    _latest = value;
    if (_controller.hasListener) _controller.add(value);
  }

  Future<void> dispose() => _controller.close();
}

/// A fully drivable [InboxTransport] fake for U-SI1+ tests. Seed the live-read
/// streams with [emitInbox] / [emitThread] / [emitUnread] (including
/// `TransportSnapshot.error` to exercise the `ErrorView` path), and inspect the
/// recorded writes ([sentMessages], [markedRead], …). Writes return configurable
/// results or throw configurable errors — a test never touches the network.
class FakeInboxTransport implements InboxTransport {
  FakeInboxTransport({
    TransportSnapshot<List<Conversation>>? initialInbox,
    TransportSnapshot<int>? initialUnread,
  })  : _inbox = _Seeded<TransportSnapshot<List<Conversation>>>(
          initialInbox ??
              const TransportSnapshot<List<Conversation>>.ready(
                <Conversation>[],
              ),
        ),
        _unread = _Seeded<TransportSnapshot<int>>(
          initialUnread ?? const TransportSnapshot<int>.ready(0),
        );

  final _Seeded<TransportSnapshot<List<Conversation>>> _inbox;
  final _Seeded<TransportSnapshot<int>> _unread;
  final Map<String, _Seeded<TransportSnapshot<List<Message>>>> _threads = {};

  // Recorded writes.
  final List<SendMessageInput> sentMessages = <SendMessageInput>[];
  final List<ConversationId> markedRead = <ConversationId>[];
  final List<({ConversationId id, List<String> messageIds})> delivered =
      <({ConversationId id, List<String> messageIds})>[];
  final List<String> directConversationRequests = <String>[];
  final List<({List<String> participantUids, String name})> groupCreations =
      <({List<String> participantUids, String name})>[];

  // Configurable results / errors.
  String sendMessageResult = 'msg-1';
  Object? sendMessageError;
  ConversationId getOrCreateResult = const ConversationId('a_b');
  Object? getOrCreateError;
  ConversationId createGroupResult = const ConversationId('grp-1');
  int totalUnreadResult = 0;
  List<Message> olderMessages = const <Message>[];

  /// Recorded `loadOlderMessages` calls (U-SI1 pagination assertions).
  final List<({ConversationId id, String beforeMessageId})> olderRequests =
      <({ConversationId id, String beforeMessageId})>[];

  void emitInbox(TransportSnapshot<List<Conversation>> snapshot) =>
      _inbox.emit(snapshot);

  void emitUnread(TransportSnapshot<int> snapshot) => _unread.emit(snapshot);

  void emitThread(
    ConversationId id,
    TransportSnapshot<List<Message>> snapshot,
  ) =>
      _thread(id).emit(snapshot);

  _Seeded<TransportSnapshot<List<Message>>> _thread(ConversationId id) =>
      _threads.putIfAbsent(
        id.value,
        () => _Seeded<TransportSnapshot<List<Message>>>(
          const TransportSnapshot<List<Message>>.ready(<Message>[]),
        ),
      );

  Future<void> dispose() async {
    await _inbox.dispose();
    await _unread.dispose();
    for (final t in _threads.values) {
      await t.dispose();
    }
  }

  @override
  Stream<TransportSnapshot<List<Conversation>>> watchInbox() => _inbox.stream;

  @override
  Stream<TransportSnapshot<List<Message>>> watchThread(
    ConversationId conversationId, {
    int tailLimit = 30,
  }) =>
      _thread(conversationId).stream;

  @override
  Future<List<Message>> loadOlderMessages(
    ConversationId conversationId, {
    required String beforeMessageId,
    int limit = 30,
  }) async {
    olderRequests.add((id: conversationId, beforeMessageId: beforeMessageId));
    return olderMessages;
  }

  @override
  Stream<TransportSnapshot<int>> watchUnreadConversations() => _unread.stream;

  @override
  Future<int> getTotalUnreadCount() async => totalUnreadResult;

  @override
  Future<ConversationId> getOrCreateDirectConversation(String otherUid) async {
    directConversationRequests.add(otherUid);
    if (getOrCreateError != null) throw getOrCreateError!;
    return getOrCreateResult;
  }

  @override
  Future<ConversationId> createGroupConversation({
    required List<String> participantUids,
    required String name,
  }) async {
    groupCreations.add((participantUids: participantUids, name: name));
    return createGroupResult;
  }

  @override
  Future<String> sendMessage(SendMessageInput input) async {
    sentMessages.add(input);
    if (sendMessageError != null) throw sendMessageError!;
    return sendMessageResult;
  }

  @override
  Future<void> markConversationRead(ConversationId conversationId) async {
    markedRead.add(conversationId);
  }

  @override
  Future<void> acknowledgeDelivery(
    ConversationId conversationId,
    List<String> messageIds,
  ) async {
    delivered.add((id: conversationId, messageIds: messageIds));
  }
}

/// A drivable [NotificationsTransport] fake.
class FakeNotificationsTransport implements NotificationsTransport {
  FakeNotificationsTransport({
    TransportSnapshot<List<NotificationItem>>? initialUnread,
    TransportSnapshot<int>? initialCount,
  })  : _unread = _Seeded<TransportSnapshot<List<NotificationItem>>>(
          initialUnread ??
              const TransportSnapshot<List<NotificationItem>>.ready(
                <NotificationItem>[],
              ),
        ),
        _count = _Seeded<TransportSnapshot<int>>(
          initialCount ?? const TransportSnapshot<int>.ready(0),
        );

  final _Seeded<TransportSnapshot<List<NotificationItem>>> _unread;
  final _Seeded<TransportSnapshot<int>> _count;

  List<NotificationItem> notifications = const <NotificationItem>[];
  final List<String> markedRead = <String>[];
  int markAllCalls = 0;

  void emitUnread(TransportSnapshot<List<NotificationItem>> snapshot) =>
      _unread.emit(snapshot);

  void emitCount(TransportSnapshot<int> snapshot) => _count.emit(snapshot);

  Future<void> dispose() async {
    await _unread.dispose();
    await _count.dispose();
  }

  @override
  Stream<TransportSnapshot<List<NotificationItem>>>
      watchUnreadNotifications() => _unread.stream;

  @override
  Stream<TransportSnapshot<int>> watchUnreadNotificationCount() =>
      _count.stream;

  @override
  Future<List<NotificationItem>> getNotifications() async => notifications;

  @override
  Future<void> markNotificationRead(String notificationId) async {
    markedRead.add(notificationId);
  }

  @override
  Future<void> markAllNotificationsRead() async {
    markAllCalls++;
  }
}

/// A drivable [PresenceTransport] fake.
class FakePresenceTransport implements PresenceTransport {
  final Map<String, _Seeded<PresenceStatus>> _presence = {};
  final Map<String, _Seeded<TypingStatus>> _typing = {};
  final List<bool> presenceWrites = <bool>[];
  final List<({ConversationId id, bool typing})> typingWrites =
      <({ConversationId id, bool typing})>[];

  void emitPresence(PresenceStatus status) => _presenceFor(status.uid)
      .emit(status);

  void emitTyping(TypingStatus status) =>
      _typingFor(status.conversationId).emit(status);

  _Seeded<PresenceStatus> _presenceFor(String uid) => _presence.putIfAbsent(
        uid,
        () => _Seeded<PresenceStatus>(PresenceStatus.unknown(uid)),
      );

  _Seeded<TypingStatus> _typingFor(ConversationId id) => _typing.putIfAbsent(
        id.value,
        () => _Seeded<TypingStatus>(TypingStatus.empty(id)),
      );

  Future<void> dispose() async {
    for (final p in _presence.values) {
      await p.dispose();
    }
    for (final t in _typing.values) {
      await t.dispose();
    }
  }

  @override
  Stream<PresenceStatus> watchPresence(String uid) => _presenceFor(uid).stream;

  @override
  Stream<TypingStatus> watchTyping(ConversationId conversationId) =>
      _typingFor(conversationId).stream;

  @override
  Future<void> setPresence({required bool online}) async {
    presenceWrites.add(online);
  }

  @override
  Future<void> setTyping(
    ConversationId conversationId, {
    required bool typing,
  }) async {
    typingWrites.add((id: conversationId, typing: typing));
  }
}

/// A drivable [StaffroomTransport] fake. Chat streams are seedable; the
/// server-derived reads return configurable lists; writes are recorded and
/// return configurable results.
class FakeStaffroomTransport implements StaffroomTransport {
  final _Seeded<TransportSnapshot<List<ChatMessage>>> _staffRoom =
      _Seeded<TransportSnapshot<List<ChatMessage>>>(
    const TransportSnapshot<List<ChatMessage>>.ready(<ChatMessage>[]),
  );
  final Map<String, _Seeded<TransportSnapshot<List<ChatMessage>>>>
      _groupChats = {};

  // Configurable reads.
  List<String> ensuredGroupIds = const <String>[];
  List<Group> myGroups = const <Group>[];
  List<Group> discoverableGroups = const <Group>[];
  Group? group;
  List<GroupPost> groupPosts = const <GroupPost>[];
  List<FeedItem> feed = const <FeedItem>[];
  List<TeacherSuggestion> recommended = const <TeacherSuggestion>[];
  List<TeacherSuggestion> allTeachers = const <TeacherSuggestion>[];
  PublicProfile? publicProfile;
  LikedItemIds likedItemIds = const LikedItemIds();
  MyConnectionData connectionData = const MyConnectionData();
  PersonaPulse? personaPulseResult;

  // Configurable write results.
  bool joinResult = true;
  LikeResult likeResult = const LikeResult(isLiked: true, newCount: 1);
  String createPostResult = 'post-1';
  String sendGroupChatResult = 'gmsg-1';
  ConnectionRequestResult connectionRequestResult =
      ConnectionRequestResult.sent;

  // Configurable write errors (thrown when non-null) — the U-SI2 optimistic
  // rollback tests set these to a [TransportUnavailable] to exercise the
  // apply → fail → revert path. Additive: null by default, so existing seeds are
  // unaffected. The attempt is still recorded before the throw.
  Object? likeError;
  Object? joinError;
  Object? connectionRequestError;

  // Optional in-flight gates: when set, the write awaits the completer before
  // resolving, so a test can pump a frame and assert the **immediate optimistic**
  // state (toggled heart / "Joined") BEFORE the server reply reconciles it, then
  // complete the gate to observe the reconcile. Additive: null by default.
  Completer<void>? likeGate;
  Completer<void>? joinGate;

  // Recorded writes.
  final List<String> joinedGroups = <String>[];
  final List<String> leftGroups = <String>[];
  final List<({String groupId, String content, PostType postType})>
      createdPosts = <({String groupId, String content, PostType postType})>[];
  final List<({String groupId, String postId})> likes =
      <({String groupId, String postId})>[];
  final List<({String? groupId, String text})> sentChats =
      <({String? groupId, String text})>[];
  final List<String> connectionRequests = <String>[];
  final List<String> accepted = <String>[];
  final List<String> declined = <String>[];
  final List<String> disconnected = <String>[];
  final List<String> followed = <String>[];
  final List<PersonaPulseRequest> personaPulses = <PersonaPulseRequest>[];

  void emitStaffRoomChat(TransportSnapshot<List<ChatMessage>> snapshot) =>
      _staffRoom.emit(snapshot);

  void emitGroupChat(
    String groupId,
    TransportSnapshot<List<ChatMessage>> snapshot,
  ) =>
      _groupChatFor(groupId).emit(snapshot);

  _Seeded<TransportSnapshot<List<ChatMessage>>> _groupChatFor(String groupId) =>
      _groupChats.putIfAbsent(
        groupId,
        () => _Seeded<TransportSnapshot<List<ChatMessage>>>(
          const TransportSnapshot<List<ChatMessage>>.ready(<ChatMessage>[]),
        ),
      );

  Future<void> dispose() async {
    await _staffRoom.dispose();
    for (final g in _groupChats.values) {
      await g.dispose();
    }
  }

  @override
  Stream<TransportSnapshot<List<ChatMessage>>> watchStaffRoomChat({
    int limit = 100,
  }) =>
      _staffRoom.stream;

  @override
  Stream<TransportSnapshot<List<ChatMessage>>> watchGroupChat(
    String groupId, {
    int limit = 100,
  }) =>
      _groupChatFor(groupId).stream;

  @override
  Future<List<String>> ensureUserGroups() async => ensuredGroupIds;

  @override
  Future<List<Group>> getMyGroups() async => myGroups;

  @override
  Future<Group?> getGroup(String groupId) async => group;

  @override
  Future<List<Group>> discoverGroups() async => discoverableGroups;

  @override
  Future<List<GroupPost>> getGroupPosts(
    String groupId, {
    int limit = 20,
    String? startAfterPostId,
  }) async =>
      groupPosts;

  @override
  Future<List<FeedItem>> getUnifiedFeed({
    int limit = 20,
    String? startAfterTimestamp,
  }) async =>
      feed;

  @override
  Future<List<TeacherSuggestion>> getRecommendedTeachers() async =>
      recommended;

  @override
  Future<List<TeacherSuggestion>> getAllTeachers() async => allTeachers;

  @override
  Future<PublicProfile?> getPublicProfile(String uid) async => publicProfile;

  @override
  Future<LikedItemIds> getLikedItemIds() async => likedItemIds;

  @override
  Future<MyConnectionData> getMyConnectionData() async => connectionData;

  @override
  Future<bool> joinGroup(String groupId) async {
    joinedGroups.add(groupId);
    if (joinGate != null) await joinGate!.future;
    if (joinError != null) throw joinError!;
    return joinResult;
  }

  @override
  Future<void> leaveGroup(String groupId) async {
    leftGroups.add(groupId);
  }

  @override
  Future<String> createGroupPost({
    required String groupId,
    required String content,
    required PostType postType,
    List<Map<String, dynamic>> attachments = const <Map<String, dynamic>>[],
  }) async {
    createdPosts.add((groupId: groupId, content: content, postType: postType));
    return createPostResult;
  }

  @override
  Future<LikeResult> likeGroupPost(String groupId, String postId) async {
    likes.add((groupId: groupId, postId: postId));
    if (likeGate != null) await likeGate!.future;
    if (likeError != null) throw likeError!;
    return likeResult;
  }

  @override
  Future<String> sendGroupChatMessage(
    String groupId, {
    required String text,
    String? audioUrl,
  }) async {
    sentChats.add((groupId: groupId, text: text));
    return sendGroupChatResult;
  }

  @override
  Future<void> sendCommunityChatMessage({
    required String text,
    String? audioUrl,
  }) async {
    sentChats.add((groupId: null, text: text));
  }

  @override
  Future<ConnectionRequestResult> sendConnectionRequest(String toUid) async {
    connectionRequests.add(toUid);
    if (connectionRequestError != null) throw connectionRequestError!;
    return connectionRequestResult;
  }

  @override
  Future<void> acceptConnectionRequest(String requestId) async {
    accepted.add(requestId);
  }

  @override
  Future<void> declineConnectionRequest(String requestId) async {
    declined.add(requestId);
  }

  @override
  Future<void> disconnect(String otherUid) async {
    disconnected.add(otherUid);
  }

  @override
  Future<void> followTeacher(String followingId) async {
    followed.add(followingId);
  }

  @override
  Future<PersonaPulse?> triggerPersonaPulse(
    PersonaPulseRequest request,
  ) async {
    personaPulses.add(request);
    return personaPulseResult;
  }
}
