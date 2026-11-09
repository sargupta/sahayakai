/// Demo data for the AI tools: one static, presentation-ready answer per tool.
///
/// [demoToolOverrides] swaps every AI tool repository for a `Demo…Repository`
/// that never touches the network. Each generate / ask / plan call waits
/// ~1.6 s (so the working state is visible on stage) and then returns
/// classroom-ready content for the demo teacher's two classes — Class 7 A
/// Science (default topic: Photosynthesis) and Class 6 B Mathematics (default
/// topic: Fractions). Requested topic, grade, subject and language are echoed
/// into titles and copy where that is cheap; the bodies are written for the
/// Indian classroom (NCERT-aligned, low-resource, local examples).
///
/// Only reachable from the `kDemoData` branch in `main.dart`.
library;

import 'dart:convert';
import 'dart:math' as math;

import 'package:dio/dio.dart' show FormData;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/network/api_client.dart';
import '../features/assess_assignment/data/assess_assignment_repository.dart';
import '../features/assess_assignment/domain/assessment.dart';
import '../features/assessment_scanner/data/assessment_scanner_repository.dart';
import '../features/assessment_scanner/domain/assessment_scan.dart';
import '../features/exam_paper/data/exam_paper_repository.dart';
import '../features/exam_paper/domain/exam_paper.dart';
import '../features/instant_answer/data/instant_answer_repository.dart';
import '../features/instant_answer/domain/instant_answer.dart';
import '../features/lesson_planner/data/lesson_plan_repository.dart';
import '../features/lesson_planner/domain/lesson_plan.dart';
import '../features/parent_message/data/parent_message_repository.dart';
import '../features/parent_message/domain/parent_message.dart';
import '../features/quiz_generator/data/quiz_repository.dart';
import '../features/quiz_generator/domain/quiz.dart';
import '../features/rubric_generator/data/rubric_repository.dart';
import '../features/rubric_generator/domain/rubric.dart';
import '../features/teacher_training/data/teacher_training_repository.dart';
import '../features/teacher_training/domain/teacher_advice.dart';
import '../features/video_storyteller/data/video_storyteller_repository.dart';
import '../features/video_storyteller/domain/video_storyteller.dart';
import '../features/virtual_field_trip/data/virtual_field_trip_repository.dart';
import '../features/virtual_field_trip/domain/virtual_field_trip.dart';
import '../features/visual_aid/data/visual_aid_repository.dart';
import '../features/visual_aid/domain/visual_aid.dart';
import '../features/worksheet_wizard/data/worksheet_repository.dart';
import '../features/worksheet_wizard/domain/worksheet.dart';
import 'demo_mode.dart';

/// Every AI tool repository, replaced by its offline demo twin.
List<Override> demoToolOverrides() => <Override>[
  lessonPlanRepositoryProvider.overrideWith(
    (ref) => DemoLessonPlanRepository(),
  ),
  quizRepositoryProvider.overrideWith((ref) => DemoQuizRepository()),
  rubricRepositoryProvider.overrideWith((ref) => DemoRubricRepository()),
  worksheetRepositoryProvider.overrideWith((ref) => DemoWorksheetRepository()),
  instantAnswerRepositoryProvider.overrideWith(
    (ref) => DemoInstantAnswerRepository(),
  ),
  visualAidRepositoryProvider.overrideWith((ref) => DemoVisualAidRepository()),
  videoStorytellerRepositoryProvider.overrideWith(
    (ref) => DemoVideoStorytellerRepository(),
  ),
  virtualFieldTripRepositoryProvider.overrideWith(
    (ref) => DemoVirtualFieldTripRepository(),
  ),
  teacherTrainingRepositoryProvider.overrideWith(
    (ref) => DemoTeacherTrainingRepository(),
  ),
  examPaperRepositoryProvider.overrideWith((ref) => DemoExamPaperRepository()),
  assessAssignmentRepositoryProvider.overrideWith(
    (ref) => DemoAssessAssignmentRepository(),
  ),
  assessmentScannerRepositoryProvider.overrideWith(
    (ref) => DemoAssessmentScannerRepository(),
  ),
  parentMessageRepositoryProvider.overrideWith(
    (ref) => DemoParentMessageRepository(),
  ),
];

// ---------------------------------------------------------------------------
// Shared plumbing
// ---------------------------------------------------------------------------

/// The repositories' super constructors need an [ApiClient]. This one refuses
/// every request, so a code path the demo did not override fails loudly
/// instead of reaching a real backend.
class _NoNetworkApiClient extends ApiClient {
  static const String _offline = 'demo mode: no network';

  @override
  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? query,
    required T Function(dynamic json) decode,
  }) async => throw StateError(_offline);

  @override
  Future<T> post<T>(
    String path, {
    Object? data,
    required T Function(Map<String, dynamic> json) decode,
  }) async => throw StateError(_offline);

  @override
  Future<T> put<T>(
    String path, {
    Object? data,
    required T Function(Map<String, dynamic> json) decode,
  }) async => throw StateError(_offline);

  @override
  Future<T> patch<T>(
    String path, {
    Object? data,
    required T Function(Map<String, dynamic> json) decode,
  }) async => throw StateError(_offline);

  @override
  Future<RawResponse> postRaw(String path, {Object? data}) async =>
      throw StateError(_offline);

  @override
  Future<T> postMultipart<T>(
    String path, {
    required FormData data,
    required T Function(Map<String, dynamic> json) decode,
  }) async => throw StateError(_offline);
}

/// One shared offline client for every demo repository.
final ApiClient _offlineClient = _NoNetworkApiClient();

/// The "AI is working" pause, long enough to see the loading state on stage.
Future<void> _working() =>
    Future<void>.delayed(const Duration(milliseconds: 1600));

/// A short pause, then a fresh fake content id.
Future<String> _saved() async {
  await Future<void>.delayed(const Duration(milliseconds: 300));
  return 'demo-saved-${DateTime.now().millisecondsSinceEpoch}';
}

/// [value] trimmed, or [fallback] when it is null or blank.
String _or(String? value, String fallback) {
  final trimmed = value?.trim() ?? '';
  return trimmed.isEmpty ? fallback : trimmed;
}

/// [text] cut to at most [max] characters on a word boundary, with an ellipsis.
String _shorten(String text, int max) {
  final trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  final cut = trimmed.substring(0, max);
  final space = cut.lastIndexOf(' ');
  return '${(space > max ~/ 2 ? cut.substring(0, space) : cut).trimRight()}…';
}

/// Whether the request reads as a Mathematics request (Class 6 B) rather than
/// the Science default (Class 7 A).
bool _isMaths(String? subject, String? topic) {
  final text = '${subject ?? ''} ${topic ?? ''}'.toLowerCase();
  const cues = <String>[
    'math',
    'fraction',
    'decimal',
    'number',
    'geometry',
    'algebra',
    'integer',
    'ganit',
  ];
  return cues.any(text.contains);
}

const String _scienceTopic = 'Photosynthesis';
const String _mathsTopic = 'Fractions';

String _defaultGrade(bool maths) => maths ? 'Class 6' : 'Class 7';
String _defaultSubject(bool maths) =>
    maths ? kDemoClass6Subject : kDemoClass7Subject;
String _defaultTopic(bool maths) => maths ? _mathsTopic : _scienceTopic;

/// "Priya" out of "Priya Deshmukh".
final String _teacherFirstName = kDemoTeacherName.split(' ').first;

// ---------------------------------------------------------------------------
// Lesson plan
// ---------------------------------------------------------------------------

class DemoLessonPlanRepository extends LessonPlanRepository {
  DemoLessonPlanRepository() : super(_offlineClient);

  @override
  Future<LessonPlan> generate(LessonPlanRequest request) async {
    await _working();
    return _demoLessonPlan(request);
  }

  @override
  Future<String> save({required LessonPlan plan, LessonPlanRequest? request}) =>
      _saved();
}

LessonPlan _demoLessonPlan(LessonPlanRequest request) {
  final topic = request.topic.trim();
  final lower = topic.toLowerCase();
  final grades = request.gradeLevels
      .map((g) => g.trim())
      .where((g) => g.isNotEmpty)
      .toList(growable: false);
  final maths = _isMaths(request.subject, topic);
  final grade = grades.isEmpty ? _defaultGrade(maths) : grades.first;
  final subject = _or(request.subject, _defaultSubject(maths));
  final language = _or(request.language, 'English');

  final String title;
  final List<String> objectives;
  final List<VocabularyTerm> vocabulary;
  final List<String> materials;
  final List<LessonActivity> activities;
  final String assessment;
  final String homework;

  if (lower.contains('photosynth') || (topic.isEmpty && !maths)) {
    title = 'Photosynthesis: How Green Plants Make Their Food';
    objectives = _photosynthesisObjectives;
    vocabulary = _photosynthesisVocabulary;
    materials = _photosynthesisMaterials;
    activities = _photosynthesisActivities;
    assessment = _photosynthesisAssessment;
    homework = _photosynthesisHomework;
  } else if (lower.contains('fraction') || (topic.isEmpty && maths)) {
    title = 'Fractions: Sharing Rotis Equally';
    objectives = _fractionsObjectives;
    vocabulary = _fractionsVocabulary;
    materials = _fractionsMaterials;
    activities = _fractionsActivities;
    assessment = _fractionsAssessment;
    homework = _fractionsHomework;
  } else {
    title = '$topic — A 40-Minute Lesson for $grade';
    objectives = <String>[
      'Explain the main idea of $topic in their own words, using one example '
          'from daily life.',
      'Identify the key terms of $topic and use them correctly in a sentence.',
      'Apply what they have learnt about $topic to a short problem or '
          'situation from their own surroundings.',
      'Work in a group to present one finding about $topic to the class.',
    ];
    vocabulary = const <VocabularyTerm>[];
    materials = <String>[
      'Blackboard and coloured chalk',
      'NCERT $grade $subject textbook — the chapter on $topic',
      'Chart paper and sketch pens (one set per group of five)',
      'Everyday objects from home or the school compound that relate to '
          '$topic',
      'Small paper chits for the exit ticket',
    ];
    activities = <LessonActivity>[
      LessonActivity(
        phase: 'Engage',
        name: 'Story hook',
        duration: '5 minutes',
        description:
            'Open with a short story or a question from village life that '
            'leads into $topic. Let three or four students share what they '
            'already know or guess — accept every answer without correcting '
            'yet.',
        teacherTips:
            'Write the guesses in a corner of the board; return to them at '
            'the end of the lesson.',
        understandingCheck:
            'What do you think $topic has to do with our '
            'everyday life?',
      ),
      LessonActivity(
        phase: 'Explore',
        name: 'Group investigation',
        duration: '10 minutes',
        description:
            'In groups of five, students examine the objects or the textbook '
            'pictures and list three things they notice about $topic. One '
            'student writes, one reports.',
        teacherTips:
            'Mix stronger and weaker readers in every group and give each '
            'student a role.',
        understandingCheck:
            'What is one thing your group noticed that '
            'surprised you?',
      ),
      LessonActivity(
        phase: 'Explain',
        name: 'Board work',
        duration: '10 minutes',
        description:
            'Build a simple concept map of $topic on the blackboard using the '
            "groups' observations. Introduce the key terms one by one and "
            'have students copy the map into their notebooks.',
        teacherTips:
            'Use one colour of chalk for key terms and another for '
            'examples.',
        understandingCheck:
            'Can someone explain this part of the map in '
            'their own words?',
      ),
      LessonActivity(
        phase: 'Elaborate',
        name: 'Pair practice',
        duration: '10 minutes',
        description:
            'Pairs solve two short questions from the textbook exercise on '
            '$topic, then swap notebooks and check each other’s work.',
        teacherTips:
            'Walk around and note common mistakes to discuss with '
            'the whole class.',
      ),
      LessonActivity(
        phase: 'Evaluate',
        name: 'Exit ticket',
        duration: '5 minutes',
        description:
            'Each student writes on a chit one thing they learnt about '
            '$topic today and one question they still have.',
        teacherTips:
            'Sort the chits into "got it", "almost" and "not yet" '
            'to plan the next class.',
      ),
    ];
    assessment =
        'Observe group reports during the Explore phase, ask oral questions '
        'during board work, and read the exit tickets to see who can explain '
        '$topic independently.';
    homework =
        'Find one example of $topic at home or in your neighbourhood. Draw '
        'it and write three lines explaining how it connects to what we '
        'learnt today.';
  }

  return LessonPlan(
    title: title,
    language: language,
    gradeLevel: grade,
    duration: '40 minutes',
    subject: subject,
    objectives: objectives,
    keyVocabulary: vocabulary,
    materials: materials,
    activities: activities,
    assessment: assessment,
    homework: homework,
    raw: <String, dynamic>{
      'demo': true,
      'title': title,
      'gradeLevel': grade,
      'subject': subject,
      'language': language,
    },
  );
}

const List<String> _photosynthesisObjectives = <String>[
  'Explain photosynthesis as the process by which green plants make their '
      'own food using sunlight, water and carbon dioxide.',
  'Name the raw materials and the products of photosynthesis and write the '
      'word equation.',
  'Describe the role of chlorophyll, stomata and roots in the process.',
  'Relate photosynthesis to the food we eat and the oxygen we breathe.',
];

const List<VocabularyTerm> _photosynthesisVocabulary = <VocabularyTerm>[
  VocabularyTerm(
    term: 'Photosynthesis',
    meaning:
        'The process by which green plants make food (glucose) from '
        'carbon dioxide and water in the presence of sunlight.',
  ),
  VocabularyTerm(
    term: 'Chlorophyll',
    meaning: 'The green pigment in leaves that traps the energy of sunlight.',
  ),
  VocabularyTerm(
    term: 'Stomata',
    meaning:
        'Tiny pores on the surface of leaves through which gases enter '
        'and leave.',
  ),
  VocabularyTerm(
    term: 'Autotroph',
    meaning: 'An organism that makes its own food, such as a green plant.',
  ),
];

const List<String> _photosynthesisMaterials = <String>[
  'Fresh leaves from the school garden (tulsi, hibiscus, money plant) and '
      'one croton or red amaranth leaf',
  'A potted plant with one leaf partly covered by black paper (set up two '
      'days earlier)',
  'Iodine solution or diluted Betadine with a dropper (optional)',
  'Blackboard and coloured chalk',
  'NCERT Class 7 Science textbook',
];

