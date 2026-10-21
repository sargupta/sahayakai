import 'package:flutter/foundation.dart';

import 'group.dart';

/// A top-level `posts/{id}` document — the legacy public community feed
/// (`createPostAction` / `getPosts`). Distinct from a [GroupPost] (which lives
/// under `groups/{id}/posts`). The doc carries `{ authorId, content, visibility,
/// gradeLevel, subject, likesCount, commentsCount, createdAt, imageUrl? }`;
/// `authorName`/`authorPhotoURL` are denormalised on some read paths, so they are
/// modelled nullable.
@immutable
class CommunityPost {
  const CommunityPost({
    required this.id,
    required this.authorId,
    required this.content,
    this.authorName,
    this.authorPhotoURL,
    this.visibility = 'public',
    this.gradeLevel,
    this.subject,
    this.imageUrl,
    this.likesCount = 0,
    this.commentsCount = 0,
    this.createdAt,
  });

  final String id;
  final String authorId;
  final String? authorName;
  final String? authorPhotoURL;
  final String content;

  /// `'public' | 'connections'`.
  final String visibility;
  final String? gradeLevel;
  final String? subject;

  /// A trusted Storage-host https URL, when the post carries an image.
  final String? imageUrl;
  final int likesCount;
  final int commentsCount;
  final String? createdAt;

  @override
  bool operator ==(Object other) =>
      other is CommunityPost &&
      other.id == id &&
      other.authorId == authorId &&
      other.authorName == authorName &&
      other.authorPhotoURL == authorPhotoURL &&
      other.content == content &&
      other.visibility == visibility &&
      other.gradeLevel == gradeLevel &&
      other.subject == subject &&
      other.imageUrl == imageUrl &&
      other.likesCount == likesCount &&
      other.commentsCount == commentsCount &&
      other.createdAt == createdAt;

  @override
  int get hashCode => Object.hash(
        id,
        authorId,
        authorName,
        authorPhotoURL,
        content,
        visibility,
        gradeLevel,
        subject,
        imageUrl,
        likesCount,
        commentsCount,
        createdAt,
      );
}

/// The polymorphic kind of a unified-feed item
/// (`src/types/community.ts::FeedItemType`). [fromWire] tolerant → [groupPost].
enum FeedItemType {
  groupPost('group_post'),
  resourceShare('resource_share'),
  connectionSuggestion('connection_suggestion'),
  chatHighlight('chat_highlight'),
  groupSuggestion('group_suggestion');

  const FeedItemType(this.wire);

  final String wire;

  static FeedItemType fromWire(String? wire) {
    for (final t in FeedItemType.values) {
      if (t.wire == wire) return t;
    }
    return FeedItemType.groupPost;
  }
}

/// The `resource_share` payload of a [FeedItem]
/// (`src/types/community.ts::FeedItem.resource`).
@immutable
class FeedResource {
  const FeedResource({
    required this.id,
    required this.title,
    required this.type,
    required this.authorName,
    required this.authorUid,
    this.likes = 0,
    this.language,
  });

  final String id;
  final String title;
  final String type;
  final String authorName;
  final String authorUid;
  final int likes;
  final String? language;

  @override
  bool operator ==(Object other) =>
      other is FeedResource &&
      other.id == id &&
      other.title == title &&
      other.type == type &&
      other.authorName == authorName &&
      other.authorUid == authorUid &&
      other.likes == likes &&
      other.language == language;

  @override
  int get hashCode =>
      Object.hash(id, title, type, authorName, authorUid, likes, language);
}

/// The `connection_suggestion` payload of a [FeedItem].
@immutable
class FeedConnectionSuggestion {
  const FeedConnectionSuggestion({
    required this.uid,
    required this.displayName,
    required this.reason,
    this.photoURL,
    this.sharedSubjects = const <String>[],
  });

  final String uid;
  final String displayName;
  final String reason;
  final String? photoURL;
  final List<String> sharedSubjects;

  @override
  bool operator ==(Object other) =>
      other is FeedConnectionSuggestion &&
      other.uid == uid &&
      other.displayName == displayName &&
      other.reason == reason &&
      other.photoURL == photoURL &&
      listEquals(other.sharedSubjects, sharedSubjects);

  @override
  int get hashCode => Object.hash(
        uid,
        displayName,
        reason,
        photoURL,
        Object.hashAll(sharedSubjects),
      );
}

/// The `chat_highlight` payload of a [FeedItem].
@immutable
class FeedChatHighlight {
  const FeedChatHighlight({
    required this.groupId,
    required this.groupName,
    this.messageCount = 0,
    this.latestMessage,
  });

  final String groupId;
  final String groupName;
  final int messageCount;
  final String? latestMessage;

  @override
  bool operator ==(Object other) =>
      other is FeedChatHighlight &&
      other.groupId == groupId &&
      other.groupName == groupName &&
      other.messageCount == messageCount &&
      other.latestMessage == latestMessage;

  @override
  int get hashCode =>
      Object.hash(groupId, groupName, messageCount, latestMessage);
}

/// A unified-feed item (`src/types/community.ts::FeedItem`) — polymorphic on
/// [type], with exactly one payload populated. Assembled server-side
/// (`getUnifiedFeedAction`); NOT realtime (focus + 45s poll).
@immutable
class FeedItem {
  const FeedItem({
    required this.id,
    required this.type,
    this.timestamp,
    this.groupId,
    this.groupName,
    this.post,
    this.resource,
    this.connectionSuggestion,
    this.chatHighlight,
    this.groupSuggestion,
  });

  final String id;
  final FeedItemType type;
  final String? timestamp;
  final String? groupId;
  final String? groupName;

  /// Populated when [type] is [FeedItemType.groupPost].
  final GroupPost? post;

  /// Populated when [type] is [FeedItemType.resourceShare].
  final FeedResource? resource;

  /// Populated when [type] is [FeedItemType.connectionSuggestion].
  final FeedConnectionSuggestion? connectionSuggestion;

  /// Populated when [type] is [FeedItemType.chatHighlight].
  final FeedChatHighlight? chatHighlight;

  /// Populated when [type] is [FeedItemType.groupSuggestion].
  final Group? groupSuggestion;

  @override
  bool operator ==(Object other) =>
      other is FeedItem &&
      other.id == id &&
      other.type == type &&
      other.timestamp == timestamp &&
      other.groupId == groupId &&
      other.groupName == groupName &&
      other.post == post &&
      other.resource == resource &&
      other.connectionSuggestion == connectionSuggestion &&
      other.chatHighlight == chatHighlight &&
      other.groupSuggestion == groupSuggestion;

  @override
  int get hashCode => Object.hash(
        id,
        type,
        timestamp,
        groupId,
        groupName,
        post,
        resource,
        connectionSuggestion,
        chatHighlight,
        groupSuggestion,
      );
}
