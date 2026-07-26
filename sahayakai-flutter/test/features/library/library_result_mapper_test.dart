import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/library/data/library_result_mapper.dart';
import 'package:sahayakai/features/quiz_generator/domain/quiz.dart';

/// T1-U2 — the reshape this screen used to skip entirely.
///
/// Every fixture below is the REAL saved shape, copied from the backend
/// source each `mapSaved*` function's own doc comment cites (the exact
/// `dbAdapter.saveContent({ ..., data: <flow output> })` call in
/// `sahayakai-main`) — not guessed. Quiz and Worksheet get the most scrutiny
/// here because they are the two types the old `library_repository.dart`
/// doc comment predicted would NOT decode through the existing DTOs (a
/// single-variant quiz; a markdown-only worksheet) — verification found both
/// predictions wrong, and these tests are the proof.
void main() {
  group('mapSavedQuiz', () {
    test(
        'the saved shape is multi-variant (easy/medium/hard), never the '
        'single-variant {title, questions} shape once assumed', () {
      // Verified against src/ai/flows/quiz-generator.ts: `output` (the value
      // persisted as `data`) is a `QuizVariantsOutput` envelope, not a bare
      // `{title, questions}` object.
      final json = <String, dynamic>{
        'easy': <String, dynamic>{
          'title': 'Photosynthesis Quiz — Easy',
          'questions': [
            <String, dynamic>{
              'questionText': 'What do plants need to make food?',
              'questionType': 'multiple_choice',
              'options': ['Sunlight', 'Moonlight', 'Sand', 'Plastic'],
              'correctAnswer': 'Sunlight',
              'explanation': 'Plants use sunlight to photosynthesize.',
              'difficultyLevel': 'easy',
            },
          ],
          'teacherInstructions': 'Write these on the board.',
          'gradeLevel': 'Class 6',
          'subject': 'Science',
        },
        'medium': null,
        'hard': null,
        'id': 'quiz-123',
        'gradeLevel': 'Class 6',
        'subject': 'Science',
        'topic': 'Photosynthesis',
        'isSaved': true,
        'validationWarning': null,
      };

      final quiz = mapSavedQuiz(json);

      expect(quiz, isNotNull);
      expect(quiz!.variants, hasLength(1));
      expect(quiz.variants.single.difficulty, QuizDifficulty.easy);
      expect(quiz.variants.single.title, 'Photosynthesis Quiz — Easy');
      expect(quiz.variants.single.questions, hasLength(1));
      expect(
        quiz.variants.single.questions.single.questionText,
        'What do plants need to make food?',
      );
      expect(quiz.topic, 'Photosynthesis');
    });

    test('a saved quiz with all three variants decodes all three, in order',
        () {
      Map<String, dynamic> variant(String difficulty) => <String, dynamic>{
            'title': 'Fractions ($difficulty)',
            'questions': [
              <String, dynamic>{
                'questionText': 'What is 1/2 + 1/2?',
                'questionType': 'short_answer',
                'correctAnswer': '1',
                'explanation': 'Two halves make one whole.',
                'difficultyLevel': difficulty,
              },
            ],
          };
      final json = <String, dynamic>{
        'easy': variant('easy'),
        'medium': variant('medium'),
        'hard': variant('hard'),
        'id': 'quiz-456',
        'gradeLevel': 'Class 5',
        'subject': 'Mathematics',
        'topic': 'Fractions',
        'isSaved': true,
      };

      final quiz = mapSavedQuiz(json);

      expect(quiz, isNotNull);
      expect(quiz!.variants.map((v) => v.difficulty), [
        QuizDifficulty.easy,
        QuizDifficulty.medium,
        QuizDifficulty.hard,
      ]);
    });

    test('a non-object payload is refused, not guessed at', () {
      expect(mapSavedQuiz('just a string'), isNull);
      expect(mapSavedQuiz(null), isNull);
      expect(mapSavedQuiz(<dynamic>[1, 2, 3]), isNull);
    });

    test('a structurally broken variant degrades to null, never a throw', () {
      // `easy` is a String where the DTO expects a nested object — the
      // generated fromJson would throw a TypeError decoding it.
      final json = <String, dynamic>{
        'easy': 'not an object',
        'medium': null,
        'hard': null,
      };
      expect(() => mapSavedQuiz(json), returnsNormally);
      expect(mapSavedQuiz(json), isNull);
    });

    test('three empty/null variants is nothing to show — falls back honestly',
        () {
      final json = <String, dynamic>{
        'easy': null,
        'medium': null,
        'hard': null,
        'id': 'quiz-empty',
      };
      expect(mapSavedQuiz(json), isNull);
    });
  });

  group('mapSavedWorksheet', () {
    test(
        'the saved shape is a fully structured object, not the bare '
        'markdown string once assumed', () {
      // Verified against src/ai/flows/worksheet-wizard.ts:
      // `WorksheetWizardOutputSchema` — structured `activities` +
      // `answerKey`, PLUS a legacy derived `worksheetContent` markdown field
      // that rides along. This fixture includes that legacy field precisely
      // to prove the mapper reads the structured fields, not the markdown.
      final json = <String, dynamic>{
        'title': 'Fractions Worksheet',
        'gradeLevel': 'Class 5',
        'subject': 'Mathematics',
        'learningObjectives': ['Add fractions with unlike denominators'],
        'studentInstructions': 'Solve each problem and show your work.',
        'activities': [
          <String, dynamic>{
            'type': 'question',
            'content': 'What is 1/2 + 1/4?',
            'explanation': 'Find a common denominator first.',
            'chalkboardNote': 'Draw a pie split into quarters.',
          },
        ],
        'answerKey': [
          <String, dynamic>{'activityIndex': 0, 'answer': '3/4'},
        ],
        // Legacy field — present on real saved documents, must be ignored.
        'worksheetContent': '# Fractions Worksheet\n\nSome markdown here...',
      };

      final worksheet = mapSavedWorksheet(json);

      expect(worksheet, isNotNull);
      expect(worksheet!.title, 'Fractions Worksheet');
      expect(worksheet.learningObjectives,
          ['Add fractions with unlike denominators']);
      expect(worksheet.activities, hasLength(1));
      expect(worksheet.activities.single.content, 'What is 1/2 + 1/4?');
      expect(worksheet.activities.single.chalkboardNote,
          'Draw a pie split into quarters.');
      expect(worksheet.answerKey, hasLength(1));
      expect(worksheet.answerKey.single.answer, '3/4');
      expect(worksheet.answerKey.single.displayNumber, 1);
    });

    test('a bare markdown string (the once-assumed legacy shape) is refused',
        () {
      // If a genuinely old document really does store `data` as a raw
      // string, this must NOT be guessed into a Worksheet — it must fall
      // back to the honest "Ready" state.
      expect(mapSavedWorksheet('# Just markdown, no structure'), isNull);
    });

    test('a structurally empty object is nothing to show', () {
      expect(mapSavedWorksheet(<String, dynamic>{}), isNull);
    });
  });

  group('mapSavedAssessment', () {
    test('reads the rubric from rubricSnapshot, the real saved key', () {
      // Verified against src/ai/flows/assignment-assessor.ts:
      // `AssessAssignmentOutputSchema` names the field `rubricSnapshot`, not
      // `rubric`. A mapper that assumed `rubric` would silently drop the
      // rubric on every saved assessment.
      final json = <String, dynamic>{
        'rawTranscript': 'The mitochondria is the powerhouse of the cell.',
        'editedTranscript': null,
        'language': 'English',
        'overallScore': 85,
        'pointsEarned': 17,
        'pointsPossible': 20,
        'perCriterionScores': [
          <String, dynamic>{
            'criterionName': 'Content Accuracy',
            'level': 'Proficient',
            'points': 9,
            'maxPoints': 10,
            'feedback': 'Good grasp of the concept.',
            'confidence': 0.9,
          },
        ],
        'strengths': ['Clear handwriting'],
        'improvements': ['Add more detail'],
        'nextSteps': ['Practice more examples'],
        'teacherNote': 'Well done overall.',
        'confidenceOverall': 0.88,
        'warnings': <String>[],
        'rubricSnapshot': <String, dynamic>{
          'title': 'Biology Short Answer Rubric',
          'description': 'Grades a short-answer biology response.',
          'criteria': [
            <String, dynamic>{
              'name': 'Content Accuracy',
              'description': 'Accuracy of the stated fact.',
              'levels': [
                <String, dynamic>{
                  'name': 'Proficient',
                  'description': 'Correct and complete.',
                  'points': 9,
                },
              ],
            },
          ],
          'gradeLevel': 'Class 8',
          'subject': 'Biology',
        },
        // Fields the mobile model does not need, present on every real
        // saved document — must not break the decode.
        'assessmentId': 'assess-1',
        'studentId': null,
        'createdAtIso': '2026-07-20T10:00:00.000Z',
      };

      final assessment = mapSavedAssessment(json);

      expect(assessment, isNotNull);
      expect(assessment!.overallScore, 85);
      expect(assessment.rubric, isNotNull);
      expect(assessment.rubric!.title, 'Biology Short Answer Rubric');
      expect(assessment.rubric!.criteria.single.name, 'Content Accuracy');
      expect(assessment.displayTranscript,
          'The mitochondria is the powerhouse of the cell.');
    });

    test('a non-object payload is refused', () {
      expect(mapSavedAssessment(42), isNull);
    });
  });

  group('mapSavedExamPaper', () {
    test('decodes the paper and keeps raw verbatim for the Save round-trip',
        () {
      // Verified against src/ai/flows/exam-paper-generator.ts and the PUT
      // /api/ai/exam-paper save handler in sahayakai-main — both persist
      // `data` as the exact ExamPaperDataSchema object.
      final json = <String, dynamic>{
        'title': 'CBSE Class 10 Mathematics Exam',
        'board': 'CBSE',
        'subject': 'Mathematics',
        'gradeLevel': 'Class 10',
        'duration': '3 hours',
        'maxMarks': 80,
        'generalInstructions': ['Attempt all questions.'],
        'sections': [
          <String, dynamic>{
            'name': 'Section A',
            'label': 'Multiple Choice Questions',
            'totalMarks': 20,
            'questions': [
              <String, dynamic>{
                'number': 1,
                'text': 'What is 2 + 2?',
                'marks': 1,
                'options': ['3', '4', '5', '6'],
                'source': 'AI Generated',
              },
            ],
          },
        ],
        'blueprintSummary': <String, dynamic>{
          'chapterWise': <dynamic>[],
          'difficultyWise': <dynamic>[],
        },
        'pyqSources': <dynamic>[],
      };

      final ready = mapSavedExamPaper(json);

      expect(ready, isNotNull);
      expect(ready!.paper.title, 'CBSE Class 10 Mathematics Exam');
      expect(ready.paper.sections.single.questions.single.text,
          'What is 2 + 2?');
      expect(ready.raw, same(json));
    });

    test('an empty paper is nothing to show', () {
      expect(mapSavedExamPaper(<String, dynamic>{'title': ''}), isNull);
    });
  });

  group('mapSavedLessonPlan', () {
    test('decodes a real saved lesson plan', () {
      // Verified against src/ai/flows/lesson-plan-generator.ts:
      // `LessonPlanOutputSchema` — identical field names, both save paths
      // (`data: cached` / `data: output`).
      final json = <String, dynamic>{
        'title': 'Photosynthesis for Class 6',
        'gradeLevel': 'Class 6',
        'duration': '40 minutes',
        'subject': 'Science',
        'objectives': ['Explain how plants make food'],
        'keyVocabulary': [
          <String, dynamic>{
            'term': 'Photosynthesis',
            'meaning': 'How plants make food using sunlight.',
          },
        ],
        'materials': ['Leaves', 'Sunlight'],
        'activities': [
          <String, dynamic>{
            'phase': 'Engage',
            'name': 'Leaf walk',
            'description': 'Collect leaves from the schoolyard.',
            'duration': '10 minutes',
          },
        ],
        'assessment': 'Ask students to draw the process.',
        'homework': 'Observe a plant for a week.',
      };

      final plan = mapSavedLessonPlan(json);

      expect(plan, isNotNull);
      expect(plan!.title, 'Photosynthesis for Class 6');
      expect(plan.objectives, ['Explain how plants make food']);
      expect(plan.activities.single.name, 'Leaf walk');
    });

    test('a structurally decoded but empty plan falls back honestly', () {
      // No title, no objectives, no materials, no activities — nothing
      // worth a document. LessonPlanResultView has no EmptyView guard of its
      // own (unlike the other 7 tools), so this mapper is the only thing
      // standing between a genuinely blank document and the teacher.
      expect(mapSavedLessonPlan(<String, dynamic>{'foo': 'bar'}), isNull);
    });
  });

  group('mapSavedRubric, mapSavedInstantAnswer, mapSavedTeacherAdvice', () {
    test('mapSavedRubric decodes the criteria grid', () {
      final json = <String, dynamic>{
        'title': 'Science Project Rubric',
        'description': 'Grades a science fair project.',
        'criteria': [
          <String, dynamic>{
            'name': 'Research and Content',
            'description': 'Depth of research shown.',
            'levels': [
              <String, dynamic>{
                'name': 'Exemplary',
                'description': 'Thorough and well-cited.',
                'points': 4,
              },
            ],
          },
        ],
        'gradeLevel': 'Class 7',
        'subject': 'Science',
      };

      final rubric = mapSavedRubric(json);

      expect(rubric, isNotNull);
      expect(rubric!.criteria.single.name, 'Research and Content');
      expect(rubric.criteria.single.levels.single.pointsLabel, '4');
    });

    test('mapSavedInstantAnswer decodes the answer', () {
      final json = <String, dynamic>{
        'answer': 'Water boils at 100°C at sea level.',
        'videoSuggestionUrl': null,
        'gradeLevel': 'Class 6',
        'subject': 'Science',
      };

      final answer = mapSavedInstantAnswer(json);

      expect(answer, isNotNull);
      expect(answer!.answer, 'Water boils at 100°C at sea level.');
    });

    test('mapSavedInstantAnswer refuses a payload with no usable answer', () {
      final json = <String, dynamic>{'answer': '   '};
      expect(mapSavedInstantAnswer(json), isNull);
    });

    test('mapSavedTeacherAdvice decodes the advice list', () {
      final json = <String, dynamic>{
        'introduction': 'Great question about classroom management.',
        'advice': [
          <String, dynamic>{
            'strategy': 'Use a quiet signal.',
            'pedagogy': 'Behaviourism',
            'explanation': 'Consistent cues reduce disruption over time.',
          },
        ],
        'conclusion': 'Keep at it — consistency pays off.',
        'gradeLevel': 'Class 5',
        'subject': 'General',
      };

      final advice = mapSavedTeacherAdvice(json);

      expect(advice, isNotNull);
      expect(advice!.advice.single.strategy, 'Use a quiet signal.');
    });
  });
}
