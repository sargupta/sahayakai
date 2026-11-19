import '../../../core/i18n/gen/app_localizations.dart';
import '../../../shared/domain/library_item.dart';
import '../../assess_assignment/presentation/widgets/assess_assignment_result_view.dart';
import '../../assessment_scanner/presentation/widgets/assessment_scanner_result_view.dart';
import '../../exam_paper/presentation/widgets/exam_paper_result_view.dart';
import '../../instant_answer/presentation/widgets/instant_answer_result_view.dart';
import '../../lesson_planner/presentation/widgets/lesson_plan_result_view.dart';
import '../../quiz_generator/presentation/widgets/quiz_result_view.dart';
import '../../rubric_generator/presentation/widgets/rubric_result_view.dart';
import '../../teacher_training/presentation/widgets/teacher_training_result_view.dart';
import '../../visual_aid/presentation/widgets/visual_aid_result_view.dart';
import '../../worksheet_wizard/presentation/widgets/worksheet_result_view.dart';
import '../data/library_result_mapper.dart';

/// The plain-text rendering of a saved library item, by type — the same text
/// the detail screen's Share/Copy bar sends and a My-work row's Share button
/// sends. Returns null when the item cannot be mapped to shareable text
/// (an unknown or not-yet-supported type).
///
/// Lives here, not in the detail screen, so the list row can share an item
/// without opening it (and both paths stay byte-identical).
String? libraryShareText(LibraryItem full, AppLocalizations l10n) {
  switch (full.type) {
    case ContentType.lessonPlan:
      final plan = mapSavedLessonPlan(full.data);
      return plan == null ? null : lessonPlanAsPlainText(plan, l10n);
    case ContentType.quiz:
      final quiz = mapSavedQuiz(full.data);
      return quiz == null ? null : quizAsPlainText(quiz, l10n);
    case ContentType.worksheet:
      final worksheet = mapSavedWorksheet(full.data);
      return worksheet == null ? null : worksheetAsPlainText(worksheet, l10n);
    case ContentType.rubric:
      final rubric = mapSavedRubric(full.data);
      return rubric == null ? null : rubricAsPlainText(rubric, l10n);
    case ContentType.instantAnswer:
      final answer = mapSavedInstantAnswer(full.data);
      return answer == null
          ? null
          : instantAnswerAsPlainText(
              answer,
              question: full.title.isEmpty ? null : full.title,
            );
    case ContentType.teacherTraining:
      final advice = mapSavedTeacherAdvice(full.data);
      return advice == null ? null : teacherAdviceAsPlainText(advice, l10n);
    case ContentType.examPaper:
      final ready = mapSavedExamPaper(full.data);
      return ready == null ? null : examPaperAsPlainText(ready.paper, l10n);
    case ContentType.assessment:
      final assessment = mapSavedAssessment(full.data);
      return assessment == null
          ? null
          : assessmentAsPlainText(assessment, l10n);
    case ContentType.visualAid:
      final aid = mapSavedVisualAid(full.data);
      return aid == null
          ? null
          : visualAidAsPlainText(
              aid,
              l10n,
              prompt: full.title.isEmpty ? null : full.title,
            );
    case ContentType.assessmentSubmission:
      final result = mapSavedAssessmentScanner(full.data);
      return result == null ? null : assessmentResultAsPlainText(result, l10n);
    case ContentType.microLesson:
    case ContentType.virtualFieldTrip:
    case ContentType.unknown:
      return null;
  }
}
