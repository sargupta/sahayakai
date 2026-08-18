// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'virtual_field_trip_dtos.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$VirtualFieldTripRequestDtoToJson(
  VirtualFieldTripRequestDto instance,
) => <String, dynamic>{
  'topic': instance.topic,
  if (instance.gradeLevel case final value?) 'gradeLevel': value,
  if (instance.language case final value?) 'language': value,
};

FieldTripStopDto _$FieldTripStopDtoFromJson(Map<String, dynamic> json) =>
    FieldTripStopDto(
      name: json['name'] as String?,
      description: json['description'] as String?,
      educationalFact: json['educationalFact'] as String?,
      reflectionPrompt: json['reflectionPrompt'] as String?,
      googleEarthUrl: json['googleEarthUrl'] as String?,
      culturalAnalogy: json['culturalAnalogy'] as String?,
      explanation: json['explanation'] as String?,
    );

VirtualFieldTripResponseDto _$VirtualFieldTripResponseDtoFromJson(
  Map<String, dynamic> json,
) => VirtualFieldTripResponseDto(
  title: json['title'] as String?,
  stops: (json['stops'] as List<dynamic>?)
      ?.map((e) => FieldTripStopDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  gradeLevel: json['gradeLevel'] as String?,
  subject: json['subject'] as String?,
);

FieldTripStillGeneratingDto _$FieldTripStillGeneratingDtoFromJson(
  Map<String, dynamic> json,
) => FieldTripStillGeneratingDto(
  error: json['error'] as String?,
  message: json['message'] as String?,
  budgetMs: json['budgetMs'] as num?,
  elapsedMs: json['elapsedMs'] as num?,
);
