/// Demo data for the Community area: the Staffroom (feed, groups, the staff
/// room and group chats, the connection graph) and the Pro Inbox
/// (conversations and threads).
///
/// Everything lives in one in-memory [_DemoCommunityStore] shared by the
/// transports below, so the two pillars tell one story: accepting a connection
/// request in the Messages pane opens a direct conversation in the inbox, a
/// post written in the composer lands at the top of the feed and in its group,
/// and a message sent in a thread updates that conversation's inbox row.
///
/// Nothing here touches the network or Firebase. Live reads are streams that
/// replay the current value to every new listener and then push each change,
/// which is how the real Firestore `onSnapshot` reads behave. Timestamps are
/// relative to the moment the store is created, so the demo always reads as
/// "the last few days".
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/network/api_exception.dart';
import '../features/inbox/data/block_c_transport.dart';
import '../features/inbox/data/inbox_transport.dart';
import '../features/inbox/data/messages_stream_provider.dart';
import '../features/inbox/domain/conversation_id.dart';
import '../features/inbox/domain/inbox_models.dart';
import '../features/staffroom/data/staffroom_providers.dart';
import '../features/staffroom/data/staffroom_transport.dart';
import '../features/staffroom/data/teacher_profiles.dart';
import '../features/staffroom/domain/chat_message.dart';
import '../features/staffroom/domain/community_post.dart';
import '../features/staffroom/domain/connection.dart';
import '../features/staffroom/domain/group.dart';
import '../features/staffroom/domain/persona_pulse.dart';
import '../features/staffroom/domain/staffroom_results.dart';
import '../features/staffroom/domain/teacher.dart';
import 'demo_mode.dart';

