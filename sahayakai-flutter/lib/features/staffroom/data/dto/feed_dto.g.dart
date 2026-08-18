// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'feed_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CommunityPostDto _$CommunityPostDtoFromJson(Map<String, dynamic> json) =>
    CommunityPostDto(
      id: json['id'] as String?,
      authorId: json['authorId'] as String?,
      authorName: json['authorName'] as String?,
      authorPhotoURL: json['authorPhotoURL'] as String?,
      content: json['content'] as String?,
      visibility: json['visibility'] as String?,
      gradeLevel: json['gradeLevel'] as String?,
      subject: json['subject'] as String?,
      imageUrl: json['imageUrl'] as String?,
      likesCount: json['likesCount'] as num?,
      commentsCount: json['commentsCount'] as num?,
      createdAt: json['createdAt'],
    );

FeedItemDto _$FeedItemDtoFromJson(Map<String, dynamic> json) => FeedItemDto(
  id: json['id'] as String?,
  type: json['type'] as String?,
  groupId: json['groupId'] as String?,
  groupName: json['groupName'] as String?,
  timestamp: json['timestamp'],
  post: json['post'] == null
      ? null
      : GroupPostDto.fromJson(json['post'] as Map<String, dynamic>),
  resource: json['resource'] as Map<String, dynamic>?,
  connectionSuggestion: json['connectionSuggestion'] as Map<String, dynamic>?,
  chatHighlight: json['chatHighlight'] as Map<String, dynamic>?,
  groupSuggestion: json['groupSuggestion'] == null
      ? null
      : GroupDto.fromJson(json['groupSuggestion'] as Map<String, dynamic>),
);
