// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rubric_dtos.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$RubricRequestDtoToJson(RubricRequestDto instance) =>
    <String, dynamic>{
      'assignmentDescription': instance.assignmentDescription,
      if (instance.gradeLevel case final value?) 'gradeLevel': value,
      if (instance.subject case final value?) 'subject': value,
      if (instance.language case final value?) 'language': value,
    };

RubricResponseDto _$RubricResponseDtoFromJson(Map<String, dynamic> json) =>
    RubricResponseDto(
      title: json['title'] as String?,
      description: json['description'] as String?,
      criteria: (json['criteria'] as List<dynamic>?)
          ?.map((e) => RubricCriterionDto.fromJson(e as Map<String, dynamic>))
          .toList(),
      gradeLevel: json['gradeLevel'] as String?,
      subject: json['subject'] as String?,
    );

RubricCriterionDto _$RubricCriterionDtoFromJson(Map<String, dynamic> json) =>
    RubricCriterionDto(
      name: json['name'] as String?,
      description: json['description'] as String?,
      levels: (json['levels'] as List<dynamic>?)
          ?.map((e) => RubricLevelDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

RubricLevelDto _$RubricLevelDtoFromJson(Map<String, dynamic> json) =>
    RubricLevelDto(
      name: json['name'] as String?,
      description: json['description'] as String?,
      points: json['points'] as num?,
    );
