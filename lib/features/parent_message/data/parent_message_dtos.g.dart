// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'parent_message_dtos.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$ParentMessageRequestDtoToJson(
  ParentMessageRequestDto instance,
) => <String, dynamic>{
  'studentName': instance.studentName,
  'className': instance.className,
  'subject': instance.subject,
  'reason': instance.reason,
  'parentLanguage': instance.parentLanguage,
  if (instance.reasonContext case final value?) 'reasonContext': value,
  if (instance.teacherNote case final value?) 'teacherNote': value,
  if (instance.consecutiveAbsentDays case final value?)
    'consecutiveAbsentDays': value,
  if (instance.teacherName case final value?) 'teacherName': value,
  if (instance.schoolName case final value?) 'schoolName': value,
};

ParentMessageResponseDto _$ParentMessageResponseDtoFromJson(
  Map<String, dynamic> json,
) => ParentMessageResponseDto(
  message: json['message'] as String?,
  languageCode: json['languageCode'] as String?,
  wordCount: json['wordCount'] as num?,
);
