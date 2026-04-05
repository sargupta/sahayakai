import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai_mobile/src/features/chat/domain/chat_message.dart';
import 'package:sahayakai_mobile/src/features/lesson_plan/domain/lesson_plan_models.dart';
import 'package:sahayakai_mobile/src/features/quiz/domain/quiz_models.dart';
import 'package:sahayakai_mobile/src/features/exam_paper/domain/exam_paper_models.dart';

void main() {
  // ═══════════════════════════════════════════════════════════════════
  // ChatMessage
  // ═══════════════════════════════════════════════════════════════════
  group('ChatMessage', () {
    test('constructor sets all required fields', () {
      final ts = DateTime(2026, 4, 3);
      final msg = ChatMessage(
        id: 'c1',
        text: 'hello',
        isUser: true,
        timestamp: ts,
      );
      expect(msg.id, 'c1');
      expect(msg.text, 'hello');
      expect(msg.isUser, true);
      expect(msg.timestamp, ts);
      expect(msg.videoUrl, isNull);
    });

    test('optional videoUrl is set when provided', () {
      final msg = ChatMessage(
        id: 'c2',
        text: 'vid',
        isUser: false,
        timestamp: DateTime.now(),
        videoUrl: 'https://example.com/video.mp4',
      );
      expect(msg.videoUrl, 'https://example.com/video.mp4');
    });

    test('optional videoUrl defaults to null', () {
      final msg = ChatMessage(
        id: 'c3',
        text: 'no video',
        isUser: true,
        timestamp: DateTime.now(),
      );
      expect(msg.videoUrl, isNull);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // LessonPlanInput
  // ═══════════════════════════════════════════════════════════════════
  group('LessonPlanInput', () {
    test('constructor defaults', () {
      final input = LessonPlanInput(topic: 'Photosynthesis');
      expect(input.topic, 'Photosynthesis');
      expect(input.language, 'English');
      expect(input.gradeLevels, ['Grade 1']);
      expect(input.resourceLevel, 'low');
      expect(input.useRuralContext, true);
    });

    test('constructor with all custom values', () {
      final input = LessonPlanInput(
        topic: 'Fractions',
        language: 'Hindi',
        gradeLevels: ['Grade 5', 'Grade 6'],
        resourceLevel: 'high',
        useRuralContext: false,
      );
      expect(input.topic, 'Fractions');
      expect(input.language, 'Hindi');
      expect(input.gradeLevels, ['Grade 5', 'Grade 6']);
      expect(input.resourceLevel, 'high');
      expect(input.useRuralContext, false);
    });

    test('toJson includes all fields and hardcoded overrides', () {
      final input = LessonPlanInput(
        topic: 'Gravity',
        language: 'Tamil',
        gradeLevels: ['Grade 8'],
        resourceLevel: 'medium',
        useRuralContext: false,
      );
      final json = input.toJson();
      expect(json['topic'], 'Gravity');
      expect(json['language'], 'Tamil');
      expect(json['gradeLevels'], ['Grade 8']);
      // Note: Dart map literal with duplicate key — first value wins
      expect(json['resourceLevel'], 'medium');
      expect(json['useRuralContext'], false);
      expect(json['difficultyLevel'], 'standard');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Activity
  // ═══════════════════════════════════════════════════════════════════
  group('Activity', () {
    test('fromJson with all fields present', () {
      final a = Activity.fromJson({
        'name': 'Discussion',
        'description': 'Group talk',
        'duration': '10 min',
      });
      expect(a.name, 'Discussion');
      expect(a.description, 'Group talk');
      expect(a.duration, '10 min');
    });

    test('fromJson with all fields null falls back to empty strings', () {
      final a = Activity.fromJson({});
      expect(a.name, '');
      expect(a.description, '');
      expect(a.duration, '');
    });

    test('fromJson with partial fields', () {
      final a = Activity.fromJson({'name': 'Quiz'});
      expect(a.name, 'Quiz');
      expect(a.description, '');
      expect(a.duration, '');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // LessonPlanOutput
  // ═══════════════════════════════════════════════════════════════════
  group('LessonPlanOutput', () {
    test('fromJson with full data including activities', () {
      final output = LessonPlanOutput.fromJson({
        'title': 'Photosynthesis Plan',
        'gradeLevel': 'Grade 5',
        'duration': '45 min',
        'subject': 'Science',
        'objectives': ['Understand light reactions'],
        'materials': ['Chart paper'],
        'activities': [
          {'name': 'Intro', 'description': 'Explain concept', 'duration': '5m'},
        ],
        'assessment': 'Oral quiz',
      });
      expect(output.title, 'Photosynthesis Plan');
      expect(output.gradeLevel, 'Grade 5');
      expect(output.duration, '45 min');
      expect(output.subject, 'Science');
      expect(output.objectives, ['Understand light reactions']);
      expect(output.materials, ['Chart paper']);
      expect(output.activities.length, 1);
      expect(output.activities[0].name, 'Intro');
      expect(output.assessment, 'Oral quiz');
    });

    test('fromJson with all fields null falls back to defaults', () {
      final output = LessonPlanOutput.fromJson({});
      expect(output.title, '');
      expect(output.gradeLevel, '');
      expect(output.duration, '');
      expect(output.subject, '');
      expect(output.objectives, isEmpty);
      expect(output.materials, isEmpty);
      expect(output.activities, isEmpty);
      expect(output.assessment, '');
    });

    test('fromJson with null activities list yields empty list', () {
      final output = LessonPlanOutput.fromJson({
        'title': 'T',
        'activities': null,
      });
      expect(output.activities, isEmpty);
    });

    test('fromJson with null objectives/materials lists yields empty lists', () {
      final output = LessonPlanOutput.fromJson({
        'objectives': null,
        'materials': null,
      });
      expect(output.objectives, isEmpty);
      expect(output.materials, isEmpty);
    });

    test('fromJson with actual objectives and materials lists', () {
      final output = LessonPlanOutput.fromJson({
        'objectives': ['A', 'B'],
        'materials': ['X'],
      });
      expect(output.objectives, ['A', 'B']);
      expect(output.materials, ['X']);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // QuizConfig
  // ═══════════════════════════════════════════════════════════════════
  group('QuizConfig', () {
    test('constructor defaults', () {
      final cfg = QuizConfig(topic: 'Math');
      expect(cfg.topic, 'Math');
      expect(cfg.numQuestions, 5);
      expect(cfg.gradeLevel, '5th Grade');
      expect(cfg.language, 'English');
      expect(cfg.questionTypes, ['multiple_choice']);
      expect(cfg.bloomsLevels, ['Remember']);
    });

    test('constructor with all custom values', () {
      final cfg = QuizConfig(
        topic: 'Science',
        numQuestions: 10,
        gradeLevel: '8th Grade',
        language: 'Hindi',
        questionTypes: ['short_answer', 'true_false'],
        bloomsLevels: ['Analyze', 'Evaluate'],
      );
      expect(cfg.numQuestions, 10);
      expect(cfg.gradeLevel, '8th Grade');
      expect(cfg.language, 'Hindi');
      expect(cfg.questionTypes, ['short_answer', 'true_false']);
      expect(cfg.bloomsLevels, ['Analyze', 'Evaluate']);
    });

    test('toJson maps bloomsLevels to bloomsTaxonomyLevels', () {
      final cfg = QuizConfig(
        topic: 'History',
        bloomsLevels: ['Apply'],
      );
      final json = cfg.toJson();
      expect(json['topic'], 'History');
      expect(json['numQuestions'], 5);
      expect(json['gradeLevel'], '5th Grade');
      expect(json['language'], 'English');
      expect(json['questionTypes'], ['multiple_choice']);
      expect(json['bloomsTaxonomyLevels'], ['Apply']);
      // Verify bloomsLevels is NOT a key in json (renamed)
      expect(json.containsKey('bloomsLevels'), false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Question (Quiz)
  // ═══════════════════════════════════════════════════════════════════
  group('Question', () {
    test('fromJson with all fields present', () {
      final q = Question.fromJson({
        'question': 'What is 2+2?',
        'type': 'multiple_choice',
        'options': ['3', '4', '5'],
        'answer': '4',
        'explanation': 'Basic addition',
      });
      expect(q.text, 'What is 2+2?');
      expect(q.type, 'multiple_choice');
      expect(q.options, ['3', '4', '5']);
      expect(q.correctAnswer, '4');
      expect(q.explanation, 'Basic addition');
    });

    test('fromJson with all fields null falls back to defaults', () {
      final q = Question.fromJson({});
      expect(q.text, '');
      expect(q.type, 'multiple_choice');
      expect(q.options, isEmpty);
      expect(q.correctAnswer, '');
      expect(q.explanation, '');
    });

    test('fromJson with null options list yields empty list', () {
      final q = Question.fromJson({'options': null});
      expect(q.options, isEmpty);
    });

    test('fromJson with actual options list', () {
      final q = Question.fromJson({'options': ['A', 'B']});
      expect(q.options, ['A', 'B']);
    });

    test('fromJson uses "question" key for text field', () {
      final q = Question.fromJson({'question': 'Q1'});
      expect(q.text, 'Q1');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Quiz
  // ═══════════════════════════════════════════════════════════════════
  group('Quiz', () {
    test('fromJson with full data', () {
      final quiz = Quiz.fromJson({
        'title': 'Math Quiz',
        'questions': [
          {
            'question': 'Q1',
            'type': 'mcq',
            'options': ['a', 'b'],
            'answer': 'a',
            'explanation': 'E1',
          },
        ],
      });
      expect(quiz.title, 'Math Quiz');
      expect(quiz.questions.length, 1);
      expect(quiz.questions[0].text, 'Q1');
    });

    test('fromJson with null title falls back to default', () {
      final quiz = Quiz.fromJson({});
      expect(quiz.title, 'Generated Quiz');
    });

    test('fromJson with title present uses provided title', () {
      final quiz = Quiz.fromJson({'title': 'Custom'});
      expect(quiz.title, 'Custom');
    });

    test('fromJson with null questions list yields empty list', () {
      final quiz = Quiz.fromJson({'questions': null});
      expect(quiz.questions, isEmpty);
    });

    test('fromJson with actual questions list parses all', () {
      final quiz = Quiz.fromJson({
        'questions': [
          {'question': 'A'},
          {'question': 'B'},
        ],
      });
      expect(quiz.questions.length, 2);
      expect(quiz.questions[1].text, 'B');
    });

    test('fromJson with empty questions list', () {
      final quiz = Quiz.fromJson({'questions': []});
      expect(quiz.questions, isEmpty);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ExamPaperInput
  // ═══════════════════════════════════════════════════════════════════
  group('ExamPaperInput', () {
    test('constructor defaults', () {
      final input = ExamPaperInput(
        board: 'CBSE',
        gradeLevel: 'Class 10',
        subject: 'Math',
      );
      expect(input.board, 'CBSE');
      expect(input.gradeLevel, 'Class 10');
      expect(input.subject, 'Math');
      expect(input.chapters, isEmpty);
      expect(input.difficulty, 'mixed');
      expect(input.language, 'English');
      expect(input.includeAnswerKey, true);
      expect(input.includeMarkingScheme, true);
    });

    test('constructor with all custom values', () {
      final input = ExamPaperInput(
        board: 'ICSE',
        gradeLevel: 'Class 8',
        subject: 'Science',
        chapters: ['Ch1', 'Ch2'],
        difficulty: 'hard',
        language: 'Hindi',
        includeAnswerKey: false,
        includeMarkingScheme: false,
      );
      expect(input.chapters, ['Ch1', 'Ch2']);
      expect(input.difficulty, 'hard');
      expect(input.language, 'Hindi');
      expect(input.includeAnswerKey, false);
      expect(input.includeMarkingScheme, false);
    });

    test('toJson includes all fields', () {
      final input = ExamPaperInput(
        board: 'CBSE',
        gradeLevel: 'Class 10',
        subject: 'Math',
        chapters: ['Algebra'],
        difficulty: 'easy',
        language: 'Tamil',
        includeAnswerKey: false,
        includeMarkingScheme: true,
      );
      final json = input.toJson();
      expect(json['board'], 'CBSE');
      expect(json['gradeLevel'], 'Class 10');
      expect(json['subject'], 'Math');
      expect(json['chapters'], ['Algebra']);
      expect(json['difficulty'], 'easy');
      expect(json['language'], 'Tamil');
      expect(json['includeAnswerKey'], false);
      expect(json['includeMarkingScheme'], true);
    });

    test('toJson with empty chapters', () {
      final input = ExamPaperInput(
        board: 'CBSE',
        gradeLevel: 'Class 10',
        subject: 'Math',
      );
      final json = input.toJson();
      expect(json['chapters'], isEmpty);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ExamQuestion
  // ═══════════════════════════════════════════════════════════════════
  group('ExamQuestion', () {
    test('fromJson with "text" key present', () {
      final q = ExamQuestion.fromJson({
        'text': 'Solve x+2=5',
        'type': 'short_answer',
        'marks': '3',
      });
      expect(q.text, 'Solve x+2=5');
      expect(q.type, 'short_answer');
      expect(q.marks, '3');
      expect(q.options, isNull);
      expect(q.answer, isNull);
      expect(q.solution, isNull);
    });

    test('fromJson with "question" key (fallback) when "text" is absent', () {
      final q = ExamQuestion.fromJson({
        'question': 'Fallback question text',
        'type': 'mcq',
        'marks': 5,
      });
      expect(q.text, 'Fallback question text');
      expect(q.marks, '5'); // num converted to string
    });

    test('fromJson with neither "text" nor "question" yields empty string', () {
      final q = ExamQuestion.fromJson({});
      expect(q.text, '');
      expect(q.type, 'short_answer');
      expect(q.marks, '1');
    });

    test('fromJson with "text" present ignores "question"', () {
      final q = ExamQuestion.fromJson({
        'text': 'Primary',
        'question': 'Fallback',
      });
      expect(q.text, 'Primary');
    });

    test('fromJson with options, answer, solution present', () {
      final q = ExamQuestion.fromJson({
        'text': 'Q',
        'type': 'mcq',
        'marks': '2',
        'options': ['A', 'B', 'C'],
        'answer': 'B',
        'solution': 'Because B',
      });
      expect(q.options, ['A', 'B', 'C']);
      expect(q.answer, 'B');
      expect(q.solution, 'Because B');
    });

    test('fromJson with null options yields null (not empty list)', () {
      final q = ExamQuestion.fromJson({
        'text': 'Q',
        'type': 'mcq',
        'marks': '2',
        'options': null,
      });
      expect(q.options, isNull);
    });

    test('fromJson with null answer and solution yields null', () {
      final q = ExamQuestion.fromJson({
        'text': 'Q',
        'type': 'mcq',
        'marks': '2',
        'answer': null,
        'solution': null,
      });
      expect(q.answer, isNull);
      expect(q.solution, isNull);
    });

    test('fromJson marks as num gets converted to string', () {
      final q = ExamQuestion.fromJson({
        'text': 'Q',
        'type': 't',
        'marks': 10,
      });
      expect(q.marks, '10');
    });

    test('fromJson marks null defaults to "1"', () {
      final q = ExamQuestion.fromJson({'text': 'Q', 'type': 't'});
      expect(q.marks, '1');
    });

    test('toJson includes optional fields only when non-null', () {
      final q = ExamQuestion(
        text: 'Q1',
        type: 'mcq',
        marks: '3',
        options: ['A', 'B'],
        answer: 'A',
        solution: 'Sol',
      );
      final json = q.toJson();
      expect(json['text'], 'Q1');
      expect(json['type'], 'mcq');
      expect(json['marks'], '3');
      expect(json['options'], ['A', 'B']);
      expect(json['answer'], 'A');
      expect(json['solution'], 'Sol');
    });

    test('toJson excludes options/answer/solution when null', () {
      final q = ExamQuestion(
        text: 'Q1',
        type: 'short_answer',
        marks: '2',
      );
      final json = q.toJson();
      expect(json.containsKey('options'), false);
      expect(json.containsKey('answer'), false);
      expect(json.containsKey('solution'), false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ExamSection
  // ═══════════════════════════════════════════════════════════════════
  group('ExamSection', () {
    test('fromJson with full data', () {
      final s = ExamSection.fromJson({
        'name': 'Section A',
        'label': 'MCQ',
        'totalMarks': 20,
        'questions': [
          {
            'text': 'Q1',
            'type': 'mcq',
            'marks': '1',
            'options': ['A', 'B'],
            'answer': 'A',
          },
        ],
      });
      expect(s.name, 'Section A');
      expect(s.label, 'MCQ');
      expect(s.totalMarks, 20);
      expect(s.questions.length, 1);
      expect(s.questions[0].text, 'Q1');
    });

    test('fromJson with all fields null falls back to defaults', () {
      final s = ExamSection.fromJson({});
      expect(s.name, '');
      expect(s.label, '');
      expect(s.totalMarks, 0);
      expect(s.questions, isEmpty);
    });

    test('fromJson with null questions list yields empty list', () {
      final s = ExamSection.fromJson({'questions': null});
      expect(s.questions, isEmpty);
    });

    test('fromJson with actual questions list', () {
      final s = ExamSection.fromJson({
        'questions': [
          {'text': 'A'},
          {'text': 'B'},
        ],
      });
      expect(s.questions.length, 2);
    });

    test('fromJson totalMarks as double gets converted to int', () {
      final s = ExamSection.fromJson({'totalMarks': 15.0});
      expect(s.totalMarks, 15);
    });

    test('fromJson totalMarks null defaults to 0', () {
      final s = ExamSection.fromJson({});
      expect(s.totalMarks, 0);
    });

    test('toJson serializes correctly', () {
      final s = ExamSection(
        name: 'B',
        label: 'Short',
        totalMarks: 30,
        questions: [
          ExamQuestion(text: 'Q', type: 't', marks: '5'),
        ],
      );
      final json = s.toJson();
      expect(json['name'], 'B');
      expect(json['label'], 'Short');
      expect(json['totalMarks'], 30);
      expect((json['questions'] as List).length, 1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // BlueprintSummary
  // ═══════════════════════════════════════════════════════════════════
  group('BlueprintSummary', () {
    test('fromJson with full data', () {
      final b = BlueprintSummary.fromJson({
        'chapterWise': {'Algebra': 5, 'Geometry': 3},
        'difficultyWise': {'easy': 4, 'hard': 4},
      });
      expect(b.chapterWise, {'Algebra': 5, 'Geometry': 3});
      expect(b.difficultyWise, {'easy': 4, 'hard': 4});
    });

    test('fromJson with null maps defaults to empty maps', () {
      final b = BlueprintSummary.fromJson({});
      expect(b.chapterWise, isEmpty);
      expect(b.difficultyWise, isEmpty);
    });

    test('fromJson with null chapterWise yields empty map', () {
      final b = BlueprintSummary.fromJson({
        'chapterWise': null,
        'difficultyWise': {'easy': 2},
      });
      expect(b.chapterWise, isEmpty);
      expect(b.difficultyWise, {'easy': 2});
    });

    test('fromJson with null difficultyWise yields empty map', () {
      final b = BlueprintSummary.fromJson({
        'chapterWise': {'Ch1': 1},
        'difficultyWise': null,
      });
      expect(b.chapterWise, {'Ch1': 1});
      expect(b.difficultyWise, isEmpty);
    });

    test('fromJson handles double values via num.toInt()', () {
      final b = BlueprintSummary.fromJson({
        'chapterWise': {'Ch1': 3.0},
        'difficultyWise': {'easy': 7.0},
      });
      expect(b.chapterWise['Ch1'], 3);
      expect(b.difficultyWise['easy'], 7);
    });

    test('toJson serializes correctly', () {
      final b = BlueprintSummary(
        chapterWise: {'A': 1},
        difficultyWise: {'hard': 2},
      );
      final json = b.toJson();
      expect(json['chapterWise'], {'A': 1});
      expect(json['difficultyWise'], {'hard': 2});
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PYQSource
  // ═══════════════════════════════════════════════════════════════════
  group('PYQSource', () {
    test('fromJson with all string fields', () {
      final p = PYQSource.fromJson({
        'id': 'pyq-1',
        'year': '2024',
        'chapter': 'Algebra',
      });
      expect(p.id, 'pyq-1');
      expect(p.year, '2024');
      expect(p.chapter, 'Algebra');
    });

    test('fromJson with all fields null defaults to empty strings', () {
      final p = PYQSource.fromJson({});
      expect(p.id, '');
      expect(p.year, '');
      expect(p.chapter, '');
    });

    test('fromJson converts numeric values to strings', () {
      final p = PYQSource.fromJson({
        'id': 42,
        'year': 2025,
        'chapter': 3,
      });
      expect(p.id, '42');
      expect(p.year, '2025');
      expect(p.chapter, '3');
    });

    test('fromJson with null id, year, chapter individually', () {
      final p = PYQSource.fromJson({
        'id': null,
        'year': '2024',
        'chapter': null,
      });
      expect(p.id, '');
      expect(p.year, '2024');
      expect(p.chapter, '');
    });

    test('toJson serializes correctly', () {
      final p = PYQSource(id: 'x', year: '2023', chapter: 'Ch1');
      final json = p.toJson();
      expect(json, {'id': 'x', 'year': '2023', 'chapter': 'Ch1'});
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ExamPaperOutput
  // ═══════════════════════════════════════════════════════════════════
  group('ExamPaperOutput', () {
    test('fromJson with full data including blueprintSummary and pyqSources',
        () {
      final output = ExamPaperOutput.fromJson({
        'title': 'Math Paper',
        'board': 'CBSE',
        'subject': 'Math',
        'gradeLevel': 'Class 10',
        'duration': '3 hours',
        'maxMarks': '80',
        'generalInstructions': ['Read carefully', 'Answer all'],
        'sections': [
          {
            'name': 'A',
            'label': 'MCQ',
            'totalMarks': 20,
            'questions': [
              {'text': 'Q1', 'type': 'mcq', 'marks': '1'},
            ],
          },
        ],
        'blueprintSummary': {
          'chapterWise': {'Algebra': 5},
          'difficultyWise': {'easy': 3},
        },
        'pyqSources': [
          {'id': 'p1', 'year': '2023', 'chapter': 'Algebra'},
        ],
      });
      expect(output.title, 'Math Paper');
      expect(output.board, 'CBSE');
      expect(output.subject, 'Math');
      expect(output.gradeLevel, 'Class 10');
      expect(output.duration, '3 hours');
      expect(output.maxMarks, '80');
      expect(output.generalInstructions, ['Read carefully', 'Answer all']);
      expect(output.sections.length, 1);
      expect(output.sections[0].name, 'A');
      expect(output.blueprintSummary, isNotNull);
      expect(output.blueprintSummary!.chapterWise, {'Algebra': 5});
      expect(output.pyqSources, isNotNull);
      expect(output.pyqSources!.length, 1);
      expect(output.pyqSources![0].id, 'p1');
    });

    test('fromJson with all fields null falls back to defaults', () {
      final output = ExamPaperOutput.fromJson({});
      expect(output.title, '');
      expect(output.board, '');
      expect(output.subject, '');
      expect(output.gradeLevel, '');
      expect(output.duration, '');
      expect(output.maxMarks, '');
      expect(output.generalInstructions, isEmpty);
      expect(output.sections, isEmpty);
      expect(output.blueprintSummary, isNull);
      expect(output.pyqSources, isNull);
    });

    test('fromJson with null blueprintSummary yields null', () {
      final output = ExamPaperOutput.fromJson({'blueprintSummary': null});
      expect(output.blueprintSummary, isNull);
    });

    test('fromJson with non-null blueprintSummary parses it', () {
      // Use jsonDecode to simulate real JSON (produces Map<String, dynamic>)
      final raw = jsonDecode(jsonEncode({
        'blueprintSummary': {
          'chapterWise': {'Ch1': 2},
          'difficultyWise': <String, dynamic>{},
        },
      })) as Map<String, dynamic>;
      final output = ExamPaperOutput.fromJson(raw);
      expect(output.blueprintSummary, isNotNull);
      expect(output.blueprintSummary!.chapterWise, {'Ch1': 2});
    });

    test('fromJson with null pyqSources yields null', () {
      final output = ExamPaperOutput.fromJson({'pyqSources': null});
      expect(output.pyqSources, isNull);
    });

    test('fromJson with actual pyqSources list', () {
      final output = ExamPaperOutput.fromJson({
        'pyqSources': [
          {'id': '1', 'year': '2022', 'chapter': 'C'},
        ],
      });
      expect(output.pyqSources, isNotNull);
      expect(output.pyqSources!.length, 1);
    });

    test('fromJson with null sections list yields empty list', () {
      final output = ExamPaperOutput.fromJson({'sections': null});
      expect(output.sections, isEmpty);
    });

    test('fromJson with null generalInstructions yields empty list', () {
      final output = ExamPaperOutput.fromJson({'generalInstructions': null});
      expect(output.generalInstructions, isEmpty);
    });

    test('fromJson duration as int gets converted to string', () {
      final output = ExamPaperOutput.fromJson({'duration': 180});
      expect(output.duration, '180');
    });

    test('fromJson maxMarks as int gets converted to string', () {
      final output = ExamPaperOutput.fromJson({'maxMarks': 80});
      expect(output.maxMarks, '80');
    });

    test('fromJson duration null defaults to empty string', () {
      final output = ExamPaperOutput.fromJson({'duration': null});
      expect(output.duration, '');
    });

    test('fromJson maxMarks null defaults to empty string', () {
      final output = ExamPaperOutput.fromJson({'maxMarks': null});
      expect(output.maxMarks, '');
    });

    test('toJson serializes all fields including optionals', () {
      final output = ExamPaperOutput(
        title: 'T',
        board: 'B',
        subject: 'S',
        gradeLevel: 'G',
        duration: 'D',
        maxMarks: 'M',
        generalInstructions: ['I1'],
        sections: [
          ExamSection(
            name: 'A',
            label: 'L',
            totalMarks: 10,
            questions: [],
          ),
        ],
        blueprintSummary: BlueprintSummary(
          chapterWise: {'C': 1},
          difficultyWise: {'easy': 1},
        ),
        pyqSources: [PYQSource(id: 'p', year: 'y', chapter: 'c')],
      );
      final json = output.toJson();
      expect(json['title'], 'T');
      expect(json['board'], 'B');
      expect(json['subject'], 'S');
      expect(json['gradeLevel'], 'G');
      expect(json['duration'], 'D');
      expect(json['maxMarks'], 'M');
      expect(json['generalInstructions'], ['I1']);
      expect((json['sections'] as List).length, 1);
      expect(json['blueprintSummary'], isNotNull);
      expect(json['pyqSources'], isNotNull);
      expect((json['pyqSources'] as List).length, 1);
    });

    test('toJson with null blueprintSummary serializes as null', () {
      final output = ExamPaperOutput(
        title: 'T',
        board: 'B',
        subject: 'S',
        gradeLevel: 'G',
        duration: 'D',
        maxMarks: 'M',
        generalInstructions: [],
        sections: [],
      );
      final json = output.toJson();
      expect(json['blueprintSummary'], isNull);
      expect(json['pyqSources'], isNull);
    });

    test('toJsonString produces valid JSON', () {
      final output = ExamPaperOutput(
        title: 'Paper',
        board: 'CBSE',
        subject: 'Math',
        gradeLevel: '10',
        duration: '3h',
        maxMarks: '80',
        generalInstructions: ['Read'],
        sections: [],
      );
      final jsonStr = output.toJsonString();
      final decoded = jsonDecode(jsonStr) as Map<String, dynamic>;
      expect(decoded['title'], 'Paper');
      expect(decoded['board'], 'CBSE');
    });

    test('fromJsonString round-trip with toJsonString', () {
      final original = ExamPaperOutput(
        title: 'Round Trip',
        board: 'ICSE',
        subject: 'Science',
        gradeLevel: 'Class 8',
        duration: '2h',
        maxMarks: '100',
        generalInstructions: ['Inst1', 'Inst2'],
        sections: [
          ExamSection(
            name: 'A',
            label: 'Short',
            totalMarks: 40,
            questions: [
              ExamQuestion(
                text: 'Q1',
                type: 'short',
                marks: '5',
                answer: 'ans',
              ),
            ],
          ),
        ],
        blueprintSummary: BlueprintSummary(
          chapterWise: {'Ch1': 10},
          difficultyWise: {'medium': 10},
        ),
        pyqSources: [
          PYQSource(id: '1', year: '2024', chapter: 'Ch1'),
        ],
      );
      final jsonStr = original.toJsonString();
      final restored = ExamPaperOutput.fromJsonString(jsonStr);
      expect(restored.title, 'Round Trip');
      expect(restored.board, 'ICSE');
      expect(restored.subject, 'Science');
      expect(restored.sections.length, 1);
      expect(restored.sections[0].questions[0].text, 'Q1');
      expect(restored.sections[0].questions[0].answer, 'ans');
      expect(restored.blueprintSummary!.chapterWise['Ch1'], 10);
      expect(restored.pyqSources!.length, 1);
    });

    test('fromJsonString with minimal JSON', () {
      final jsonStr = jsonEncode({
        'title': 'Min',
        'board': 'B',
        'subject': 'S',
        'gradeLevel': 'G',
        'duration': 'D',
        'maxMarks': 'M',
        'generalInstructions': [],
        'sections': [],
      });
      final output = ExamPaperOutput.fromJsonString(jsonStr);
      expect(output.title, 'Min');
      expect(output.sections, isEmpty);
      expect(output.blueprintSummary, isNull);
      expect(output.pyqSources, isNull);
    });
  });
}
