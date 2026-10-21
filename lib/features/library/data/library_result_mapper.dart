/// Reshapes a saved Library item's `data` payload — `z.any()` server-side
/// (`SaveContentSchema` in `sahayakai-main/src/ai/schemas/content-schemas.ts`)
/// — into the exact domain model each tool's OWN `*_result_view.dart` widget
/// already renders, so `library_detail_screen.dart` can show a saved
/// generation through the same widget the tool itself uses instead of a bare
/// "Ready" checkmark.
///
/// `library_detail_screen.dart` (a `presentation` file) may not import this
/// file's DTO dependencies directly — ARCHITECTURE §7: "`presentation` may
/// import `domain` + `shared`, never another feature's `data`". This file
/// lives in the Library feature's OWN `data/` layer instead, and every
/// function here returns a domain model only (never a DTO), so the boundary
/// holds while the reshape still happens.
///
/// EVERY mapper below was checked against the `sahayakai-main` flow that
/// actually persists that content type — not assumed. The general finding
/// (contradicting the shape divergence `library_repository.dart` used to
/// document as the reason this screen stayed a placeholder): most of the AI
/// flows this file covers call `dbAdapter.saveContent` with `data` set to the
/// flow's own output object, verbatim, and the live generate route's response
/// each tool's `*ResponseDto` was already built and pinned against is either
/// that exact object or a strict field-name subset of it. So the SAME
/// `*ResponseDto.fromJson(...).toDomain()` the repository uses to decode a
/// live generation also decodes a saved one correctly — no bespoke reshaping
/// needed for those. Three cases looked like they might diverge and were each
/// checked individually against the real writer:
///   - quiz: saved as the full multi-variant `{ easy, medium, hard, ... }`
///     envelope (`src/ai/flows/quiz-generator.ts`), never the single-variant
///     shape once assumed — turned out NOT to diverge.
///   - worksheet: saved as the fully structured object (`title`,
///     `learningObjectives`, `activities[...]`, `answerKey[...]`, ...), not a
///     bare markdown string (`src/ai/flows/worksheet-wizard.ts`); a legacy
///     `worksheetContent` markdown field rides along and is simply ignored —
///     also turned out NOT to diverge.
///   - visual-aid (T2-U11): DOES genuinely diverge, unlike the two above.
///     `visual-aid-designer.ts` strips the one field that actually carries the
///     drawing (`imageDataUri`) before persisting, replacing it with a GCS
///     `storageRef` the client cannot turn into pixels without a separate
///     signed-URL round trip (`GET /api/content/download`). See
///     [mapSavedVisualAid]'s own doc for the full finding — short version:
///     every real saved visual-aid maps to null today, honestly, not from a
///     decode bug.
///
/// Content types with NO dedicated mobile tool screen yet — micro-lesson,
/// virtual-field-trip — have no mapper here on purpose; `library_detail_screen.dart`
/// falls back to the honest "Ready" state for them, and for anything that
/// fails to decode below. visual-aid and assessment-submission (T2-U11) DO
/// have routed mobile tool screens now — see [mapSavedVisualAid] and
/// [mapSavedAssessmentScanner] below.
///
/// Every function shares the same contract:
///   1. refuses anything that is not a JSON object (a legacy/foreign shape) —
///      returns null rather than guessing;
///   2. never throws — a malformed field degrades to null, never a crash,
///      via the same defensive `*ResponseDto` decode the live generate path
///      already relies on, plus a belt-and-braces try/catch here;
///   3. drops a structurally-decoded-but-empty result (the model's own
///      `isEmpty` / `hasAnswer` signal, matching what each tool's live path
///      already treats as "nothing to render"), so the caller falls back to
///      the honest "Ready" state instead of an empty document.
library;

