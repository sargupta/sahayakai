/// Data models for the Community feature.

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/// Post types for community feed posts.
enum PostType { share, askHelp, celebrate, resource, discussion, question, announcement, tip }

/// Group types for community groups.
enum GroupType {
  subject,
  grade,
  school,
  custom;

  String get displayName {
    switch (this) {
      case GroupType.subject:
        return 'Subject';
      case GroupType.grade:
        return 'Grade';
      case GroupType.school:
        return 'School';
      case GroupType.custom:
        return 'Custom';
    }
  }
}

/// Connection request statuses.
enum ConnectionStatus { pending, accepted, declined, none }

// ---------------------------------------------------------------------------
// CommunityPost
// ---------------------------------------------------------------------------

/// A post in the community feed or a group.
class CommunityPost {
  final String id;
  final String? groupId;
  final String authorUid;
  final String authorName;
  final String? authorPhotoURL;
  final String content;
  final PostType postType;
  final List<String> attachments;
  int likesCount;
  int commentsCount;
  bool isLiked;
  final String? createdAt; // ISO-8601
  final String authorRole;
  final List<String> tags;

  CommunityPost({
    required this.id,
    this.groupId,
    this.authorUid = '',
    required this.authorName,
    this.authorPhotoURL,
    required this.content,
    this.postType = PostType.share,
    this.attachments = const [],
    this.likesCount = 0,
    this.commentsCount = 0,
    this.isLiked = false,
    this.createdAt,
    this.authorRole = '',
    this.tags = const [],
  });

  /// Alias used by screens for the avatar URL.
  String get authorAvatarUrl => authorPhotoURL ?? '';

  /// Alias used by screens for the like state.
  bool get isLikedByMe => isLiked;
  set isLikedByMe(bool value) => isLiked = value;

  /// Alias used by screens for like count.
  int get likeCount => likesCount;
  set likeCount(int value) => likesCount = value;

  /// Alias used by screens for comment count.
  int get commentCount => commentsCount;

  factory CommunityPost.fromJson(Map<String, dynamic> json) => CommunityPost(
        id: json['id'] as String? ?? '',
        groupId: json['groupId'] as String?,
        authorUid: json['authorUid'] as String? ?? '',
        authorName: json['authorName'] as String? ?? '',
        authorPhotoURL: json['authorPhotoURL'] as String?,
        content: json['content'] as String? ?? '',
        postType: _parsePostType(json['postType'] as String?),
        attachments: (json['attachments'] as List<dynamic>?)
                ?.map((e) => e as String)
                .toList() ??
            [],
        likesCount: json['likesCount'] as int? ?? 0,
        commentsCount: json['commentsCount'] as int? ?? 0,
        isLiked: json['isLiked'] as bool? ?? false,
        createdAt: json['createdAt'] as String?,
        authorRole: json['authorRole'] as String? ?? '',
        tags: (json['tags'] as List<dynamic>?)
                ?.map((e) => e as String)
                .toList() ??
            [],
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        if (groupId != null) 'groupId': groupId,
        'authorUid': authorUid,
        'authorName': authorName,
        if (authorPhotoURL != null) 'authorPhotoURL': authorPhotoURL,
        'content': content,
        'postType': postType.name,
        'attachments': attachments,
        'likesCount': likesCount,
        'commentsCount': commentsCount,
        'isLiked': isLiked,
        if (createdAt != null) 'createdAt': createdAt,
        'authorRole': authorRole,
        'tags': tags,
      };
}

// ---------------------------------------------------------------------------
// CommunityGroup
// ---------------------------------------------------------------------------

/// A community group that teachers can join.
class CommunityGroup {
  final String id;
  final String name;
  final String? description;
  final GroupType type;
  final int memberCount;
  final String? lastActivityAt; // ISO-8601
  final String? iconUrl;

  const CommunityGroup({
    required this.id,
    required this.name,
    this.description,
    required this.type,
    this.memberCount = 0,
    this.lastActivityAt,
    this.iconUrl,
  });

  factory CommunityGroup.fromJson(Map<String, dynamic> json) => CommunityGroup(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        description: json['description'] as String?,
        type: _parseGroupType(json['type'] as String?),
        memberCount: json['memberCount'] as int? ?? 0,
        lastActivityAt: json['lastActivityAt'] as String?,
        iconUrl: json['iconUrl'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        if (description != null) 'description': description,
        'type': type.name,
        'memberCount': memberCount,
        if (lastActivityAt != null) 'lastActivityAt': lastActivityAt,
        if (iconUrl != null) 'iconUrl': iconUrl,
      };
}

// ---------------------------------------------------------------------------
// CommunityComment
// ---------------------------------------------------------------------------

/// A comment on a community post.
class CommunityComment {
  final String id;
  final String postId;
  final String authorUid;
  final String authorName;
  final String? authorPhotoURL;
  final String content;
  final String? createdAt; // ISO-8601

