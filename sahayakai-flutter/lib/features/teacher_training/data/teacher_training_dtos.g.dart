// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'teacher_training_dtos.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$TeacherTrainingRequestDtoToJson(
  TeacherTrainingRequestDto instance,
) => <String, dynamic>{
  'question': instance.question,
  if (instance.subject case final value?) 'subject': value,
  if (instance.language case final value?) 'language': value,
};

TeacherTrainingResponseDto _$TeacherTrainingResponseDtoFromJson(
  Map<String, dynamic> json,
) => TeacherTrainingResponseDto(
  introduction: json['introduction'] as String?,
  advice: (json['advice'] as List<dynamic>?)
      ?.map((e) => TeacherAdvicePointDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  conclusion: json['conclusion'] as String?,
  gradeLevel: json['gradeLevel'] as String?,
  subject: json['subject'] as String?,
);

TeacherAdvicePointDto _$TeacherAdvicePointDtoFromJson(
  Map<String, dynamic> json,
) => TeacherAdvicePointDto(
  strategy: json['strategy'] as String?,
  pedagogy: json['pedagogy'] as String?,
  explanation: json['explanation'] as String?,
);
