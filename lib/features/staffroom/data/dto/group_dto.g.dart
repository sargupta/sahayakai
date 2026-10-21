// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'group_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

GroupDto _$GroupDtoFromJson(Map<String, dynamic> json) => GroupDto(
  id: json['id'] as String?,
  name: json['name'] as String?,
  description: json['description'] as String?,
  type: json['type'] as String?,
  coverColor: json['coverColor'] as String?,
  memberCount: json['memberCount'] as num?,
  autoJoinRules: json['autoJoinRules'] as Map<String, dynamic>?,
  lastActivityAt: json['lastActivityAt'],
  createdAt: json['createdAt'],
  createdBy: json['createdBy'] as String?,
);

PostAttachmentDto _$PostAttachmentDtoFromJson(Map<String, dynamic> json) =>
    PostAttachmentDto(
      type: json['type'] as String?,
      resourceId: json['resourceId'] as String?,
      url: json['url'] as String?,
      title: json['title'] as String?,
    );

GroupPostDto _$GroupPostDtoFromJson(Map<String, dynamic> json) => GroupPostDto(
  id: json['id'] as String?,
  groupId: json['groupId'] as String?,
  authorUid: json['authorUid'] as String?,
  authorName: json['authorName'] as String?,
  authorPhotoURL: json['authorPhotoURL'] as String?,
  content: json['content'] as String?,
  postType: json['postType'] as String?,
  attachments: json['attachments'] as List<dynamic>?,
  likesCount: json['likesCount'] as num?,
  commentsCount: json['commentsCount'] as num?,
  translations: json['translations'] as Map<String, dynamic>?,
  createdAt: json['createdAt'],
);

Map<String, dynamic> _$CreateGroupPostRequestDtoToJson(
  CreateGroupPostRequestDto instance,
) => <String, dynamic>{
  'groupId': instance.groupId,
  'content': instance.content,
  'postType': instance.postType,
  if (instance.attachments case final value?) 'attachments': value,
};

LikeResultDto _$LikeResultDtoFromJson(Map<String, dynamic> json) =>
    LikeResultDto(
      isLiked: json['isLiked'] as bool?,
      newCount: json['newCount'] as num?,
    );

JoinGroupResponseDto _$JoinGroupResponseDtoFromJson(
  Map<String, dynamic> json,
) => JoinGroupResponseDto(joined: json['joined'] as bool?);

LikedItemIdsDto _$LikedItemIdsDtoFromJson(Map<String, dynamic> json) =>
    LikedItemIdsDto(
      groupPostIds: json['groupPostIds'] as List<dynamic>?,
      resourceIds: json['resourceIds'] as List<dynamic>?,
    );