const List<LessonActivity> _photosynthesisActivities = <LessonActivity>[
  LessonActivity(
    phase: 'Engage',
    name: 'Where is the kitchen of a mango tree?',
    duration: '5 minutes',
    description:
        'Ask: "At home, food is cooked in the kitchen. Where is the kitchen '
        'of a mango tree?" Let students guess — roots, fruit, soil — and '
        'write every guess on the side of the board.',
    teacherTips:
        'Do not give the answer yet. The wrong guesses become the hook for '
        'the board work.',
    understandingCheck: 'Who cooks the food for a plant?',
  ),
  LessonActivity(
    phase: 'Explore',
    name: 'Leaf walk',
    duration: '10 minutes',
    description:
        'Groups of five collect three different leaves from the school '
        'compound. They compare green and non-green leaves, feel the upper '
        'and lower surfaces, and note which leaves face the sun.',
    teacherTips:
        'Remind students to pick fallen or lower leaves only and to stay '
        'within the compound wall.',
    understandingCheck:
        'What do all the leaves you collected have in '
        'common?',
  ),
  LessonActivity(
    phase: 'Explain',
    name: 'Board work: the recipe of a leaf',
    duration: '10 minutes',
    description:
        'Draw a large leaf. Add arrows for sunlight, water coming up from the '
        'roots and carbon dioxide entering through the stomata; show glucose '
        'and oxygen as outputs. Write the word equation: Carbon dioxide + '
        'Water → Glucose + Oxygen (in sunlight, with chlorophyll).',
    teacherTips:
        'Use yellow chalk for sunlight, blue for water and white for gases '
        'so the diagram reads at a glance from the back bench.',
    understandingCheck:
        'Which two things does the plant take in, and which '
        'two does it give out?',
  ),
  LessonActivity(
    phase: 'Elaborate',
    name: 'The covered-leaf test',
    duration: '10 minutes',
    description:
        'Show the leaf that was half covered with black paper. As a teacher-'
        'only demonstration, test it with iodine: the uncovered part turns '
        'blue-black (starch present), the covered part does not. If no '
        'iodine is available, show the textbook figure and ask students to '
        'predict the result.',
    teacherTips:
        'Keep the iodine bottle with you; students observe from their desks.',
    understandingCheck: 'Why did the covered part not make starch?',
  ),
  LessonActivity(
    phase: 'Evaluate',
    name: 'Exit ticket',
    duration: '5 minutes',
    description:
        'Each student writes on a chit: one raw material, one product, and '
        'the part of the plant where photosynthesis happens.',
    teacherTips:
        'Collect the chits at the door and sort them before the '
        'next class.',
  ),
];

const String _photosynthesisAssessment =
    'Oral questions during the board work, the covered-leaf prediction, and '
    'the exit ticket. Students who can name both raw materials and both '
    'products have met the core objective.';

const String _photosynthesisHomework =
    'Ask a farmer or an elder at home why plants kept inside a dark room turn '
    'yellow. Write five lines connecting their answer to photosynthesis, and '
    'draw a leaf showing what goes in and what comes out.';

const List<String> _fractionsObjectives = <String>[
  'Understand a fraction as a part of a whole that is divided into equal '
      'parts.',
  'Identify the numerator and the denominator and explain what each tells '
      'us.',
  'Represent simple fractions with paper strips and on a number line.',
  'Compare like fractions using real-life sharing situations.',
];

const List<VocabularyTerm> _fractionsVocabulary = <VocabularyTerm>[
  VocabularyTerm(
    term: 'Fraction',
    meaning: 'A number that names a part of a whole or a part of a group.',
  ),
  VocabularyTerm(
    term: 'Numerator',
    meaning: 'The top number — how many equal parts are taken.',
  ),
  VocabularyTerm(
    term: 'Denominator',
    meaning:
        'The bottom number — how many equal parts the whole is divided '
        'into.',
  ),
  VocabularyTerm(
    term: 'Like fractions',
    meaning: 'Fractions with the same denominator, such as 2/7 and 5/7.',
  ),
];

const List<String> _fractionsMaterials = <String>[
  'Paper "rotis" — circles cut from old newspaper, one per student',
  'Paper strips about 20 cm long, three per student',
  'Tamarind seeds or bottle caps as counters',
  'Blackboard with a long number line drawn from 0 to 2',
  'NCERT Class 6 Mathematics textbook',
];

const List<LessonActivity> _fractionsActivities = <LessonActivity>[
  LessonActivity(
    phase: 'Engage',
    name: 'Sharing at tiffin time',
    duration: '5 minutes',
    description:
        'Tell the story of four friends who have one roti to share at '
        'tiffin. Ask: "How should they cut it so that it is fair? What do we '
        'call each piece?"',
    teacherTips:
        'Stress the word "equal" — unequal pieces are not fractions '
        'of the same size.',
    understandingCheck:
        'If the roti is cut into 4 equal pieces, what part '
        'does each friend get?',
  ),
  LessonActivity(
    phase: 'Explore',
    name: 'Fold and name',
    duration: '10 minutes',
    description:
        'Students fold paper rotis into halves, quarters and eighths, shade '
        'some pieces, and write the fraction for the shaded part on each.',
    teacherTips:
        'Pair students so that one folds and the other checks that '
        'the parts are equal.',
    understandingCheck:
        'Which is bigger: one half or one quarter? How do '
        'you know?',
  ),
  LessonActivity(
    phase: 'Explain',
    name: 'Board work: numerator and denominator',
    duration: '10 minutes',
    description:
        'Write 3/8 on the board. Label the numerator ("parts taken") and the '
        'denominator ("equal parts in the whole"). Mark 1/2, 1/4 and 3/4 on '
        'the number line and show that 2/4 lands at the same point as 1/2.',
    teacherTips:
        'Students point to the number line while saying the '
        'fraction aloud.',
    understandingCheck: 'In 5/6, what does the 6 tell us?',
  ),
  LessonActivity(
    phase: 'Elaborate',
    name: 'Fraction market',
    duration: '10 minutes',
    description:
        'Pairs use 12 tamarind seeds as "mangoes" to solve: 1/4 of the '
        'mangoes are ripe — how many? 2/3 are sold — how many are left? Each '
        'pair writes one new problem for another pair.',
    teacherTips:
        'Let early finishers try 3/4 of 12 and explain their method '
        'to the class.',
  ),
  LessonActivity(
    phase: 'Evaluate',
    name: 'Exit ticket',
    duration: '5 minutes',
    description:
        'Each student draws a shape divided into equal parts, shades a '
        'fraction of it, and writes the fraction with the numerator and '
        'denominator labelled.',
    teacherTips: 'Check especially that the parts drawn are equal.',
  ),
];

const String _fractionsAssessment =
    'Observe folding accuracy during Explore, ask oral questions on the '
    'number line, and check the exit tickets for equal parts and correct '
    'labels.';

const String _fractionsHomework =
    'At dinner, notice how food is shared at home. Write three sharing '
    'situations as fractions — for example, "Aai cut the bhakri into 4 equal '
    'parts and I ate 1 part = 1/4".';

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

class DemoQuizRepository extends QuizRepository {
  DemoQuizRepository() : super(_offlineClient);

  @override
  Future<Quiz> generate(QuizRequest request) async {
    await _working();
    return _demoQuiz(request);
  }

  @override
  Future<String> save({required Quiz quiz, required QuizRequest request}) =>
      _saved();
}

Quiz _demoQuiz(QuizRequest request) {
  final maths = _isMaths(request.subject, request.topic);
  final topic = _or(request.topic, _defaultTopic(maths));
  final grade = _or(request.gradeLevel, _defaultGrade(maths));
  final subject = _or(request.subject, _defaultSubject(maths));

  final pools = maths
      ? const <QuizDifficulty, List<Question>>{
          QuizDifficulty.easy: _fractionsEasy,
          QuizDifficulty.medium: _fractionsMedium,
          QuizDifficulty.hard: _fractionsHard,
        }
      : const <QuizDifficulty, List<Question>>{
          QuizDifficulty.easy: _photosynthesisEasy,
          QuizDifficulty.medium: _photosynthesisMedium,
          QuizDifficulty.hard: _photosynthesisHard,
        };
  const labels = <QuizDifficulty, String>{
    QuizDifficulty.easy: 'Warm-up',
    QuizDifficulty.medium: 'Practice',
    QuizDifficulty.hard: 'Challenge',
  };
  const instructions = <QuizDifficulty, String>{
    QuizDifficulty.easy:
        'Use as a 5-minute oral warm-up at the start of class. Read each '
        'question aloud; students answer on slates.',
    QuizDifficulty.medium:
        'Give 15 minutes for written work. Discuss the answers together and '
        'let students correct their own notebooks.',
    QuizDifficulty.hard:
        'Best for students who finish early or as a group challenge. Ask '
        'groups to justify every answer.',
  };

  final variants = <QuizVariant>[
    for (final difficulty in QuizDifficulty.values)
      QuizVariant(
        difficulty: difficulty,
        title: '$topic — ${labels[difficulty]} Quiz',
        questions: _pickQuestions(pools[difficulty]!, request),
        teacherInstructions: instructions[difficulty],
        gradeLevel: grade,
        subject: subject,
      ),
  ];

  return Quiz(
    variants: variants,
    gradeLevel: grade,
    subject: subject,
    topic: topic,
    raw: <String, dynamic>{
      'demo': true,
      'topic': topic,
      'gradeLevel': grade,
      'subject': subject,
    },
  );
}

/// The requested question types (when enough of them exist in [pool]), cut to
/// the requested count.
List<Question> _pickQuestions(List<Question> pool, QuizRequest request) {
  final wanted = request.questionTypes.toSet();
  final matching = pool
      .where((q) => wanted.contains(q.questionType))
      .toList(growable: false);
  final source = matching.length >= 3 ? matching : pool;
  final count = math.max(1, math.min(request.numQuestions, source.length));
  return source.take(count).toList(growable: false);
}

const List<Question> _photosynthesisEasy = <Question>[
  Question(
    questionText: 'Which part of a plant mainly makes its food?',
    questionType: QuestionType.multipleChoice,
    options: <String>['Root', 'Stem', 'Leaf', 'Flower'],
    correctAnswer: 'Leaf',
    explanation:
        'Leaves contain chlorophyll, which is why they are called '
        'the food factories of the plant.',
    difficultyLevel: QuizDifficulty.easy,
  ),
  Question(
    questionText: 'Which gas do plants take in from the air to make food?',
    questionType: QuestionType.multipleChoice,
    options: <String>['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'],
    correctAnswer: 'Carbon dioxide',
    explanation: 'Carbon dioxide enters the leaf through the stomata.',
    difficultyLevel: QuizDifficulty.easy,
  ),
  Question(
    questionText: 'The green pigment present in leaves is called ______.',
    questionType: QuestionType.fillInTheBlanks,
    correctAnswer: 'chlorophyll',
    explanation: 'Chlorophyll traps the energy of sunlight.',
    difficultyLevel: QuizDifficulty.easy,
  ),
  Question(
    questionText: 'Plants can make food at night without any light.',
    questionType: QuestionType.trueFalse,
    options: <String>['True', 'False'],
    correctAnswer: 'False',
    explanation:
        'Photosynthesis needs sunlight. At night plants use the '
        'food they stored during the day.',
    difficultyLevel: QuizDifficulty.easy,
  ),
  Question(
    questionText: 'The tiny pores on the surface of a leaf are called:',
    questionType: QuestionType.multipleChoice,
    options: <String>['Stomata', 'Veins', 'Root hairs', 'Petals'],
    correctAnswer: 'Stomata',
    explanation: 'Gases enter and leave the leaf through the stomata.',
    difficultyLevel: QuizDifficulty.easy,
  ),
  Question(
    questionText: 'Name the two products of photosynthesis.',
    questionType: QuestionType.shortAnswer,
    correctAnswer: 'Glucose (food) and oxygen.',
    explanation: 'The glucose is later stored in the plant as starch.',
    difficultyLevel: QuizDifficulty.easy,
  ),
];

const List<Question> _photosynthesisMedium = <Question>[
  Question(
    questionText: 'Which is the correct word equation for photosynthesis?',
    questionType: QuestionType.multipleChoice,
    options: <String>[
      'Carbon dioxide + Water → Glucose + Oxygen',
      'Oxygen + Water → Glucose + Carbon dioxide',
      'Glucose + Oxygen → Carbon dioxide + Water',
      'Carbon dioxide + Oxygen → Glucose + Water',
    ],
    correctAnswer: 'Carbon dioxide + Water → Glucose + Oxygen',
    explanation:
        'This happens in the presence of sunlight and chlorophyll. '
        'The third option is the equation for respiration.',
    difficultyLevel: QuizDifficulty.medium,
  ),
  Question(
    questionText: 'How does water reach the leaves of a plant?',
    questionType: QuestionType.multipleChoice,
    options: <String>[
      'Through the stomata',
      'Through the roots and stem',
      'Through the flowers',
      'Directly from the air',
    ],
    correctAnswer: 'Through the roots and stem',
    explanation:
        'Roots absorb water from the soil and the stem carries it up '
        'to the leaves.',
    difficultyLevel: QuizDifficulty.medium,
  ),
  Question(
    questionText: 'Food made in the leaves is stored in the form of ______.',
    questionType: QuestionType.fillInTheBlanks,
    correctAnswer: 'starch',
    explanation: 'This is why a leaf turns blue-black in the iodine test.',
    difficultyLevel: QuizDifficulty.medium,
  ),
  Question(
    questionText:
        'A croton leaf is red and purple, so it cannot carry out '
        'photosynthesis.',
    questionType: QuestionType.trueFalse,
    options: <String>['True', 'False'],
    correctAnswer: 'False',
    explanation:
        'Croton leaves also contain chlorophyll; its green colour is '
        'hidden by the red and purple pigments.',
    difficultyLevel: QuizDifficulty.medium,
  ),
  Question(
    questionText: 'Why are green plants called autotrophs?',
    questionType: QuestionType.shortAnswer,
    correctAnswer:
        'Because they make their own food from simple substances '
        '(carbon dioxide and water) using sunlight.',
    explanation: '"Auto" means self and "troph" means nourishment.',
    difficultyLevel: QuizDifficulty.medium,
  ),
  Question(
    questionText: 'Which of these plants cannot make its own food?',
    questionType: QuestionType.multipleChoice,
    options: <String>['Mango', 'Cuscuta (amarbel)', 'Tulsi', 'Money plant'],
    correctAnswer: 'Cuscuta (amarbel)',
    explanation:
        'Cuscuta has no chlorophyll. It is a parasite that takes '
        'food from the plant it climbs on.',
    difficultyLevel: QuizDifficulty.medium,
  ),
];

