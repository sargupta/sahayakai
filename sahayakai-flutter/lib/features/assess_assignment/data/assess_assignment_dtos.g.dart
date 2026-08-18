// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'assess_assignment_dtos.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$AssessAssignmentRequestDtoToJson(
  AssessAssignmentRequestDto instance,
) => <String, dynamic>{
  'imageDataUri': instance.imageDataUri,
  'mode': instance.mode,
  if (instance.language case final value?) 'language': value,
  if (instance.editedTranscript case final value?) 'editedTranscript': value,
  if (instance.rubricSnapshot case final value?) 'rubricSnapshot': value,
};

AssessAssignmentResponseDto _$AssessAssignmentResponseDtoFromJson(
  Map<String, dynamic> json,
) => AssessAssignmentResponseDto(
  rawTranscript: json['rawTranscript'] as String?,
  editedTranscript: json['editedTranscript'] as String?,
  language: json['language'] as String?,
  overallScore: json['overallScore'] as num?,
  pointsEarned: json['pointsEarned'] as num?,
  pointsPossible: json['pointsPossible'] as num?,
  perCriterionScores: (json['perCriterionScores'] as List<dynamic>?)
      ?.map((e) => CriterionScoreDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  strengths: (json['strengths'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
  improvements: (json['improvements'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
  nextSteps: (json['nextSteps'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
  teacherNote: json['teacherNote'] as String?,
  confidenceOverall: json['confidenceOverall'] as num?,
  warnings: (json['warnings'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
  rubricSnapshot: json['rubricSnapshot'] == null
      ? null
      : AssessmentRubricDto.fromJson(
          json['rubricSnapshot'] as Map<String, dynamic>,
        ),
);

CriterionScoreDto _$CriterionScoreDtoFromJson(Map<String, dynamic> json) =>
    CriterionScoreDto(
      criterionName: json['criterionName'] as String?,
      level: json['level'] as String?,
      points: json['points'] as num?,
      maxPoints: json['maxPoints'] as num?,
      feedback: json['feedback'] as String?,
      confidence: json['confidence'] as num?,
    );

AssessmentRubricDto _$AssessmentRubricDtoFromJson(Map<String, dynamic> json) =>
    AssessmentRubricDto(
      title: json['title'] as String?,
      description: json['description'] as String?,
      criteria: (json['criteria'] as List<dynamic>?)
          ?.map(
            (e) => AssessmentRubricCriterionDto.fromJson(
              e as Map<String, dynamic>,
            ),
          )
          .toList(),
      gradeLevel: json['gradeLevel'] as String?,
      subject: json['subject'] as String?,
    );

AssessmentRubricCriterionDto _$AssessmentRubricCriterionDtoFromJson(
  Map<String, dynamic> json,
) => AssessmentRubricCriterionDto(
  name: json['name'] as String?,
  description: json['description'] as String?,
  levels: (json['levels'] as List<dynamic>?)
      ?.map((e) => AssessmentRubricLevelDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

AssessmentRubricLevelDto _$AssessmentRubricLevelDtoFromJson(
  Map<String, dynamic> json,
) => AssessmentRubricLevelDto(
  name: json['name'] as String?,
  description: json['description'] as String?,
  points: json['points'] as num?,
);
