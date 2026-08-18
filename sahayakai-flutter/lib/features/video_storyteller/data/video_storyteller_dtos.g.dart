// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'video_storyteller_dtos.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$VideoStorytellerRequestDtoToJson(
  VideoStorytellerRequestDto instance,
) => <String, dynamic>{
  if (instance.subject case final value?) 'subject': value,
  if (instance.gradeLevel case final value?) 'gradeLevel': value,
  if (instance.topic case final value?) 'topic': value,
  if (instance.language case final value?) 'language': value,
};

VideoCategoriesDto _$VideoCategoriesDtoFromJson(Map<String, dynamic> json) =>
    VideoCategoriesDto(
      pedagogy: (json['pedagogy'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      storytelling: (json['storytelling'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      govtUpdates: (json['govtUpdates'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      courses: (json['courses'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      topRecommended: (json['topRecommended'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
    );

VideoDto _$VideoDtoFromJson(Map<String, dynamic> json) => VideoDto(
  id: json['id'] as String?,
  title: json['title'] as String?,
  description: json['description'] as String?,
  thumbnail: json['thumbnail'] as String?,
  channelTitle: json['channelTitle'] as String?,
  channelId: json['channelId'] as String?,
  publishedAt: json['publishedAt'] as String?,
  duration: json['duration'] as String?,
  viewCount: json['viewCount'] as String?,
  reason: json['reason'] as String?,
  relevanceReason: json['relevanceReason'] as String?,
);

VideoStorytellerResponseDto _$VideoStorytellerResponseDtoFromJson(
  Map<String, dynamic> json,
) => VideoStorytellerResponseDto(
  categories: json['categories'] == null
      ? null
      : VideoCategoriesDto.fromJson(json['categories'] as Map<String, dynamic>),
  personalizedMessage: json['personalizedMessage'] as String?,
  categorizedVideos: (json['categorizedVideos'] as Map<String, dynamic>?)?.map(
    (k, e) => MapEntry(
      k,
      (e as List<dynamic>)
          .map((e) => VideoDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  ),
  fromCache: json['fromCache'] as bool?,
  latencyScore: json['latencyScore'] as num?,
);