const List<Question> _photosynthesisHard = <Question>[
  Question(
    questionText:
        'A leaf was half covered with black paper for two days and '
        'then tested with iodine. What will you observe?',
    questionType: QuestionType.multipleChoice,
    options: <String>[
      'The covered part turns blue-black',
      'The uncovered part turns blue-black',
      'The whole leaf turns blue-black',
      'No part changes colour',
    ],
    correctAnswer: 'The uncovered part turns blue-black',
    explanation:
        'Only the part that received sunlight made starch, and '
        'iodine turns starch blue-black.',
    difficultyLevel: QuizDifficulty.hard,
  ),
  Question(
    questionText:
        'Why does a plant kept in a dark room for a week turn pale '
        'and weak?',
    questionType: QuestionType.shortAnswer,
    correctAnswer:
        'Without light it cannot photosynthesise, so it stops '
        'making food, uses up its stored food and makes less chlorophyll.',
    explanation: 'Light is essential for photosynthesis, not only water.',
    difficultyLevel: QuizDifficulty.hard,
  ),
  Question(
    questionText:
        'What would happen to animals if all green plants on Earth '
        'disappeared?',
    questionType: QuestionType.multipleChoice,
    options: <String>[
      'They would slowly run out of food and oxygen',
      'They would get more oxygen',
      'Nothing would change',
      'They would start making their own food',
    ],
    correctAnswer: 'They would slowly run out of food and oxygen',
    explanation:
        'Every food chain begins with green plants, and plants '
        'release the oxygen animals breathe.',
    difficultyLevel: QuizDifficulty.hard,
  ),
  Question(
    questionText: 'A cactus carries out photosynthesis in its green stem.',
    questionType: QuestionType.trueFalse,
    options: <String>['True', 'False'],
    correctAnswer: 'True',
    explanation:
        'Its leaves are reduced to spines to save water, so the '
        'green stem takes over the job of making food.',
    difficultyLevel: QuizDifficulty.hard,
  ),
  Question(
    questionText:
        'In photosynthesis, the energy of sunlight is changed into '
        '______ energy stored in food.',
    questionType: QuestionType.fillInTheBlanks,
    correctAnswer: 'chemical',
    explanation: 'This stored chemical energy is released during respiration.',
    difficultyLevel: QuizDifficulty.hard,
  ),
  Question(
    questionText:
        'Farmers remove weeds from their fields. How does this '
        'help the crop make more food?',
    questionType: QuestionType.shortAnswer,
    correctAnswer:
        'Weeds compete with the crop for sunlight, water and '
        'minerals. Removing them gives the crop more of what it needs for '
        'photosynthesis.',
    explanation: 'Links photosynthesis to everyday farming practice.',
    difficultyLevel: QuizDifficulty.hard,
  ),
];

const List<Question> _fractionsEasy = <Question>[
  Question(
    questionText:
        'One roti is shared equally among 4 children. What part '
        'does each child get?',
    questionType: QuestionType.multipleChoice,
    options: <String>['1/2', '1/3', '1/4', '4/1'],
    correctAnswer: '1/4',
    explanation:
        'The whole is divided into 4 equal parts; each child gets 1 '
        'part.',
    difficultyLevel: QuizDifficulty.easy,
  ),
  Question(
    questionText: 'In the fraction 3/5, the numerator is ______.',
    questionType: QuestionType.fillInTheBlanks,
    correctAnswer: '3',
    explanation: 'The numerator is the top number — the parts taken.',
    difficultyLevel: QuizDifficulty.easy,
  ),
  Question(
    questionText:
        'A chocolate bar has 8 equal pieces and 2 are eaten. What '
        'fraction is eaten?',
    questionType: QuestionType.multipleChoice,
    options: <String>['2/8', '6/8', '8/2', '2/6'],
    correctAnswer: '2/8',
    explanation: '2 parts out of 8 equal parts = 2/8 (which is also 1/4).',
    difficultyLevel: QuizDifficulty.easy,
  ),
  Question(
    questionText:
        'In 5/7, the 7 tells us that the whole is divided into 7 '
        'equal parts.',
    questionType: QuestionType.trueFalse,
    options: <String>['True', 'False'],
    correctAnswer: 'True',
    explanation: 'The denominator counts the equal parts in the whole.',
    difficultyLevel: QuizDifficulty.easy,
  ),
  Question(
    questionText: 'Which of these is a proper fraction?',
    questionType: QuestionType.multipleChoice,
    options: <String>['7/4', '5/5', '3/8', '9/2'],
    correctAnswer: '3/8',
    explanation:
        'In a proper fraction the numerator is smaller than the '
        'denominator.',
    difficultyLevel: QuizDifficulty.easy,
  ),
  Question(
    questionText: 'Write the fraction for: "3 out of 10 mangoes are ripe".',
    questionType: QuestionType.shortAnswer,
    correctAnswer: '3/10',
    explanation: 'Parts taken (3) over the total (10).',
    difficultyLevel: QuizDifficulty.easy,
  ),
];

const List<Question> _fractionsMedium = <Question>[
  Question(
    questionText: 'Which fraction is equivalent to 1/2?',
    questionType: QuestionType.multipleChoice,
    options: <String>['2/3', '3/6', '2/5', '4/6'],
    correctAnswer: '3/6',
    explanation: 'Multiply the numerator and the denominator of 1/2 by 3.',
    difficultyLevel: QuizDifficulty.medium,
  ),
  Question(
    questionText: 'Which is greater: 3/7 or 5/7?',
    questionType: QuestionType.multipleChoice,
    options: <String>['3/7', '5/7', 'Both are equal', 'Cannot be compared'],
    correctAnswer: '5/7',
    explanation:
        'For like fractions, the one with the bigger numerator is '
        'greater.',
    difficultyLevel: QuizDifficulty.medium,
  ),
  Question(
    questionText: '7/4 written as a mixed fraction is ______.',
    questionType: QuestionType.fillInTheBlanks,
    correctAnswer: '1 3/4',
    explanation: '7 ÷ 4 = 1 remainder 3, so 7/4 = 1 3/4.',
    difficultyLevel: QuizDifficulty.medium,
  ),
  Question(
    questionText: '2/3 and 4/6 are equivalent fractions.',
    questionType: QuestionType.trueFalse,
    options: <String>['True', 'False'],
    correctAnswer: 'True',
    explanation: '4/6 reduces to 2/3 when both parts are divided by 2.',
    difficultyLevel: QuizDifficulty.medium,
  ),
  Question(
    questionText:
        "Riya's mother bought 12 bananas. Riya ate 1/4 of them. "
        'How many bananas did Riya eat?',
    questionType: QuestionType.shortAnswer,
    correctAnswer: '3 bananas',
    explanation: '1/4 of 12 = 12 ÷ 4 = 3.',
    difficultyLevel: QuizDifficulty.medium,
  ),
  Question(
    questionText: 'Arrange 1/8, 1/3 and 1/5 in ascending order.',
    questionType: QuestionType.multipleChoice,
    options: <String>[
      '1/8, 1/5, 1/3',
      '1/3, 1/5, 1/8',
      '1/5, 1/8, 1/3',
      '1/8, 1/3, 1/5',
    ],
    correctAnswer: '1/8, 1/5, 1/3',
    explanation:
        'With the same numerator, the bigger the denominator, the '
        'smaller the fraction.',
    difficultyLevel: QuizDifficulty.medium,
  ),
];

const List<Question> _fractionsHard = <Question>[
  Question(
    questionText: 'Reduce 18/24 to its lowest terms.',
    questionType: QuestionType.shortAnswer,
    correctAnswer: '3/4',
    explanation: 'The HCF of 18 and 24 is 6; 18 ÷ 6 = 3 and 24 ÷ 6 = 4.',
    difficultyLevel: QuizDifficulty.hard,
  ),
  Question(
    questionText: '2/5 + 1/5 = ?',
    questionType: QuestionType.multipleChoice,
    options: <String>['3/10', '3/5', '2/25', '1/5'],
    correctAnswer: '3/5',
    explanation:
        'For like fractions, add the numerators and keep the '
        'denominator.',
    difficultyLevel: QuizDifficulty.hard,
  ),
  Question(
    questionText:
        'Ramesh walked 3/4 km to school and Sita walked 2/3 km. Who '
        'walked more, and by how much?',
    questionType: QuestionType.multipleChoice,
    options: <String>[
      'Ramesh, by 1/12 km',
      'Sita, by 1/12 km',
      'Ramesh, by 1/7 km',
      'Both walked the same',
    ],
    correctAnswer: 'Ramesh, by 1/12 km',
    explanation: '3/4 = 9/12 and 2/3 = 8/12, so Ramesh walked 1/12 km more.',
    difficultyLevel: QuizDifficulty.hard,
  ),
  Question(
    questionText: '5/8 − 1/4 = 4/4',
    questionType: QuestionType.trueFalse,
    options: <String>['True', 'False'],
    correctAnswer: 'False',
    explanation:
        '1/4 = 2/8, so 5/8 − 2/8 = 3/8. Never subtract the '
        'denominators.',
    difficultyLevel: QuizDifficulty.hard,
  ),
  Question(
    questionText:
        'A water tank is 3/5 full. ______ of the tank is still '
        'empty.',
    questionType: QuestionType.fillInTheBlanks,
    correctAnswer: '2/5',
    explanation: 'The whole tank is 5/5; 5/5 − 3/5 = 2/5.',
    difficultyLevel: QuizDifficulty.hard,
  ),
  Question(
    questionText:
        'Explain why 1/3 of a big watermelon can be more than 1/2 '
        'of a small watermelon.',
    questionType: QuestionType.shortAnswer,
    correctAnswer:
        'A fraction is always a part of a particular whole. If the '
        'whole is bigger, a third of it can be larger than half of a much '
        'smaller whole.',
    explanation:
        'Fractions can only be compared directly when the wholes are '
        'the same size.',
    difficultyLevel: QuizDifficulty.hard,
  ),
];

// ---------------------------------------------------------------------------
// Rubric
// ---------------------------------------------------------------------------

class DemoRubricRepository extends RubricRepository {
  DemoRubricRepository() : super(_offlineClient);

  @override
  Future<Rubric> generate(RubricRequest request) async {
    await _working();
    return _demoRubric(request);
  }

  @override
  Future<String> save({
    required Rubric rubric,
    required RubricRequest request,
  }) => _saved();
}

Rubric _demoRubric(RubricRequest request) {
  final maths = _isMaths(request.subject, request.assignmentDescription);
  final assignment = _or(
    request.assignmentDescription,
    maths
        ? 'Word problems on fractions'
        : 'Poster: How a leaf makes food (photosynthesis)',
  );
  final grade = _or(request.gradeLevel, _defaultGrade(maths));
  final subject = _or(request.subject, _defaultSubject(maths));
  final title = 'Rubric: ${_shorten(assignment, 60)}';
  return Rubric(
    title: title,
    description:
        'For assessing "${_shorten(assignment, 120)}" in $grade $subject. '
        'Each criterion is scored from 1 (Beginning) to 4 (Exemplary), for a '
        'total of 16 marks. Share the rubric with students before they start '
        'so they know what good work looks like.',
    criteria: maths ? _mathsCriteria : _scienceCriteria,
    gradeLevel: grade,
    subject: subject,
    raw: <String, dynamic>{
      'demo': true,
      'title': title,
      'gradeLevel': grade,
      'subject': subject,
    },
  );
}

const List<RubricCriterion> _scienceCriteria = <RubricCriterion>[
  RubricCriterion(
    name: 'Scientific understanding',
    description: 'Explains the concept accurately using the correct terms.',
    levels: <RubricLevel>[
      RubricLevel(
        name: 'Exemplary',
        points: 4,
        description:
            'Explains the concept fully and accurately, uses every '
            'key term correctly and links the ideas together.',
      ),
      RubricLevel(
        name: 'Proficient',
        points: 3,
        description:
            'Explains the main idea correctly with most key terms; '
            'one small gap or slip.',
      ),
      RubricLevel(
        name: 'Developing',
        points: 2,
        description:
            'Explains only parts of the concept; some terms are '
            'missing or used incorrectly.',
      ),
      RubricLevel(
        name: 'Beginning',
        points: 1,
        description:
            'Shows little understanding; ideas are copied or '
            'incorrect.',
      ),
    ],
  ),
  RubricCriterion(
    name: 'Diagrams and labelling',
    description:
        'Uses neat, correctly labelled diagrams to support the '
        'explanation.',
    levels: <RubricLevel>[
      RubricLevel(
        name: 'Exemplary',
        points: 4,
        description:
            'Diagram is neat, complete and correctly labelled, with '
            'arrows that show the process clearly.',
      ),
      RubricLevel(
        name: 'Proficient',
        points: 3,
        description:
            'Diagram is clear and mostly labelled; one label is '
            'missing or misplaced.',
      ),
      RubricLevel(
        name: 'Developing',
        points: 2,
        description: 'Diagram is present but incomplete or hard to read.',
      ),
      RubricLevel(
        name: 'Beginning',
        points: 1,
        description: 'Diagram is missing or does not match the topic.',
      ),
    ],
  ),
  RubricCriterion(
    name: 'Real-life connections',
    description:
        'Connects the concept to examples from home, the farm or '
        'the surroundings.',
    levels: <RubricLevel>[
      RubricLevel(
        name: 'Exemplary',
        points: 4,
        description:
            'Gives two or more original local examples and explains '
            'how each connects to the concept.',
      ),
      RubricLevel(
        name: 'Proficient',
        points: 3,
        description:
            'Gives one clear local example with a correct '
            'explanation.',
      ),
      RubricLevel(
        name: 'Developing',
        points: 2,
        description:
            'Gives an example from the textbook only, with little '
            'explanation.',
      ),
      RubricLevel(
        name: 'Beginning',
        points: 1,
        description: 'No example, or the example is unrelated.',
      ),
    ],
  ),
  RubricCriterion(
    name: 'Presentation and effort',
    description: 'Work is neat, organised, complete and on time.',
    levels: <RubricLevel>[
      RubricLevel(
        name: 'Exemplary',
        points: 4,
        description: 'Neat, well organised and creative; submitted on time.',
      ),
      RubricLevel(
        name: 'Proficient',
        points: 3,
        description: 'Neat and complete; submitted on time.',
      ),
      RubricLevel(
        name: 'Developing',
        points: 2,
        description: 'Partly complete or untidy in places.',
      ),
      RubricLevel(
        name: 'Beginning',
        points: 1,
        description: 'Incomplete and difficult to follow.',
      ),
    ],
  ),
];

