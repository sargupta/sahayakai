// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'instant_answer_dtos.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$InstantAnswerRequestDtoToJson(
  InstantAnswerRequestDto instance,
) => <String, dynamic>{
  'question': instance.question,
  if (instance.gradeLevel case final value?) 'gradeLevel': value,
  if (instance.subject case final value?) 'subject': value,
  if (instance.language case final value?) 'language': value,
};

InstantAnswerResponseDto _$InstantAnswerResponseDtoFromJson(
  Map<String, dynamic> json,
) => InstantAnswerResponseDto(
  answer: json['answer'] as String?,
  videoSuggestionUrl: json['videoSuggestionUrl'] as String?,
  gradeLevel: json['gradeLevel'] as String?,
  subject: json['subject'] as String?,
);
