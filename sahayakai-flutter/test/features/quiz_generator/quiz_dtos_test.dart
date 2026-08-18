import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/features/quiz_generator/data/quiz_dtos.dart';
import 'package:sahayakai/features/quiz_generator/domain/quiz.dart';

/// The wire contract for `POST /api/ai/quiz`, pinned against
/// `docs/flutter/SCREEN_INVENTORY.md` §P0.5 and the backend's
/// `src/ai/schemas/quiz-generator-schemas.ts`. If the client ever drifts from
/// the endpoint's field names, casing or enum members, these fail first.
void main() {
  group('QuizRequestDto', () {
    test(
      'serializes every field with the exact names SCREEN_INVENTORY pins',
      () {
        final json = QuizRequestDto.fromDomain(
          QuizRequest(
            topic: '  Fractions  ',
            questionTypes: const [
              QuestionType.multipleChoice,
              QuestionType.trueFalse,
            ],
            numQuestions: 7,
            gradeLevel: 'Class 6',
            subject: 'Mathematics',
            language: AppLocale.kn.aiName,
            targetDifficulty: QuizDifficulty.medium,
            bloomsTaxonomyLevels: const ['Understand', 'Apply'],
          ),
        ).toJson();

        expect(json, {
          'topic': 'Fractions', // trimmed
          'questionTypes': ['multiple_choice', 'true_false'],
          'numQuestions': 7,
          'gradeLevel': 'Class 6',
          'subject': 'Mathematics',
          'language': 'Kannada', // AppLocale.aiName, not the code
          'targetDifficulty': 'medium',
          'bloomsTaxonomyLevels': ['Understand', 'Apply'],
        });
      },
    );

    test('never sends server-injected fields', () {
      // Middleware injects these from the verified Firebase token; a client
      // that sent its own would be both wrong and a trust-boundary hole.
      final json = QuizRequestDto.fromDomain(
        const QuizRequest(
          topic: 'Fractions',
          questionTypes: [QuestionType.multipleChoice],
        ),
      ).toJson();

      for (final field in ['userId', 'gradeBandLabel', 'teacherContext']) {
        expect(
          json.containsKey(field),
          isFalse,
          reason: '$field is server-injected and must never be sent',
        );
      }
    });

    test('omits blank optionals instead of sending explicit nulls', () {
      // The endpoint applies its own defaults for absent keys; an explicit
      // null is a different (and wrong) request.
      final json = QuizRequestDto.fromDomain(
        const QuizRequest(
          topic: 'Photosynthesis',
          questionTypes: [QuestionType.shortAnswer],
          gradeLevel: '   ',
          subject: '',
        ),
      ).toJson();

      expect(json, {
        'topic': 'Photosynthesis',
        'questionTypes': ['short_answer'],
        'numQuestions': 5, // the pinned default
      });
    });

    test('carries imageDataUri only when a textbook photo is attached', () {
      // The rural "photograph the page" path: the quiz schema treats this as the
      // primary context. Sent verbatim when present, and absent (not an explicit
      // null) when the teacher supplies no photo.
      const uri = 'data:image/png;base64,iVBORw0KGgo=';
      final withPhoto = QuizRequestDto.fromDomain(
        const QuizRequest(
          topic: 'Fractions',
          questionTypes: [QuestionType.multipleChoice],
          imageDataUri: uri,
        ),
      ).toJson();
      expect(withPhoto['imageDataUri'], uri);

      final without = QuizRequestDto.fromDomain(
        const QuizRequest(
          topic: 'Fractions',
          questionTypes: [QuestionType.multipleChoice],
        ),
      ).toJson();
      expect(without.containsKey('imageDataUri'), isFalse);
    });

    test('every QuestionType and QuizDifficulty maps to its wire member', () {
      expect(QuestionType.values.map((t) => t.wire), [
        'multiple_choice',
        'fill_in_the_blanks',
        'short_answer',
        'true_false',
      ]);
      expect(QuizDifficulty.values.map((d) => d.wire), [
        'easy',
        'medium',
        'hard',
      ]);
    });
  });

  group('QuizResponseDto', () {
    test('decodes variants and drops null + question-less ones', () {
      final quiz = QuizResponseDto.fromJson(<String, dynamic>{
        'easy': {
          'title': 'Easy',
          'questions': [
            {
              'questionText': 'Q1',
              'questionType': 'multiple_choice',
              'options': ['a', 'b'],
              'correctAnswer': 'a',
              'explanation': 'because',
              'difficultyLevel': 'easy',
            },
          ],
          'teacherInstructions': 'Board it.',
        },
        'medium': null, // the model returned nothing
        'hard': {
          'title': 'Hard',
          'questions': <dynamic>[],
        }, // present but empty
        'id': 'abc',
        'topic': 'Fractions',
        'isSaved': false,
      }).toDomain();

      // Neither a null variant nor an empty one earns a tab.
      expect(quiz.variants.map((v) => v.difficulty), [QuizDifficulty.easy]);

      final question = quiz.variants.single.questions.single;
      expect(question.questionType, QuestionType.multipleChoice);
      expect(question.correctAnswer, 'a');
      expect(question.explanation, 'because');
      expect(quiz.variants.single.teacherInstructions, 'Board it.');
      expect(quiz.id, 'abc');
      expect(quiz.topic, 'Fractions');
      expect(quiz.isSaved, isFalse);
    });

    test('keeps all three variants in easy -> medium -> hard order', () {
      Map<String, dynamic> variant(String title) => {
        'title': title,
        'questions': [
          {'questionText': 'Q', 'correctAnswer': 'A'},
        ],
      };
      final quiz = QuizResponseDto.fromJson(<String, dynamic>{
        // Deliberately out of order in the payload.
        'hard': variant('Hard'),
        'easy': variant('Easy'),
        'medium': variant('Medium'),
      }).toDomain();

      expect(quiz.variants.map((v) => v.difficulty), [
        QuizDifficulty.easy,
        QuizDifficulty.medium,
        QuizDifficulty.hard,
      ]);
    });

    test('tolerates an empty payload', () {
      final quiz = QuizResponseDto.fromJson(
        const <String, dynamic>{},
      ).toDomain();
      expect(quiz.variants, isEmpty);
      expect(quiz.isSaved, isFalse);
      expect(quiz.validationWarning, isNull);
    });

    test('tolerates unknown enum members rather than throwing', () {
      // The quiz is model-generated; an unrecognised member must degrade to
      // "no badge", never crash the screen.
      final question = QuestionDto.fromJson(const <String, dynamic>{
        'questionText': 'Q',
        'questionType': 'martian_type',
        'difficultyLevel': 'impossible',
      }).toDomain();

      expect(question.questionType, isNull);
      expect(question.difficultyLevel, isNull);
      expect(question.questionText, 'Q');
    });

    test('trims blank prose and drops blank options', () {
      final question = QuestionDto.fromJson(const <String, dynamic>{
        'questionText': '  Q  ',
        'options': ['a', '   ', 'b', ''],
        'correctAnswer': ' a ',
        'explanation': '   ',
      }).toDomain();

      expect(question.questionText, 'Q');
      expect(question.options, ['a', 'b']);
      expect(question.correctAnswer, 'a');
      expect(question.explanation, isNull);
    });

    test('surfaces a validation warning only when it carries a message', () {
      Quiz decode(Map<String, dynamic>? warning) => QuizResponseDto.fromJson(
        <String, dynamic>{'validationWarning': warning},
      ).toDomain();

      expect(decode(null).validationWarning, isNull);
      expect(
        decode({
          'invalid': false,
          'lenient': true,
          'message': '  ',
        }).validationWarning,
        isNull,
      );
      expect(
        decode({
          'invalid': false,
          'lenient': true,
          'message': 'Heads up.',
        }).validationWarning?.message,
        'Heads up.',
      );
    });

    test('hasMarkedOption drives the inline-vs-spelled-out answer choice', () {
      const marked = Question(
        questionText: 'Q',
        options: ['One half', 'Whole'],
        correctAnswer: 'one HALF', // case/space insensitive
      );
      const unmarked = Question(
        questionText: 'Q',
        options: ['One half', 'Whole'],
        correctAnswer: 'Two thirds',
      );
      const noOptions = Question(questionText: 'Q', correctAnswer: '1');

      expect(marked.hasMarkedOption, isTrue);
      expect(unmarked.hasMarkedOption, isFalse);
      expect(noOptions.hasMarkedOption, isFalse);
    });
  });
}
