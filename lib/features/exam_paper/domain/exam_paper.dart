import 'package:flutter/foundation.dart';

/// Overall difficulty distribution the teacher asks for. Wire values are the
/// exact `z.enum(['easy','moderate','hard','mixed'])` the endpoint pins
/// (`ExamPaperInputSchema` in `sahayakai-main`); `mixed` is the server default.
enum ExamDifficulty {
  easy('easy'),
  moderate('moderate'),
  hard('hard'),
  mixed('mixed');

  const ExamDifficulty(this.wire);

  /// The exact token `POST /api/ai/exam-paper` validates against.
  final String wire;
}

/// Immutable input the teacher assembles on the exam-paper form.
///
/// `board`, `gradeLevel` and `subject` are REQUIRED (the route 400s without
/// them). `chapters` is a list — an empty list means "all chapters", which the
/// server only accepts when it has an official blueprint for the
/// board/grade/subject (see [examPaperNeedsChapters]); otherwise it 400s with
/// `chapters_required_for_unblueprinted_subject`. The server injects `userId`
/// and `teacherContext` from the verified token, so they are deliberately NOT
/// modelled here. `duration` / `maxMarks` default from the blueprint and are
/// not sent. Verified against `ExamPaperInputSchema` in `sahayakai-main`.
@immutable
class ExamPaperRequest {
  const ExamPaperRequest({
    required this.board,
    required this.gradeLevel,
    required this.subject,
    this.chapters = const <String>[],
    this.difficulty = ExamDifficulty.mixed,
    this.language,
    this.includeAnswerKey = true,
    this.includeMarkingScheme = true,
  });

  final String board;
  final String gradeLevel;
  final String subject;

  /// Selected chapters; empty = "all chapters" (only valid for a blueprinted
  /// board/grade/subject).
  final List<String> chapters;

  final ExamDifficulty difficulty;

  /// Full English language name the endpoint expects (e.g. `Kannada`),
  /// sourced from [AppLocale.aiName].
  final String? language;

  final bool includeAnswerKey;
  final bool includeMarkingScheme;
}

/// True when the chosen board/grade/subject has NO official blueprint, so the
/// server needs at least one chapter to anchor the paper (else it 400s with
/// `chapters_required_for_unblueprinted_subject`).
///
/// Mirrors `findBlueprint` in `src/ai/data/board-blueprints.ts`: the only
/// blueprinted combos are **CBSE Class 9 / Class 10 Mathematics / Science**
/// (case-insensitive, trimmed). Any required field still unset returns `false`
/// — the field's own validator handles the empty case first, so this never
/// double-reports.
bool examPaperNeedsChapters(String? board, String? gradeLevel, String? subject) {
  if (board == null || gradeLevel == null || subject == null) return false;
  final b = board.trim().toLowerCase();
  final g = gradeLevel.trim().toLowerCase();
  final s = subject.trim().toLowerCase();
  final blueprinted = b == 'cbse' &&
      (g == 'class 9' || g == 'class 10') &&
      (s == 'mathematics' || s == 'science');
  return !blueprinted;
}

/// One question within a section. Every field is null-tolerant because the
/// paper is model-generated. `options` is present for MCQs (four labelled
/// options); `answerKey` / `markingScheme` are present only when the teacher
/// asked for them AND the model produced them.
@immutable
class ExamQuestion {
  const ExamQuestion({
    required this.number,
    required this.text,
    this.marks,
    this.options = const <String>[],
    this.internalChoice,
    this.answerKey,
    this.markingScheme,
    this.source,
  });

  final num? number;
  final String text;
  final num? marks;
  final List<String> options;

  /// An "OR" alternative question, if the blueprint allows internal choice.
  final String? internalChoice;
  final String? answerKey;
  final String? markingScheme;

  /// Provenance tag: `AI Generated` or `PYQ <year>`.
  final String? source;

  bool get hasAnswerKey => answerKey != null && answerKey!.isNotEmpty;
  bool get hasMarkingScheme =>
      markingScheme != null && markingScheme!.isNotEmpty;
}

/// One section of the paper (e.g. "Section A — Multiple Choice Questions").
@immutable
class ExamSection {
  const ExamSection({
    required this.name,
    this.label,
    this.totalMarks,
    this.questions = const <ExamQuestion>[],
  });