/// The Community overrides for demo mode: both Block-C transports, the teacher
/// profile lookup, and the two "current user id" seams (which otherwise read
/// `FirebaseAuth.instance` and fail with no Firebase app).
///
/// The notifications and presence transports are left alone: their providers
/// always bind the Firebase-free deferred implementations.
List<Override> demoCommunityOverrides() {
  final store = _DemoCommunityStore();
  return <Override>[
    staffroomTransportProvider.overrideWith((ref) {
      ref.onDispose(store.dispose);
      return DemoStaffroomTransport._(store);
    }),
    inboxTransportProvider.overrideWithValue(DemoInboxTransport._(store)),
    teacherProfileSourceProvider.overrideWithValue(
      DemoTeacherProfileSource._(store),
    ),
    currentStaffroomUserIdProvider.overrideWith((ref) => kDemoUid),
    currentInboxUserIdProvider.overrideWith((ref) => kDemoUid),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Transports
// ─────────────────────────────────────────────────────────────────────────────

/// The demo [StaffroomTransport]: every read is served from, and every write
/// applied to, the shared in-memory store.
class DemoStaffroomTransport implements StaffroomTransport {
  DemoStaffroomTransport._(this._store);

  final _DemoCommunityStore _store;

  @override
  Stream<TransportSnapshot<List<ChatMessage>>> watchStaffRoomChat({
    int limit = 100,
  }) => _store.staffRoomChat.stream.map(
    (all) => TransportSnapshot<List<ChatMessage>>.ready(_tail(all, limit)),
  );

  @override
  Stream<TransportSnapshot<List<ChatMessage>>> watchGroupChat(
    String groupId, {
    int limit = 100,
  }) => _store
      .groupChat(groupId)
      .stream
      .map(
        (all) => TransportSnapshot<List<ChatMessage>>.ready(_tail(all, limit)),
      );

  @override
  Future<List<String>> ensureUserGroups() async =>
      List<String>.unmodifiable(_store.myGroupIds);

  @override
  Future<List<Group>> getMyGroups() async => _store.myGroups();

  @override
  Future<Group?> getGroup(String groupId) async => _store.groups[groupId];

  @override
  Future<List<Group>> discoverGroups() async => _store.discoverableGroups();

  @override
  Future<List<GroupPost>> getGroupPosts(
    String groupId, {
    int limit = 20,
    String? startAfterPostId,
  }) async {
    if (!_store.groups.containsKey(groupId)) {
      throw const ApiException(
        ApiErrorKind.notFound,
        'Not found.',
        statusCode: 404,
      );
    }
    if (!_store.myGroupIds.contains(groupId)) {
      // The posts route is member-gated: a non-member gets the 403 the group
      // page renders as its locked "members only" preview.
      throw const ApiException(
        ApiErrorKind.forbidden,
        'Join this group to see its posts.',
        statusCode: 403,
      );
    }
    final posts = _store.postsIn(groupId);
    var start = 0;
    if (startAfterPostId != null && startAfterPostId.isNotEmpty) {
      final index = posts.indexWhere((p) => p.id == startAfterPostId);
      start = index < 0 ? posts.length : index + 1;
    }
    return List<GroupPost>.unmodifiable(posts.skip(start).take(limit));
  }

  @override
  Future<List<FeedItem>> getUnifiedFeed({
    int limit = 20,
    String? startAfterTimestamp,
  }) async {
    final feed = _store.feed();
    final after = startAfterTimestamp;
    final page = after == null || after.isEmpty
        ? feed
        : feed.where((item) => (item.timestamp ?? '').compareTo(after) < 0);
    return List<FeedItem>.unmodifiable(page.take(limit));
  }

  @override
  Future<List<TeacherSuggestion>> getRecommendedTeachers() async =>
      _store.recommendedTeachers();

  @override
  Future<List<TeacherSuggestion>> getAllTeachers() async =>
      List<TeacherSuggestion>.unmodifiable(<TeacherSuggestion>[
        for (final teacher in _store.teachers.values) teacher.toSuggestion(),
      ]);

  @override
  Future<PublicProfile?> getPublicProfile(String uid) async {
    if (uid == kDemoUid) return _demoTeacher.toProfile(withEmail: true);
    final teacher = _store.teachers[uid];
    if (teacher == null) return null;
    // Email is shared only between mutually connected teachers.
    return teacher.toProfile(withEmail: _store.connected.contains(uid));
  }

  @override
  Future<LikedItemIds> getLikedItemIds() async => LikedItemIds(
    groupPostIds: List<String>.unmodifiable(_store.likedPostIds),
    resourceIds: List<String>.unmodifiable(_store.likedResourceIds),
  );

  @override
  Future<MyConnectionData> getMyConnectionData() async =>
      _store.connectionData();

  @override
  Future<bool> joinGroup(String groupId) async => _store.join(groupId);

  @override
  Future<void> leaveGroup(String groupId) async => _store.leave(groupId);

  @override
  Future<String> createGroupPost({
    required String groupId,
    required String content,
    required PostType postType,
    List<Map<String, dynamic>> attachments = const <Map<String, dynamic>>[],
  }) async {
    final trimmed = content.trim();
    if (trimmed.isEmpty) {
      throw const ApiException(
        ApiErrorKind.badResponse,
        'Write something before posting.',
        statusCode: 400,
      );
    }
    if (!_store.myGroupIds.contains(groupId)) {
      throw const ApiException(
        ApiErrorKind.forbidden,
        'Join this group to post in it.',
        statusCode: 403,
      );
    }
    return _store.addPost(
      groupId: groupId,
      content: trimmed,
      postType: postType,
      attachments: attachments,
    );
  }

  @override
  Future<LikeResult> likeGroupPost(String groupId, String postId) async =>
      _store.toggleLike(postId);

  @override
  Future<String> sendGroupChatMessage(
    String groupId, {
    required String text,
    String? audioUrl,
  }) async {
    final message = _chatMessage(
      text: text,
      audioUrl: audioUrl,
      groupId: groupId,
    );
    final room = _store.groupChat(groupId);
    room.value = List<ChatMessage>.unmodifiable(<ChatMessage>[
      ...room.value,
      message,
    ]);
    _store.touchGroup(groupId);
    return message.id;
  }

  @override
  Future<void> sendCommunityChatMessage({
    required String text,
    String? audioUrl,
  }) async {
    final message = _chatMessage(text: text, audioUrl: audioUrl);
    final room = _store.staffRoomChat;
    room.value = List<ChatMessage>.unmodifiable(<ChatMessage>[
      ...room.value,
      message,
    ]);
  }

  /// The demo teacher's chat message, with the same 500-character cap the two
  /// chat routes enforce (checked before the "request", like the real
  /// transport).
  ChatMessage _chatMessage({
    required String text,
    String? audioUrl,
    String? groupId,
  }) {
    final trimmed = text.trim();
    final audio = audioUrl?.trim();
    final hasAudio = audio != null && audio.isNotEmpty;
    if (!hasAudio && trimmed.length > ChatMessageTooLongException.maxLength) {
      throw ChatMessageTooLongException(trimmed.length);
    }
    return ChatMessage(
      id: _store.nextId('chat'),
      text: trimmed,
      authorId: kDemoUid,
      authorName: kDemoTeacherName,
      audioUrl: hasAudio ? audio : null,
      createdAt: _store.nowIso(),
      groupId: groupId,
    );
  }

  @override
  Future<ConnectionRequestResult> sendConnectionRequest(String toUid) async =>
      _store.requestConnection(toUid);

  @override
  Future<void> acceptConnectionRequest(String requestId) async =>
      _store.acceptRequest(requestId);

  @override
  Future<void> declineConnectionRequest(String requestId) async =>
      _store.declineRequest(requestId);

  @override
  Future<void> disconnect(String otherUid) async => _store.disconnect(otherUid);

  @override
  Future<void> followTeacher(String followingId) async {
    if (followingId.isNotEmpty && followingId != kDemoUid) {
      _store.followed.add(followingId);
    }
  }

  @override
  Future<PersonaPulse?> triggerPersonaPulse(
    PersonaPulseRequest request,
  ) async => _store.nextPersonaPulse();
}

/// The demo [InboxTransport]: the four seeded conversations plus any opened
/// during the demo, with sends, unread counts and read receipts kept in
/// memory.
class DemoInboxTransport implements InboxTransport {
  DemoInboxTransport._(this._store);

  final _DemoCommunityStore _store;

  @override
  Stream<TransportSnapshot<List<Conversation>>> watchInbox() =>
      _store.inbox.stream.map(TransportSnapshot<List<Conversation>>.ready);

  @override
  Stream<TransportSnapshot<List<Message>>> watchThread(
    ConversationId conversationId, {
    int tailLimit = 30,
  }) => _store
      .thread(conversationId.value)
      .stream
      .map(
        (all) => TransportSnapshot<List<Message>>.ready(_tail(all, tailLimit)),
      );

  @override
  Future<List<Message>> loadOlderMessages(
    ConversationId conversationId, {
    required String beforeMessageId,
    int limit = 30,
  }) async {
    final all = _store.thread(conversationId.value).value;
    final index = all.indexWhere((m) => m.id == beforeMessageId);
    if (index <= 0) return const <Message>[];
    return _tail(all.sublist(0, index), limit);
  }

  @override
  Stream<TransportSnapshot<int>> watchUnreadConversations() =>
      _store.unread.stream.map(TransportSnapshot<int>.ready);

  @override
  Future<int> getTotalUnreadCount() async => _store.unread.value;

  @override
  Future<ConversationId> getOrCreateDirectConversation(String otherUid) async =>
      _store.directConversation(otherUid);

  @override
  Future<ConversationId> createGroupConversation({
    required List<String> participantUids,
    required String name,
  }) async => _store.createGroupConversation(participantUids, name);

  @override
  Future<String> sendMessage(SendMessageInput input) async =>
      _store.sendMessage(input);

  @override
  Future<void> markConversationRead(ConversationId conversationId) async =>
      _store.markRead(conversationId.value);

  @override
  Future<void> acknowledgeDelivery(
    ConversationId conversationId,
    List<String> messageIds,
  ) async {
    // Every demo message is already stamped delivered to all participants.
  }
}

/// The demo [TeacherProfileSource]: resolves uids against the seeded teacher
/// directory (the demo teacher included).
class DemoTeacherProfileSource implements TeacherProfileSource {
  DemoTeacherProfileSource._(this._store);

  final _DemoCommunityStore _store;

  @override
  Future<Map<String, TeacherSuggestion>> lookup(List<String> uids) async =>
      <String, TeacherSuggestion>{
        for (final uid in uids)
          if (_store.teacherOrMe(uid) case final teacher?)
            uid: teacher.toSuggestion(),
      };
}

/// The newest [limit] items of an oldest-first list.
List<T> _tail<T>(List<T> all, int limit) {
  if (limit <= 0) return List<T>.unmodifiable(<T>[]);
  return List<T>.unmodifiable(
    all.length <= limit ? all : all.sublist(all.length - limit),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live value: replays the current value to each listener, then pushes changes
// ─────────────────────────────────────────────────────────────────────────────

class _Live<T> {
  _Live(this._value);

  final StreamController<T> _changes = StreamController<T>.broadcast();
  T _value;

  T get value => _value;

  set value(T next) {
    _value = next;
    if (_changes.hasListener) _changes.add(next);
  }

  /// A fresh stream per listener: the current value first, then every change.
  Stream<T> get stream => Stream<T>.multi((listener) {
    listener.add(_value);
    final subscription = _changes.stream.listen(
      listener.add,
      onError: listener.addError,
      onDone: listener.close,
    );
    listener.onCancel = () => subscription.cancel();
  });

  Future<void> close() => _changes.close();
}

// ─────────────────────────────────────────────────────────────────────────────
// Teachers
// ─────────────────────────────────────────────────────────────────────────────

class _Teacher {
  const _Teacher({
    required this.uid,
    required this.name,
    required this.school,
    required this.district,
    required this.state,
    required this.subjects,
    required this.grades,
    required this.languages,
    required this.years,
    required this.bio,
    this.reason,
    this.impactScore = 0,
    this.followers = 0,
    this.careerStage,
  });

  final String uid;
  final String name;
  final String school;
  final String district;
  final String state;
  final List<String> subjects;
  final List<String> grades;
  final List<String> languages;
  final int years;
  final String bio;

  /// Why "People you may know" surfaces this teacher.
  final String? reason;
  final int impactScore;
  final int followers;
  final String? careerStage;

  String get initial => name.isEmpty ? '?' : name.substring(0, 1);

  String get email => '${name.toLowerCase().replaceAll(' ', '.')}@example.org';

  TeacherSuggestion toSuggestion() => TeacherSuggestion(
    uid: uid,
    displayName: name,
    initial: initial,
    schoolName: school,
    subjects: subjects,
    gradeLevels: grades,
    bio: bio,
    impactScore: impactScore,
    followersCount: followers,
    recommendationReason: reason,
  );

  PublicProfile toProfile({required bool withEmail}) => PublicProfile(
    id: uid,
    displayName: name,
    bio: bio,
    state: state,
    district: district,
    schoolType: 'Government',
    schoolName: school,
    subjects: subjects,
    languages: languages,
    gradeLevels: grades,
    qualifications: const <String>['B.Ed.'],
    yearsOfExperience: years,
    careerStage: careerStage,
    email: withEmail ? email : null,
  );

  ParticipantSnapshot toParticipant() => ParticipantSnapshot(
    displayName: name,
    preferredLanguage: languages.isEmpty ? null : languages.first,
  );
}

const _Teacher _demoTeacher = _Teacher(
  uid: kDemoUid,
  name: kDemoTeacherName,
  school: kDemoSchool,
  district: kDemoDistrict,
  state: kDemoState,
  subjects: <String>[kDemoClass7Subject, kDemoClass6Subject],
  grades: <String>['Class 6', 'Class 7'],
  languages: <String>['Marathi', 'Hindi', 'English'],
  years: 9,
  bio:
      'Science and maths teacher at ZP School Wagholi. I love low-cost '
      'experiments and getting parents into the classroom.',
  impactScore: 72,
  followers: 46,
  careerStage: 'Experienced',
);

const String _anjali = 'demo-t-anjali';
const String _rahul = 'demo-t-rahul';
const String _meena = 'demo-t-meena';
const String _suresh = 'demo-t-suresh';
const String _fatima = 'demo-t-fatima';
const String _kavita = 'demo-t-kavita';
const String _arjun = 'demo-t-arjun';
const String _sunita = 'demo-t-sunita';
const String _deepak = 'demo-t-deepak';
const String _lakshmi = 'demo-t-lakshmi';
const String _vijay = 'demo-t-vijay';

const List<_Teacher> _seedTeachers = <_Teacher>[
  _Teacher(
    uid: _anjali,
    name: 'Anjali Kulkarni',
    school: kDemoSchool,
    district: 'Pune',
    state: 'Maharashtra',
    subjects: <String>['Mathematics'],
    grades: <String>['Class 6', 'Class 7'],
    languages: <String>['Marathi', 'Hindi', 'English'],
    years: 11,
    bio:
        'Maths with matchsticks, bangles and market prices. Eleven years at '
        'ZP Wagholi.',
    reason: 'Same school',
    impactScore: 81,
    followers: 63,
    careerStage: 'Experienced',
  ),
  _Teacher(
    uid: _rahul,
    name: 'Rahul Patil',
    school: 'ZP Primary School, Lonikand',
    district: 'Pune',
    state: 'Maharashtra',
    subjects: <String>['Science'],
    grades: <String>['Class 7', 'Class 8'],
    languages: <String>['Marathi', 'English'],
    years: 8,
    bio:
        'Kitchen-chemistry fan. If it costs more than ten rupees, I find a '
        'cheaper way.',
    reason: 'Teaches Class 7 Science',
    impactScore: 88,
    followers: 112,
    careerStage: 'Experienced',
  ),
  _Teacher(
    uid: _meena,
    name: 'Meena Iyer',
    school: 'Government Middle School, Thiruparankundram',
    district: 'Madurai',
    state: 'Tamil Nadu',
    subjects: <String>['English'],
    grades: <String>['Class 6', 'Class 7', 'Class 8'],
    languages: <String>['Tamil', 'English'],
    years: 14,
    bio: 'Phonics, picture cards and a lot of reading aloud.',
    reason: 'Teaches Class 6–8',
    impactScore: 76,
    followers: 94,
    careerStage: 'Senior',
  ),
  _Teacher(
    uid: _suresh,
    name: 'Suresh Jadhav',
    school: 'ZP School, Kesnand',
    district: 'Pune',
    state: 'Maharashtra',
    subjects: <String>['Marathi', 'Mathematics'],
    grades: <String>['Class 5', 'Class 6'],
    languages: <String>['Marathi'],
    years: 5,
    bio: 'Teaching Classes 5 and 6 in a two-teacher school.',
    reason: 'Pune district',
    impactScore: 41,
    followers: 18,
    careerStage: 'Early career',
  ),
  _Teacher(
    uid: _fatima,
    name: 'Fatima Shaikh',
    school: 'Municipal Urdu School No. 3, Chhatrapati Sambhajinagar',
    district: 'Chhatrapati Sambhajinagar',
    state: 'Maharashtra',
    subjects: <String>['Science'],
    grades: <String>['Class 6', 'Class 7', 'Class 8'],
    languages: <String>['Urdu', 'Marathi', 'Hindi'],
    years: 10,
    bio: 'Bilingual question banks in Urdu and Marathi.',
    reason: 'Teaches Science',
    impactScore: 79,
    followers: 87,
    careerStage: 'Experienced',
  ),
  _Teacher(
    uid: _kavita,
    name: 'Kavita Rao',
    school: 'Government Higher Primary School, Saptapur',
    district: 'Dharwad',
    state: 'Karnataka',
    subjects: <String>['Mathematics'],
    grades: <String>['Class 5', 'Class 6', 'Class 7'],
    languages: <String>['Kannada', 'English'],
    years: 12,
    bio: 'Maths labs from waste material. Abacus club every Saturday.',
    reason: 'Teaches Mathematics',
    impactScore: 70,
    followers: 58,
    careerStage: 'Experienced',
  ),
  _Teacher(
    uid: _arjun,
    name: 'Arjun Meena',
    school: 'Government Senior Secondary School, Bassi',
    district: 'Jaipur',
    state: 'Rajasthan',
    subjects: <String>['Science'],
    grades: <String>['Class 7', 'Class 8', 'Class 9'],
    languages: <String>['Hindi', 'English'],
    years: 6,
    bio: 'Science through local farming: soil, seeds and water.',
    reason: 'Teaches Class 7 Science',
    impactScore: 64,
    followers: 39,
    careerStage: 'Early career',
  ),
  _Teacher(
    uid: _sunita,
    name: 'Sunita Bhosale',
    school: 'ZP School, Shirur',
    district: 'Pune',
    state: 'Maharashtra',
    subjects: <String>['EVS', 'Marathi'],
    grades: <String>['Class 1', 'Class 2', 'Class 3', 'Class 4'],
    languages: <String>['Marathi'],
    years: 16,
    bio: 'One room, four classes. Ladder cards and peer tutoring.',
    reason: 'Pune district',
    impactScore: 90,
    followers: 140,
    careerStage: 'Senior',
  ),
  _Teacher(
    uid: _deepak,
    name: 'Deepak Verma',
    school: 'Government Middle School, Berasia',
    district: 'Bhopal',
    state: 'Madhya Pradesh',
    subjects: <String>['Social Science'],
    grades: <String>['Class 6', 'Class 7', 'Class 8'],
    languages: <String>['Hindi'],
    years: 9,
    bio: 'Newspaper circles and map games for Social Science.',
    reason: 'Teaches Class 6–8',
    impactScore: 58,
    followers: 33,
    careerStage: 'Experienced',
  ),
  _Teacher(
    uid: _lakshmi,
    name: 'Lakshmi Reddy',
    school: 'ZPHS Hasanparthy',
    district: 'Hanamkonda',
    state: 'Telangana',
    subjects: <String>['Science'],
    grades: <String>['Class 7', 'Class 8', 'Class 9'],
    languages: <String>['Telugu', 'English'],
    years: 13,
    bio: 'Biology models from clay and seeds; eco-club in charge.',
    reason: 'Teaches Science',
    impactScore: 74,
    followers: 71,
    careerStage: 'Senior',
  ),
  _Teacher(
    uid: _vijay,
    name: 'Vijay Pawar',
    school: kDemoSchool,
    district: 'Pune',
    state: 'Maharashtra',
    subjects: <String>['Mathematics', 'Social Science'],
    grades: <String>['Class 5', 'Class 6', 'Class 7'],
    languages: <String>['Marathi', 'Hindi'],
    years: 22,
    bio: 'Headmaster, ZP School Wagholi.',
    reason: 'Same school',
    impactScore: 67,
    followers: 52,
    careerStage: 'Senior',
  ),
];

// ─────────────────────────────────────────────────────────────────────────────
// Groups
// ─────────────────────────────────────────────────────────────────────────────

const String _gScience7 = 'demo-grp-sci7-pune';
const String _gMarathiMaths = 'demo-grp-marathi-maths';
const String _gWagholiStaff = 'demo-grp-wagholi-staff';
const String _gMultigrade = 'demo-grp-multigrade';
const String _gBriefing = 'demo-grp-mh-briefing';

/// [group] with a new member count and/or last activity (Group has no
/// copyWith).
Group _groupWith(Group group, {int? memberCount, String? lastActivityAt}) =>
    Group(
      id: group.id,
      name: group.name,
      description: group.description,
      type: group.type,
      coverColor: group.coverColor,
      memberCount: memberCount ?? group.memberCount,
      autoJoinRules: group.autoJoinRules,
      createdBy: group.createdBy,
      lastActivityAt: lastActivityAt ?? group.lastActivityAt,
      createdAt: group.createdAt,
    );

/// [post] with a new like count (GroupPost has no copyWith).
GroupPost _postWithLikes(GroupPost post, int likes) => GroupPost(
  id: post.id,
  groupId: post.groupId,
  authorUid: post.authorUid,
  authorName: post.authorName,
  authorPhotoURL: post.authorPhotoURL,
  content: post.content,
  postType: post.postType,
  attachments: post.attachments,
  likesCount: likes,
  commentsCount: post.commentsCount,
  translations: post.translations,
  createdAt: post.createdAt,
);

// ─────────────────────────────────────────────────────────────────────────────
// The store
// ─────────────────────────────────────────────────────────────────────────────

class _DemoCommunityStore {
  _DemoCommunityStore() : _t0 = DateTime.now() {
    _seedGroups();
    _seedPosts();
    _seedFeedExtras();
    _seedChats();
    _seedConversations();
    _publishInbox();
  }

  /// The moment the demo starts; every seeded timestamp is relative to it.
  final DateTime _t0;
  int _seq = 0;

  // Teachers and the connection graph.
  final Map<String, _Teacher> teachers = <String, _Teacher>{
    for (final teacher in _seedTeachers) teacher.uid: teacher,
  };
  final Set<String> connected = <String>{_anjali, _rahul, _meena};
  final Set<String> sentTo = <String>{_kavita};

  /// Inbound requests, requestId → sender uid (insertion-ordered).
  final Map<String, String> received = <String, String>{
    '${_suresh}_$kDemoUid': _suresh,
    '${_fatima}_$kDemoUid': _fatima,
  };
  final Set<String> followed = <String>{};

  // Groups, posts and the feed.
  final Map<String, Group> groups = <String, Group>{};
  final Set<String> myGroupIds = <String>{
    _gScience7,
    _gMarathiMaths,
    _gWagholiStaff,
    // Every teacher is auto-joined to her state's Daily Briefing (the
    // backend's ensure-groups step), which Home's briefing quotes.
    _gBriefing,
  };
  final List<GroupPost> _posts = <GroupPost>[];
  final List<FeedItem> _feedExtras = <FeedItem>[];
  final Set<String> likedPostIds = <String>{};
  final Set<String> likedResourceIds = <String>{'demo-res-light-shadows'};

  // Chats.
  late final _Live<List<ChatMessage>> staffRoomChat;
  final Map<String, _Live<List<ChatMessage>>> _groupChats =
      <String, _Live<List<ChatMessage>>>{};
  int _personaPulses = 0;

  // Inbox.
  final Map<String, Conversation> _conversations = <String, Conversation>{};
  final Map<String, _Live<List<Message>>> _threads =
      <String, _Live<List<Message>>>{};
  final _Live<List<Conversation>> inbox = _Live<List<Conversation>>(
    const <Conversation>[],
  );
  final _Live<int> unread = _Live<int>(0);

  // ── Helpers ─────────────────────────────────────────────────────────────

  String _ago(Duration ago) => _t0.subtract(ago).toUtc().toIso8601String();

  String nowIso() => DateTime.now().toUtc().toIso8601String();

  String nextId(String kind) => 'demo-$kind-${++_seq}';

  _Teacher? teacherOrMe(String uid) =>
      uid == kDemoUid ? _demoTeacher : teachers[uid];

  String _nameOf(String uid) => teacherOrMe(uid)?.name ?? 'Teacher';

  Future<void> dispose() async {
    await staffRoomChat.close();
    for (final room in _groupChats.values) {
      await room.close();
    }
    for (final thread in _threads.values) {
      await thread.close();
    }
    await inbox.close();
    await unread.close();
  }

  // ── Seed: groups ────────────────────────────────────────────────────────

  void _seedGroups() {
    final seeded = <Group>[
      Group(
        id: _gScience7,
        name: 'Class 7 Science teachers – Pune',
        description:
            'Lesson ideas, low-cost practicals and question banks '
            'for the Class 7 Science syllabus, Marathi and semi-English '
            'medium.',
        type: GroupType.subjectGrade,
        coverColor: 'linear-gradient(135deg, #34d399, #059669)',
        memberCount: 248,
        autoJoinRules: const GroupAutoJoinRules(
          subjects: <String>['Science'],
          grades: <String>['Class 7'],
          board: 'Maharashtra State Board',
          state: 'Maharashtra',
        ),
        createdBy: 'system',
        lastActivityAt: _ago(const Duration(minutes: 40)),
        createdAt: _ago(const Duration(days: 410)),
      ),
      Group(
        id: _gMarathiMaths,
        name: 'Marathi medium maths',
        description:
            'For teachers who teach maths in Marathi: activity '
            'sheets, word problems from village life, and ways to explain '
            'a concept without English jargon.',
        type: GroupType.interest,
        coverColor: 'linear-gradient(135deg, #fb923c, #f59e0b)',
        memberCount: 1132,
        autoJoinRules: const GroupAutoJoinRules(
          subjects: <String>['Mathematics'],
          state: 'Maharashtra',
        ),
        createdBy: _anjali,
        lastActivityAt: _ago(const Duration(hours: 3)),
        createdAt: _ago(const Duration(days: 290)),
      ),
      Group(
        id: _gWagholiStaff,
        name: 'ZP School Wagholi – staff room',
        description:
            'Our school’s own space: timetables, circulars from the '
            'Kendra office, duty rosters and good news.',
        type: GroupType.school,
        coverColor: 'linear-gradient(135deg, #818cf8, #6366f1)',
        memberCount: 18,
        autoJoinRules: const GroupAutoJoinRules(school: kDemoSchool),
        createdBy: 'system',
        lastActivityAt: _ago(const Duration(hours: 4)),
        createdAt: _ago(const Duration(days: 380)),
      ),
      Group(
        id: _gMultigrade,
        name: 'Multigrade classroom ideas',
        description:
            'One room, three classes, one teacher. Seating plans, '
            'peer-tutoring routines and self-paced activity cards that '
            'actually work.',
        type: GroupType.interest,
        coverColor: 'linear-gradient(135deg, #f472b6, #db2777)',
        memberCount: 612,
        autoJoinRules: const GroupAutoJoinRules(
          grades: <String>['Class 1', 'Class 2', 'Class 3', 'Class 4'],
        ),
        createdBy: _sunita,
        lastActivityAt: _ago(const Duration(hours: 5)),
        createdAt: _ago(const Duration(days: 200)),
      ),
      Group(
        id: _gBriefing,
        name: 'Daily Briefing – Maharashtra teachers',
        description:
            'Every morning: new circulars in plain language, exam '
            'timetables and training dates for government-school teachers '
            'in Maharashtra.',
        type: GroupType.region,
        coverColor: 'linear-gradient(135deg, #38bdf8, #0284c7)',
        memberCount: 5240,
        autoJoinRules: const GroupAutoJoinRules(state: 'Maharashtra'),
        createdBy: 'system',
        lastActivityAt: _ago(const Duration(hours: 2)),
        createdAt: _ago(const Duration(days: 500)),
      ),
    ];
    for (final group in seeded) {
      groups[group.id] = group;
    }
  }

  List<Group> myGroups() =>
      _sortedByActivity(groups.values.where((g) => myGroupIds.contains(g.id)));

  List<Group> discoverableGroups() =>
      _sortedByActivity(groups.values.where((g) => !myGroupIds.contains(g.id)));

  static List<Group> _sortedByActivity(Iterable<Group> groups) {
    final list = groups.toList()
      ..sort(
        (a, b) => (b.lastActivityAt ?? '').compareTo(a.lastActivityAt ?? ''),
      );
    return List<Group>.unmodifiable(list);
  }

  bool join(String groupId) {
    final group = groups[groupId];
    if (group == null || myGroupIds.contains(groupId)) return false;
    myGroupIds.add(groupId);
    groups[groupId] = _groupWith(group, memberCount: group.memberCount + 1);
    return true;
  }

  void leave(String groupId) {
    final group = groups[groupId];
    if (group == null || !myGroupIds.remove(groupId)) return;
    final count = group.memberCount - 1;
    groups[groupId] = _groupWith(group, memberCount: count < 0 ? 0 : count);
  }

  void touchGroup(String groupId) {
    final group = groups[groupId];
    if (group == null) return;
    groups[groupId] = _groupWith(group, lastActivityAt: nowIso());
  }

  // ── Seed: posts and the feed ────────────────────────────────────────────

  void _seedPosts() {
    _posts.addAll(<GroupPost>[
      GroupPost(
        id: 'demo-post-fraction-strips',
        groupId: _gMarathiMaths,
        authorUid: _anjali,
        authorName: 'Anjali Kulkarni',
        content:
            'Sharing the fraction-strip worksheet I made for Class 6, '
            'fully in Marathi. The strips are cut from old notebook covers: '
            'children fold, colour and compare ½, ⅓ and ¼ before we ever '
            'write a symbol. Prints on one A4 sheet.',
        postType: PostType.resource,
        attachments: const <PostAttachment>[
          PostAttachment(
            type: 'worksheet',
            resourceId: 'demo-res-fraction-strips',
            title: 'Fraction strips – Class 6 (Marathi)',
          ),
        ],
        likesCount: 24,
        commentsCount: 6,
        createdAt: _ago(const Duration(hours: 3)),
      ),
      GroupPost(
        id: 'demo-post-wagholi-assessment',
        groupId: _gWagholiStaff,
        authorUid: _vijay,
        authorName: 'Vijay Pawar',
        content:
            'Reminder from the Kendra office circular: the foundational '
            'literacy and numeracy assessment for Classes 2 to 5 is on '
            'Thursday. Please hand in attendance sheets by Wednesday, 4 pm.',
        postType: PostType.share,
        likesCount: 6,
        commentsCount: 2,
        createdAt: _ago(const Duration(hours: 4)),
      ),
      GroupPost(
        id: 'demo-post-turmeric',
        groupId: _gScience7,
        authorUid: _rahul,
        authorName: 'Rahul Patil',
        content:
            'Tried this today: turmeric paper as an acid–base indicator. '
            'Soap water turned it red, lemon juice did nothing, and the whole '
            'class gasped. Cost: one spoon of haldi from the mid-day meal '
            'kitchen. Works perfectly for the acids and bases chapter.',
        postType: PostType.share,
        likesCount: 41,
        commentsCount: 12,
        createdAt: _ago(const Duration(hours: 9)),
      ),
      GroupPost(
        id: 'demo-post-exhibition',
        groupId: _gWagholiStaff,
        authorUid: _vijay,
        authorName: 'Vijay Pawar',
        content:
            'Proud moment for our school: Class 7 A’s rainwater '
            'harvesting model won first prize at the taluka science '
            'exhibition. Congratulations to the students, and to Priya madam '
            'for guiding them!',
        postType: PostType.celebrate,
        likesCount: 17,
        commentsCount: 9,
        createdAt: _ago(const Duration(days: 1, hours: 1)),
      ),
      GroupPost(
        id: 'demo-post-place-value',
        groupId: _gMarathiMaths,
        authorUid: _suresh,
        authorName: 'Suresh Jadhav',
        content:
            'Need help: about a third of my Class 5 still read 305 as '
            '“three hundred fifty”. Bundles of sticks helped a little. What '
            'has worked for you to make place value stick?',
        postType: PostType.askHelp,
        likesCount: 9,
        commentsCount: 14,
        createdAt: _ago(const Duration(days: 1, hours: 6)),
      ),
      GroupPost(
        id: 'demo-post-moon-diary',
        groupId: _gScience7,
        authorUid: kDemoUid,
        authorName: kDemoTeacherName,
        content:
            'Tried a “moon diary” with Class 7 A for two weeks: every '
            'child drew the moon at 8 pm from home, and many parents joined '
            'in. Today we sorted the drawings on the floor and the phases '
            'explained themselves.',
        postType: PostType.share,
        likesCount: 33,
        commentsCount: 7,
        createdAt: _ago(const Duration(days: 2, hours: 2)),
      ),
      GroupPost(
        id: 'demo-post-question-bank',
        groupId: _gScience7,
        authorUid: _fatima,
        authorName: 'Fatima Shaikh',
        content:
            'Chapter-wise question bank for Class 7 Science, units 1 to '
            '6, with an answer key. I made it bilingual, Marathi and Urdu, '
            'for my school. Sharing in case it helps yours.',
        postType: PostType.resource,
        attachments: const <PostAttachment>[
          PostAttachment(
            type: 'quiz',
            resourceId: 'demo-res-question-bank',
            title: 'Class 7 Science question bank (units 1–6)',
          ),
        ],
        likesCount: 52,
        commentsCount: 11,
        createdAt: _ago(const Duration(days: 3, hours: 1)),
      ),
      // Posts in the two groups the demo teacher has not joined yet: they
      // appear in the feed and on the group page once she joins.
      GroupPost(
        id: 'demo-post-ladder-cards',
        groupId: _gMultigrade,
        authorUid: _sunita,
        authorName: 'Sunita Bhosale',
        content:
            'Our “ladder cards” for multigrade: each card has one task at '
            'three levels (Class 2, 3 and 4). Children pick their rung and '
            'the older ones check the younger ones’ work. I now get fifteen '
            'quiet minutes with each group.',
        postType: PostType.share,
        likesCount: 64,
        commentsCount: 18,
        createdAt: _ago(const Duration(hours: 5)),
      ),
      GroupPost(
        id: 'demo-post-briefing',
        groupId: _gBriefing,
        authorUid: 'system',
        authorName: 'Daily Briefing',
        content:
            'Today’s briefing: (1) The second term exam timetable for '
            'Classes 5 and 8 is out; exams begin on the 20th. (2) Online '
            'training on the new Science textbook: registration closes on '
            'Friday. (3) Student data entries for the school census are due '
            'this month.',
        postType: PostType.share,
        likesCount: 210,
        commentsCount: 31,
        createdAt: _ago(const Duration(hours: 2)),
      ),
    ]);
    likedPostIds.addAll(<String>[
      'demo-post-fraction-strips',
      'demo-post-turmeric',
      'demo-post-question-bank',
    ]);
  }

  void _seedFeedExtras() {
    final science7 = groups[_gScience7]!;
    final arjun = teachers[_arjun]!;
    _feedExtras.addAll(<FeedItem>[
      FeedItem(
        id: 'demo-feed-chat-sci7',
        type: FeedItemType.chatHighlight,
        timestamp: _ago(const Duration(minutes: 40)),
        groupId: science7.id,
        groupName: science7.name,
        chatHighlight: FeedChatHighlight(
          groupId: science7.id,
          groupName: science7.name,
          messageCount: 23,
          latestMessage:
              'Has anyone received the new practical notebook format yet?',
        ),
      ),
      FeedItem(
        id: 'demo-feed-res-light',
        type: FeedItemType.resourceShare,
        timestamp: _ago(const Duration(hours: 6)),
        groupId: science7.id,
        groupName: science7.name,
        resource: const FeedResource(
          id: 'demo-res-light-shadows',
          title: 'Light and shadows – Class 7 lesson plan (Marathi)',
          type: 'lesson-plan',
          authorName: 'Rahul Patil',
          authorUid: _rahul,
          likes: 37,
          language: 'Marathi',
        ),
      ),
      FeedItem(
        id: 'demo-feed-pymk-arjun',
        type: FeedItemType.connectionSuggestion,
        timestamp: _ago(const Duration(days: 2, hours: 4)),
        connectionSuggestion: FeedConnectionSuggestion(
          uid: arjun.uid,
          displayName: arjun.name,
          reason: 'Teaches Class 7 Science',
          sharedSubjects: const <String>['Science'],
        ),
      ),
    ]);
  }

  List<GroupPost> postsIn(String groupId) {
    final list = _posts.where((p) => p.groupId == groupId).toList()
      ..sort((a, b) => (b.createdAt ?? '').compareTo(a.createdAt ?? ''));
    return list;
  }

  /// The unified feed: posts from the teacher's groups plus the discovery
  /// cards, newest first. A group suggestion is built live so it disappears
  /// once the group is joined.
  List<FeedItem> feed() {
    final items = <FeedItem>[
      for (final post in _posts)
        if (myGroupIds.contains(post.groupId))
          FeedItem(
            id: 'feed-${post.id}',
            type: FeedItemType.groupPost,
            timestamp: post.createdAt,
            groupId: post.groupId,
            groupName: groups[post.groupId]?.name,
            post: post,
          ),
      ..._feedExtras,
      if (!myGroupIds.contains(_gMultigrade))
        FeedItem(
          id: 'demo-feed-grp-multigrade',
          type: FeedItemType.groupSuggestion,
          timestamp: _ago(const Duration(days: 1, hours: 2)),
          groupSuggestion: groups[_gMultigrade],
        ),
    ]..sort((a, b) => (b.timestamp ?? '').compareTo(a.timestamp ?? ''));
    return items;
  }

  String addPost({
    required String groupId,
    required String content,
    required PostType postType,
    required List<Map<String, dynamic>> attachments,
  }) {
    final id = nextId('post');
    _posts.add(
      GroupPost(
        id: id,
        groupId: groupId,
        authorUid: kDemoUid,
        authorName: kDemoTeacherName,
        content: content,
        postType: postType,
        attachments: <PostAttachment>[
          for (final raw in attachments.take(5))
            PostAttachment(
              type: _string(raw['type']) ?? 'image',
              resourceId: _string(raw['resourceId']),
              url: _string(raw['url']),
              title: _string(raw['title']),
            ),
        ],
        createdAt: nowIso(),
      ),
    );
    touchGroup(groupId);
    return id;
  }

  LikeResult toggleLike(String postId) {
    final index = _posts.indexWhere((p) => p.id == postId);
    if (index < 0) return const LikeResult(isLiked: false, newCount: 0);
    final post = _posts[index];
    final nowLiked = !likedPostIds.contains(postId);
    final count = post.likesCount + (nowLiked ? 1 : -1);
    final newCount = count < 0 ? 0 : count;
    if (nowLiked) {
      likedPostIds.add(postId);
    } else {
      likedPostIds.remove(postId);
    }
    _posts[index] = _postWithLikes(post, newCount);
    return LikeResult(isLiked: nowLiked, newCount: newCount);
  }

  // ── Seed: chats ─────────────────────────────────────────────────────────

  ChatMessage _chat(
    String id,
    String authorId,
    String text,
    Duration ago, {
    String? groupId,
    bool persona = false,
    String? authorName,
  }) => ChatMessage(
    id: id,
    text: text,
    authorId: authorId,
    authorName: authorName ?? _nameOf(authorId),
    isDemoPersona: persona,
    createdAt: _ago(ago),
    groupId: groupId,
  );

  void _seedChats() {
    staffRoomChat = _Live<List<ChatMessage>>(
      List<ChatMessage>.unmodifiable(<ChatMessage>[
        _chat(
          'demo-sr-1',
          _meena,
          'Good morning from Madurai! The monsoon finally reached us; half my '
              'class came in with wet uniforms.',
          const Duration(hours: 2, minutes: 10),
        ),
        _chat(
          'demo-sr-2',
          _arjun,
          'Morning, everyone. Anyone else on “Nutrition in plants” this '
              'week? I need a quick starch test for leaves.',
          const Duration(hours: 2),
        ),
        _chat(
          'demo-sr-3',
          _rahul,
          'Arjun ji, boil the leaf in water, then warm it in spirit to remove '
              'the green. A few drops of Betadine work as iodine. Cheap and '
              'safe.',
          const Duration(hours: 1, minutes: 55),
        ),
        _chat(
          'demo-sr-4',
          _lakshmi,
          'The Betadine trick works, we did it last year. Keep the windows '
              'open while warming the spirit.',
          const Duration(hours: 1, minutes: 40),
        ),
        _chat(
          'demo-sr-5',
          _sunita,
          'Question for multigrade teachers: how do you manage reading time '
              'when Class 1 needs you and Class 4 has finished early?',
          const Duration(hours: 1, minutes: 10),
        ),
        _chat(
          'demo-sr-6',
          'demo-persona-asha',
          'Sunita, many teachers keep a “finished early” basket: story cards '
              'that Class 4 children read aloud to a Class 1 partner. Both '
              'groups practise reading.',
          const Duration(hours: 1, minutes: 5),
          persona: true,
          authorName: _personaName,
        ),
        _chat(
          'demo-sr-7',
          _deepak,
          'A tip from Bhopal: we started 15-minute newspaper circles for '
              'Class 8. Monday attendance has gone up.',
          const Duration(minutes: 40),
        ),
        _chat(
          'demo-sr-8',
          kDemoUid,
          'Thank you, Rahul! Trying the Betadine test with Class 7 A '
              'tomorrow.',
          const Duration(minutes: 15),
        ),
      ]),
    );

    _groupChats[_gScience7] = _Live<List<ChatMessage>>(
      List<ChatMessage>.unmodifiable(<ChatMessage>[
        _chat(
          'demo-gc-sci-1',
          _fatima,
          'Uploaded the question bank in the posts. Please note the answer '
              'to Q12 in unit 4 is corrected.',
          const Duration(hours: 3),
          groupId: _gScience7,
        ),
        _chat(
          'demo-gc-sci-2',
          kDemoUid,
          'Thanks, Fatima! Using it for Friday’s unit test.',
          const Duration(hours: 2, minutes: 30),
          groupId: _gScience7,
        ),
        _chat(
          'demo-gc-sci-3',
          _rahul,
          'Kendra meeting has moved to Saturday, 11 am, same venue.',
          const Duration(hours: 1, minutes: 20),
          groupId: _gScience7,
        ),
        _chat(
          'demo-gc-sci-4',
          _fatima,
          'Noted. I will bring the bilingual charts.',
          const Duration(hours: 1, minutes: 5),
          groupId: _gScience7,
        ),
        _chat(
          'demo-gc-sci-5',
          _rahul,
          'Has anyone received the new practical notebook format yet?',
          const Duration(minutes: 40),
          groupId: _gScience7,
        ),
      ]),
    );

    _groupChats[_gMarathiMaths] = _Live<List<ChatMessage>>(
      List<ChatMessage>.unmodifiable(<ChatMessage>[
        _chat(
          'demo-gc-mm-1',
          _suresh,
          'Thank you for all the replies on place value. Trying the '
              'bundles-and-loose-sticks game tomorrow.',
          const Duration(hours: 20),
          groupId: _gMarathiMaths,
        ),
        _chat(
          'demo-gc-mm-2',
          _anjali,
          'Also try a place-value pocket chart from an old calendar. The '
              'children love moving the cards themselves.',
          const Duration(hours: 19),
          groupId: _gMarathiMaths,
        ),
        _chat(
          'demo-gc-mm-3',
          kDemoUid,
          'The pocket chart worked well with my Class 6 B too.',
          const Duration(hours: 3, minutes: 30),
          groupId: _gMarathiMaths,
        ),
      ]),
    );

    _groupChats[_gWagholiStaff] = _Live<List<ChatMessage>>(
      List<ChatMessage>.unmodifiable(<ChatMessage>[
        _chat(
          'demo-gc-ws-1',
          _vijay,
          'Staff meeting on Friday after school. Agenda: the annual day and '
              'the parents’ meeting.',
          const Duration(days: 1, hours: 4),
          groupId: _gWagholiStaff,
        ),
        _chat(
          'demo-gc-ws-2',
          _anjali,
          'Can the parents’ meeting be at 3 pm? Many mothers work in the '
              'fields till 2.',
          const Duration(days: 1, hours: 3),
          groupId: _gWagholiStaff,
        ),
        _chat(
          'demo-gc-ws-3',
          kDemoUid,
          'Agree with Anjali. I will prepare the Class 7 A progress charts.',
          const Duration(days: 1, hours: 2),
          groupId: _gWagholiStaff,
        ),
        _chat(
          'demo-gc-ws-4',
          _vijay,
          'Done, 3 pm it is. Thank you both.',
          const Duration(hours: 4),
          groupId: _gWagholiStaff,
        ),
      ]),
    );

    _groupChats[_gMultigrade] = _Live<List<ChatMessage>>(
      List<ChatMessage>.unmodifiable(<ChatMessage>[
        _chat(
          'demo-gc-mg-1',
          _sunita,
          'Welcome to all the new members! Please share a photo of your '
              'seating plan.',
          const Duration(hours: 6),
          groupId: _gMultigrade,
        ),
        _chat(
          'demo-gc-mg-2',
          _deepak,
          'U-shape for the older children, small circles for the younger '
              'ones. Works for us.',
          const Duration(hours: 5, minutes: 30),
          groupId: _gMultigrade,
        ),
      ]),
    );

    _groupChats[_gBriefing] = _Live<List<ChatMessage>>(
      List<ChatMessage>.unmodifiable(<ChatMessage>[
        _chat(
          'demo-gc-br-1',
          _suresh,
          'Is the training registration link the same as last year?',
          const Duration(hours: 1, minutes: 50),
          groupId: _gBriefing,
        ),
        _chat(
          'demo-gc-br-2',
          _sunita,
          'No, it is new. Ask your Kendra Pramukh for it.',
          const Duration(hours: 1, minutes: 30),
          groupId: _gBriefing,
        ),
      ]),
    );
  }

  _Live<List<ChatMessage>> groupChat(String groupId) => _groupChats.putIfAbsent(
    groupId,
    () => _Live<List<ChatMessage>>(const <ChatMessage>[]),
  );

  static const String _personaName = 'Asha Tai (AI teacher)';

  static const List<String> _personaLines = <String>[
    'A quick idea for today: end the period with a one-line exit ticket. '
        'What did you learn, and what is still confusing?',
    'Teaching “Weather and climate”? Ask each child to keep a five-day rain '
        'and temperature log at home, then compare logs in class.',
    'In a multigrade room, ten minutes of buddy reading every day, an older '
        'child with a younger one, builds fluency in both.',
  ];

  /// The persona heartbeat: posts the next AI-teacher line into the staff
  /// room, then disarms (null) once the short script is spent, so a long demo
  /// never fills the room.
  PersonaPulse? nextPersonaPulse() {
    if (_personaPulses >= _personaLines.length) return null;
    final line = _personaLines[_personaPulses++];
    staffRoomChat.value = List<ChatMessage>.unmodifiable(<ChatMessage>[
      ...staffRoomChat.value,
      ChatMessage(
        id: nextId('persona'),
        text: line,
        authorId: 'demo-persona-asha',
        authorName: _personaName,
        isDemoPersona: true,
        createdAt: nowIso(),
      ),
    ]);
    return PersonaPulse(
      message: line,
      personaName: _personaName,
      personaState: kDemoState,
      personaSubject: 'Pedagogy',
    );
  }

  // ── Connections ─────────────────────────────────────────────────────────

  MyConnectionData connectionData() => MyConnectionData(
    connectedUids: List<String>.unmodifiable(connected),
    sentRequestUids: List<String>.unmodifiable(sentTo),
    receivedRequests: List<ReceivedConnectionRequest>.unmodifiable(
      <ReceivedConnectionRequest>[
        for (final entry in received.entries)
          ReceivedConnectionRequest(uid: entry.value, requestId: entry.key),
      ],
    ),
  );

  /// "People you may know": up to five teachers the demo teacher is not yet
  /// connected to and has no inbound request from (an outgoing request still
  /// shows, as "Requested").
  List<TeacherSuggestion> recommendedTeachers() {
    const order = <String>[_vijay, _arjun, _lakshmi, _sunita, _kavita, _deepak];
    final inbound = received.values.toSet();
    return List<TeacherSuggestion>.unmodifiable(
      <TeacherSuggestion>[
        for (final uid in order)
          if (!connected.contains(uid) && !inbound.contains(uid))
            teachers[uid]!.toSuggestion(),
      ].take(5),
    );
  }

  ConnectionRequestResult requestConnection(String toUid) {
    if (connected.contains(toUid)) {
      return ConnectionRequestResult.alreadyConnected;
    }
    if (sentTo.contains(toUid) || received.containsValue(toUid)) {
      return ConnectionRequestResult.alreadyPending;
    }
    if (toUid.isNotEmpty && toUid != kDemoUid) sentTo.add(toUid);
    return ConnectionRequestResult.sent;
  }

  static const Map<String, String> _welcomeLines = <String, String>{
    _suresh:
        'Namaskar Priya tai, thank you for connecting! I loved your moon '
        'diary post. Could I try it with my Class 5?',
    _fatima:
        'Thank you for connecting! Happy to share the Urdu–Marathi '
        'question banks whenever you need them.',
  };

  /// Accepting promotes the sender into the connections and opens the DM,
  /// with a short hello from them so the new conversation shows in the inbox.
  void acceptRequest(String requestId) {
    final uid = received.remove(requestId);
    if (uid == null) return;
    connected.add(uid);
    sentTo.remove(uid);
    final id = directConversation(uid);
    _append(
      id.value,
      _message(
        id: nextId('msg'),
        senderId: uid,
        text:
            _welcomeLines[uid] ??
            'Thank you for connecting, Priya! Looking forward to sharing '
                'ideas.',
        createdAt: nowIso(),
        participants: <String>[kDemoUid, uid],
        readByMe: false,
      ),
    );
  }

  void declineRequest(String requestId) {
    received.remove(requestId);
  }

  void disconnect(String otherUid) {
    connected.remove(otherUid);
  }

  // ── Inbox ───────────────────────────────────────────────────────────────

  Message _message({
    required String id,
    required String senderId,
    required String text,
    required String createdAt,
    required List<String> participants,
    required bool readByMe,
    MessageType type = MessageType.text,
    SharedResource? resource,
    String? clientMessageId,
  }) => Message(
    id: id,
    type: type,
    text: text,
    senderId: senderId,
    senderName: _nameOf(senderId),
    resource: resource,
    readBy: <String>[
      senderId,
      // The demo teacher's own messages read as seen by the others.
      if (senderId == kDemoUid)
        ...participants.where((uid) => uid != kDemoUid)
      else if (readByMe)
        kDemoUid,
    ],
    deliveredTo: <String>[
      for (final uid in participants)
        if (uid != senderId) uid,
    ],
    createdAt: createdAt,
    clientMessageId: clientMessageId,
    deliveryStatus: MessageDeliveryStatus.sent,
  );

  void _seedConversations() {
    // 1. Anjali — same school; two unread.
    _seedDirect(
      _anjali,
      unreadForMe: 2,
      messages: <({String from, String text, Duration ago, SharedResource? res})>[
        (
          from: _anjali,
          text:
              'Priya, are you free for a joint maths–science period on '
              'Friday? I am thinking measurement and density.',
          ago: const Duration(days: 1, hours: 3),
          res: null,
        ),
        (
          from: kDemoUid,
          text:
              'Yes! Let’s do the floating and sinking activity with the '
              'measuring jars from the lab.',
          ago: const Duration(days: 1, hours: 2, minutes: 30),
          res: null,
        ),
        (
          from: _anjali,
          text: 'Perfect. I will bring the weighing scale from the office.',
          ago: const Duration(days: 1, hours: 2),
          res: null,
        ),
        (
          from: kDemoUid,
          text: 'Here is the lesson plan I made for it.',
          ago: const Duration(hours: 20),
          res: const SharedResource(
            id: 'demo-res-density',
            kind: SharedResourceKind.lessonPlan,
            title: 'Floating and sinking – density (Class 7)',
            route: 'lesson-planner',
            gradeLevel: 'Class 7',
            subject: 'Science',
            language: 'English',
          ),
        ),
        (
          from: _anjali,
          text:
              'Read it, lovely. Can we add a quick estimation warm-up at the '
              'start?',
          ago: const Duration(minutes: 35),
          res: null,
        ),
        (
          from: _anjali,
          text:
              'Also, the headmaster wants both our classes for the 3 pm '
              'parents’ meeting slot.',
          ago: const Duration(minutes: 30),
          res: null,
        ),
      ],
    );

    // 2. Rahul — all read; the last message is the demo teacher's.
    _seedDirect(
      _rahul,
      unreadForMe: 0,
      messages:
          <({String from, String text, Duration ago, SharedResource? res})>[
            (
              from: _rahul,
              text:
                  'Sending you the turmeric indicator photos from today’s '
                  'class.',
              ago: const Duration(days: 2),
              res: null,
            ),
            (
              from: kDemoUid,
              text: 'These are brilliant. My students will love it.',
              ago: const Duration(days: 1, hours: 23),
              res: null,
            ),
            (
              from: _rahul,
              text:
                  'Will you bring Class 7 A’s rainwater model to the Kendra '
                  'meeting? Everyone wants to see it.',
              ago: const Duration(days: 1, hours: 20),
              res: null,
            ),
            (
              from: kDemoUid,
              text:
                  'Of course. The children are already arguing about who will '
                  'explain it.',
              ago: const Duration(days: 1, hours: 19),
              res: null,
            ),
            (
              from: kDemoUid,
              text: 'Saturday, 11 am works. See you there.',
              ago: const Duration(hours: 5),
              res: null,
            ),
          ],
    );

    // 3. Meena — one unread.
    _seedDirect(
      _meena,
      unreadForMe: 1,
      messages:
          <({String from, String text, Duration ago, SharedResource? res})>[
            (
              from: kDemoUid,
              text:
                  'Meena, your phonics chart idea in the staff room was '
                  'wonderful. Could you share the template?',
              ago: const Duration(days: 3),
              res: null,
            ),
            (
              from: _meena,
              text:
                  'Of course! It works for Marathi letters too if you change '
                  'the pictures.',
              ago: const Duration(days: 2, hours: 23),
              res: null,
            ),
            (
              from: _meena,
              text: 'Here is the template.',
              ago: const Duration(days: 2, hours: 12),
              res: const SharedResource(
                id: 'demo-res-phonics-chart',
                kind: SharedResourceKind.worksheet,
                title: 'Picture–sound phonics chart (editable)',
                route: 'worksheet-wizard',
                gradeLevel: 'Class 6',
                subject: 'English',
                language: 'English',
              ),
            ),
            (
              from: _meena,
              text:
                  'Did the chart work with your Class 6? Would love to see a '
                  'photo.',
              ago: const Duration(hours: 1),
              res: null,
            ),
          ],
    );

    // 4. A group conversation — the cluster science-fair planning group.
    const groupId = 'demo-conv-science-fair';
    const members = <String>[kDemoUid, _rahul, _anjali, _vijay];
    final lines = <({String from, String text, Duration ago})>[
      (
        from: _rahul,
        text: 'Made this group to plan the cluster science fair.',
        ago: const Duration(days: 2, hours: 6),
      ),
      (
        from: _vijay,
        text: 'Good idea. The fair is on the 28th in our school hall.',
        ago: const Duration(days: 2, hours: 5, minutes: 30),
      ),
      (
        from: _anjali,
        text: 'I can run the maths corner: measurement and estimation games.',
        ago: const Duration(days: 2, hours: 5),
      ),
      (
        from: kDemoUid,
        text:
            'Class 7 A will show the rainwater model and a water-filter '
            'demo.',
        ago: const Duration(days: 2, hours: 4),
      ),
      (
        from: _vijay,
        text: 'Please send me the tables and charts you need by Monday.',
        ago: const Duration(days: 1),
      ),
      (
        from: _rahul,
        text: 'Sent mine. Priya, Anjali, yours?',
        ago: const Duration(hours: 7),
      ),
    ];
    final messages = <Message>[
      for (final (i, line) in lines.indexed)
        _message(
          id: '$groupId-m${i + 1}',
          senderId: line.from,
          text: line.text,
          createdAt: _ago(line.ago),
          participants: members,
          readByMe: true,
        ),
    ];
    _threads[groupId] = _Live<List<Message>>(
      List<Message>.unmodifiable(messages),
    );
    _conversations[groupId] = Conversation(
      id: const ConversationId(groupId),
      type: ConversationType.group,
      participantIds: members,
      participants: <String, ParticipantSnapshot>{
        for (final uid in members) uid: teacherOrMe(uid)!.toParticipant(),
      },
      name: 'Cluster science fair – planning',
      createdBy: _rahul,
      lastMessage: messages.last.text,
      lastMessageAt: messages.last.createdAt,
      lastMessageSenderId: messages.last.senderId,
      unreadCount: <String, int>{for (final uid in members) uid: 0},
      createdAt: _ago(const Duration(days: 2, hours: 6)),
      updatedAt: messages.last.createdAt,
    );
  }

  void _seedDirect(
    String otherUid, {
    required int unreadForMe,
    required List<
      ({String from, String text, Duration ago, SharedResource? res})
    >
    messages,
  }) {
    final id = ConversationId.direct(kDemoUid, otherUid);
    final participants = <String>[kDemoUid, otherUid];
    final thread = <Message>[
      for (final (i, line) in messages.indexed)
        _message(
          id: '${id.value}-m${i + 1}',
          senderId: line.from,
          text: line.text,
          createdAt: _ago(line.ago),
          participants: participants,
          // The last [unreadForMe] messages from the other teacher are unread.
          readByMe: i < messages.length - unreadForMe,
          type: line.res == null ? MessageType.text : MessageType.resource,
          resource: line.res,
        ),
    ];
    _threads[id.value] = _Live<List<Message>>(
      List<Message>.unmodifiable(thread),
    );
    final last = thread.last;
    _conversations[id.value] = Conversation(
      id: id,
      type: ConversationType.direct,
      participantIds: participants,
      participants: <String, ParticipantSnapshot>{
        kDemoUid: _demoTeacher.toParticipant(),
        otherUid: teachers[otherUid]!.toParticipant(),
      },
      lastMessage: _preview(last),
      lastMessageAt: last.createdAt,
      lastMessageSenderId: last.senderId,
      unreadCount: <String, int>{kDemoUid: unreadForMe, otherUid: 0},
      createdAt: thread.first.createdAt,
      updatedAt: last.createdAt,
    );
  }

  _Live<List<Message>> thread(String conversationId) => _threads.putIfAbsent(
    conversationId,
    () => _Live<List<Message>>(const <Message>[]),
  );

  /// Publishes the inbox (conversations with at least one message, newest
  /// first — like the `orderBy lastMessageAt` query) and the unread total.
  void _publishInbox() {
    final rows =
        _conversations.values
            .where((c) => (c.lastMessageAt ?? '').isNotEmpty)
            .toList()
          ..sort((a, b) => b.lastMessageAt!.compareTo(a.lastMessageAt!));
    inbox.value = List<Conversation>.unmodifiable(rows);
    unread.value = rows.fold<int>(0, (sum, c) => sum + c.unreadFor(kDemoUid));
  }

  ConversationId directConversation(String otherUid) {
    final id = ConversationId.direct(kDemoUid, otherUid);
    if (!_conversations.containsKey(id.value)) {
      final other = teacherOrMe(otherUid);
      _conversations[id.value] = Conversation(
        id: id,
        type: ConversationType.direct,
        participantIds: <String>[kDemoUid, otherUid],
        participants: <String, ParticipantSnapshot>{
          kDemoUid: _demoTeacher.toParticipant(),
          otherUid:
              other?.toParticipant() ??
              const ParticipantSnapshot(displayName: 'Teacher'),
        },
        lastMessage: '',
        lastMessageSenderId: '',
        unreadCount: <String, int>{kDemoUid: 0, otherUid: 0},
        createdAt: nowIso(),
      );
    }
    return id;
  }

  ConversationId createGroupConversation(
    List<String> participantUids,
    String name,
  ) {
    final id = nextId('conv');
    final members = <String>{kDemoUid, ...participantUids}.toList();
    _conversations[id] = Conversation(
      id: ConversationId(id),
      type: ConversationType.group,
      participantIds: members,
      participants: <String, ParticipantSnapshot>{
        for (final uid in members)
          uid:
              teacherOrMe(uid)?.toParticipant() ??
              const ParticipantSnapshot(displayName: 'Teacher'),
      },
      name: name.trim().isEmpty ? 'New group' : name.trim(),
      createdBy: kDemoUid,
      lastMessage: '',
      lastMessageSenderId: '',
      unreadCount: <String, int>{for (final uid in members) uid: 0},
      createdAt: nowIso(),
    );
    return ConversationId(id);
  }

  String sendMessage(SendMessageInput input) {
    final conversationId = input.conversationId.value;
    final conversation =
        _conversations[conversationId] ??
        _conversations[directConversationFor(input.conversationId)];
    final participants = conversation?.participantIds ?? <String>[kDemoUid];
    final trimmedClientId = input.clientMessageId?.trim();
    final clientId = trimmedClientId == null || trimmedClientId.isEmpty
        ? null
        : trimmedClientId;

    // Idempotent on the client id, like the real route: a retry of a send
    // that already landed does not add a second message.
    final existing = thread(conversationId).value;
    if (clientId != null && existing.any((m) => m.id == clientId)) {
      return clientId;
    }

    final message = _message(
      id: clientId ?? nextId('msg'),
      senderId: kDemoUid,
      text: input.text.trim(),
      createdAt: nowIso(),
      participants: participants,
      readByMe: true,
      type: input.type,
      resource: input.type == MessageType.resource
          ? _resourceFrom(input.resource)
          : null,
      clientMessageId: clientId,
    );
    _append(conversationId, message);
    return message.id;
  }

  /// Resolves the conversation a direct id refers to when it was never opened
  /// through [directConversation] (a cold deep link); creates it.
  String directConversationFor(ConversationId id) {
    final pair = id.directPair;
    if (pair == null) return id.value;
    final other = pair.a == kDemoUid ? pair.b : pair.a;
    return directConversation(other).value;
  }

  /// Appends [message] to its thread and updates the conversation's inbox row:
  /// preview, time, and the unread tally of everyone but the sender.
  void _append(String conversationId, Message message) {
    final live = thread(conversationId);
    live.value = List<Message>.unmodifiable(<Message>[...live.value, message]);
    final conversation = _conversations[conversationId];
    if (conversation != null) {
      _conversations[conversationId] = _withConversation(
        conversation,
        lastMessage: _preview(message),
        lastMessageAt: message.createdAt,
        lastMessageSenderId: message.senderId,
        unreadCount: <String, int>{
          for (final uid in conversation.participantIds)
            uid: uid == message.senderId ? 0 : conversation.unreadFor(uid) + 1,
        },
      );
    }
    _publishInbox();
  }

  void markRead(String conversationId) {
    final conversation = _conversations[conversationId];
    if (conversation != null && conversation.unreadFor(kDemoUid) != 0) {
      _conversations[conversationId] = _withConversation(
        conversation,
        unreadCount: <String, int>{...conversation.unreadCount, kDemoUid: 0},
      );
      _publishInbox();
    }
    final live = _threads[conversationId];
    if (live == null) return;
    if (live.value.every((m) => m.readBy.contains(kDemoUid))) return;
    live.value = List<Message>.unmodifiable(<Message>[
      for (final m in live.value)
        if (m.readBy.contains(kDemoUid))
          m
        else
          Message(
            id: m.id,
            type: m.type,
            text: m.text,
            senderId: m.senderId,
            senderName: m.senderName,
            senderPhotoURL: m.senderPhotoURL,
            resource: m.resource,
            audioUrl: m.audioUrl,
            audioDuration: m.audioDuration,
            readBy: <String>[...m.readBy, kDemoUid],
            deliveredTo: m.deliveredTo,
            createdAt: m.createdAt,
            clientMessageId: m.clientMessageId,
            deliveryStatus: m.deliveryStatus,
          ),
    ]);
  }

  static Conversation _withConversation(
    Conversation c, {
    String? lastMessage,
    String? lastMessageAt,
    String? lastMessageSenderId,
    Map<String, int>? unreadCount,
  }) => Conversation(
    id: c.id,
    type: c.type,
    participantIds: c.participantIds,
    participants: c.participants,
    name: c.name,
    groupPhotoURL: c.groupPhotoURL,
    createdBy: c.createdBy,
    lastMessage: lastMessage ?? c.lastMessage,
    lastMessageAt: lastMessageAt ?? c.lastMessageAt,
    lastMessageSenderId: lastMessageSenderId ?? c.lastMessageSenderId,
    unreadCount: unreadCount ?? c.unreadCount,
    createdAt: c.createdAt,
    updatedAt: lastMessageAt ?? c.updatedAt,
  );

  /// The ≤80-character inbox snippet for [message].
  static String _preview(Message message) {
    var text = message.text.trim();
    if (text.isEmpty) {
      text = switch (message.type) {
        MessageType.resource => message.resource?.title ?? 'Shared a resource',
        MessageType.audio => 'Voice note',
        MessageType.text => '',
      };
    }
    return text.length <= 80 ? text : '${text.substring(0, 79)}…';
  }

  static SharedResource? _resourceFrom(Map<String, dynamic>? json) {
    if (json == null) return null;
    final title = _string(json['title']);
    if (title == null || title.isEmpty) return null;
    return SharedResource(
      id: _string(json['id']) ?? 'demo-res-shared',
      kind: SharedResourceKind.fromWire(_string(json['type'])),
      title: title,
      route: _string(json['route']) ?? 'lesson-planner',
      gradeLevel: _string(json['gradeLevel']),
      subject: _string(json['subject']),
      language: _string(json['language']),
    );
  }
}

String? _string(Object? value) => value is String ? value : null;