import '../../assess_assignment/data/assess_assignment_dtos.dart';
import '../../assess_assignment/domain/assessment.dart';
import '../../assessment_scanner/data/assessment_scanner_dtos.dart';
import '../../assessment_scanner/domain/assessment_scan.dart';
import '../../exam_paper/data/exam_paper_dtos.dart';
import '../../exam_paper/domain/exam_paper.dart';
import '../../instant_answer/data/instant_answer_dtos.dart';
import '../../instant_answer/domain/instant_answer.dart';
import '../../lesson_planner/data/lesson_plan_dtos.dart';
import '../../lesson_planner/domain/lesson_plan.dart';
import '../../quiz_generator/data/quiz_dtos.dart';
import '../../quiz_generator/domain/quiz.dart';
import '../../rubric_generator/data/rubric_dtos.dart';
import '../../rubric_generator/domain/rubric.dart';
import '../../teacher_training/data/teacher_training_dtos.dart';
import '../../teacher_training/domain/teacher_advice.dart';
import '../../visual_aid/data/visual_aid_dtos.dart';
import '../../visual_aid/domain/visual_aid.dart';
import '../../worksheet_wizard/data/worksheet_dtos.dart';
import '../../worksheet_wizard/domain/worksheet.dart';

/// Verified against `sahayakai-main/src/ai/flows/lesson-plan-generator.ts`:
/// `LessonPlanOutputSchema` (title, gradeLevel, duration, subject,
/// objectives, keyVocabulary, materials, activities[...], assessment,
/// homework) is exactly what both `dbAdapter.saveContent` calls persist as
/// `data` (the cache-hit branch saves `data: cached`, the fresh-generation
/// branch saves `data: output` — both are `LessonPlanOutputSchema` values).
/// Matches [LessonPlanResponseDto] field-for-field.
LessonPlan? mapSavedLessonPlan(Object? raw) {
  if (raw is! Map<String, dynamic>) return null;
  try {
    final plan = LessonPlanResponseDto.fromJson(raw).toDomain();
    final isEmpty = plan.title.isEmpty &&
        plan.objectives.isEmpty &&
        plan.materials.isEmpty &&
        plan.activities.isEmpty;
    return isEmpty ? null : plan;
  } catch (_) {
    return null;
  }
}

/// Verified against `sahayakai-main/src/ai/flows/quiz-generator.ts`: the
/// `dbAdapter.saveContent(input.userId, { ..., data: output })` call at the
/// end of `generateQuiz` persists `output`, a `QuizVariantsOutput` —
/// `{ easy, medium, hard, id, gradeLevel, subject, topic, isSaved,
/// validationWarning }` — the SAME shape `POST /api/ai/quiz` returns. The
/// frontend's own "Save to Library" button
/// (`src/components/quiz-display.tsx`) sends `data: editState.editedVariants`,
/// which is that same envelope round-tripped through the UI. Matches
/// [QuizResponseDto] field-for-field.
Quiz? mapSavedQuiz(Object? raw) {
  if (raw is! Map<String, dynamic>) return null;
  try {
    final quiz = QuizResponseDto.fromJson(raw).toDomain();
    return quiz.variants.isEmpty ? null : quiz;
  } catch (_) {
    return null;
  }
}

/// Verified against `sahayakai-main/src/ai/flows/worksheet-wizard.ts`:
/// `WorksheetWizardOutputSchema` (title, gradeLevel, subject,
/// learningObjectives, studentInstructions, activities[{type, content,
/// explanation, chalkboardNote}], answerKey[{activityIndex, answer}], plus a
/// derived legacy `worksheetContent` markdown string) is exactly what
/// `dbAdapter.saveContent(..., { data: output })` persists. Matches
/// [WorksheetResponseDto] field-for-field; the legacy markdown field is not
/// modelled there and is simply ignored.
Worksheet? mapSavedWorksheet(Object? raw) {
  if (raw is! Map<String, dynamic>) return null;
  try {
    final worksheet = WorksheetResponseDto.fromJson(raw).toDomain();
    return worksheet.isEmpty ? null : worksheet;
  } catch (_) {
    return null;
  }
}

