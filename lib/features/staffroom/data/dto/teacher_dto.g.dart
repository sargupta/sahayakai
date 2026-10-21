// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'teacher_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TeacherSuggestionDto _$TeacherSuggestionDtoFromJson(
  Map<String, dynamic> json,
) => TeacherSuggestionDto(
  uid: json['uid'] as String?,
  displayName: json['displayName'] as String?,
  photoURL: json['photoURL'] as String?,
  initial: json['initial'] as String?,
  schoolName: json['schoolName'] as String?,
  subjects: json['subjects'] as List<dynamic>?,
  gradeLevels: json['gradeLevels'] as List<dynamic>?,
  bio: json['bio'] as String?,
  impactScore: json['impactScore'] as num?,
  followersCount: json['followersCount'] as num?,
  recommendationReason: json['recommendationReason'] as String?,
);

PublicProfileResponseDto _$PublicProfileResponseDtoFromJson(
  Map<String, dynamic> json,
) =>
    PublicProfileResponseDto(profile: json['profile'] as Map<String, dynamic>?);
