// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'assessment_scanner_dtos.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$AssessmentScannerRequestDtoToJson(
  AssessmentScannerRequestDto instance,
) => <String, dynamic>{
  'assessmentId': instance.assessmentId,
  'pageUrls': instance.pageUrls,
  'subject': instance.subject,
  'gradeLevel': instance.gradeLevel,
  if (instance.language case final value?) 'language': value,
  if (instance.teacherAnswerKeyText case final value?)
    'teacherAnswerKeyText': value,
  if (instance.educationBoard case final value?) 'educationBoard': value,
};

AssessmentScannerResponseDto _$AssessmentScannerResponseDtoFromJson(
  Map<String, dynamic> json,
) => AssessmentScannerResponseDto(
  assessmentId: json['assessmentId'] as String?,
  status: json['status'] as String?,
  pageCount: json['pageCount'] as num?,
  totalAwardedMarks: json['totalAwardedMarks'] as num?,
  totalMaxMarks: json['totalMaxMarks'] as num?,
  scorePct: json['scorePct'] as num?,
  letterGrade: json['letterGrade'] as String?,
  questions: (json['questions'] as List<dynamic>?)
      ?.map((e) => GradedQuestionDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  recommendedNextSteps: (json['recommendedNextSteps'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
  studentRecommendations: (json['studentRecommendations'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
  needsReviewCount: json['needsReviewCount'] as num?,
  imageQualityWarnings: (json['imageQualityWarnings'] as List<dynamic>?)
      ?.map((e) => e as String)
      .toList(),
  errorMessage: json['errorMessage'] as String?,
);

GradedQuestionDto _$GradedQuestionDtoFromJson(Map<String, dynamic> json) =>
    GradedQuestionDto(
      questionId: json['questionId'] as String?,
      pageIndex: json['pageIndex'] as num?,
      questionText: json['questionText'] as String?,
      studentAnswer: json['studentAnswer'] as String?,
      expectedAnswer: json['expectedAnswer'] as String?,
      marksAwarded: json['marksAwarded'] as num?,
      marksMax: json['marksMax'] as num?,
      feedback: json['feedback'] as String?,
      studentFacingFeedback: json['studentFacingFeedback'] as String?,
      conceptTested: json['conceptTested'] as String?,
      mistakePattern: json['mistakePattern'] as String?,
      needsTeacherReview: json['needsTeacherReview'] as bool?,
      confidence: json['confidence'] as num?,
    );
