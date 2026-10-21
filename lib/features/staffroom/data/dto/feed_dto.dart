import 'package:json_annotation/json_annotation.dart';

import '../../../inbox/data/dto/wire_time.dart';
import '../../domain/community_post.dart';
import 'dto_helpers.dart';
import 'group_dto.dart';

part 'feed_dto.g.dart';

/// Decodes a top-level `posts/{id}` document — the legacy public community feed
/// (`createPostAction` / `getPosts`). Distinct from [GroupPostDto].
@JsonSerializable(createToJson: false)
class CommunityPostDto {
  const CommunityPostDto({
    this.id,
    this.authorId,
    this.authorName,
    this.authorPhotoURL,
    this.content,
    this.visibility,
    this.gradeLevel,
    this.subject,
    this.imageUrl,
    this.likesCount,
    this.commentsCount,
    this.createdAt,
  });

  factory CommunityPostDto.fromJson(Map<String, dynamic> json) =>
      _$CommunityPostDtoFromJson(json);

  final String? id;
  final String? authorId;
  final String? authorName;
  final String? authorPhotoURL;
  final String? content;
  final String? visibility;
  final String? gradeLevel;
  final String? subject;
  final String? imageUrl;
  final num? likesCount;
  final num? commentsCount;
  final dynamic createdAt;

  CommunityPost toDomain() => CommunityPost(
        id: id?.trim() ?? '',
        authorId: authorId?.trim() ?? '',
        authorName: cleanString(authorName),
        authorPhotoURL: cleanString(authorPhotoURL),
        content: content?.trim() ?? '',
        visibility: cleanString(visibility) ?? 'public',
        gradeLevel: cleanString(gradeLevel),
        subject: cleanString(subject),
        imageUrl: cleanString(imageUrl),
        likesCount: likesCount?.toInt() ?? 0,
        commentsCount: commentsCount?.toInt() ?? 0,
        createdAt: wireTimeToIso(createdAt),
      );
}

/// Decodes a `FeedItem` (`src/types/community.ts::FeedItem`) from
/// `getUnifiedFeedAction`. Polymorphic: exactly one payload is populated per
/// [type]. A malformed payload degrades to null (the UI skips that slot) rather
/// than crashing the feed.
@JsonSerializable(createToJson: false)
class FeedItemDto {
  const FeedItemDto({
    this.id,
    this.type,
    this.groupId,
    this.groupName,
    this.timestamp,
    this.post,
    this.resource,
    this.connectionSuggestion,
    this.chatHighlight,
    this.groupSuggestion,
  });

  factory FeedItemDto.fromJson(Map<String, dynamic> json) =>
      _$FeedItemDtoFromJson(json);

  final String? id;
  final String? type;
  final String? groupId;
  final String? groupName;
  final dynamic timestamp;
  final GroupPostDto? post;
  final Map<String, dynamic>? resource;
  final Map<String, dynamic>? connectionSuggestion;
  final Map<String, dynamic>? chatHighlight;
  final GroupDto? groupSuggestion;

  FeedItem toDomain() => FeedItem(
        id: id?.trim() ?? '',
        type: FeedItemType.fromWire(type),
        timestamp: wireTimeToIso(timestamp),
        groupId: cleanString(groupId),
        groupName: cleanString(groupName),
        post: post?.toDomain(),
        resource: _resource(resource),
        connectionSuggestion: _connectionSuggestion(connectionSuggestion),
        chatHighlight: _chatHighlight(chatHighlight),
        groupSuggestion: groupSuggestion?.toDomain(),
      );

  static FeedResource? _resource(Map<String, dynamic>? m) {
    if (m == null) return null;
    final id = (m['id'] as String?)?.trim();
    if (id == null || id.isEmpty) return null;
    return FeedResource(
      id: id,
      title: (m['title'] as String?)?.trim() ?? '',
      type: (m['type'] as String?)?.trim() ?? '',
      authorName: (m['authorName'] as String?)?.trim() ?? '',
      authorUid: (m['authorUid'] as String?)?.trim() ?? '',
      likes: asInt(m['likes']) ?? 0,
      language: cleanString(m['language'] as String?),
    );
  }

  static FeedConnectionSuggestion? _connectionSuggestion(
      Map<String, dynamic>? m) {
    if (m == null) return null;
    final uid = (m['uid'] as String?)?.trim();
    if (uid == null || uid.isEmpty) return null;
    return FeedConnectionSuggestion(
      uid: uid,
      displayName: (m['displayName'] as String?)?.trim() ?? '',
      reason: (m['reason'] as String?)?.trim() ?? '',
      photoURL: cleanString(m['photoURL'] as String?),
      sharedSubjects: stringList(m['sharedSubjects']),
    );
  }

  static FeedChatHighlight? _chatHighlight(Map<String, dynamic>? m) {
    if (m == null) return null;
    final groupId = (m['groupId'] as String?)?.trim();
    if (groupId == null || groupId.isEmpty) return null;
    return FeedChatHighlight(
      groupId: groupId,
      groupName: (m['groupName'] as String?)?.trim() ?? '',
      messageCount: asInt(m['messageCount']) ?? 0,
      latestMessage: cleanString(m['latestMessage'] as String?),
    );
  }
}