const List<RubricCriterion> _mathsCriteria = <RubricCriterion>[
  RubricCriterion(
    name: 'Conceptual understanding',
    description: 'Shows what the numbers and operations mean.',
    levels: <RubricLevel>[
      RubricLevel(
        name: 'Exemplary',
        points: 4,
        description:
            'Explains the concept with models (strips, number line) '
            'and words; no misconceptions.',
      ),
      RubricLevel(
        name: 'Proficient',
        points: 3,
        description: 'Understands the concept; one minor confusion.',
      ),
      RubricLevel(
        name: 'Developing',
        points: 2,
        description:
            'Partial understanding; relies on rules without knowing '
            'why they work.',
      ),
      RubricLevel(
        name: 'Beginning',
        points: 1,
        description: 'Major misconceptions, such as adding denominators.',
      ),
    ],
  ),
  RubricCriterion(
    name: 'Procedure and accuracy',
    description:
        'Carries out the steps correctly and reaches the right '
        'answer.',
    levels: <RubricLevel>[
      RubricLevel(
        name: 'Exemplary',
        points: 4,
        description: 'All steps correct; answers in the simplest form.',
      ),
      RubricLevel(
        name: 'Proficient',
        points: 3,
        description: 'Steps correct with one calculation slip.',
      ),
      RubricLevel(
        name: 'Developing',
        points: 2,
        description: 'Some steps correct; several errors.',
      ),
      RubricLevel(
        name: 'Beginning',
        points: 1,
        description: 'Steps missing or mostly incorrect.',
      ),
    ],
  ),
  RubricCriterion(
    name: 'Reasoning and explanation',
    description: 'Explains why the method works and checks the answer.',
    levels: <RubricLevel>[
      RubricLevel(
        name: 'Exemplary',
        points: 4,
        description:
            'Clear reasoning in words or pictures; checks the '
            'answer against the question.',
      ),
      RubricLevel(
        name: 'Proficient',
        points: 3,
        description: 'Reasoning is mostly clear; checking is partial.',
      ),
      RubricLevel(
        name: 'Developing',
        points: 2,
        description: 'Gives an answer with little explanation.',
      ),
      RubricLevel(
        name: 'Beginning',
        points: 1,
        description: 'No reasoning shown.',
      ),
    ],
  ),
  RubricCriterion(
    name: 'Presentation of work',
    description: 'Working is neat, ordered and easy to follow.',
    levels: <RubricLevel>[
      RubricLevel(
        name: 'Exemplary',
        points: 4,
        description:
            'Steps written in order, units and final answer clearly '
            'marked.',
      ),
      RubricLevel(
        name: 'Proficient',
        points: 3,
        description: 'Mostly ordered; final answer marked.',
      ),
      RubricLevel(
        name: 'Developing',
        points: 2,
        description: 'Working scattered; hard to follow in places.',
      ),
      RubricLevel(
        name: 'Beginning',
        points: 1,
        description: 'Only answers written, or work is illegible.',
      ),
    ],
  ),
];

// ---------------------------------------------------------------------------
// Worksheet
// ---------------------------------------------------------------------------

class DemoWorksheetRepository extends WorksheetRepository {
  DemoWorksheetRepository() : super(_offlineClient);

  @override
  Future<Worksheet> generate(WorksheetRequest request) async {
    await _working();
    return _demoWorksheet(request);
  }

  @override
  Future<String> save({
    required Worksheet worksheet,
    required String prompt,
    String? gradeLevel,
    String? language,
  }) => _saved();
}

Worksheet _demoWorksheet(WorksheetRequest request) {
  final maths = _isMaths(request.subject, request.prompt);
  final grade = _or(request.gradeLevel, _defaultGrade(maths));
  final subject = _or(request.subject, _defaultSubject(maths));
  final title = maths
      ? 'Fractions Around Us — Practice Worksheet'
      : 'Photosynthesis — The Leaf as a Food Factory';
  return Worksheet(
    title: title,
    gradeLevel: grade,
    subject: subject,
    learningObjectives: maths
        ? const <String>[
            'Write fractions for parts of a whole and parts of a group.',
            'Find equivalent fractions and reduce fractions to lowest terms.',
            'Compare fractions and solve simple word problems.',
          ]
        : const <String>[
            'Name the raw materials and products of photosynthesis.',
            'Explain the role of chlorophyll and stomata.',
            'Connect photosynthesis to plants and food in daily life.',
          ],
    studentInstructions: maths
        ? 'Answer all questions in your notebook. Show your working for every '
              'question. Use paper strips or drawings if they help you.'
        : 'Answer all questions in your notebook. Use the textbook page your '
              'teacher shared. Draw diagrams neatly in pencil.',
    activities: maths ? _fractionsWorksheet : _photosynthesisWorksheet,
    answerKey: maths ? _fractionsAnswers : _photosynthesisAnswers,
    raw: <String, dynamic>{
      'demo': true,
      'title': title,
      'gradeLevel': grade,
      'subject': subject,
      'prompt': request.prompt,
    },
  );
}

const List<WorksheetActivity> _photosynthesisWorksheet = <WorksheetActivity>[
  WorksheetActivity(
    type: WorksheetActivityType.question,
    content:
        'Fill in the blanks:\n'
        '(a) The green pigment in leaves is called ______.\n'
        '(b) Plants take in ______ gas through tiny pores called ______.\n'
        '(c) Food made in leaves is stored as ______.',
    chalkboardNote: 'Word bank: starch, chlorophyll, stomata, carbon dioxide',
  ),
  WorksheetActivity(
    type: WorksheetActivityType.question,
    content:
        'Match the following:\n'
        '(a) Roots — (i) trap sunlight\n'
        '(b) Chlorophyll — (ii) let gases in and out\n'
        '(c) Stomata — (iii) absorb water from the soil\n'
        '(d) Oxygen — (iv) released into the air',
  ),
  WorksheetActivity(
    type: WorksheetActivityType.question,
    content:
        'Write the word equation for photosynthesis. Underline the raw '
        'materials and circle the products.',
    explanation: 'Remember the two conditions: sunlight and chlorophyll.',
  ),
  WorksheetActivity(
    type: WorksheetActivityType.puzzle,
    content:
        'Unscramble the words:\n'
        '(a) LLOROHPHYLC   (b) TAMOTSA   (c) CRASTH   (d) NEXOGY',
    chalkboardNote: 'Hint: all four words appear in today’s lesson.',
  ),
  WorksheetActivity(
    type: WorksheetActivityType.question,
    content:
        'True or False:\n'
        '(a) Only the leaves of a plant are green.\n'
        '(b) Plants make food only when there is light.\n'
        '(c) Cuscuta (amarbel) makes its own food.',
  ),
  WorksheetActivity(
    type: WorksheetActivityType.question,
    content:
        'Draw a leaf. Use arrows to show sunlight, water and carbon '
        'dioxide going in, and oxygen coming out. Label each arrow.',
    chalkboardNote: 'Yellow arrow = sunlight, blue = water, black = gases',
  ),
  WorksheetActivity(
    type: WorksheetActivityType.question,
    content:
        'Why do we see more green plants near a well or a canal than on '
        'dry, rocky land? Answer in 2–3 sentences.',
  ),
  WorksheetActivity(
    type: WorksheetActivityType.creativeTask,
    content:
        'Be a leaf! Write a diary entry of 5–6 lines titled "A Day in '
        'the Life of a Mango Leaf", describing how you make food from '
        'morning to evening.',
    explanation: 'Use at least four words from the word bank.',
  ),
];

const List<AnswerKeyEntry> _photosynthesisAnswers = <AnswerKeyEntry>[
  AnswerKeyEntry(
    activityIndex: 0,
    answer: '(a) chlorophyll  (b) carbon dioxide; stomata  (c) starch',
  ),
  AnswerKeyEntry(
    activityIndex: 1,
    answer: '(a)–(iii), (b)–(i), (c)–(ii), (d)–(iv)',
  ),
  AnswerKeyEntry(
    activityIndex: 2,
    answer:
        'Carbon dioxide + Water → Glucose + Oxygen (in sunlight, with '
        'chlorophyll). Raw materials: carbon dioxide, water. Products: '
        'glucose, oxygen.',
  ),
  AnswerKeyEntry(
    activityIndex: 3,
    answer: '(a) CHLOROPHYLL  (b) STOMATA  (c) STARCH  (d) OXYGEN',
  ),
  AnswerKeyEntry(
    activityIndex: 4,
    answer:
        '(a) False — young stems can also be green.  (b) True.  '
        '(c) False — it is a parasite.',
  ),
  AnswerKeyEntry(
    activityIndex: 5,
    answer:
        'Arrows in: sunlight, water (from the stem), carbon dioxide '
        '(through stomata). Arrow out: oxygen.',
  ),
  AnswerKeyEntry(
    activityIndex: 6,
    answer:
        'Plants need water for photosynthesis. Near a well or canal there '
        'is plenty of water in the soil, so more plants can grow and make '
        'food.',
  ),
  AnswerKeyEntry(
    activityIndex: 7,
    answer:
        'Answers will vary. Look for sunlight, water, carbon dioxide, '
        'chlorophyll and oxygen used correctly.',
  ),
];

const List<WorksheetActivity> _fractionsWorksheet = <WorksheetActivity>[
  WorksheetActivity(
    type: WorksheetActivityType.question,
    content:
        'A roti is cut into 6 equal pieces and 5 pieces are eaten. What '
        'fraction of the roti is left?',
  ),
  WorksheetActivity(
    type: WorksheetActivityType.question,
    content: 'Fill in the blanks:\n(a) 2/3 = ?/12\n(b) 15/20 = 3/?',
    chalkboardNote:
        'Multiply or divide the top and bottom by the same '
        'number.',
  ),
  WorksheetActivity(
    type: WorksheetActivityType.question,
    content:
        'Put the correct sign (<, > or =):\n'
        '(a) 3/8 __ 5/8\n(b) 1/2 __ 4/8\n(c) 2/3 __ 2/5',
  ),
  WorksheetActivity(
    type: WorksheetActivityType.question,
    content: 'Convert to mixed fractions:\n(a) 9/4\n(b) 17/5',
  ),
  WorksheetActivity(
    type: WorksheetActivityType.question,
    content: 'Reduce to lowest terms:\n(a) 12/16\n(b) 25/35',
    explanation: 'Divide by the HCF of the numerator and denominator.',
  ),
  WorksheetActivity(
    type: WorksheetActivityType.puzzle,
    content:
        'Fraction riddle: I am equivalent to 1/2. My denominator is 10 '
        'more than my numerator. Who am I?',
  ),
  WorksheetActivity(
    type: WorksheetActivityType.question,
    content:
        "Meena's class has 40 students. 3/8 of them come to school by "
        'bicycle. How many students come by bicycle?',
  ),
  WorksheetActivity(
    type: WorksheetActivityType.creativeTask,
    content:
        'Fold a paper strip into 8 equal parts. Colour 3/8 of it red and '
        '1/4 of it blue. What fraction is not coloured? Paste your strip in '
        'your notebook.',
  ),
];

const List<AnswerKeyEntry> _fractionsAnswers = <AnswerKeyEntry>[
  AnswerKeyEntry(activityIndex: 0, answer: '1/6'),
  AnswerKeyEntry(activityIndex: 1, answer: '(a) 8  (b) 4'),
  AnswerKeyEntry(activityIndex: 2, answer: '(a) <  (b) =  (c) >'),
  AnswerKeyEntry(activityIndex: 3, answer: '(a) 2 1/4  (b) 3 2/5'),
  AnswerKeyEntry(activityIndex: 4, answer: '(a) 3/4  (b) 5/7'),
  AnswerKeyEntry(activityIndex: 5, answer: '10/20'),
  AnswerKeyEntry(activityIndex: 6, answer: '15 students (40 ÷ 8 × 3)'),
  AnswerKeyEntry(
    activityIndex: 7,
    answer: '3/8 is not coloured (8/8 − 3/8 − 2/8).',
  ),
];

// ---------------------------------------------------------------------------
// Instant answer
// ---------------------------------------------------------------------------

class DemoInstantAnswerRepository extends InstantAnswerRepository {
  DemoInstantAnswerRepository() : super(_offlineClient);

  @override
  Future<InstantAnswer> ask(InstantAnswerRequest request) async {
    await _working();
    final maths = _isMaths(request.subject, request.question);
    final grade = _or(request.gradeLevel, _defaultGrade(maths));
    final subject = _or(request.subject, _defaultSubject(maths));
    final answer = maths ? _fractionDivisionAnswer : _greenLeavesAnswer;
    return InstantAnswer(
      answer: answer,
      videoSuggestionUrl: Uri.https('www.youtube.com', '/results', {
        'search_query': maths
            ? 'dividing fractions class 6'
            : 'why are leaves green class 7',
      }),
      gradeLevel: grade,
      subject: subject,
      raw: <String, dynamic>{
        'demo': true,
        'answer': answer,
        'gradeLevel': grade,
        'subject': subject,
      },
    );
  }

  @override
  Future<String> save({
    required InstantAnswer answer,
    required InstantAnswerRequest request,
  }) => _saved();
}

const String _greenLeavesAnswer = '''
Leaves look green because of a pigment called **chlorophyll**, found inside tiny structures called *chloroplasts* in the leaf cells.

### What happens to sunlight?
- Sunlight is a mix of many colours — remember the rainbow, VIBGYOR.
- Chlorophyll **absorbs** mostly the red and blue parts of light and uses that energy to make food.
- It **reflects** the green part. That reflected light reaches our eyes, so the leaf looks green.

### Why it matters
The energy chlorophyll captures drives **photosynthesis**:

`Carbon dioxide + Water → Glucose + Oxygen` (in sunlight, with chlorophyll)

### Try it in class (5 minutes)
1. Crush a fresh tulsi or spinach leaf with a few drops of water on white paper — the green stain is chlorophyll.
2. Show a croton or red amaranth (lal maath) leaf and ask: *Does this leaf make food too?* Yes — its chlorophyll is hidden by red pigments.
3. Ask why old leaves turn yellow before they fall: the chlorophyll breaks down and the yellow pigments underneath show through.

**Quick check:** "If a plant is kept in a dark cupboard for a week, what will happen to its leaves, and why?"
''';

const String _fractionDivisionAnswer = '''
When we divide by a fraction, we are really asking **"how many of these parts fit into the whole?"** Flipping the fraction (using its *reciprocal*) is a shortcut for counting those parts.

### Start with rotis
- You have **3 rotis** and cut each one into halves. How many halves do you get?
- Each roti gives 2 halves, so 3 rotis give 6 halves.
- So `3 ÷ 1/2 = 6`, which is the same as `3 × 2 = 6`.

### The rule
To divide by a fraction, multiply by its reciprocal:

`a/b ÷ c/d = a/b × d/c`

Example: `3/4 ÷ 1/8 = 3/4 × 8/1 = 6` — six one-eighth pieces fit into three-quarters.

### Try it in class (5 minutes)
1. Give each pair a paper strip folded into 8 parts. Shade 3/4 of it.
2. Ask: "How many 1/8 pieces are inside the shaded part?" Students count 6.
3. Write `3/4 ÷ 1/8 = 6` on the board, then show the flip-and-multiply method gives the same answer.

**Common mistake:** flipping the *first* fraction instead of the second. Remind students: keep, change, flip — keep the first, change ÷ to ×, flip the second.
''';

// ---------------------------------------------------------------------------
// Visual aid
// ---------------------------------------------------------------------------

/// A blackboard-style photosynthesis diagram (720×480 PNG), drawn for the
/// demo build — the Science visual aid.
const String _demoScienceVisualPng =
    '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';

/// A blackboard-style fraction-strips diagram (720×480 PNG) — the Mathematics
/// visual aid.
const String _demoMathsVisualPng =
    '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'
    'AAAASUVORK5CYII=';

