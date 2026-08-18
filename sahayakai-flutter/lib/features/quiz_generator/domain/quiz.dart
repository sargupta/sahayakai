import 'package:flutter/foundation.dart';

/// The shape of a question the teacher can ask for. The [wire] values are the
/// exact enum members `/api/ai/quiz` accepts — never localize them.
enum QuestionType {
  multipleChoice('multiple_choice'),
  fillInTheBlanks('fill_in_the_blanks'),
  shortAnswer('short_answer'),
  trueFalse('true_false');

  const QuestionType(this.wire);

  final String wire;

  static QuestionType? fromWire(String? wire) {
    for (final t in QuestionType.values) {
      if (t.wire == wire) return t;
    }
    return null;
  }
}

/// A quiz difficulty band. Doubles as the request's `targetDifficulty` and as
/// the key of each returned variant, which is why one enum covers both.
enum QuizDifficulty {
  easy('easy'),
  medium('medium'),
  hard('hard');

  const QuizDifficulty(this.wire);

  final String wire;

  static QuizDifficulty? fromWire(String? wire) {
    for (final d in QuizDifficulty.values) {
      if (d.wire == wire) return d;
    }
    return null;
  }
}

/// Immutable input the teacher assembles on the form. `userId` (and the other
/// server-injected fields such as `gradeBandLabel` and `teacherContext`) come
/// from the verified token on the server and are deliberately NOT modelled
/// here.
@immutable
class QuizRequest {
  const QuizRequest({
    required this.topic,
    required this.questionTypes,
    this.numQuestions = 5,
    this.gradeLevel,
    this.subject,
    this.language,
    this.targetDifficulty,
    this.bloomsTaxonomyLevels = const <String>[],
    this.imageDataUri,
  });

  final String topic;

  /// At least one type is required by the endpoint's schema.
  final List<QuestionType> questionTypes;
  final int numQuestions;
  final String? gradeLevel;
  final String? subject;

  /// Full English language name the endpoint expects (e.g. `Kannada`),
  /// sourced from [AppLocale.aiName].
  final String? language;
  final QuizDifficulty? targetDifficulty;
  final List<String> bloomsTaxonomyLevels;

  /// Optional photo of a textbook page, as a `data:<mime>;base64,<data>` URI.
  /// The quiz schema calls this "the primary context for the quiz"; omitted
  /// from the request when null.
  final String? imageDataUri;
}

/// One generated question. [options] is only populated for multiple-choice.
@immutable
class Question {
  const Question({
    required this.questionText,
    required this.correctAnswer,
    this.questionType,
    this.options = const <String>[],
    this.explanation,
    this.difficultyLevel,
  });

  final String questionText;
  final String correctAnswer;
  final QuestionType? questionType;
  final List<String> options;
  final String? explanation;
  final QuizDifficulty? difficultyLevel;

  /// True when the correct answer is one of the listed options, so the result
  /// view can mark the right choice instead of repeating it underneath.
  bool get hasMarkedOption => options.any(
    (o) => o.trim().toLowerCase() == correctAnswer.trim().toLowerCase(),
  );
}

/// A single difficulty variant of the quiz — the unit each tab renders.
@immutable
class QuizVariant {
  const QuizVariant({
    required this.difficulty,
    required this.title,
    this.questions = const <Question>[],
    this.teacherInstructions,
    this.gradeLevel,
    this.subject,
  });

  final QuizDifficulty difficulty;
  final String title;
  final List<Question> questions;
  final String? teacherInstructions;
  final String? gradeLevel;
  final String? subject;
}

/// A lenient chapter-validation note the model attaches when it proceeded on a
/// borderline topic. Informational only, never a hard error.
@immutable
class QuizValidationWarning {
  const QuizValidationWarning({required this.message});

  final String message;
}

/// The full `/api/ai/quiz` result: up to three difficulty variants plus the
/// shared metadata. [variants] holds only the variants the model actually
/// returned, in easy -> medium -> hard order, so the view never draws an
/// empty tab.
@immutable
class Quiz {
  const Quiz({
    this.variants = const <QuizVariant>[],
    this.id,
    this.gradeLevel,
    this.subject,
    this.topic,
    this.isSaved = false,
    this.validationWarning,
    this.raw,
  });

  final List<QuizVariant> variants;
  final String? id;
  final String? gradeLevel;
  final String? subject;
  final String? topic;
  final bool isSaved;
  final QuizValidationWarning? validationWarning;

  /// The verbatim `/api/ai/quiz` response body, kept so a later "Save to
  /// Library" persists EXACTLY the multi-variant envelope the server-side flow
  /// persists as `data` (`src/ai/flows/quiz-generator.ts`) rather than a
  /// re-serialized domain object that would quietly drop any field this app
  /// does not model. Null for a quiz that did not come from a live generation
  /// (a Library item re-rendered read-only, or a test fixture) — and the Save
  /// action is withheld in exactly that case.
  final Map<String, dynamic>? raw;
}