  const CommunityComment({
    required this.id,
    required this.postId,
    required this.authorUid,
    required this.authorName,
    this.authorPhotoURL,
    required this.content,
    this.createdAt,
  });

  factory CommunityComment.fromJson(Map<String, dynamic> json) =>
      CommunityComment(
        id: json['id'] as String? ?? '',
        postId: json['postId'] as String? ?? '',
        authorUid: json['authorUid'] as String? ?? '',
        authorName: json['authorName'] as String? ?? '',
        authorPhotoURL: json['authorPhotoURL'] as String?,
        content: json['content'] as String? ?? '',
        createdAt: json['createdAt'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'postId': postId,
        'authorUid': authorUid,
        'authorName': authorName,
        if (authorPhotoURL != null) 'authorPhotoURL': authorPhotoURL,
        'content': content,
        if (createdAt != null) 'createdAt': createdAt,
      };
}

// ---------------------------------------------------------------------------
// ChatMessage
// ---------------------------------------------------------------------------

/// A real-time chat message within a group.
class ChatMessage {
  final String id;
  final String groupId;
  final String text;
  final String? audioUrl;
  final String authorId;
  final String authorName;
  final String? authorPhotoURL;
  final String? createdAt; // ISO-8601

  const ChatMessage({
    required this.id,
    this.groupId = '',
    required this.text,
    this.audioUrl,
    required this.authorId,
    required this.authorName,
    this.authorPhotoURL,
    this.createdAt,
  });

  /// Alias used by screens.
  String get senderId => authorId;

  /// Alias used by screens.
  String get senderName => authorName;

  /// Alias used by screens.
  String get senderAvatarUrl => authorPhotoURL ?? '';

  /// Alias used by screens — parses createdAt ISO-8601 string.
  DateTime get timestamp =>
      createdAt != null ? DateTime.parse(createdAt!) : DateTime.now();

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        id: json['id'] as String? ?? '',
        groupId: json['groupId'] as String? ?? '',
        text: json['text'] as String? ?? '',
        audioUrl: json['audioUrl'] as String?,
        authorId: json['authorId'] as String? ?? '',
        authorName: json['authorName'] as String? ?? '',
        authorPhotoURL: json['authorPhotoURL'] as String?,
        createdAt: json['createdAt'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'groupId': groupId,
        'text': text,
        if (audioUrl != null) 'audioUrl': audioUrl,
        'authorId': authorId,
        'authorName': authorName,
        if (authorPhotoURL != null) 'authorPhotoURL': authorPhotoURL,
        if (createdAt != null) 'createdAt': createdAt,
      };
}

// ---------------------------------------------------------------------------
// CommunityResource
// ---------------------------------------------------------------------------

/// A shared resource in the community library.
class CommunityResource {
  final String id;
  final String? type;
  final String title;
  final String? description;
  final String authorId;
  final String authorName;
  final String? language;
  final String? gradeLevel;
  final String? subject;
  final int likesCount;
  final int downloadsCount;
  final bool isLiked;
  final bool isSaved;
  final String? createdAt; // ISO-8601

  const CommunityResource({
    required this.id,
    this.type,
    required this.title,
    this.description,
    this.authorId = '',
    required this.authorName,
    this.language,
    this.gradeLevel,
    this.subject,
    this.likesCount = 0,
    this.downloadsCount = 0,
    this.isLiked = false,
    this.isSaved = false,
    this.createdAt,
  });

  factory CommunityResource.fromJson(Map<String, dynamic> json) =>
      CommunityResource(
        id: json['id'] as String? ?? '',
        type: json['type'] as String?,
        title: json['title'] as String? ?? '',
        description: json['description'] as String?,
        authorId: json['authorId'] as String? ?? '',
        authorName: json['authorName'] as String? ?? '',
        language: json['language'] as String?,
        gradeLevel: json['gradeLevel'] as String?,
        subject: json['subject'] as String?,
        likesCount: json['likesCount'] as int? ?? 0,
        downloadsCount: json['downloadsCount'] as int? ?? 0,
        isLiked: json['isLiked'] as bool? ?? false,
        isSaved: json['isSaved'] as bool? ?? false,
        createdAt: json['createdAt'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        if (type != null) 'type': type,
        'title': title,
        if (description != null) 'description': description,
        'authorId': authorId,
        'authorName': authorName,
        if (language != null) 'language': language,
        if (gradeLevel != null) 'gradeLevel': gradeLevel,
        if (subject != null) 'subject': subject,
        'likesCount': likesCount,
        'downloadsCount': downloadsCount,
        'isLiked': isLiked,
        'isSaved': isSaved,
        if (createdAt != null) 'createdAt': createdAt,
      };
}

// ---------------------------------------------------------------------------
// ConnectionRequest
// ---------------------------------------------------------------------------

/// A pending connection request between teachers.
class ConnectionRequest {
  final String id;
  final String fromUid;
  final String fromName;
  final String? fromPhotoURL;
  final String toUid;
  final ConnectionStatus status;
  final String? createdAt; // ISO-8601