  final String name;
  final String? label;
  final num? totalMarks;
  final List<ExamQuestion> questions;
}

/// One chapter's mark weight in the blueprint summary.
@immutable
class ChapterWeight {
  const ChapterWeight({required this.chapter, this.marks});
  final String chapter;
  final num? marks;
}

/// One difficulty band's percentage in the blueprint summary.
@immutable
class DifficultyWeight {
  const DifficultyWeight({required this.level, this.percentage});
  final String level;
  final num? percentage;
}

/// The blueprint the paper was built against: how marks split across chapters
/// and how difficulty is distributed.
@immutable
class BlueprintSummary {
  const BlueprintSummary({
    this.chapterWise = const <ChapterWeight>[],
    this.difficultyWise = const <DifficultyWeight>[],
  });

  final List<ChapterWeight> chapterWise;
  final List<DifficultyWeight> difficultyWise;

  bool get isEmpty => chapterWise.isEmpty && difficultyWise.isEmpty;
}

/// A prior-year-question source attribution.
@immutable
class PyqSource {
  const PyqSource({required this.id, this.year, this.chapter});
  final String id;
  final int? year;
  final String? chapter;
}

/// The full `POST /api/ai/exam-paper` 200 result. Field names match the route's
/// returned object exactly: `title`, `board`, `subject`, `gradeLevel`,
/// `duration`, `maxMarks`, `generalInstructions`, `sections[...]`,
/// `blueprintSummary`, `pyqSources[...]`. Verified against `ExamPaperDataSchema`
/// / `ExamPaperOutputSchema` + the route handler in `sahayakai-main`. See
/// docs/flutter/HANDOFF.md.
@immutable
class ExamPaper {
  const ExamPaper({
    required this.title,
    required this.board,
    required this.subject,
    required this.gradeLevel,
    this.duration,
    this.maxMarks,
    this.generalInstructions = const <String>[],
    this.sections = const <ExamSection>[],
    this.blueprintSummary,
    this.pyqSources = const <PyqSource>[],
  });

  final String title;
  final String board;
  final String subject;
  final String gradeLevel;
  final String? duration;
  final num? maxMarks;
  final List<String> generalInstructions;
  final List<ExamSection> sections;
  final BlueprintSummary? blueprintSummary;
  final List<PyqSource> pyqSources;

  /// True when the model returned nothing worth rendering — the view shows an
  /// empty result state rather than an unhelpful blank paper.
  ///
  /// Gated on [sections] alone, NOT `title.isEmpty && sections.isEmpty &&
  /// generalInstructions.isEmpty`. That AND-of-three used to require every
  /// field to be empty before the paper counted as empty, so a malformed
  /// response carrying only a `title` (no sections — no actual questions) read
  /// as "not empty" and rendered a full masthead + a tappable Save button over
  /// zero content: a fake-success state a teacher could save and burn quota
  /// on. A paper's only real content is its sections/questions, so emptiness
  /// must turn on them alone.
  bool get isEmpty => sections.isEmpty;
}

/// The outcome of a generate call. Distinct from a thrown [ApiException]: both
/// of these are "the server answered" states, one with a paper and one with the
/// **202 `generation_in_progress`** signal (still generating, will land in the
/// library). Modelling the 202 as data — not an error — is what lets the UI
/// render a calm "we'll save it to your Library" state instead of a red retry.
sealed class ExamPaperResult {
  const ExamPaperResult();
}

/// A generated paper, ready to render and to save. [raw] is the verbatim server
/// JSON so the PUT-to-library save round-trips byte-for-byte (the route persists
/// `body.paper` directly and reads `paper.title` / `paper.board` / ... off it).
class ExamPaperReady extends ExamPaperResult {
  const ExamPaperReady({required this.paper, required this.raw});
  final ExamPaper paper;
  final Map<String, dynamic> raw;
}

/// The **202** state: the paper is still generating server-side and will be
/// saved to the teacher's library. Carries the server's human message when
/// present; the view falls back to its own localized copy otherwise.
class ExamPaperInProgress extends ExamPaperResult {
  const ExamPaperInProgress({this.message});
  final String? message;
}
