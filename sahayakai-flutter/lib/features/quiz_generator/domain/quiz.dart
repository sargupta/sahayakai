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
/// here. `imageDataUri` is P2 and intentionally omitted.
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
  });

  final List<QuizVariant> variants;
  final String? id;
  final String? gradeLevel;
  final String? subject;
  final String? topic;
  final bool isSaved;
  final QuizValidationWarning? validationWarning;
}