  const ConnectionRequest({
    required this.id,
    required this.fromUid,
    required this.fromName,
    this.fromPhotoURL,
    this.toUid = '',
    this.status = ConnectionStatus.pending,
    this.createdAt,
  });

  factory ConnectionRequest.fromJson(Map<String, dynamic> json) =>
      ConnectionRequest(
        id: json['id'] as String? ?? '',
        fromUid: json['fromUid'] as String? ?? '',
        fromName: json['fromName'] as String? ?? '',
        fromPhotoURL: json['fromPhotoURL'] as String?,
        toUid: json['toUid'] as String? ?? '',
        status: _parseConnectionStatus(json['status'] as String?),
        createdAt: json['createdAt'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'fromUid': fromUid,
        'fromName': fromName,
        if (fromPhotoURL != null) 'fromPhotoURL': fromPhotoURL,
        'toUid': toUid,
        'status': status.name,
        if (createdAt != null) 'createdAt': createdAt,
      };
}

// ---------------------------------------------------------------------------
// TeacherConnection
// ---------------------------------------------------------------------------

/// An established connection between two teachers.
class TeacherConnection {
  final String id;
  final List<String> uids;
  final List<String> names;
  final List<String> photoURLs;
  final String initiatedBy;
  final String? connectedAt; // ISO-8601

  /// Single-teacher fields used by the Discover / Connected screens.
  final String? teacherName;
  final List<String> subjects;
  final List<String> grades;

  const TeacherConnection({
    required this.id,
    this.uids = const [],
    this.names = const [],
    this.photoURLs = const [],
    this.initiatedBy = '',
    this.connectedAt,
    this.teacherName,
    this.subjects = const [],
    this.grades = const [],
  });

  /// Alias: screens access [name] for a single-teacher representation.
  String get name => teacherName ?? (names.isNotEmpty ? names.first : '');

  factory TeacherConnection.fromJson(Map<String, dynamic> json) =>
      TeacherConnection(
        id: json['id'] as String? ?? '',
        uids: (json['uids'] as List<dynamic>?)
                ?.map((e) => e as String)
                .toList() ??
            [],
        names: (json['names'] as List<dynamic>?)
                ?.map((e) => e as String)
                .toList() ??
            [],
        photoURLs: (json['photoURLs'] as List<dynamic>?)
                ?.map((e) => e as String)
                .toList() ??
            [],
        initiatedBy: json['initiatedBy'] as String? ?? '',
        connectedAt: json['connectedAt'] as String?,
        teacherName: json['teacherName'] as String? ?? json['name'] as String?,
        subjects: (json['subjects'] as List<dynamic>?)
                ?.map((e) => e as String)
                .toList() ??
            [],
        grades: (json['grades'] as List<dynamic>?)
                ?.map((e) => e as String)
                .toList() ??
            [],
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'uids': uids,
        'names': names,
        'photoURLs': photoURLs,
        'initiatedBy': initiatedBy,
        if (connectedAt != null) 'connectedAt': connectedAt,
        if (teacherName != null) 'teacherName': teacherName,
        'subjects': subjects,
        'grades': grades,
      };
}

// ---------------------------------------------------------------------------
// Enum parsing helpers
// ---------------------------------------------------------------------------

PostType _parsePostType(String? value) {
  switch (value) {
    case 'share':
      return PostType.share;
    case 'askHelp':
      return PostType.askHelp;
    case 'celebrate':
      return PostType.celebrate;
    case 'resource':
      return PostType.resource;
    case 'discussion':
      return PostType.discussion;
    case 'question':
      return PostType.question;
    case 'announcement':
      return PostType.announcement;
    case 'tip':
      return PostType.tip;
    default:
      return PostType.share;
  }
}

GroupType _parseGroupType(String? value) {
  switch (value) {
    case 'subject':
      return GroupType.subject;
    case 'grade':
      return GroupType.grade;
    case 'school':
      return GroupType.school;
    case 'custom':
      return GroupType.custom;
    default:
      return GroupType.custom;
  }
}

ConnectionStatus _parseConnectionStatus(String? value) {
  switch (value) {
    case 'pending':
      return ConnectionStatus.pending;
    case 'accepted':
      return ConnectionStatus.accepted;
    case 'declined':
      return ConnectionStatus.declined;
    case 'none':
      return ConnectionStatus.none;
    default:
      return ConnectionStatus.pending;
  }
}
