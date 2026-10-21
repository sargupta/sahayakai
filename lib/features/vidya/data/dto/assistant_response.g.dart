// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'assistant_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AssistantResponseDto _$AssistantResponseDtoFromJson(
  Map<String, dynamic> json,
) => AssistantResponseDto(
  response: json['response'] as String?,
  action: json['action'] == null
      ? null
      : VidyaActionDto.fromJson(json['action'] as Map<String, dynamic>),
  plannedActions: (json['plannedActions'] as List<dynamic>?)
      ?.map((e) => VidyaActionDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);