/// Verified against `sahayakai-main/src/ai/flows/rubric-generator.ts`:
/// `RubricGeneratorOutputSchema` (title, description, criteria[{name,
/// description, levels[{name, description, points}]}], gradeLevel, subject)
/// is exactly what `dbAdapter.saveContent(..., { data: output })` persists.
/// Matches [RubricResponseDto] field-for-field.
Rubric? mapSavedRubric(Object? raw) {
  if (raw is! Map<String, dynamic>) return null;
  try {
    final rubric = RubricResponseDto.fromJson(raw).toDomain();
    return rubric.isEmpty ? null : rubric;
  } catch (_) {
    return null;
  }
}

/// Verified against `sahayakai-main/src/ai/flows/instant-answer.ts`:
/// `InstantAnswerOutputSchema` (answer, videoSuggestionUrl, gradeLevel,
/// subject) is exactly what `dbAdapter.saveContent(..., { data:
/// sanitizedOutput })` persists — identical to what `POST
/// /api/ai/instant-answer` returns. Matches [InstantAnswerResponseDto]
/// field-for-field. The saved item's own `title` is the original question
/// (the flow saves `title: input.question`); the caller passes that through
/// separately as the result view's masthead, since [InstantAnswer] itself
/// never carries the question text.
InstantAnswer? mapSavedInstantAnswer(Object? raw) {
  if (raw is! Map<String, dynamic>) return null;
  try {
    final answer = InstantAnswerResponseDto.fromJson(raw).toDomain();
    return answer.hasAnswer ? answer : null;
  } catch (_) {
    return null;
  }
}

/// Verified against `sahayakai-main/src/ai/flows/teacher-training.ts`:
/// `TeacherTrainingOutputSchema` (introduction, advice[{strategy, pedagogy,
/// explanation}], conclusion, gradeLevel, subject) is exactly what
/// `dbAdapter.saveContent(..., { data: output })` persists. Matches
/// [TeacherTrainingResponseDto] field-for-field.
TeacherAdvice? mapSavedTeacherAdvice(Object? raw) {
  if (raw is! Map<String, dynamic>) return null;
  try {
    final advice = TeacherTrainingResponseDto.fromJson(raw).toDomain();
    return advice.isEmpty ? null : advice;
  } catch (_) {
    return null;
  }
}

/// Verified against `sahayakai-main/src/ai/flows/exam-paper-generator.ts`
/// (`dbAdapter.saveContent(..., { data: parsedOutput })`) AND the `PUT
/// /api/ai/exam-paper` save handler
/// (`sahayakai-main/src/app/api/ai/exam-paper/route.ts`, which persists
/// `data: body.paper` — the caller's own copy of what `POST
/// /api/ai/exam-paper` returned). Both paths save the same
/// `ExamPaperDataSchema` shape (title, board, subject, gradeLevel, duration,
/// maxMarks, generalInstructions, sections[...], blueprintSummary,
/// pyqSources). Matches [ExamPaperResponseDto] field-for-field. `raw` is kept
/// verbatim as [ExamPaperReady.raw], the same contract a live generation's
/// result carries (the result view's Save action re-PUTs it byte-for-byte).
ExamPaperReady? mapSavedExamPaper(Object? raw) {
  if (raw is! Map<String, dynamic>) return null;
  try {
    final paper = ExamPaperResponseDto.fromJson(raw).toDomain();
    if (paper.isEmpty) return null;
    return ExamPaperReady(paper: paper, raw: raw);
  } catch (_) {
    return null;
  }
}