class DemoVisualAidRepository extends VisualAidRepository {
  DemoVisualAidRepository() : super(_offlineClient);

  @override
  Future<VisualAid> generate(VisualAidRequest request) async {
    await _working();
    final maths = _isMaths(request.subject, request.prompt);
    final subject = _or(request.subject, _defaultSubject(maths));
    final grade = _or(request.gradeLevel, _defaultGrade(maths));
    final prompt = _shorten(
      _or(
        request.prompt,
        maths
            ? 'fraction strips showing halves, quarters and eighths'
            : 'how a leaf makes food by photosynthesis',
      ),
      90,
    );
    return VisualAid(
      imageBytes: base64Decode(
        maths ? _demoMathsVisualPng : _demoScienceVisualPng,
      ),
      pedagogicalContext:
          'A clean, blackboard-style diagram of "$prompt" for $grade '
          '$subject. Labels are short and large enough to read from the back '
          'bench, and the layout is simple enough for students to copy into '
          'their notebooks in about five minutes. Use it right after the '
          'hands-on activity, so students can match what they saw to the '
          'picture.',
      discussionSpark: maths
          ? 'Cover one strip and ask: "Which is bigger, three quarters or '
                'five eighths — and how can the picture prove it?"'
          : 'Cover one arrow and ask: "What would happen to the plant if '
                'this arrow disappeared for a week?"',
      subject: subject,
    );
  }
}

// ---------------------------------------------------------------------------
// Video storyteller
// ---------------------------------------------------------------------------

class DemoVideoStorytellerRepository extends VideoStorytellerRepository {
  DemoVideoStorytellerRepository() : super(_offlineClient);

  @override
  Future<VideoRecommendations> recommend(
    VideoStorytellerRequest request,
  ) async {
    await _working();
    final maths = _isMaths(request.subject, request.topic);
    final topic = _or(request.topic, _defaultTopic(maths));
    final grade = _or(request.gradeLevel, _defaultGrade(maths));
    final subject = _or(request.subject, _defaultSubject(maths));
    return VideoRecommendations(
      personalizedMessage:
          'Namaste $_teacherFirstName ji! Here are hand-picked videos for '
          'teaching $topic to $grade $subject. Start with the NCERT '
          'explainer before your board work, and use the animated story as '
          "a hook for tomorrow's class.",
      categorizedVideos: <VideoCategory, List<Video>>{
        VideoCategory.topRecommended: <Video>[
          _video(
            'vid_top_1',
            maths
                ? 'Fractions | Class 6 Mathematics | NCERT'
                : 'Photosynthesis | Class 7 Science | NCERT',
            'NCERT Official',
            duration: '8:24',
            reason:
                'Follows the NCERT chapter step by step — ideal to play '
                'before your board work.',
          ),
        ],
        VideoCategory.storytelling: <Video>[
          _video(
            'vid_story_1',
            maths
                ? 'The Fair Share — An Animated Story About Fractions'
                : 'The Leaf That Fed the Village — An Animated Story',
            'Kahani Classroom',
            duration: '6:10',
            reason:
                'A short story with a village setting that students '
                'will remember.',
          ),
        ],
        VideoCategory.pedagogy: <Video>[
          _video(
            'vid_ped_1',
            maths
                ? 'Teaching Fractions with Paper Strips and Rotis'
                : 'Teaching Science with Local, Low-Cost Materials',
            'Ministry of Education India',
            duration: '12:00',
            reason: 'Classroom-tested activities that need no lab.',
          ),
        ],
        VideoCategory.govtUpdates: <Video>[
          _video(
            'vid_gov_1',
            'NEP 2020 in the Classroom: Competency-Based Assessment',
            'PIB India',
            duration: '4:45',
          ),
        ],
        VideoCategory.courses: <Video>[
          _video(
            'vid_course_1',
            maths
                ? 'Activity-Based Mathematics Teaching — Free Course'
                : 'Activity-Based Science Teaching — Free Course',
            'IGNOU',
            duration: '25:30',
          ),
        ],
      },
      fromCache: false,
      latencyScore: 1284,
    );
  }
}

Video _video(
  String id,
  String title,
  String channel, {
  String? duration,
  String? reason,
}) {
  return Video(
    id: id,
    title: title,
    channelTitle: channel,
    thumbnailUrl: 'https://i.ytimg.com/vi/$id/mqdefault.jpg',
    watchUrl: Uri.https('www.youtube.com', '/watch', {'v': id}),
    duration: duration,
    reason: reason,
  );
}

// ---------------------------------------------------------------------------
// Virtual field trip
// ---------------------------------------------------------------------------

class DemoVirtualFieldTripRepository extends VirtualFieldTripRepository {
  DemoVirtualFieldTripRepository() : super(_offlineClient);

  @override
  Future<FieldTripOutcome> plan(VirtualFieldTripRequest request) async {
    await _working();
    final topic = _or(request.topic, 'Forests and Wildlife of India');
    final grade = _or(request.gradeLevel, 'Class 7');
    final title = '$topic: A Virtual Field Trip';
    return FieldTripResult(
      FieldTrip(
        title: title,
        stops: _fieldTripStops,
        gradeLevel: grade,
        subject: 'Science',
        raw: <String, dynamic>{
          'demo': true,
          'title': title,
          'gradeLevel': grade,
          'subject': 'Science',
        },
      ),
    );
  }

  @override
  Future<String> save({
    required FieldTrip trip,
    required VirtualFieldTripRequest request,
  }) => _saved();
}

final List<FieldTripStop> _fieldTripStops = <FieldTripStop>[
  FieldTripStop(
    name: 'Kaziranga National Park, Assam',
    description:
        'Wide floodplain grasslands along the Brahmaputra river, home to '
        "about two-thirds of the world's one-horned rhinoceroses.",
    educationalFact:
        'Kaziranga is a UNESCO World Heritage Site. Its tall "elephant '
        'grass" can grow higher than an adult human.',
    reflectionPrompt:
        'Why might the yearly Brahmaputra floods be both a danger and a gift '
        'to the animals of Kaziranga?',
    culturalAnalogy:
        'Just as our village ponds fill up in the monsoon and bring back '
        'frogs and birds, the floods renew Kaziranga’s grasslands every year.',
    explanation:
        'Grasslands support a food chain — grass → deer and rhinos → tigers. '
        'Point out that every chain begins with green plants making food.',
    googleEarthUrl: Uri.parse(
      'https://earth.google.com/web/search/Kaziranga+National+Park',
    ),
  ),
  FieldTripStop(
    name: 'Silent Valley National Park, Kerala',
    description:
        'One of the last undisturbed tropical evergreen rainforests in the '
        'Western Ghats, with trees so dense that sunlight barely reaches the '
        'forest floor.',
    educationalFact:
        'The lion-tailed macaque, found only in the Western Ghats, lives '
        'here. A people’s movement in the 1970s and 80s stopped a dam that '
        'would have flooded the valley.',
    reflectionPrompt:
        'If you had lived near Silent Valley in 1980, would you have '
        'supported the dam or the forest? Why?',
    culturalAnalogy:
        'Like the devrai — the sacred groves near villages around Pune that '
        'no one is allowed to cut — Silent Valley survives because people '
        'chose to protect it.',
    explanation:
        'Rainforests have layers: emergent trees, canopy, understorey and '
        'floor. Ask students why the plants on the floor have very large '
        'leaves.',
    googleEarthUrl: Uri.parse(
      'https://earth.google.com/web/search/Silent+Valley+National+Park',
    ),
  ),
  FieldTripStop(
    name: 'The Sundarbans, West Bengal',
    description:
        'The largest mangrove forest in the world, where rivers meet the sea '
        'and the tide floods the forest twice a day.',
    educationalFact:
        'Mangrove trees grow special breathing roots called pneumatophores '
        'that stick up out of the salty mud to take in air.',
    reflectionPrompt:
        'Mangroves protect villages from cyclones. What could happen to the '
        'coast if these forests were cut down?',
    culturalAnalogy:
        'Like the mangrove belts along the Konkan coast that shelter fishing '
        'villages near Ratnagiri during storms.',
    explanation:
        'Plants adapt to their surroundings. Compare mangrove roots with the '
        'roots of plants in the school garden.',
    googleEarthUrl: Uri.parse(
      'https://earth.google.com/web/search/Sundarbans+National+Park',
    ),
  ),
  FieldTripStop(
    name: 'Rann of Kutch, Gujarat',
    description:
        'A vast white salt desert that turns into a shallow wetland in the '
        'monsoon, attracting thousands of flamingos.',
    educationalFact:
        'The Indian wild ass (ghudkhar) lives in the wild only in this part '
        'of India, in the Little Rann of Kutch.',
    reflectionPrompt:
        'How do you think animals and plants survive where the ground is '
        'covered in salt for most of the year?',
    culturalAnalogy:
        'Like the salt pans near the Mumbai and Konkan coast, where sea water '
        'is dried in the sun to make the salt we eat.',
    explanation:
        'Use this stop to discuss habitats that change with the seasons, and '
        'how animals migrate to find food and water.',
    googleEarthUrl: Uri.parse(
      'https://earth.google.com/web/search/Rann+of+Kutch',
    ),
  ),
  FieldTripStop(
    name: 'Valley of Flowers, Uttarakhand',
    description:
        'A high Himalayan meadow that bursts into colour during the monsoon, '
        'with hundreds of kinds of wild flowers.',
    educationalFact:
        'The valley has over 500 species of flowering plants and is part of '
        'the Nanda Devi UNESCO World Heritage Site.',
    reflectionPrompt:
        'Why do you think the flowers here bloom only for a few months each '
        'year?',
    culturalAnalogy:
        'Like the Kaas plateau near Satara, which turns purple and yellow '
        'with wild flowers every September.',
    explanation:
        'Link flowering to pollination and seeds. Ask students which insects '
        'they see on flowers in their own surroundings.',
    googleEarthUrl: Uri.parse(
      'https://earth.google.com/web/search/Valley+of+Flowers+National+Park',
    ),
  ),
];

// ---------------------------------------------------------------------------
// Teacher training (Teaching Coach)
// ---------------------------------------------------------------------------

class DemoTeacherTrainingRepository extends TeacherTrainingRepository {
  DemoTeacherTrainingRepository() : super(_offlineClient);

  @override
  Future<TeacherAdvice> advise(TeacherTrainingRequest request) async {
    await _working();
    final question = _or(
      request.question,
      'How do I keep a large, mixed-ability class engaged?',
    );
    final subject = _or(request.subject, 'General');
    final introduction =
        'You asked: "${_shorten(question, 160)}" This is a challenge almost '
        'every teacher in a busy classroom faces, and small, steady routines '
        'work better than big changes. Here are four strategies you can try '
        'from tomorrow, with no extra materials.';
    const conclusion =
        'Pick one strategy and use it every day for two weeks before adding '
        'another — routines take time to settle. Note what changes in a small '
        'diary; it will also help in your next NISHTHA or cluster meeting '
        'discussion.';
    return TeacherAdvice(
      introduction: introduction,
      advice: _coachAdvice,
      conclusion: conclusion,
      gradeLevel: 'Class 7',
      subject: subject,
      raw: <String, dynamic>{
        'demo': true,
        'introduction': introduction,
        'conclusion': conclusion,
        'subject': subject,
      },
    );
  }

  @override
  Future<String> save({
    required TeacherAdvice advice,
    required TeacherTrainingRequest request,
  }) => _saved();
}

const List<TeacherAdvicePoint> _coachAdvice = <TeacherAdvicePoint>[
  TeacherAdvicePoint(
    strategy: 'Open every lesson with a 3-minute hook',
    pedagogy: 'Activating prior knowledge (constructivism)',
    explanation:
        'Start with a question, a local object or a short story from the '
        "students' lives — a ripe mango, a bicycle tyre, a headline from the "
        'village. When new ideas connect to what students already know, '
        'attention rises and the lesson gets an anchor they can return to.',
  ),
  TeacherAdvicePoint(
    strategy: 'Use Think–Pair–Share instead of questions to the whole class',
    pedagogy: 'Cooperative learning',
    explanation:
        'Ask a question, give 30 seconds of silent thinking, then let pairs '
        'discuss for one minute before you call on any pair. Every student '
        'rehearses an answer, shy students get a safe space, and you hear '
        'from more voices than just the front benches.',
  ),
  TeacherAdvicePoint(
    strategy: 'Form mixed-ability groups with clear roles',
    pedagogy: 'Peer tutoring (zone of proximal development)',
    explanation:
        'Make groups of four or five with one confident student in each, and '
        'give roles: reader, writer, materials-keeper, presenter. Rotate the '
        'roles every week. Stronger students consolidate by explaining, and '
        'others learn from a peer who speaks their language.',
  ),
  TeacherAdvicePoint(
    strategy: 'Check understanding with a 2-minute exit ticket',
    pedagogy: 'Formative assessment (assessment for learning)',
    explanation:
        'Before the bell, each student writes one thing they learnt and one '
        'doubt on a small chit. Sort the chits into three piles — got it, '
        'almost, not yet — and begin the next class with the "not yet" pile.',
  ),
];

// ---------------------------------------------------------------------------
// Exam paper
// ---------------------------------------------------------------------------

class DemoExamPaperRepository extends ExamPaperRepository {
  DemoExamPaperRepository() : super(_offlineClient);

  @override
  Future<ExamPaperResult> generate(ExamPaperRequest request) async {
    await _working();
    final maths = _isMaths(request.subject, request.chapters.join(' '));
    final board = _or(request.board, 'CBSE');
    final grade = _or(request.gradeLevel, _defaultGrade(maths));
    final subject = _or(request.subject, _defaultSubject(maths));
    final title = '$grade $subject — Periodic Test';
    final sections = <ExamSection>[
      for (final section in maths ? _mathsSections : _scienceSections)
        ExamSection(
          name: section.name,
          label: section.label,
          totalMarks: section.totalMarks,
          questions: <ExamQuestion>[
            for (final q in section.questions)
              ExamQuestion(
                number: q.number,
                text: q.text,
                marks: q.marks,
                options: q.options,
                internalChoice: q.internalChoice,
                answerKey: request.includeAnswerKey ? q.answerKey : null,
                markingScheme: request.includeMarkingScheme
                    ? q.markingScheme
                    : null,
                source: q.source,
              ),
          ],
        ),
    ];
    final paper = ExamPaper(
      title: title,
      board: board,
      subject: subject,
      gradeLevel: grade,
      duration: '1 hour',
      maxMarks: 30,
      generalInstructions: <String>[
        'All questions are compulsory.',
        'The paper has four sections — A, B, C and D.',
        'Section A has 5 multiple-choice questions of 1 mark each. Section B '
            'has 3 questions of 2 marks, Section C has 3 questions of 3 '
            'marks, and Section D has 2 questions of 5 marks.',
        'An internal choice is given in one question of Section C.',
        if (maths)
          'Show all steps of your working. Write answers in the simplest '
              'form.'
        else
          'Draw neat, labelled diagrams wherever required.',
      ],
      sections: sections,
      blueprintSummary: maths ? _mathsBlueprint : _scienceBlueprint,
    );
    return ExamPaperReady(
      paper: paper,
      raw: <String, dynamic>{
        'demo': true,
        'title': title,
        'board': board,
        'gradeLevel': grade,
        'subject': subject,
        'maxMarks': 30,
      },
    );
  }

