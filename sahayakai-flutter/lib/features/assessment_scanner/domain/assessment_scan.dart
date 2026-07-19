import 'dart:math' as math;

import 'package:flutter/foundation.dart';

/// The subjects the Assessment Scanner accepts, copied verbatim from the
/// backend's `ASSESSMENT_SUPPORTED_SUBJECTS`
/// (`sahayakai-main/src/ai/schemas/assessment-scanner-constants.ts`). The route
/// validates `subject` against this exact list and rejects an unknown value with
/// a 400 (`UNSUPPORTED_SUBJECT`), so these are API enum values, NOT prose — they
/// stay in English and are never localized. "Other" is the catch-all generic
/// rubric. The grading rubric branches by subject family server-side.
const List<String> kAssessmentSubjects = <String>[
  'Mathematics',
  'Science',
  'Environmental Studies (EVS)',
  'Social Science',
  'History',
  'Geography',
  'Civics',
  'Hindi',
  'English',
  'Other',
];

/// The demo/Phase-2 page cap the route enforces (`ASSESSMENT_DEMO_PAGE_CAP`).
/// The schema ceiling is 15, but the route caps demo traffic at 3 for cost +
/// latency; the client mirrors that cap so a teacher never assembles a request
/// the server would reject with `PAGE_LIMIT_EXCEEDED`.
const int kAssessmentMaxPages = 3;

/// A freshly minted RFC-4122 version-4 UUID, formatted
/// `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.
///
/// The backend's `AssessmentScannerInputSchema.assessmentId` is
/// `z.string().uuid()` AND the idempotency key: re-submitting the same id
/// returns the cached grade without burning AI quota. So each *fresh* grade (and
/// each Regenerate) needs a NEW id. Generated locally with no package
/// dependency — this is an idempotency handle, not a security token, so a plain
/// [math.Random] is sufficient.
String newAssessmentId() {
  final rng = math.Random();
  final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
  // Version 4 (random) + RFC-4122 variant.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  String hex(int start, int end) {
    final b = StringBuffer();
    for (var i = start; i < end; i++) {
      b.write(bytes[i].toRadixString(16).padLeft(2, '0'));
    }
    return b.toString();
  }

  return '${hex(0, 4)}-${hex(4, 6)}-${hex(6, 8)}-${hex(8, 10)}-${hex(10, 16)}';
}

/// Immutable input the teacher assembles on the form.
///
/// [pageDataUris] is a NON-EMPTY list of up to [kAssessmentMaxPages]
/// `data:image/<jpeg|png|webp>;base64,<data>` URIs — one per photographed page.
/// Verified against `AssessmentScannerInputSchema` in `sahayakai-main`: the wire
/// field is `pageUrls` (bare data-URI / HTTPS strings, min 1, capped at the
/// route's demo cap). `subject` and `gradeLevel` are REQUIRED by the schema;
/// `language` defaults server-side; `teacherAnswerKeyText` and `educationBoard`
/// are optional. The server injects `userId` (and, later, `studentId`/`classId`)
/// from the verified token, so none of those are modelled here.
@immutable
class AssessmentScanRequest {
  const AssessmentScanRequest({
    required this.assessmentId,
    required this.pageDataUris,
    required this.subject,
    required this.gradeLevel,
    this.language,
    this.teacherAnswerKeyText,
    this.educationBoard,
  });

  /// Client-generated UUIDv4 idempotency key (see [newAssessmentId]).
  final String assessmentId;

  /// The photographed pages, each a base64 data URI. 1..[kAssessmentMaxPages].
  final List<String> pageDataUris;

  /// A subject from [kAssessmentSubjects]. Required by the schema.
  final String subject;

  /// A grade from GRADE_LEVELS (e.g. "Class 10"). Required by the schema.
  final String gradeLevel;

  /// Full English language name for the feedback (e.g. "Kannada"), from
  /// [AppLocale.aiName]. Optional; the server falls back to the profile.
  final String? language;

  /// An optional pasted answer key. Authoritative for grading when present.
  final String? teacherAnswerKeyText;

  /// An optional education board hint (rubric alignment). Optional; the server
  /// back-fills it from the teacher's saved board when omitted.
  final String? educationBoard;
}

