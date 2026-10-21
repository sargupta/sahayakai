// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'exam_paper_dtos.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$ExamPaperRequestDtoToJson(
  ExamPaperRequestDto instance,
) => <String, dynamic>{
  'board': instance.board,
  'gradeLevel': instance.gradeLevel,
  'subject': instance.subject,
  'chapters': instance.chapters,
  'difficulty': instance.difficulty,
  'includeAnswerKey': instance.includeAnswerKey,
  'includeMarkingScheme': instance.includeMarkingScheme,
  if (instance.language case final value?) 'language': value,
};

ExamPaperResponseDto _$ExamPaperResponseDtoFromJson(
  Map<String, dynamic> json,
) => ExamPaperResponseDto(
  title: json['title'] as String?,
  board: json['board'] as String?,
  subject: json['subject'] as String?,
  gradeLevel: json['gradeLevel'] as String?,
  duration: json['duration'] as String?,
  maxMarks: json['maxMarks'] as num?,
  generalInstructions: (json['generalInstructions'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
  sections: (json['sections'] as List<dynamic>?)
      ?.map((e) => ExamSectionDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  blueprintSummary: json['blueprintSummary'] == null
      ? null
      : BlueprintSummaryDto.fromJson(
          json['blueprintSummary'] as Map<String, dynamic>,
        ),
  pyqSources: (json['pyqSources'] as List<dynamic>?)
      ?.map((e) => PyqSourceDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

ExamSectionDto _$ExamSectionDtoFromJson(Map<String, dynamic> json) =>
    ExamSectionDto(
      name: json['name'] as String?,
      label: json['label'] as String?,
      totalMarks: json['totalMarks'] as num?,
      questions: (json['questions'] as List<dynamic>?)
          ?.map((e) => ExamQuestionDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

ExamQuestionDto _$ExamQuestionDtoFromJson(Map<String, dynamic> json) =>
    ExamQuestionDto(
      number: json['number'] as num?,
      text: json['text'] as String?,
      marks: json['marks'] as num?,
      options: (json['options'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      internalChoice: json['internalChoice'] as String?,
      answerKey: json['answerKey'] as String?,
      markingScheme: json['markingScheme'] as String?,
      source: json['source'] as String?,
    );

BlueprintSummaryDto _$BlueprintSummaryDtoFromJson(Map<String, dynamic> json) =>
    BlueprintSummaryDto(
      chapterWise: (json['chapterWise'] as List<dynamic>?)
          ?.map((e) => ChapterWeightDto.fromJson(e as Map<String, dynamic>))
          .toList(),
      difficultyWise: (json['difficultyWise'] as List<dynamic>?)
          ?.map((e) => DifficultyWeightDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

ChapterWeightDto _$ChapterWeightDtoFromJson(Map<String, dynamic> json) =>
    ChapterWeightDto(
      chapter: json['chapter'] as String?,
      marks: json['marks'] as num?,
    );

DifficultyWeightDto _$DifficultyWeightDtoFromJson(Map<String, dynamic> json) =>
    DifficultyWeightDto(
      level: json['level'] as String?,
      percentage: json['percentage'] as num?,
    );

PyqSourceDto _$PyqSourceDtoFromJson(Map<String, dynamic> json) => PyqSourceDto(
  id: json['id'] as String?,
  year: json['year'] as num?,
  chapter: json['chapter'] as String?,
);
