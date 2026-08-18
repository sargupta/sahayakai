// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'worksheet_dtos.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$WorksheetRequestDtoToJson(
  WorksheetRequestDto instance,
) => <String, dynamic>{
  'imageDataUri': instance.imageDataUri,
  'prompt': instance.prompt,
  if (instance.gradeLevel case final value?) 'gradeLevel': value,
  if (instance.subject case final value?) 'subject': value,
  if (instance.language case final value?) 'language': value,
};

WorksheetResponseDto _$WorksheetResponseDtoFromJson(
  Map<String, dynamic> json,
) => WorksheetResponseDto(
  title: json['title'] as String?,
  gradeLevel: json['gradeLevel'] as String?,
  subject: json['subject'] as String?,
  learningObjectives: (json['learningObjectives'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
  studentInstructions: json['studentInstructions'] as String?,
  activities: (json['activities'] as List<dynamic>?)
      ?.map((e) => WorksheetActivityDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  answerKey: (json['answerKey'] as List<dynamic>?)
      ?.map((e) => AnswerKeyEntryDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

WorksheetActivityDto _$WorksheetActivityDtoFromJson(
  Map<String, dynamic> json,
) => WorksheetActivityDto(
  type: json['type'] as String?,
  content: json['content'] as String?,
  explanation: json['explanation'] as String?,
  chalkboardNote: json['chalkboardNote'] as String?,
);

AnswerKeyEntryDto _$AnswerKeyEntryDtoFromJson(Map<String, dynamic> json) =>
    AnswerKeyEntryDto(
      activityIndex: (json['activityIndex'] as num?)?.toInt(),
      answer: json['answer'] as String?,
    );
