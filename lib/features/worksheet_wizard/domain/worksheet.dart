import 'package:flutter/foundation.dart';

/// The kind of a worksheet activity. The [wire] values are the exact enum
/// members `/api/ai/worksheet` returns (`WorksheetActivitySchema.type`) — never
/// localize them; only the surrounding label is localized.
enum WorksheetActivityType {
  question('question'),
  puzzle('puzzle'),
  creativeTask('creative_task');

  const WorksheetActivityType(this.wire);

  final String wire;

  /// Tolerant parse: the worksheet is model-generated, so an unknown or absent
  /// type degrades to "no badge" (null) rather than crashing the screen.
  static WorksheetActivityType? fromWire(String? wire) {
    for (final t in WorksheetActivityType.values) {
      if (t.wire == wire) return t;
    }
    return null;
  }
}

/// Immutable input the teacher assembles on the form.
///
/// `imageDataUri` is REQUIRED by the backend schema (a textbook-page photo).
/// The server injects `userId` and `teacherContext` from the verified token,
/// so they are deliberately NOT modelled here. Verified against
/// `WorksheetWizardInputSchema` in `sahayakai-main`.
@immutable
class WorksheetRequest {
  const WorksheetRequest({
    required this.imageDataUri,
    required this.prompt,
    this.gradeLevel,
    this.subject,
    this.language,
  });

  /// A `data:<mime>;base64,<data>` URI. Required; capped server-side (see
  /// `kMaxImageDataUriBytes`).
  final String imageDataUri;

  /// What kind of worksheet to build. Required; the endpoint caps it at 2000.
  final String prompt;
  final String? gradeLevel;
  final String? subject;

  /// Full English language name the endpoint expects (e.g. `Kannada`),
  /// sourced from [AppLocale.aiName].
  final String? language;
}

/// One activity on the generated worksheet.
@immutable
class WorksheetActivity {
  const WorksheetActivity({
    required this.content,
    this.type,
    this.explanation,
    this.chalkboardNote,
  });

  /// The activity itself (a question or task; may carry LaTeX in `$…$`).
  final String content;
  final WorksheetActivityType? type;

  /// The model's Bharat-First pedagogical note for the activity.
  final String? explanation;

  /// Advice for reproducing the activity on a blackboard.
  final String? chalkboardNote;
}

/// One answer-key entry. [activityIndex] is the 0-based index of the activity
/// it answers (backend `answerKey[i].activityIndex`); the view shows it as a
/// 1-based "Activity N". Null-tolerant because the field is model-generated.
@immutable
class AnswerKeyEntry {
  const AnswerKeyEntry({required this.answer, this.activityIndex});

  final String answer;
  final int? activityIndex;

  /// The 1-based activity number to display, or null when the index is absent.
  int? get displayNumber => activityIndex == null ? null : activityIndex! + 1;
}

/// The full `/api/ai/worksheet` result. Field names match the route's returned
/// shape exactly: note it is `learningObjectives`, NOT the `objectives` that
/// SCREEN_INVENTORY P1.1 prints (see docs/flutter/HANDOFF.md).
@immutable
class Worksheet {
  const Worksheet({
    required this.title,
    this.gradeLevel,
    this.subject,
    this.learningObjectives = const <String>[],
    this.studentInstructions,
    this.activities = const <WorksheetActivity>[],
    this.answerKey = const <AnswerKeyEntry>[],
    this.raw = const <String, dynamic>{},
  });

  final String title;
  final String? gradeLevel;
  final String? subject;
  final List<String> learningObjectives;
  final String? studentInstructions;
  final List<WorksheetActivity> activities;
  final List<AnswerKeyEntry> answerKey;

  /// The verbatim `/api/ai/worksheet` 200 body (the `WorksheetWizardOutput`),
  /// kept so a Save-to-Library round-trips byte-identically to what the model
  /// produced — the same `data: output` payload the backend flow persists via
  /// `dbAdapter.saveContent` and the Library reads back through
  /// `mapSavedWorksheet`. Defaults to `{}` (e.g. a worksheet built directly in
  /// a test or re-hydrated from the Library, where there is nothing new to
  /// save).
  final Map<String, dynamic> raw;

  /// True when the model returned nothing worth rendering — the view shows an
  /// empty result state rather than an unhelpful blank card.
  ///
  /// Gated on [activities] alone, NOT an AND of every field. That AND used to
  /// require title, objectives, instructions, activities AND the answer key to
  /// all be empty before the worksheet counted as empty, so a malformed
  /// response carrying only a `title` (no activities — nothing for the
  /// student to actually do) read as "not empty" and rendered a full masthead
  /// + a tappable Save button over zero content — the same fake-success bug
  /// `ExamPaper.isEmpty` had. A worksheet's only real content is its
  /// activities, so emptiness must turn on them alone.
  bool get isEmpty => activities.isEmpty;
}