  @override
  Future<String> save(ExamPaperReady ready) => _saved();
}

const BlueprintSummary _scienceBlueprint = BlueprintSummary(
  chapterWise: <ChapterWeight>[
    ChapterWeight(chapter: 'Nutrition in Plants', marks: 19),
    ChapterWeight(chapter: 'Nutrition in Animals', marks: 4),
    ChapterWeight(chapter: 'Respiration in Organisms', marks: 7),
  ],
  difficultyWise: <DifficultyWeight>[
    DifficultyWeight(level: 'Easy', percentage: 30),
    DifficultyWeight(level: 'Moderate', percentage: 50),
    DifficultyWeight(level: 'Hard', percentage: 20),
  ],
);

const BlueprintSummary _mathsBlueprint = BlueprintSummary(
  chapterWise: <ChapterWeight>[
    ChapterWeight(chapter: 'Fractions', marks: 24),
    ChapterWeight(chapter: 'Decimals', marks: 5),
    ChapterWeight(chapter: 'Playing with Numbers', marks: 1),
  ],
  difficultyWise: <DifficultyWeight>[
    DifficultyWeight(level: 'Easy', percentage: 30),
    DifficultyWeight(level: 'Moderate', percentage: 50),
    DifficultyWeight(level: 'Hard', percentage: 20),
  ],
);

const List<ExamSection> _scienceSections = <ExamSection>[
  ExamSection(
    name: 'Section A',
    label: 'Multiple Choice Questions (1 mark each)',
    totalMarks: 5,
    questions: <ExamQuestion>[
      ExamQuestion(
        number: 1,
        marks: 1,
        text:
            'The process by which green plants make their own food is '
            'called:',
        options: <String>[
          '(a) respiration',
          '(b) photosynthesis',
          '(c) digestion',
          '(d) transpiration',
        ],
        answerKey: '(b) photosynthesis',
        markingScheme: '1 mark for the correct option.',
      ),
      ExamQuestion(
        number: 2,
        marks: 1,
        text: 'Which of the following is a parasitic plant?',
        options: <String>[
          '(a) Pitcher plant',
          '(b) Cuscuta',
          '(c) Mango',
          '(d) Lichen',
        ],
        answerKey: '(b) Cuscuta',
        markingScheme: '1 mark for the correct option.',
      ),
      ExamQuestion(
        number: 3,
        marks: 1,
        text: 'In human beings, the digestion of food is completed in the:',
        options: <String>[
          '(a) stomach',
          '(b) small intestine',
          '(c) large intestine',
          '(d) food pipe',
        ],
        answerKey: '(b) small intestine',
        markingScheme: '1 mark for the correct option.',
      ),
      ExamQuestion(
        number: 4,
        marks: 1,
        text: 'The gas released during respiration is:',
        options: <String>[
          '(a) oxygen',
          '(b) nitrogen',
          '(c) carbon dioxide',
          '(d) hydrogen',
        ],
        answerKey: '(c) carbon dioxide',
        markingScheme: '1 mark for the correct option.',
      ),
      ExamQuestion(
        number: 5,
        marks: 1,
        text: 'Lime water turns milky when ______ is passed through it.',
        options: <String>[
          '(a) oxygen',
          '(b) carbon dioxide',
          '(c) nitrogen',
          '(d) water vapour',
        ],
        answerKey: '(b) carbon dioxide',
        markingScheme: '1 mark for the correct option.',
      ),
    ],
  ),
  ExamSection(
    name: 'Section B',
    label: 'Very Short Answer Questions (2 marks each)',
    totalMarks: 6,
    questions: <ExamQuestion>[
      ExamQuestion(
        number: 6,
        marks: 2,
        text:
            'Why are green plants called autotrophs, while animals are '
            'called heterotrophs?',
        answerKey:
            'Green plants make their own food by photosynthesis, so '
            'they are autotrophs. Animals cannot make their own food and '
            'depend on plants or other animals, so they are heterotrophs.',
        markingScheme: '1 mark for autotrophs, 1 mark for heterotrophs.',
      ),
      ExamQuestion(
        number: 7,
        marks: 2,
        text:
            'Name the tiny pores present on the surface of leaves. Write '
            'two functions of these pores.',
        answerKey:
            'Stomata. They allow carbon dioxide to enter and oxygen to '
            'leave, and they let out water vapour (transpiration).',
        markingScheme: '½ mark for the name, ½ + 1 mark for the two functions.',
      ),
      ExamQuestion(
        number: 8,
        marks: 2,
        text: 'Why do we breathe faster after running a race?',
        answerKey:
            'Running needs more energy. The body breathes faster to '
            'take in more oxygen, which is used to release energy from food '
            'during respiration.',
        markingScheme:
            '1 mark for "more energy needed", 1 mark for the role '
            'of oxygen.',
      ),
    ],
  ),
  ExamSection(
    name: 'Section C',
    label: 'Short Answer Questions (3 marks each)',
    totalMarks: 9,
    questions: <ExamQuestion>[
      ExamQuestion(
        number: 9,
        marks: 3,
        text:
            'Describe an activity to show that sunlight is necessary for '
            'photosynthesis.',
        internalChoice:
            'OR: Explain how the pitcher plant obtains its '
            'nutrients, and why it needs to trap insects.',
        answerKey:
            'Cover part of a leaf of a potted plant with black paper '
            'and keep it in sunlight for 2–3 days. Test the leaf with iodine: '
            'the uncovered part turns blue-black (starch present), the '
            'covered part does not. So starch is made only where sunlight '
            'reaches.',
        markingScheme:
            '1 mark for the set-up, 1 mark for the iodine test, '
            '1 mark for the conclusion.',
      ),
      ExamQuestion(
        number: 10,
        marks: 3,
        text:
            'Draw a labelled diagram of the human digestive system and '
            'mark the mouth, food pipe, stomach and small intestine.',
        answerKey: 'Diagram with the four parts correctly labelled.',
        markingScheme:
            '1 mark for the diagram, ½ mark for each correct '
            'label.',
      ),
      ExamQuestion(
        number: 11,
        marks: 3,
        text:
            'Write two differences between aerobic and anaerobic '
            'respiration. Give one example of an organism for each.',
        answerKey:
            'Aerobic respiration uses oxygen and releases more energy '
            '(e.g. humans). Anaerobic respiration happens without oxygen and '
            'releases less energy (e.g. yeast).',
        markingScheme: '1 mark for each difference, ½ mark for each example.',
      ),
    ],
  ),
  ExamSection(
    name: 'Section D',
    label: 'Long Answer Questions (5 marks each)',
    totalMarks: 10,
    questions: <ExamQuestion>[
      ExamQuestion(
        number: 12,
        marks: 5,
        text:
            '(a) Write the word equation for photosynthesis.\n'
            '(b) Explain the role of chlorophyll, stomata and roots in this '
            'process.\n'
            '(c) Why is photosynthesis important for all living beings?',
        answerKey:
            '(a) Carbon dioxide + Water → Glucose + Oxygen (in '
            'sunlight, with chlorophyll). (b) Chlorophyll traps sunlight; '
            'stomata take in carbon dioxide; roots absorb water. (c) It '
            'makes the food at the start of every food chain and releases '
            'the oxygen we breathe.',
        markingScheme:
            '(a) 1 mark, (b) 3 marks (1 for each part), '
            '(c) 1 mark.',
      ),
      ExamQuestion(
        number: 13,
        marks: 5,
        text:
            'Case study: Ramu, a farmer from Wagholi, noticed that the '
            'crops in a corner of his field shaded by a large banyan tree '
            'were smaller and paler than the rest.\n'
            '(a) What could be the reason?\n'
            '(b) Which life process is affected?\n'
            '(c) Suggest two things Ramu can do.',
        answerKey:
            '(a) The shaded crops get less sunlight. (b) '
            'Photosynthesis — less food is made, so the plants are smaller '
            'and paler. (c) Trim the lower branches of the tree; grow a '
            'shade-tolerant crop in that corner.',
        markingScheme: '(a) 1 mark, (b) 2 marks, (c) 2 marks.',
      ),
    ],
  ),
];

const List<ExamSection> _mathsSections = <ExamSection>[
  ExamSection(
    name: 'Section A',
    label: 'Multiple Choice Questions (1 mark each)',
    totalMarks: 5,
    questions: <ExamQuestion>[
      ExamQuestion(
        number: 1,
        marks: 1,
        text: 'Which of the following is a proper fraction?',
        options: <String>['(a) 7/5', '(b) 5/7', '(c) 9/9', '(d) 11/3'],
        answerKey: '(b) 5/7',
        markingScheme: '1 mark for the correct option.',
      ),
      ExamQuestion(
        number: 2,
        marks: 1,
        text: 'The decimal form of 3/10 is:',
        options: <String>['(a) 3.10', '(b) 0.03', '(c) 0.3', '(d) 30.0'],
        answerKey: '(c) 0.3',
        markingScheme: '1 mark for the correct option.',
      ),
      ExamQuestion(
        number: 3,
        marks: 1,
        text: '2/3 is equivalent to:',
        options: <String>['(a) 4/9', '(b) 6/9', '(c) 3/2', '(d) 2/6'],
        answerKey: '(b) 6/9',
        markingScheme: '1 mark for the correct option.',
      ),
      ExamQuestion(
        number: 4,
        marks: 1,
        text: 'Which of these is the largest?',
        options: <String>['(a) 0.5', '(b) 0.05', '(c) 0.55', '(d) 0.505'],
        answerKey: '(c) 0.55',
        markingScheme: '1 mark for the correct option.',
      ),
      ExamQuestion(
        number: 5,
        marks: 1,
        text: 'The HCF of 12 and 18 is:',
        options: <String>['(a) 2', '(b) 3', '(c) 6', '(d) 36'],
        answerKey: '(c) 6',
        markingScheme: '1 mark for the correct option.',
      ),
    ],
  ),
  ExamSection(
    name: 'Section B',
    label: 'Very Short Answer Questions (2 marks each)',
    totalMarks: 6,
    questions: <ExamQuestion>[
      ExamQuestion(
        number: 6,
        marks: 2,
        text: 'Write three fractions equivalent to 3/5.',
        answerKey: '6/10, 9/15, 12/20 (any three correct answers).',
        markingScheme: '2 marks for three correct fractions; 1 mark for two.',
      ),
      ExamQuestion(
        number: 7,
        marks: 2,
        text: 'Convert 2 3/4 into an improper fraction and into a decimal.',
        answerKey: '11/4 and 2.75',
        markingScheme: '1 mark for each.',
      ),
      ExamQuestion(
        number: 8,
        marks: 2,
        text: 'Find: 5/8 + 1/8 − 3/8',
        answerKey: '(5 + 1 − 3)/8 = 3/8',
        markingScheme: '1 mark for the method, 1 mark for the answer.',
      ),
    ],
  ),
  ExamSection(
    name: 'Section C',
    label: 'Short Answer Questions (3 marks each)',
    totalMarks: 9,
    questions: <ExamQuestion>[
      ExamQuestion(
        number: 9,
        marks: 3,
        text: 'Arrange in ascending order: 2/3, 1/2, 5/6',
        internalChoice:
            'OR: Arrange in descending order: 0.7, 0.07, 0.77, '
            '0.707',
        answerKey:
            'With denominator 6: 4/6, 3/6, 5/6, so 1/2 < 2/3 < 5/6. '
            '(OR: 0.77 > 0.707 > 0.7 > 0.07)',
        markingScheme:
            '2 marks for converting to like fractions, 1 mark for '
            'the correct order.',
      ),
      ExamQuestion(
        number: 10,
        marks: 3,
        text:
            'Sameer spent 1/4 of his pocket money on a notebook and 2/5 on '
            'a pen. What fraction did he spend? What fraction is left?',
        answerKey:
            '1/4 + 2/5 = 5/20 + 8/20 = 13/20 spent; 1 − 13/20 = 7/20 '
            'left.',
        markingScheme:
            '2 marks for the fraction spent, 1 mark for the '
            'fraction left.',
      ),
      ExamQuestion(
        number: 11,
        marks: 3,
        text:
            'A ribbon is 4.5 m long. Rina cuts off 1.75 m. How much ribbon '
            'is left?',
        answerKey: '4.50 − 1.75 = 2.75 m',
        markingScheme:
            '1 mark for aligning decimals, 2 marks for the '
            'correct answer with units.',
      ),
    ],
  ),
  ExamSection(
    name: 'Section D',
    label: 'Long Answer Questions (5 marks each)',
    totalMarks: 10,
    questions: <ExamQuestion>[
      ExamQuestion(
        number: 12,
        marks: 5,
        text:
            'Class 6 B collected ₹360 for the school garden. They spent 1/3 '
            'of it on seeds and 1/4 on pots, and the rest on manure.\n'
            '(a) How much was spent on seeds?\n'
            '(b) How much was spent on pots?\n'
            '(c) What fraction of the money, and how many rupees, went on '
            'manure?',
        answerKey:
            '(a) ₹120 (b) ₹90 (c) 1 − 1/3 − 1/4 = 5/12 of the money, '
            'which is ₹150.',
        markingScheme:
            '(a) 1 mark, (b) 1 mark, (c) 3 marks (2 for the '
            'fraction, 1 for the amount).',
      ),
      ExamQuestion(
        number: 13,
        marks: 5,
        text:
            '(a) Show 3/4 and 1 1/2 on a number line.\n'
            '(b) Which is greater, 7/9 or 4/5? Show your working.',
        answerKey:
            '(a) Number line from 0 to 2 divided into quarters, with '
            '3/4 and 1 1/2 (= 6/4) marked. (b) 7/9 = 35/45 and 4/5 = 36/45, '
            'so 4/5 is greater.',
        markingScheme:
            '(a) 2 marks, (b) 3 marks (2 for the working, 1 for '
            'the conclusion).',
      ),
    ],
  ),
];

// ---------------------------------------------------------------------------
// Assess assignment
// ---------------------------------------------------------------------------

class DemoAssessAssignmentRepository extends AssessAssignmentRepository {
  DemoAssessAssignmentRepository() : super(_offlineClient);

  @override
  Future<Assessment> assess(AssessAssignmentRequest request) async {
    await _working();
    return _demoAssessment(request);
  }

  @override
  Future<String> save({
    required Assessment assessment,
    required AssessAssignmentRequest request,
  }) => _saved();
}

