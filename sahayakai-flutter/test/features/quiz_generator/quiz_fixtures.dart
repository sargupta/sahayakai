import 'package:flutter/material.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/quiz_generator/domain/quiz.dart';

/// Shared fixtures for the quiz-generator suites. Not a `_test.dart` file, so
/// the runner ignores it.

/// The DESIGN_RUBRIC §11 Indic probe strings (Bengali, Tamil, Malayalam).
/// Every prose slot in the fixtures carries one so a clipped matra or a
/// missing wrap shows up as a real overflow, not a silent regression.
const String kBn = 'শিক্ষকদের জন্য কৃত্রিম বুদ্ধিমত্তা সহায়ক প্রশ্ন';
const String kTa = 'ஆசிரியர்களுக்கான செயற்கை நுண்ணறிவு உதவியாளர்';
const String kMl = 'അധ്യാപകർക്കുള്ള നിർമ്മിത ബുദ്ധി സഹായി';

/// A deliberately unbreakable compound word: DESIGN_RUBRIC §8 says long words
/// must wrap, never scroll the body sideways.
const String kLongWord = 'A supercalifragilisticexpialidociousquestionword?';

/// The 360dp phone gate from DESIGN_RUBRIC §12.9.
const Size kNarrowPhone = Size(360, 900);

/// Hosts a result-layer widget in the same shell the real screen uses: a
/// scrolling, page-padded body, so height and wrapping behave as in production.
/// [reduceMotion] disables animations so the ink-settle reveal degrades to its
/// static composed frame, mirroring `MediaQuery.disableAnimations`.
Widget hostResult(
  Widget child, {
  Brightness brightness = Brightness.light,
  bool reduceMotion = false,
}) {
  return MaterialApp(
    theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
    locale: const Locale('en'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: Scaffold(
      body: SingleChildScrollView(
        padding: AppSpacing.pagePadding,
        child: reduceMotion
            ? Builder(
                builder: (context) => MediaQuery(
                  data: MediaQuery.of(context).copyWith(disableAnimations: true),
                  child: child,
                ),
              )
            : child,
      ),
    ),
  );
}

/// A fully-populated quiz.
///
/// [onlyMedium] keeps a single variant (the no-tab-bar path); [empty] returns a
/// quiz the model gave no usable variants for.
Quiz buildQuiz({bool onlyMedium = false, bool empty = false}) {
  if (empty) return const Quiz();

  QuizVariant variant(QuizDifficulty difficulty) => QuizVariant(
        difficulty: difficulty,
        title: 'Fractions quiz $kBn',
        teacherInstructions: 'Write these on the board. $kTa',
        gradeLevel: 'Class 6',
        subject: 'Mathematics',
        questions: [
          Question(
            questionText: 'What is one half of a mango? $kBn $kTa $kMl',
            questionType: QuestionType.multipleChoice,
            options: const ['One quarter', 'One half', 'Two thirds', 'Whole'],
            correctAnswer: 'One half',
            explanation: 'Half means two equal parts. $kMl',
            difficultyLevel: difficulty,
          ),
          Question(
            questionText: 'Fill in: 1/2 + 1/2 = ____',
            questionType: QuestionType.fillInTheBlanks,
            correctAnswer: '1',
            explanation: 'Two halves make one whole.',
            difficultyLevel: difficulty,
          ),
          const Question(
            questionText: kLongWord,
            questionType: QuestionType.trueFalse,
            options: ['True', 'False'],
            correctAnswer: 'True',
            difficultyLevel: QuizDifficulty.hard,
          ),
        ],
      );

  return Quiz(
    topic: 'Fractions',
    gradeLevel: 'Class 6',
    subject: 'Mathematics',
    validationWarning: const QuizValidationWarning(message: 'A gentle note.'),
    variants: onlyMedium
        ? [variant(QuizDifficulty.medium)]
        : [
            variant(QuizDifficulty.easy),
            variant(QuizDifficulty.medium),
            variant(QuizDifficulty.hard),
          ],
  );
}
