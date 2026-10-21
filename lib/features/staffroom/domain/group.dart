import 'package:flutter/foundation.dart';

/// The auto-provisioning kind of a group
/// (`src/types/community.ts::GroupType`). [fromWire] tolerant → [interest] (the
/// most generic bucket) so an unknown/future group type still renders.
enum GroupType {
  subjectGrade('subject_grade'),
  school('school'),
  region('region'),
  interest('interest');

  const GroupType(this.wire);

  final String wire;

  static GroupType fromWire(String? wire) {
    for (final t in GroupType.values) {
      if (t.wire == wire) return t;
    }
    return GroupType.interest;
  }
}

/// A teacher's role inside a group (`src/types/community.ts::GroupMember.role`).
enum GroupRole {
  member('member'),
  moderator('moderator');

  const GroupRole(this.wire);

  final String wire;

  static GroupRole fromWire(String? wire) {
    for (final r in GroupRole.values) {
      if (r.wire == wire) return r;
    }
    return GroupRole.member;
  }
}

/// One of the four `SHARE_TEMPLATES` post types
/// (`src/types/community.ts::PostType`). [fromWire] tolerant → [share].
enum PostType {
  share('share'),
  askHelp('ask_help'),
  celebrate('celebrate'),
  resource('resource');

  const PostType(this.wire);

  final String wire;

  static PostType fromWire(String? wire) {
    for (final t in PostType.values) {
      if (t.wire == wire) return t;
    }
    return PostType.share;
  }
}

/// The auto-join rule bundle on a group
/// (`src/types/community.ts::Group.autoJoinRules`).
@immutable
class GroupAutoJoinRules {
  const GroupAutoJoinRules({
    this.subjects = const <String>[],
    this.grades = const <String>[],
    this.board,
    this.school,
    this.state,
  });

  final List<String> subjects;
  final List<String> grades;
  final String? board;
  final String? school;
  final String? state;

  @override
  bool operator ==(Object other) =>
      other is GroupAutoJoinRules &&
      listEquals(other.subjects, subjects) &&
      listEquals(other.grades, grades) &&
      other.board == board &&
      other.school == school &&
      other.state == state;

  @override
  int get hashCode => Object.hash(
        Object.hashAll(subjects),
        Object.hashAll(grades),
        board,
        school,
        state,
      );
}

/// A `groups/{id}` document (`src/types/community.ts::Group`). Group metadata is
/// world-readable to any signed-in teacher (`firestore.rules`); posts/chat inside
/// are member-gated.
@immutable
class Group {
  const Group({
    required this.id,
    required this.name,
    required this.description,
    required this.type,
    required this.coverColor,
    required this.memberCount,
    required this.autoJoinRules,
    required this.createdBy,
    this.lastActivityAt,
    this.createdAt,
  });

  final String id;
  final String name;
  final String description;
  final GroupType type;

  /// A CSS gradient string (e.g. `linear-gradient(135deg, #fb923c, #f59e0b)`)
  /// or a Tailwind gradient class — mapped to an `IconWell` tint spine in the
  /// UI, never a full-bleed wash (§2.4 gradient ban). Kept as the raw string; a
  /// missing value is `''` and the UI falls back to a deterministic token tint.
  final String coverColor;
  final int memberCount;
  final GroupAutoJoinRules autoJoinRules;

  /// `'system'` for auto-created groups, or the creator uid.
  final String createdBy;
  final String? lastActivityAt;
  final String? createdAt;

  bool get isSystemCreated => createdBy == 'system';

  @override
  bool operator ==(Object other) =>
      other is Group &&
      other.id == id &&
      other.name == name &&
      other.description == description &&
      other.type == type &&
      other.coverColor == coverColor &&
      other.memberCount == memberCount &&
      other.autoJoinRules == autoJoinRules &&
      other.createdBy == createdBy &&
      other.lastActivityAt == lastActivityAt &&
      other.createdAt == createdAt;

  @override
  int get hashCode => Object.hash(
        id,
        name,
        description,
        type,
        coverColor,
        memberCount,
        autoJoinRules,
        createdBy,
        lastActivityAt,
        createdAt,
      );
}

/// An attachment on a group post (`src/types/community.ts::PostAttachment`).
@immutable
class PostAttachment {
  const PostAttachment({
    required this.type,
    this.resourceId,
    this.url,
    this.title,
  });

  /// A `ContentType` or `'image'` / `'audio'`.
  final String type;
  final String? resourceId;
  final String? url;
  final String? title;

  @override
  bool operator ==(Object other) =>
      other is PostAttachment &&
      other.type == type &&
      other.resourceId == resourceId &&
      other.url == url &&
      other.title == title;

  @override
  int get hashCode => Object.hash(type, resourceId, url, title);
}

/// A `groups/{id}/posts/{id}` document (`src/types/community.ts::GroupPost`).
/// Member-gated read. Likes are hydrated separately (`getLikedItemIdsAction`)
/// and toggled optimistically (`likeGroupPostAction`).
@immutable
class GroupPost {
  const GroupPost({
    required this.id,
    required this.groupId,
    required this.authorUid,
    required this.authorName,
    required this.content,
    required this.postType,
    this.authorPhotoURL,
    this.attachments = const <PostAttachment>[],
    this.likesCount = 0,
    this.commentsCount = 0,
    this.translations = const <String, String>{},
    this.createdAt,
  });

  final String id;
  final String groupId;
  final String authorUid;
  final String authorName;
  final String? authorPhotoURL;

  /// Post body (≤2000 chars server-enforced).
  final String content;
  final PostType postType;
  final List<PostAttachment> attachments;
  final int likesCount;
  final int commentsCount;

  /// Multilingual translations keyed by full Language name (e.g. `"Hindi"`).
  final Map<String, String> translations;
  final String? createdAt;

  @override
  bool operator ==(Object other) =>
      other is GroupPost &&
      other.id == id &&
      other.groupId == groupId &&
      other.authorUid == authorUid &&
      other.authorName == authorName &&
      other.authorPhotoURL == authorPhotoURL &&
      other.content == content &&
      other.postType == postType &&
      listEquals(other.attachments, attachments) &&
      other.likesCount == likesCount &&
      other.commentsCount == commentsCount &&
      mapEquals(other.translations, translations) &&
      other.createdAt == createdAt;

  @override
  int get hashCode => Object.hash(
        id,
        groupId,
        authorUid,
        authorName,
        authorPhotoURL,
        content,
        postType,
        Object.hashAll(attachments),
        likesCount,
        commentsCount,
        Object.hashAllUnordered(translations.keys),
        createdAt,
      );
}