Assessment _demoAssessment(AssessAssignmentRequest request) {
  final maths = _isMaths(request.rubric?.subject, request.rubric?.title);
  final rubric =
      request.rubric ??
      (maths ? _mathsAssignmentRubric : _scienceAssignmentRubric);
  final transcript = maths ? _mathsTranscript : _scienceTranscript;
  final language = _or(request.language, 'English');
  final raw = <String, dynamic>{
    'demo': true,
    'mode': request.mode.wire,
    'rubric': rubric.toJson(),
  };

  if (request.mode == AssessmentMode.transcribe) {
    return Assessment(
      rawTranscript: transcript,
      confidenceOverall: 0.91,
      rubric: rubric,
      language: language,
      raw: raw,
    );
  }

  // Score each criterion one level below the top (two below for the third),
  // so the result reads like a real, mostly-good piece of student work.
  const levelPattern = <int>[1, 1, 2, 1];
  const feedback = <String>[
    'Explains the process correctly and in order; one spelling slip '
        '("there" for "their").',
    'Uses most key terms correctly. Add the word "chloroplast" when '
        'describing where food is made.',
    'The diagram is partly cut off in the photo, so the labels could not all '
        'be read. Please check this one yourself.',
    'Clear, well-organised answer with a good concluding sentence.',
  ];
  const confidence = <double>[0.92, 0.88, 0.46, 0.9];

  final scores = <CriterionScore>[];
  num earned = 0;
  num possible = 0;
  for (var i = 0; i < rubric.criteria.length; i++) {
    final criterion = rubric.criteria[i];
    final levels = criterion.levels;
    final maxPoints = levels.isEmpty
        ? 4
        : levels.map((l) => l.points ?? 0).fold<num>(0, math.max);
    final effectiveMax = maxPoints > 0 ? maxPoints : 4;
    final levelIndex = math.min(
      levelPattern[i % levelPattern.length],
      math.max(0, levels.length - 1),
    );
    final level = levels.isEmpty ? null : levels[levelIndex];
    final points = level?.points ?? (effectiveMax * 0.75).round();
    earned += points;
    possible += effectiveMax;
    scores.add(
      CriterionScore(
        criterionName: criterion.name,
        level: level?.name,
        points: points,
        maxPoints: effectiveMax,
        feedback: feedback[i % feedback.length],
        confidence: confidence[i % confidence.length],
      ),
    );
  }
  final overall = possible > 0 ? (earned * 100 / possible).round() : null;

  final edited = request.editedTranscript?.trim();
  return Assessment(
    rawTranscript: transcript,
    editedTranscript: (edited == null || edited.isEmpty) ? null : edited,
    overallScore: overall,
    pointsEarned: earned,
    pointsPossible: possible,
    perCriterionScores: scores,
    strengths: maths
        ? const <String>[
            'Finds a common denominator correctly before adding.',
            'Writes every step in order, so the method is easy to follow.',
          ]
        : const <String>[
            'Names both raw materials and both products correctly.',
            'Connects photosynthesis to food for animals and humans.',
          ],
    improvements: maths
        ? const <String>[
            'Write the final answer in a sentence with the unit.',
            'Check the answer by estimating — is 7/20 less than half?',
          ]
        : const <String>[
            'Label every arrow in the diagram, including oxygen.',
            'Mention where in the leaf the food is made (chloroplasts).',
          ],
    nextSteps: maths
        ? const <String>[
            'Practise two word problems that need subtraction from 1 whole.',
          ]
        : const <String>[
            'Redraw the leaf diagram with all four arrows labelled.',
            'Try the covered-leaf question from the worksheet.',
          ],
    teacherNote:
        'A strong answer overall. The diagram was hard to read in the photo — '
        'worth a quick look at the notebook before finalising the marks.',
    confidenceOverall: 0.84,
    warnings: const <String>[
      'Part of the page was cut off in the photo; the diagram score has low '
          'confidence.',
    ],
    rubric: rubric,
    language: language,
    raw: raw,
  );
}

const String _scienceTranscript =
    'Q. What is photosynthesis? Explain with a diagram.\n\n'
    'Photosynthesis is the process in which green plants make there own food. '
    'They take carbon dioxide from the air through stomata and water from the '
    'soil through the roots. In the presence of sunlight and chlorophyll they '
    'make glucose and give out oxygen.\n\n'
    'Carbon dioxide + Water → Glucose + Oxygen\n\n'
    'The extra food is stored as starch.\n\n'
    '[Diagram: a leaf with arrows labelled sunlight, water and CO2; the '
    'outgoing arrow is cut off at the edge of the photo]\n\n'
    'If there was no photosynthesis there will be no food for animals and '
    'humans.';

const String _mathsTranscript =
    'Q. Sameer spent 1/4 of his pocket money on a notebook and 2/5 on a pen. '
    'What fraction did he spend? What fraction is left?\n\n'
    '1/4 + 2/5 = 5/20 + 8/20 = 13/20\n'
    'Left = 1 − 13/20 = 20/20 − 13/20 = 7/20\n\n'
    'Ans: He spent 13/20 and 7/20 is left.';

const AssessmentRubric _scienceAssignmentRubric = AssessmentRubric(
  title: 'Photosynthesis — Long Answer',
  description: 'Class 7 Science written answer with a diagram.',
  gradeLevel: 'Class 7',
  subject: 'Science',
  criteria: <AssessmentRubricCriterion>[
    AssessmentRubricCriterion(
      name: 'Scientific accuracy',
      description: 'The process is explained correctly.',
      levels: _fivePointLevels,
    ),
    AssessmentRubricCriterion(
      name: 'Use of key terms',
      description: 'Chlorophyll, stomata, glucose, oxygen used correctly.',
      levels: _fivePointLevels,
    ),
    AssessmentRubricCriterion(
      name: 'Diagram and labelling',
      description: 'A neat leaf diagram with every arrow labelled.',
      levels: _fivePointLevels,
    ),
    AssessmentRubricCriterion(
      name: 'Clarity of expression',
      description: 'Ideas are in order and easy to follow.',
      levels: _fivePointLevels,
    ),
  ],
);

const AssessmentRubric _mathsAssignmentRubric = AssessmentRubric(
  title: 'Fractions — Word Problem',
  description: 'Class 6 Mathematics word problem with working.',
  gradeLevel: 'Class 6',
  subject: 'Mathematics',
  criteria: <AssessmentRubricCriterion>[
    AssessmentRubricCriterion(
      name: 'Understanding the problem',
      description: 'Identifies what is given and what is asked.',
      levels: _fivePointLevels,
    ),
    AssessmentRubricCriterion(
      name: 'Method',
      description: 'Uses a common denominator correctly.',
      levels: _fivePointLevels,
    ),
    AssessmentRubricCriterion(
      name: 'Accuracy',
      description: 'Calculations and final answer are correct.',
      levels: _fivePointLevels,
    ),
    AssessmentRubricCriterion(
      name: 'Presentation',
      description: 'Steps are written in order with a final statement.',
      levels: _fivePointLevels,
    ),
  ],
);

const List<AssessmentRubricLevel> _fivePointLevels = <AssessmentRubricLevel>[
  AssessmentRubricLevel(
    name: 'Excellent',
    points: 5,
    description: 'Complete and accurate.',
  ),
  AssessmentRubricLevel(
    name: 'Good',
    points: 4,
    description: 'Mostly complete; one small gap.',
  ),
  AssessmentRubricLevel(
    name: 'Satisfactory',
    points: 3,
    description: 'Partly complete; some errors.',
  ),
  AssessmentRubricLevel(
    name: 'Needs work',
    points: 1,
    description: 'Little of the expected answer is present.',
  ),
];

// ---------------------------------------------------------------------------
// Assessment scanner
// ---------------------------------------------------------------------------

class DemoAssessmentScannerRepository extends AssessmentScannerRepository {
  DemoAssessmentScannerRepository() : super(_offlineClient);

  @override
  Future<AssessmentResult> grade(AssessmentScanRequest request) async {
    await _working();
    final maths = _isMaths(request.subject, null);
    final pageCount = math.max(1, request.pageDataUris.length);
    final source = maths ? _mathsScan : _scienceScan;
    final perPage = (source.length / pageCount).ceil();
    final questions = <GradedQuestion>[
      for (var i = 0; i < source.length; i++)
        _onPage(source[i], math.min(i ~/ perPage, pageCount - 1)),
    ];
    final awarded = questions.fold<num>(0, (sum, q) => sum + q.marksAwarded);
    final max = questions.fold<num>(0, (sum, q) => sum + q.marksMax);
    final pct = max > 0 ? awarded * 100 / max : 0;
    return AssessmentResult(
      assessmentId: request.assessmentId,
      status: 'graded',
      pageCount: pageCount,
      totalAwardedMarks: awarded,
      totalMaxMarks: max,
      scorePct: pct,
      letterGrade: _cbseGrade(pct),
      questions: questions,
      recommendedNextSteps: maths
          ? const <String>[
              'Re-teach comparing fractions with a common denominator using '
                  'paper strips.',
              'Give two more subtraction problems with unlike denominators '
                  'for practice.',
            ]
          : const <String>[
              'Revisit why light, not water, is the missing factor for a '
                  'plant kept in the dark.',
              'Ask the student to redraw the photosynthesis diagram with '
                  'glucose labelled.',
            ],
      studentRecommendations: maths
          ? const <String>[
              'Before comparing two fractions, make their denominators the '
                  'same.',
              'Never subtract the denominators — only the numerators.',
            ]
          : const <String>[
              'Learn the four arrows of photosynthesis: sunlight, water, '
                  'carbon dioxide in; oxygen out.',
              'Use the full form "carbon dioxide" in answers, not only CO2.',
            ],
      needsReviewCount: questions.where((q) => q.needsTeacherReview).length,
    );
  }
}

/// [q] moved to [pageIndex].
GradedQuestion _onPage(GradedQuestion q, int pageIndex) => GradedQuestion(
  questionId: q.questionId,
  pageIndex: pageIndex,
  questionText: q.questionText,
  studentAnswer: q.studentAnswer,
  marksAwarded: q.marksAwarded,
  marksMax: q.marksMax,
  expectedAnswer: q.expectedAnswer,
  feedback: q.feedback,
  studentFacingFeedback: q.studentFacingFeedback,
  conceptTested: q.conceptTested,
  mistakePattern: q.mistakePattern,
  needsTeacherReview: q.needsTeacherReview,
  confidence: q.confidence,
);

/// CBSE-style grade for a percentage.
String _cbseGrade(num pct) {
  if (pct > 90) return 'A1';
  if (pct > 80) return 'A2';
  if (pct > 70) return 'B1';
  if (pct > 60) return 'B2';
  if (pct > 50) return 'C1';
  if (pct > 40) return 'C2';
  if (pct >= 33) return 'D';
  return 'E';
}

const List<GradedQuestion> _scienceScan = <GradedQuestion>[
  GradedQuestion(
    questionId: 'q1',
    pageIndex: 0,
    questionText: 'Name the green pigment present in leaves.',
    studentAnswer: 'Chlorophyll',
    marksAwarded: 1,
    marksMax: 1,
    expectedAnswer: 'Chlorophyll',
    feedback: 'Correct.',
    studentFacingFeedback: 'Well done!',
    conceptTested: 'Chlorophyll',
    confidence: 0.97,
  ),
  GradedQuestion(
    questionId: 'q2',
    pageIndex: 0,
    questionText: 'Write the word equation for photosynthesis.',
    studentAnswer: 'Carbon dioxide + water → glucose + oxygen (sunlight)',
    marksAwarded: 2,
    marksMax: 2,
    expectedAnswer:
        'Carbon dioxide + Water → Glucose + Oxygen, in sunlight '
        'with chlorophyll',
    feedback: 'Correct and complete.',
    studentFacingFeedback: 'Perfect equation.',
    conceptTested: 'Word equation',
    confidence: 0.93,
  ),
  GradedQuestion(
    questionId: 'q3',
    pageIndex: 0,
    questionText: 'What are stomata? Write one function.',
    studentAnswer: 'Small holes in the leaf. They help the plant to breathe.',
    marksAwarded: 1,
    marksMax: 2,
    expectedAnswer:
        'Tiny pores on the leaf surface; they let carbon dioxide '
        'in and oxygen out.',
    feedback:
        'Definition is correct, but the function is vague — exchange '
        'of gases for photosynthesis is expected.',
    studentFacingFeedback: 'Say which gases go in and out through stomata.',
    conceptTested: 'Stomata',
    mistakePattern: 'Vague function ("breathe") instead of gas exchange',
    confidence: 0.9,
  ),
  GradedQuestion(
    questionId: 'q4',
    pageIndex: 0,
    questionText: 'Why is Cuscuta called a parasite?',
    studentAnswer: 'Because it takes food from the plant on which it climbs.',
    marksAwarded: 2,
    marksMax: 2,
    expectedAnswer:
        'It has no chlorophyll and takes its food from the host '
        'plant.',
    feedback: 'Correct.',
    studentFacingFeedback: 'Good answer.',
    conceptTested: 'Parasitic nutrition',
    confidence: 0.94,
  ),
  GradedQuestion(
    questionId: 'q5',
    pageIndex: 0,
    questionText:
        'Explain how the covered-leaf experiment shows that '
        'sunlight is needed for photosynthesis.',
    studentAnswer:
        'The covered part did not turn blue-black because no '
        'starch was made there.',
    marksAwarded: 2,
    marksMax: 3,
    expectedAnswer:
        'The uncovered part turns blue-black (starch present); '
        'the covered part does not, so starch is made only where light '
        'falls.',
    feedback:
        'Correct reasoning for the covered part; the uncovered part '
        'and the conclusion are missing.',
    studentFacingFeedback:
        'Also describe what happened to the uncovered '
        'part.',
    conceptTested: 'Experiment and conclusion',
    confidence: 0.88,
  ),
  GradedQuestion(
    questionId: 'q6',
    pageIndex: 0,
    questionText:
        'Draw and label a diagram showing the raw materials and '
        'products of photosynthesis.',
    studentAnswer:
        '[Diagram: leaf with arrows for sunlight, water, CO2 and '
        'O2; glucose not labelled]',
    marksAwarded: 3,
    marksMax: 5,
    expectedAnswer:
        'Leaf with labelled arrows: sunlight, water, carbon '
        'dioxide in; oxygen out; glucose made in the leaf.',
    feedback:
        'Neat diagram, but glucose is not shown. The photo is blurred '
        'near the edge — please confirm the labels.',
    studentFacingFeedback: 'Show where the glucose is made.',
    conceptTested: 'Diagram',
    mistakePattern: 'Incomplete labelling',
    needsTeacherReview: true,
    confidence: 0.55,
  ),
  GradedQuestion(
    questionId: 'q7',
    pageIndex: 0,
    questionText: 'Why do plants kept in a dark room turn yellow?',
    studentAnswer: 'Because they do not get water.',
    marksAwarded: 0,
    marksMax: 3,
    expectedAnswer:
        'Without light they cannot photosynthesise or make '
        'chlorophyll, so the leaves turn pale yellow.',
    feedback: 'Incorrect — the missing factor is light, not water.',
    studentFacingFeedback:
        'Think again: what does a dark room take away '
        'from the plant?',
    conceptTested: 'Light as a requirement',
    mistakePattern: 'Confuses light with water as the missing factor',
    confidence: 0.91,
  ),
  GradedQuestion(
    questionId: 'q8',
    pageIndex: 0,
    questionText: 'Name the two products of photosynthesis.',
    studentAnswer: 'Glucose and oxygen',
    marksAwarded: 2,
    marksMax: 2,
    expectedAnswer: 'Glucose and oxygen',
    feedback: 'Correct.',
    studentFacingFeedback: 'Well done!',
    conceptTested: 'Products of photosynthesis',
    confidence: 0.96,
  ),
];