/// How a graded question came out, derived from the marks (the backend
/// `GradedQuestion` carries NO `isCorrect` flag — the correct/partial/incorrect
/// signal is inferred from `marksAwarded` vs `marksMax`). Rendered as an
/// icon + text chip so the state is NEVER conveyed by colour alone.
enum QuestionOutcome { correct, partial, incorrect }

/// One graded question. Field names mirror `GradedQuestionSchema` exactly:
/// note the marks ceiling is `marksMax` (NOT `maxMarks`), and there is no
/// `isCorrect` — [outcome] derives it. Every prose field is model-generated and
/// rendered as-is (through `AiText`), never re-translated on the client.
@immutable
class GradedQuestion {
  const GradedQuestion({
    required this.questionId,
    required this.pageIndex,
    required this.questionText,
    required this.studentAnswer,
    required this.marksAwarded,
    required this.marksMax,
    this.expectedAnswer,
    this.feedback,
    this.studentFacingFeedback,
    this.conceptTested,
    this.mistakePattern,
    this.needsTeacherReview = false,
    this.confidence,
  });

  final String questionId;
  final int pageIndex;
  final String questionText;
  final String studentAnswer;
  final num marksAwarded;
  final num marksMax;
  final String? expectedAnswer;
  final String? feedback;
  final String? studentFacingFeedback;
  final String? conceptTested;
  final String? mistakePattern;
  final bool needsTeacherReview;
  final double? confidence;

  /// True when the question carries a real marks scale. A `question_only` page
  /// scores 0/0 and is excluded from totals; such a row shows no marks badge or
  /// outcome chip.
  bool get isScored => marksMax > 0;

  /// The correct/partial/incorrect signal, derived from the marks. Only
  /// meaningful when [isScored].
  QuestionOutcome get outcome {
    if (marksAwarded >= marksMax) return QuestionOutcome.correct;
    if (marksAwarded <= 0) return QuestionOutcome.incorrect;
    return QuestionOutcome.partial;
  }

  /// The 1-based page this question was read from.
  int get pageNumber => pageIndex + 1;
}

/// The full `/api/ai/assessment-scanner` result — a graded answer sheet. Field
/// names match `AssessmentScannerOutputSchema` exactly. The overall gauge is
/// [scorePct] (0..100), which drives the ScoreRing; [totalAwardedMarks] /
/// [totalMaxMarks] are the raw marks. Every list is defensive because the output
/// is model-generated.
@immutable
class AssessmentResult {
  const AssessmentResult({
    required this.assessmentId,
    required this.status,
    required this.pageCount,
    required this.totalAwardedMarks,
    required this.totalMaxMarks,
    required this.scorePct,
    required this.letterGrade,
    this.questions = const <GradedQuestion>[],
    this.recommendedNextSteps = const <String>[],
    this.studentRecommendations = const <String>[],
    this.needsReviewCount = 0,
    this.imageQualityWarnings = const <String>[],
    this.errorMessage,
  });

  /// 'graded' | 'partial' | 'failed'.
  final String status;
  final String assessmentId;
  final int pageCount;
  final num totalAwardedMarks;
  final num totalMaxMarks;

  /// 0..100 overall score — the ScoreRing gauge.
  final num scorePct;

  /// A+/A/B/C/D/E, derived server-side from [scorePct].
  final String letterGrade;
  final List<GradedQuestion> questions;

  /// Teacher-facing guidance (re-teach X, assign Y). Rendered as-is.
  final List<String> recommendedNextSteps;

  /// Student-facing guidance, already in the requested language. Rendered as-is.
  final List<String> studentRecommendations;

  /// Count of questions flagged `needsTeacherReview`. Surfaced as a badge.
  final int needsReviewCount;

  /// Human-readable per-page photo warnings (e.g. "Page 1: blurry"). Rendered
  /// as-is; these are server-composed English advisories.
  final List<String> imageQualityWarnings;
  final String? errorMessage;

  /// The overall score clamped to 0..100 and rounded — the ScoreRing needs an
  /// integer over 100 (model drift can push [scorePct] slightly out of range).
  int get scorePercent => scorePct.clamp(0, 100).round();

  /// True when the model returned nothing worth rendering — the view shows a
  /// dignified empty state instead of a hollow scorecard.
  bool get isEmpty =>
      questions.isEmpty &&
      recommendedNextSteps.isEmpty &&
      studentRecommendations.isEmpty;
}
