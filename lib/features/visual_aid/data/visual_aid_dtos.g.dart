// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visual_aid_dtos.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$VisualAidRequestDtoToJson(
  VisualAidRequestDto instance,
) => <String, dynamic>{
  'prompt': instance.prompt,
  if (instance.gradeLevel case final value?) 'gradeLevel': value,
  if (instance.subject case final value?) 'subject': value,
  if (instance.language case final value?) 'language': value,
};

VisualAidResponseDto _$VisualAidResponseDtoFromJson(
  Map<String, dynamic> json,
) => VisualAidResponseDto(
  imageDataUri: json['imageDataUri'] as String?,
  pedagogicalContext: json['pedagogicalContext'] as String?,
  discussionSpark: json['discussionSpark'] as String?,
  subject: json['subject'] as String?,
);
