// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'vidya_action.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NcertChapterDto _$NcertChapterDtoFromJson(Map<String, dynamic> json) =>
    NcertChapterDto(
      number: (json['number'] as num?)?.toInt(),
      title: json['title'] as String?,
      learningOutcomes: (json['learningOutcomes'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
    );

VidyaActionParamsDto _$VidyaActionParamsDtoFromJson(
  Map<String, dynamic> json,
) => VidyaActionParamsDto(
  topic: json['topic'] as String?,
  gradeLevel: json['gradeLevel'] as String?,
  subject: json['subject'] as String?,
  language: json['language'] as String?,
  ncertChapter: json['ncertChapter'] == null
      ? null
      : NcertChapterDto.fromJson(json['ncertChapter'] as Map<String, dynamic>),
  dependsOn: (json['dependsOn'] as List<dynamic>?)
      ?.map((e) => (e as num).toInt())
      .toList(),
  clarifyingPrompt: json['clarifyingPrompt'] as String?,
  validationWarning: json['validationWarning'] as String?,
);

VidyaActionDto _$VidyaActionDtoFromJson(Map<String, dynamic> json) =>
    VidyaActionDto(
      type: json['type'] as String?,
      flow: json['flow'] as String?,
      params: json['params'] == null
          ? null
          : VidyaActionParamsDto.fromJson(
              json['params'] as Map<String, dynamic>,
            ),
    );
