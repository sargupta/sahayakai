// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lesson_plan_dtos.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$LessonPlanRequestDtoToJson(
  LessonPlanRequestDto instance,
) => <String, dynamic>{
  'topic': instance.topic,
  if (instance.gradeLevels case final value?) 'gradeLevels': value,
  if (instance.subject case final value?) 'subject': value,
  if (instance.language case final value?) 'language': value,
  if (instance.resourceLevel case final value?) 'resourceLevel': value,
  if (instance.difficultyLevel case final value?) 'difficultyLevel': value,
  if (instance.useRuralContext case final value?) 'useRuralContext': value,
};

LessonPlanResponseDto _$LessonPlanResponseDtoFromJson(
  Map<String, dynamic> json,
) => LessonPlanResponseDto(
  title: json['title'] as String?,
  gradeLevel: json['gradeLevel'] as String?,
  duration: json['duration'] as String?,
  subject: json['subject'] as String?,
  objectives: (json['objectives'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
  keyVocabulary: (json['keyVocabulary'] as List<dynamic>?)
      ?.map((e) => VocabularyDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  materials: (json['materials'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
  activities: (json['activities'] as List<dynamic>?)
      ?.map((e) => ActivityDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  assessment: json['assessment'] as String?,
  homework: json['homework'] as String?,
  language: json['language'] as String?,
  validationWarning: json['validationWarning'] == null
      ? null
      : ValidationWarningDto.fromJson(
          json['validationWarning'] as Map<String, dynamic>,
        ),
);

VocabularyDto _$VocabularyDtoFromJson(Map<String, dynamic> json) =>
    VocabularyDto(
      term: json['term'] as String?,
      meaning: json['meaning'] as String?,
    );

ActivityDto _$ActivityDtoFromJson(Map<String, dynamic> json) => ActivityDto(
  phase: json['phase'] as String?,
  name: json['name'] as String?,
  description: json['description'] as String?,
  duration: json['duration'] as String?,
  teacherTips: json['teacherTips'] as String?,
  understandingCheck: json['understandingCheck'] as String?,
);

ValidationWarningDto _$ValidationWarningDtoFromJson(
  Map<String, dynamic> json,
) => ValidationWarningDto(
  invalid: json['invalid'] as bool?,
  lenient: json['lenient'] as bool?,
  message: json['message'] as String?,
);