const List<GradedQuestion> _mathsScan = <GradedQuestion>[
  GradedQuestion(
    questionId: 'q1',
    pageIndex: 0,
    questionText: '3 out of 8 equal parts are shaded. Write the fraction.',
    studentAnswer: '3/8',
    marksAwarded: 1,
    marksMax: 1,
    expectedAnswer: '3/8',
    feedback: 'Correct.',
    studentFacingFeedback: 'Well done!',
    conceptTested: 'Fraction of a whole',
    confidence: 0.97,
  ),
  GradedQuestion(
    questionId: 'q2',
    pageIndex: 0,
    questionText: 'Write two fractions equivalent to 2/5.',
    studentAnswer: '4/10, 6/15',
    marksAwarded: 2,
    marksMax: 2,
    expectedAnswer: 'Any two, e.g. 4/10, 6/15',
    feedback: 'Correct.',
    studentFacingFeedback: 'Good work.',
    conceptTested: 'Equivalent fractions',
    confidence: 0.95,
  ),
  GradedQuestion(
    questionId: 'q3',
    pageIndex: 0,
    questionText: 'Compare 3/4 and 5/8 using < or >.',
    studentAnswer: '3/4 = 6/8, so 3/4 < 5/8',
    marksAwarded: 1,
    marksMax: 2,
    expectedAnswer: '3/4 = 6/8 > 5/8, so 3/4 > 5/8',
    feedback: 'Converted correctly to 6/8 but chose the wrong sign.',
    studentFacingFeedback: 'You found 6/8 — now compare 6 and 5 again.',
    conceptTested: 'Comparing unlike fractions',
    mistakePattern: 'Correct conversion, wrong comparison sign',
    confidence: 0.9,
  ),
  GradedQuestion(
    questionId: 'q4',
    pageIndex: 0,
    questionText: 'Convert 13/4 into a mixed fraction.',
    studentAnswer: '3 1/4',
    marksAwarded: 2,
    marksMax: 2,
    expectedAnswer: '3 1/4',
    feedback: 'Correct.',
    studentFacingFeedback: 'Well done!',
    conceptTested: 'Mixed fractions',
    confidence: 0.94,
  ),
  GradedQuestion(
    questionId: 'q5',
    pageIndex: 0,
    questionText: 'Add: 2/7 + 3/7',
    studentAnswer: '5/14',
    marksAwarded: 0,
    marksMax: 2,
    expectedAnswer: '5/7',
    feedback: 'Added the denominators as well as the numerators.',
    studentFacingFeedback:
        'For like fractions, keep the denominator the '
        'same.',
    conceptTested: 'Adding like fractions',
    mistakePattern: 'Adds denominators',
    confidence: 0.93,
  ),
  GradedQuestion(
    questionId: 'q6',
    pageIndex: 0,
    questionText: 'Reduce 18/24 to its lowest terms.',
    studentAnswer: '18/24 = 9/12 = 3/4',
    marksAwarded: 3,
    marksMax: 3,
    expectedAnswer: '3/4',
    feedback: 'Correct, with clear steps.',
    studentFacingFeedback: 'Excellent working.',
    conceptTested: 'Simplest form',
    confidence: 0.95,
  ),
  GradedQuestion(
    questionId: 'q7',
    pageIndex: 0,
    questionText:
        'A class has 36 students and 2/3 of them are girls. How '
        'many boys are there?',
    studentAnswer: '2/3 of 36 = 24 girls, so boys = 36 − 24 = 12',
    marksAwarded: 3,
    marksMax: 3,
    expectedAnswer: '12 boys',
    feedback: 'Correct.',
    studentFacingFeedback: 'Well reasoned!',
    conceptTested: 'Fraction of a group',
    confidence: 0.92,
  ),
  GradedQuestion(
    questionId: 'q8',
    pageIndex: 0,
    questionText:
        'Riya ate 1/4 of a cake and her brother ate 3/8. Who ate '
        'more, and by how much?',
    studentAnswer: 'Brother ate more. 3/8 − 1/4 = 2/4',
    marksAwarded: 2,
    marksMax: 5,
    expectedAnswer: 'Brother, by 1/8 (3/8 − 2/8)',
    feedback:
        'Correct comparison, but subtracted numerators and '
        'denominators separately. Handwriting is faint — please confirm.',
    studentFacingFeedback: 'Change 1/4 to 2/8 first, then subtract.',
    conceptTested: 'Subtracting unlike fractions',
    mistakePattern: 'Subtracts numerators and denominators separately',
    needsTeacherReview: true,
    confidence: 0.58,
  ),
];

// ---------------------------------------------------------------------------
// Parent message
// ---------------------------------------------------------------------------

class DemoParentMessageRepository extends ParentMessageRepository {
  DemoParentMessageRepository() : super(_offlineClient);

  @override
  Future<ParentMessage> draft(ParentMessageRequest request) async {
    await _working();
    return _demoParentMessage(request);
  }
}

ParentMessage _demoParentMessage(ParentMessageRequest request) {
  final student = _or(request.studentName, 'Aarav');
  final first = student.split(' ').first;
  final className = _or(request.className, kDemoClass7Name);
  final subject = _or(request.subject, kDemoClass7Subject);
  final teacher = _or(request.teacherName, kDemoTeacherName);
  final school = _or(request.schoolName, kDemoSchool);
  final days = request.consecutiveAbsentDays ?? 3;
  final language = request.parentLanguage.trim().toLowerCase();

  final String code;
  final String salutation;
  final String greeting;
  final String body;
  final String thanks;

  if (language == 'hi' || language.contains('hindi')) {
    code = 'hi-IN';
    salutation = 'आदरणीय अभिभावक जी,';
    greeting = '$school से $subject शिक्षक $teacher की ओर से नमस्ते।';
    thanks = 'धन्यवाद,';
    body = switch (request.reason) {
      ParentMessageReason.consecutiveAbsences =>
        '$student ($className) पिछले $days दिनों से स्कूल में अनुपस्थित है। '
            'कक्षा में सभी को $first की कमी महसूस हो रही है, और इन दिनों '
            'में $subject के कुछ महत्वपूर्ण पाठ पढ़ाए गए हैं।\n\n'
            'यदि $first की तबीयत ठीक नहीं है या घर पर कोई कठिनाई है, तो '
            'कृपया हमें बताएँ — छूटा हुआ काम पूरा करने में पूरी मदद की जाएगी। '
            'कृपया कल से $first को स्कूल भेजें, या किसी भी समय फ़ोन पर बात '
            'करें।',
      ParentMessageReason.poorPerformance =>
        'हाल की कक्षा परीक्षाओं में $student ($className) को $subject के '
            'कुछ पाठ कठिन लगे हैं और अंक कुछ कम आए हैं। $first मेहनती है, '
            'और घर से थोड़े सहयोग से हम मिलकर इसमें ज़रूर सुधार कर सकते हैं।'
            '\n\n'
            'कृपया $first को रोज़ शाम 20 मिनट उस दिन का $subject का पाठ '
            'दोहराने के लिए कहें, और सप्ताह में एक बार कॉपी देख लें। आप किसी '
            'भी कार्यदिवस पर दोपहर 1 बजे के बाद स्कूल आकर मिल सकते हैं।',
      ParentMessageReason.behavioralConcern =>
        'पिछले सप्ताह से कक्षा में $student ($className) का ध्यान पढ़ाई पर '
            'कम रहा है और पाठ के दौरान बातचीत अधिक हो रही है। इससे $first '
            'की और साथियों की पढ़ाई पर असर पड़ रहा है। हमें विश्वास है कि हम '
            'मिलकर इसमें सुधार कर सकते हैं।\n\n'
            'कृपया घर पर $first से प्यार से बात करें कि कक्षा में ध्यान से '
            'सुनना और साथियों का सम्मान करना क्यों ज़रूरी है। इस सप्ताह किसी '
            'दिन थोड़ी देर मिल सकें तो अच्छा रहेगा।',
      ParentMessageReason.positiveFeedback =>
        'आपके साथ एक अच्छी ख़बर साझा करते हुए ख़ुशी हो रही है! $subject में '
            '$student ($className) का प्रदर्शन बहुत अच्छा रहा है। कक्षा में '
            '$first की भागीदारी बहुत सक्रिय रहती है, गृहकार्य समय पर पूरा '
            'होता है, और हाल ही में $first ने एक कठिन पाठ समझने में '
            'साथियों की मदद भी की।\n\n'
            'कृपया हमारी ओर से $first को बधाई दें — घर पर आपका सहयोग साफ़ '
            'दिखाई दे रहा है।',
    };
  } else if (language == 'mr' || language.contains('marathi')) {
    code = 'mr-IN';
    salutation = 'आदरणीय पालक,';
    greeting = '$school मधील $subject शिक्षक $teacher यांच्याकडून नमस्कार.';
    thanks = 'धन्यवाद,';
    body = switch (request.reason) {
      ParentMessageReason.consecutiveAbsences =>
        '$student ($className) गेले $days दिवस शाळेत गैरहजर आहे. वर्गात '
            'सर्वांना $first ची आठवण येत आहे, आणि या दिवसांत $subject चे '
            'काही महत्त्वाचे धडे शिकवले गेले आहेत.\n\n'
            '$first ची तब्येत बरी नसेल किंवा घरी काही अडचण असेल, तर कृपया '
            'आम्हाला कळवा — राहिलेला अभ्यास पूर्ण करण्यासाठी पूर्ण मदत केली '
            'जाईल. कृपया उद्यापासून $first ला शाळेत पाठवा, किंवा फोनवर '
            'बोलण्यासाठी संपर्क करा.',
      ParentMessageReason.poorPerformance =>
        'अलीकडील वर्ग चाचण्यांमध्ये $student ($className) ला $subject मधील '
            'काही धडे अवघड वाटले आणि गुण थोडे कमी आले आहेत. $first मेहनती '
            'आहे, आणि घरून थोडी साथ मिळाल्यास आपण मिळून नक्की सुधारणा करू '
            'शकतो.\n\n'
            'कृपया $first ला रोज संध्याकाळी 20 मिनिटे त्या दिवसाचा '
            '$subject चा धडा उजळणी करायला सांगा, आणि आठवड्यातून एकदा वही '
            'तपासा. कोणत्याही कामाच्या दिवशी दुपारी 1 नंतर आपण शाळेत भेटू '
            'शकता.',
      ParentMessageReason.behavioralConcern =>
        'गेल्या आठवड्यापासून वर्गात $student ($className) चे अभ्यासाकडे लक्ष '
            'कमी आहे आणि तासाला बोलणे जास्त होत आहे. याचा $first च्या आणि '
            'वर्गमित्रांच्या अभ्यासावर परिणाम होत आहे. आपण मिळून यात नक्की '
            'सुधारणा करू शकतो, याची खात्री आहे.\n\n'
            'कृपया घरी $first शी प्रेमाने बोला — वर्गात लक्षपूर्वक ऐकणे आणि '
            'मित्रांचा आदर करणे का महत्त्वाचे आहे. या आठवड्यात थोडा वेळ भेटता '
            'आले तर बरे होईल.',
      ParentMessageReason.positiveFeedback =>
        'आपल्याला एक आनंदाची बातमी सांगताना खूप आनंद होत आहे! $subject मध्ये '
            '$student ($className) ची प्रगती खूप छान आहे. वर्गातील $first '
            'चा सहभाग उत्साही असतो, गृहपाठ वेळेवर पूर्ण होतो, आणि नुकतीच '
            '$first ने एक अवघड धडा समजून घेण्यासाठी वर्गमित्रांना मदत केली.'
            '\n\n'
            'कृपया आमच्याकडून $first चे अभिनंदन करा — घरी मिळणारी आपली साथ '
            'स्पष्टपणे दिसत आहे.',
    };
  } else {
    code = 'en-IN';
    salutation = 'Dear Parent,';
    greeting = 'Namaste from $teacher, $subject teacher at $school.';
    thanks = 'Thank you,';
    body = switch (request.reason) {
      ParentMessageReason.consecutiveAbsences =>
        '$student ($className) has been absent from school for the last '
            '$days days. We miss $first in class, and some important '
            '$subject lessons have been covered during this time.\n\n'
            'If $first is unwell or there is any difficulty at home, please '
            'let me know — I will help $first catch up on the missed work. '
            'Kindly send $first to school from tomorrow, or call me at any '
            'time to talk.',
      ParentMessageReason.poorPerformance =>
        "I am writing about $student's progress in $subject ($className). In "
            'the recent class tests, $first has found some topics difficult '
            'and the marks have dropped a little. $first works hard, and '
            'with some support at home we can improve this together.\n\n'
            'Please ask $first to spend 20 minutes each evening revising '
            "the day's $subject lesson, and look at the notebook once a week. "
            'You are welcome to meet me on any working day after 1 pm.',
      ParentMessageReason.behavioralConcern =>
        "I would like to share a concern about $student's behaviour in "
            '$className. Over the past week, $first has found it hard to '
            'settle down and has been talking during lessons, which affects '
            "both $first's learning and that of classmates. I am sure we "
            'can improve this together.\n\n'
            'Please talk gently with $first at home about listening in '
            'class and respecting classmates. I would also like to meet you '
            'briefly this week.',
      ParentMessageReason.positiveFeedback =>
        'I am happy to share some good news! $student ($className) has been '
            'doing very well in $subject — taking part actively, completing '
            'homework on time, and recently helping classmates understand a '
            'difficult topic.\n\n'
            'Please congratulate $first from our side. Your support at home '
            'is clearly making a difference.',
    };
  }

  final message = '$salutation\n$greeting\n\n$body\n\n$thanks\n$teacher';
  final spoken = '$greeting $body'.replaceAll(RegExp(r'\s*\n+\s*'), ' ');
  return ParentMessage(
    message: message,
    spokenScript: spoken,
    languageCode: code,
    wordCount: message.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).length,
  );
}