/// Verified against `sahayakai-main/src/ai/flows/assignment-assessor.ts`:
/// `AssessAssignmentOutputSchema` (rawTranscript, editedTranscript, language,
/// overallScore, pointsEarned, pointsPossible, perCriterionScores[...],
/// strengths, improvements, nextSteps, teacherNote, confidenceOverall,
/// warnings, rubricSnapshot, plus assessmentId/studentId/createdAtIso this
/// mapper does not need) is exactly what `dbAdapter.saveContent(..., { data:
/// finalOutput })` persists. Carries the rubric under the key
/// `rubricSnapshot`, not `rubric` — matches [AssessAssignmentResponseDto]
/// field-for-field, which is exactly why this reuses it instead of a
/// hand-rolled parser that could get that key wrong.
Assessment? mapSavedAssessment(Object? raw) {
  if (raw is! Map<String, dynamic>) return null;
  try {
    final assessment = AssessAssignmentResponseDto.fromJson(raw).toDomain();
    return assessment.isEmpty ? null : assessment;
  } catch (_) {
    return null;
  }
}

/// Verified against `sahayakai-main/src/ai/flows/visual-aid-designer.ts`:
/// `dbAdapter.saveContent(..., { data: { ...finalOutput, imageDataUri:
/// undefined, storageRef: filePath } })` persists `pedagogicalContext`,
/// `discussionSpark` and `subject` verbatim (same as the live
/// `VisualAidOutputSchema`), but DELIBERATELY DROPS `imageDataUri` — the only
/// field that carries the drawing itself — and substitutes `storageRef`, a
/// private GCS path (the upload is saved with `isPublic: false`). Turning that
/// path into actual pixels requires a SEPARATE authenticated round trip
/// (`GET /api/content/download?id=...`, which mints a 15-minute signed URL)
/// that this synchronous, JSON-only mapper does not — and structurally cannot
/// — make.
///
/// So [VisualAidResponseDto.fromJson] still decodes `pedagogicalContext` /
/// `discussionSpark` / `subject` correctly (those three DO match
/// field-for-field), but `imageDataUri` is absent from every real saved
/// document, so [VisualAid.hasImage] comes back false every time. That is not
/// a decode bug — it is a genuine, verified backend gap. This mapper treats
/// `hasImage` exactly like [mapSavedInstantAnswer] treats `hasAnswer`: a false
/// value means "nothing this view can honestly show", so it returns null and
/// sends the caller to the generic "Ready" state — NOT to
/// [VisualAidResultView]'s own "no image, try rephrasing" empty state, whose
/// copy would be actively misleading here (the drawing was generated fine; it
/// just isn't reachable from this payload).
VisualAid? mapSavedVisualAid(Object? raw) {
  if (raw is! Map<String, dynamic>) return null;
  try {
    final aid = VisualAidResponseDto.fromJson(raw).toDomain();
    return aid.hasImage ? aid : null;
  } catch (_) {
    return null;
  }
}

/// Verified against `sahayakai-main/src/ai/flows/assessment-scanner.ts`:
/// `persist()`'s `dbAdapter.saveContent(..., { data: output })` call persists
/// `output` — an `AssessmentScannerOutputSchema` value built by `aggregate()`
/// — verbatim. That is the SAME object `POST /api/ai/assessment-scanner`
/// returns: the route calls `dispatchAssessmentScanner(body)` and passes the
/// result straight into `NextResponse.json(result)`, no wrapping or renaming.
/// Matches [AssessmentScannerResponseDto] field-for-field, including
/// `GradedQuestionSchema`'s `marksAwarded` / `marksMax` naming. The saved
/// payload's `conceptMastery`, `classAverageAtScan` and `teacherEditedAt` ride
/// along unused, same as on the live generate path — the DTO already
/// documents them as intentionally unmodelled.
AssessmentResult? mapSavedAssessmentScanner(Object? raw) {
  if (raw is! Map<String, dynamic>) return null;
  try {
    final result = AssessmentScannerResponseDto.fromJson(raw).toDomain();
    return result.isEmpty ? null : result;
  } catch (_) {
    return null;
  }
}
