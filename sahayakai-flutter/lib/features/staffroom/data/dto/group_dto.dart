import 'package:json_annotation/json_annotation.dart';

import '../../../inbox/data/dto/wire_time.dart';
import '../../domain/group.dart';
import '../../domain/staffroom_results.dart';
import 'dto_helpers.dart';

part 'group_dto.g.dart';

/// Decodes a `groups/{id}` document (`src/types/community.ts::Group`), returned
/// by `getMyGroupsAction` / `getGroupAction` / `discoverGroupsAction` (REST
/// wrappers).
@JsonSerializable(createToJson: false)
class GroupDto {
  const GroupDto({
    this.id,
    this.name,
    this.description,
    this.type,
    this.coverColor,
    this.memberCount,
    this.autoJoinRules,
    this.lastActivityAt,
    this.createdAt,
    this.createdBy,
  });

  factory GroupDto.fromJson(Map<String, dynamic> json) =>
      _$GroupDtoFromJson(json);

  final String? id;
  final String? name;
  final String? description;
  final String? type;
  final String? coverColor;
  final num? memberCount;
  final Map<String, dynamic>? autoJoinRules;
  final dynamic lastActivityAt;
  final dynamic createdAt;
  final String? createdBy;

  Group toDomain() => Group(
        id: id?.trim() ?? '',
        name: name?.trim() ?? '',
        description: description?.trim() ?? '',
        type: GroupType.fromWire(type),
        coverColor: coverColor?.trim() ?? '',
        memberCount: memberCount?.toInt() ?? 0,
        autoJoinRules: _rules(autoJoinRules),
        createdBy: createdBy?.trim().isNotEmpty == true
            ? createdBy!.trim()
            : 'system',
        lastActivityAt: wireTimeToIso(lastActivityAt),
        createdAt: wireTimeToIso(createdAt),
      );

  static GroupAutoJoinRules _rules(Map<String, dynamic>? raw) {
    if (raw == null) return const GroupAutoJoinRules();
    return GroupAutoJoinRules(
      subjects: stringList(raw['subjects']),
      grades: stringList(raw['grades']),
      board: cleanString(raw['board'] as String?),
      school: cleanString(raw['school'] as String?),
      state: cleanString(raw['state'] as String?),
    );
  }
}

/// Decodes a `PostAttachment` (`src/types/community.ts::PostAttachment`).
@JsonSerializable(createToJson: false)
class PostAttachmentDto {
  const PostAttachmentDto({this.type, this.resourceId, this.url, this.title});

  factory PostAttachmentDto.fromJson(Map<String, dynamic> json) =>
      _$PostAttachmentDtoFromJson(json);

  final String? type;
  final String? resourceId;
  final String? url;
  final String? title;

  PostAttachment toDomain() => PostAttachment(
        type: type?.trim() ?? '',
        resourceId: cleanString(resourceId),
        url: cleanString(url),
        title: cleanString(title),
      );
}

/// Decodes a `groups/{id}/posts/{id}` document
/// (`src/types/community.ts::GroupPost`), returned by `getGroupPostsAction`.
@JsonSerializable(createToJson: false)
class GroupPostDto {
  const GroupPostDto({
    this.id,
    this.groupId,
    this.authorUid,
    this.authorName,
    this.authorPhotoURL,
    this.content,
    this.postType,
    this.attachments,
    this.likesCount,
    this.commentsCount,
    this.translations,
    this.createdAt,
  });

  factory GroupPostDto.fromJson(Map<String, dynamic> json) =>
      _$GroupPostDtoFromJson(json);

  final String? id;
  final String? groupId;
  final String? authorUid;
  final String? authorName;
  final String? authorPhotoURL;
  final String? content;
  final String? postType;
  final List<dynamic>? attachments;
  final num? likesCount;
  final num? commentsCount;
  final Map<String, dynamic>? translations;
  final dynamic createdAt;

  GroupPost toDomain() => GroupPost(
        id: id?.trim() ?? '',
        groupId: groupId?.trim() ?? '',
        authorUid: authorUid?.trim() ?? '',
        authorName: authorName?.trim() ?? '',
        authorPhotoURL: cleanString(authorPhotoURL),
        content: content?.trim() ?? '',
        postType: PostType.fromWire(postType),
        attachments: (attachments ?? const <dynamic>[])
            .whereType<Map>()
            .map((m) => PostAttachmentDto.fromJson(m.cast<String, dynamic>())
                .toDomain())
            .toList(growable: false),
        likesCount: likesCount?.toInt() ?? 0,
        commentsCount: commentsCount?.toInt() ?? 0,
        translations: stringStringMap(translations),
        createdAt: wireTimeToIso(createdAt),
      );
}

/// Serialises the `createGroupPost` wrapper body: `{ groupId, content,
/// postType, attachments? }` → `postId`. Author is server-derived.
@JsonSerializable(includeIfNull: false, createFactory: false)
class CreateGroupPostRequestDto {
  const CreateGroupPostRequestDto({
    required this.groupId,
    required this.content,
    required this.postType,
    this.attachments,
  });

  factory CreateGroupPostRequestDto.build({
    required String groupId,
    required String content,
    required PostType postType,
    List<Map<String, dynamic>>? attachments,
  }) {
    return CreateGroupPostRequestDto(
      groupId: groupId.trim(),
      content: content.trim(),
      postType: postType.wire,
      attachments: (attachments != null && attachments.isNotEmpty)
          ? attachments
          : null,
    );
  }

  final String groupId;
  final String content;

  /// `PostType` wire token.
  final String postType;
  final List<Map<String, dynamic>>? attachments;

  Map<String, dynamic> toJson() => _$CreateGroupPostRequestDtoToJson(this);
}

/// Decodes `likeGroupPostAction`'s `{ isLiked, newCount }`.
@JsonSerializable(createToJson: false)
class LikeResultDto {
  const LikeResultDto({this.isLiked, this.newCount});

  factory LikeResultDto.fromJson(Map<String, dynamic> json) =>
      _$LikeResultDtoFromJson(json);

  final bool? isLiked;
  final num? newCount;

  LikeResult toDomain() => LikeResult(
        isLiked: isLiked ?? false,
        newCount: newCount?.toInt() ?? 0,
      );
}

/// Decodes `joinGroupAction`'s `{ joined: boolean }`.
@JsonSerializable(createToJson: false)
class JoinGroupResponseDto {
  const JoinGroupResponseDto({this.joined});

  factory JoinGroupResponseDto.fromJson(Map<String, dynamic> json) =>
      _$JoinGroupResponseDtoFromJson(json);

  final bool? joined;

  bool get value => joined ?? false;
}

/// Decodes `getLikedItemIdsAction`'s `{ groupPostIds[], resourceIds[] }`.
@JsonSerializable(createToJson: false)
class LikedItemIdsDto {
  const LikedItemIdsDto({this.groupPostIds, this.resourceIds});

  factory LikedItemIdsDto.fromJson(Map<String, dynamic> json) =>
      _$LikedItemIdsDtoFromJson(json);

  final List<dynamic>? groupPostIds;
  final List<dynamic>? resourceIds;

  LikedItemIds toDomain() => LikedItemIds(
        groupPostIds: stringList(groupPostIds),
        resourceIds: stringList(resourceIds),
      );
}
