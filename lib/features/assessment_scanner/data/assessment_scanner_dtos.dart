import 'package:json_annotation/json_annotation.dart';

import '../domain/assessment_scan.dart';

part 'assessment_scanner_dtos.g.dart';

/// Serializes an [AssessmentScanRequest] into the exact
/// `POST /api/ai/assessment-scanner` body. `includeIfNull: false` drops the
/// optionals the teacher left blank so the server applies its own defaults.
///
/// Pinned against `AssessmentScannerInputSchema` in `sahayakai-main`. The
/// multi-page field is `pageUrls` (an array of bare `data:` URI strings, min 1,
/// capped at the route's demo page cap). `userId` / `studentId` / `classId` are
/// injected server-side from the verified token and are NEVER sent from here.
@JsonSerializable(includeIfNull: false, createFactory: false)
class AssessmentScannerRequestDto {
  const AssessmentScannerRequestDto({
    required this.assessmentId,
    required this.pageUrls,
    required this.subject,
    required this.gradeLevel,
    this.language,
    this.teacherAnswerKeyText,
    this.educationBoard,
  });

  factory AssessmentScannerRequestDto.fromDomain(AssessmentScanRequest r) {
    return AssessmentScannerRequestDto(
      assessmentId: r.assessmentId,
      // The data URIs are sent verbatim under `pageUrls`: the server validates
      // each string's length and its `data:image/...;base64,` shape.
      pageUrls: r.pageDataUris,
      subject: r.subject,
      gradeLevel: r.gradeLevel,
      language: _blankToNull(r.language),
      teacherAnswerKeyText: _blankToNull(r.teacherAnswerKeyText),
      educationBoard: _blankToNull(r.educationBoard),
    );
  }

  final String assessmentId;
  final List<String> pageUrls;
  final String subject;
  final String gradeLevel;
  final String? language;
  final String? teacherAnswerKeyText;
  final String? educationBoard;

  Map<String, dynamic> toJson() => _$AssessmentScannerRequestDtoToJson(this);
}

/// The `/api/ai/assessment-scanner` 200 payload — a graded answer sheet. Every
/// field is defensive because the assessment is model-generated; [toDomain]
/// normalizes it into the render model. Field names mirror
/// `AssessmentScannerOutputSchema` exactly (the overall gauge is `scorePct`;
/// per-question marks ceiling is `marksMax`). The `conceptMastery`,
/// `classAverageAtScan` and `teacherEditedAt` fields are intentionally not
/// modelled — the scanner UI does not render them and json_serializable ignores
/// unknown keys.
@JsonSerializable(createToJson: false)
class AssessmentScannerResponseDto {
  const AssessmentScannerResponseDto({
    this.assessmentId,
    this.status,
    this.pageCount,
    this.totalAwardedMarks,
    this.totalMaxMarks,
    this.scorePct,
    this.letterGrade,
    this.questions,
    this.recommendedNextSteps,
    this.studentRecommendations,
    this.needsReviewCount,
    this.imageQualityWarnings,
    this.errorMessage,
  });

  factory AssessmentScannerResponseDto.fromJson(Map<String, dynamic> json) =>
      _$AssessmentScannerResponseDtoFromJson(json);

  final String? assessmentId;
  final String? status;
  final num? pageCount;
  final num? totalAwardedMarks;
  final num? totalMaxMarks;
  final num? scorePct;
  final String? letterGrade;
  final List<GradedQuestionDto>? questions;
  final List<String>? recommendedNextSteps;
  final List<String>? studentRecommendations;
  final num? needsReviewCount;
  final List<String>? imageQualityWarnings;
  final String? errorMessage;

  AssessmentResult toDomain() {
    return AssessmentResult(
      assessmentId: _clean(assessmentId) ?? '',
      status: _clean(status) ?? 'graded',
      pageCount: _toInt(pageCount),
      totalAwardedMarks: _toNum(totalAwardedMarks),
      totalMaxMarks: _toNum(totalMaxMarks),
      scorePct: _toNum(scorePct).clamp(0, 100),
      letterGrade: _clean(letterGrade) ?? '',
      questions: (questions ?? const <GradedQuestionDto>[])
          .map((q) => q.toDomain())
          // Drop rows the model returned with no question text AND no answer —
          // there is nothing to render for them.
          .where((q) => q.questionText.isNotEmpty || q.studentAnswer.isNotEmpty)
          .toList(growable: false),
      recommendedNextSteps: _cleanList(recommendedNextSteps),
      studentRecommendations: _cleanList(studentRecommendations),
      needsReviewCount: _toInt(needsReviewCount),
      imageQualityWarnings: _cleanList(imageQualityWarnings),
      errorMessage: _clean(errorMessage),
    );
  }
}

/// One graded question. Mirrors `GradedQuestionSchema`
/// (`{ questionId, pageIndex, questionText, studentAnswer, expectedAnswer,
/// marksAwarded, marksMax, feedback, studentFacingFeedback, conceptTested,
/// mistakePattern, needsTeacherReview, confidence, ... }`). The
/// `partialCreditBreakdown`, `ncertChapterId` and `teacherOverrides` fields are
/// not modelled (not rendered by the scanner UI).
@JsonSerializable(createToJson: false)
class GradedQuestionDto {
  const GradedQuestionDto({
    this.questionId,
    this.pageIndex,
    this.questionText,
    this.studentAnswer,
    this.expectedAnswer,
    this.marksAwarded,
    this.marksMax,
    this.feedback,
    this.studentFacingFeedback,
    this.conceptTested,
    this.mistakePattern,
    this.needsTeacherReview,
    this.confidence,
  });

  factory GradedQuestionDto.fromJson(Map<String, dynamic> json) =>
      _$GradedQuestionDtoFromJson(json);

  final String? questionId;
  final num? pageIndex;
  final String? questionText;
  final String? studentAnswer;
  final String? expectedAnswer;
  final num? marksAwarded;
  final num? marksMax;
  final String? feedback;
  final String? studentFacingFeedback;
  final String? conceptTested;
  final String? mistakePattern;
  final bool? needsTeacherReview;
  final num? confidence;

  GradedQuestion toDomain() => GradedQuestion(
        questionId: _clean(questionId) ?? '',
        pageIndex: _toInt(pageIndex),
        questionText: _clean(questionText) ?? '',
        studentAnswer: _clean(studentAnswer) ?? '',
        expectedAnswer: _clean(expectedAnswer),
        // Marks are clamped non-negative; awarded never exceeds max defensively.
        marksMax: _toNum(marksMax),
        marksAwarded: _toNum(marksAwarded)
            .clamp(0, _toNum(marksMax) > 0 ? _toNum(marksMax) : double.infinity),
        feedback: _clean(feedback),
        studentFacingFeedback: _clean(studentFacingFeedback),
        conceptTested: _clean(conceptTested),
        mistakePattern: _clean(mistakePattern),
        needsTeacherReview: needsTeacherReview ?? false,
        confidence: _toUnit(confidence),
      );
}

String? _clean(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}

List<String> _cleanList(List<String>? values) {
  if (values == null) return const <String>[];
  return values
      .map((v) => v.trim())
      .where((v) => v.isNotEmpty)
      .toList(growable: false);
}

String? _blankToNull(String? value) => _clean(value);

num _toNum(num? value) => value ?? 0;

int _toInt(num? value) => (value ?? 0).round();

/// Clamps a model-supplied confidence into the 0.0–1.0 unit interval, dropping a
/// null. Defensive: the schema promises 0–1, but the model can drift.
double? _toUnit(num? value) {
  if (value == null) return null;
  return value.toDouble().clamp(0.0, 1.0);
}
