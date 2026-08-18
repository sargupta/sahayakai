import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/assess_assignment/data/assess_assignment_repository.dart';
import 'package:sahayakai/features/assess_assignment/domain/assessment.dart';
import 'package:sahayakai/features/instant_answer/data/instant_answer_repository.dart';
import 'package:sahayakai/features/instant_answer/domain/instant_answer.dart';
import 'package:sahayakai/features/quiz_generator/data/quiz_repository.dart';
import 'package:sahayakai/features/quiz_generator/domain/quiz.dart';
import 'package:sahayakai/features/rubric_generator/data/rubric_repository.dart';
import 'package:sahayakai/features/rubric_generator/domain/rubric.dart';
import 'package:sahayakai/features/teacher_training/data/teacher_training_repository.dart';
import 'package:sahayakai/features/teacher_training/domain/teacher_advice.dart';
import 'package:sahayakai/features/virtual_field_trip/data/virtual_field_trip_repository.dart';
import 'package:sahayakai/features/virtual_field_trip/domain/virtual_field_trip.dart';

import '../support/app_harness.dart';
import '../support/fake_api_client.dart';

/// Data-layer gates for the six `Save to Library` actions the ResultActionsBar
/// rollout added (quiz, instant answer, rubric, teacher training, assessment,
/// virtual field trip).
///
/// EACH ONE IS PINNED AGAINST THE BACKEND WRITER IT MIRRORS, not against itself:
/// `POST /api/content/save` validates its body with `SaveContentSchema`, whose
/// `type` is a CLOSED enum (`ContentTypeSchema` in
/// `sahayakai-main/src/ai/schemas/content-schemas.ts`) and whose `id` must be a
/// real UUID — so a wrong type string or a hand-rolled hex id is a 400 in
/// production and nothing else here would catch it. The title/topic/default
/// rules likewise mirror each flow's own `dbAdapter.saveContent` call, so a
/// mobile save and a server-side save land as the same Library row.
///
/// The `ApiClient` is a double: an un-faked call in a unit test fires a live
/// request at production.
void main() {
  ProviderContainer containerWith(FakeApiClient client) {
    final container = ProviderContainer(overrides: [apiClientOverride(client)]);
    addTearDown(container.dispose);
    return container;
  }

  FakeApiClient okClient(String id) =>
      FakeApiClient(postResponse: <String, dynamic>{'success': true, 'id': id});

  Map<String, dynamic> bodyOf(FakeApiClient client) {
    expect(client.posts.single.path, '/api/content/save');
    return client.posts.single.data! as Map<String, dynamic>;
  }

  /// `SaveContentSchema.id` is `z.string().uuid()`; anything else is a 400.
  void expectUuid(Object? id) {
    expect(
      id,
      matches(
        RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
        ),
      ),
    );
  }

  group('QuizRepository.save', () {
    const quiz = Quiz(
      variants: <QuizVariant>[],
      gradeLevel: 'Class 6',
      subject: 'Science',
      topic: 'Photosynthesis',
      raw: <String, dynamic>{
        'easy': <String, dynamic>{'title': 'Photosynthesis'},
        'gradeLevel': 'Class 6',
      },
    );

    test('POSTs the quiz envelope verbatim under type "quiz"', () async {
      final client = okClient('quiz-1');
      final container = containerWith(client);

      final id = await container
          .read(quizRepositoryProvider)
          .save(
            quiz: quiz,
            request: const QuizRequest(
              topic: 'Photosynthesis',
              questionTypes: <QuestionType>[QuestionType.multipleChoice],
              gradeLevel: 'Class 5',
              subject: 'General',
              language: 'Bengali',
            ),
          );

      expect(id, 'quiz-1');
      final body = bodyOf(client);
      expect(body['type'], 'quiz');
      expect(body['title'], 'Photosynthesis');
      expect(body['topic'], 'Photosynthesis');
      // The model's own metadata wins over the request's, as the flow does.
      expect(body['gradeLevel'], 'Class 6');
      expect(body['subject'], 'Science');
      expect(body['language'], 'Bengali');
      expect(body['isPublic'], false);
      expect(body['isDraft'], false);
      // The multi-variant envelope, not a re-serialized domain object.
      expect(body['data'], quiz.raw);
      expectUuid(body['id']);
    });

    test('falls back to the flow defaults when the model omits them', () async {
      final client = okClient('quiz-2');
      final container = containerWith(client);

      await container
          .read(quizRepositoryProvider)
          .save(
            quiz: const Quiz(raw: <String, dynamic>{'easy': null}),
            request: const QuizRequest(
              topic: '',
              questionTypes: <QuestionType>[QuestionType.shortAnswer],
            ),
          );

      final body = bodyOf(client);
      expect(body['title'], 'Quiz');
      expect(body['gradeLevel'], 'Class 5');
      expect(body['subject'], 'General');
      expect(body['language'], 'English');
    });
  });

  group('InstantAnswerRepository.save', () {
    test('titles and topics the row with the teacher\'s question', () async {
      final client = okClient('ans-1');
      final container = containerWith(client);
      const answer = InstantAnswer(
        answer: 'Because the atmosphere scatters blue light.',
        gradeLevel: 'Class 7',
        raw: <String, dynamic>{'answer': 'Because …'},
      );

      final id = await container
          .read(instantAnswerRepositoryProvider)
          .save(
            answer: answer,
            request: const InstantAnswerRequest(
              question: 'Why is the sky blue?',
              subject: 'Science',
              language: 'Tamil',
            ),
          );

      expect(id, 'ans-1');
      final body = bodyOf(client);
      expect(body['type'], 'instant-answer');
      // The Library re-titles a saved answer from `title`, so both carry it.
      expect(body['title'], 'Why is the sky blue?');
      expect(body['topic'], 'Why is the sky blue?');
      expect(body['gradeLevel'], 'Class 7');
      expect(body['subject'], 'Science');
      expect(body['language'], 'Tamil');
      expect(body['data'], answer.raw);
      expectUuid(body['id']);
    });
  });

  group('RubricRepository.save', () {
    test('prefers the model title, else "Rubric: {assignment}"', () async {
      final client = okClient('rub-1');
      final container = containerWith(client);

      await container
          .read(rubricRepositoryProvider)
          .save(
            rubric: const Rubric(
              title: '',
              raw: <String, dynamic>{'criteria': <dynamic>[]},
            ),
            request: const RubricRequest(
              assignmentDescription: 'Class 8 essay on monsoons',
            ),
          );

      final body = bodyOf(client);
      expect(body['type'], 'rubric');
      expect(body['title'], 'Rubric: Class 8 essay on monsoons');
      expect(body['topic'], 'Class 8 essay on monsoons');
      expect(body['gradeLevel'], 'Class 5');
      expect(body['subject'], 'General');
    });
  });

  group('TeacherTrainingRepository.save', () {
    test('mirrors the flow\'s clipped "Advice: …" title', () async {
      final client = okClient('tt-1');
      final container = containerWith(client);
      const longQuestion =
          'How do I keep a multi-grade classroom of forty children engaged '
          'when I only have one blackboard?';

      await container
          .read(teacherTrainingRepositoryProvider)
          .save(
            advice: const TeacherAdvice(
              introduction: 'i',
              conclusion: 'c',
              raw: <String, dynamic>{'introduction': 'i'},
            ),
            request: const TeacherTrainingRequest(question: longQuestion),
          );

      final body = bodyOf(client);
      expect(body['type'], 'teacher-training');
      // 50 characters of the question, then the flow's literal ellipsis.
      expect(body['title'], 'Advice: ${longQuestion.substring(0, 50)}...');
      // The topic keeps the WHOLE question — only the title is clipped.
      expect(body['topic'], longQuestion);
      expect(body['gradeLevel'], 'Class 5');
    });
  });

  group('AssessAssignmentRepository.save', () {
    test('takes grade and subject off the attached rubric', () async {
      final client = okClient('as-1');
      final container = containerWith(client);

      await container
          .read(assessAssignmentRepositoryProvider)
          .save(
            assessment: const Assessment(
              overallScore: 82,
              rubric: AssessmentRubric(
                title: 'Monsoon essay rubric',
                gradeLevel: 'Class 8',
                subject: 'Geography',
              ),
              raw: <String, dynamic>{'overallScore': 82},
            ),
            request: const AssessAssignmentRequest(
              imageDataUri: 'data:image/png;base64,AAA',
              language: 'Hindi',
            ),
          );

      final body = bodyOf(client);
      expect(body['type'], 'assessment');
      // No trailing ".0" on a whole-number score.
      expect(body['title'], 'Assessment: Geography (82%)');
      expect(body['topic'], 'Monsoon essay rubric');
      expect(body['gradeLevel'], 'Class 8');
      expect(body['subject'], 'Geography');
      expect(body['language'], 'Hindi');
    });

    test('a rubric-less transcribe run still produces a valid body', () async {
      final client = okClient('as-2');
      final container = containerWith(client);

      await container
          .read(assessAssignmentRepositoryProvider)
          .save(
            assessment: const Assessment(raw: <String, dynamic>{}),
            request: const AssessAssignmentRequest(
              imageDataUri: 'data:image/png;base64,AAA',
            ),
          );

      final body = bodyOf(client);
      // No score, so no "(nn%)" suffix invented.
      expect(body['title'], 'Assessment: Assignment');
      expect(body['topic'], 'Handwritten assignment');
      expect(body['gradeLevel'], 'Class 5');
      expect(body['subject'], 'General');
      expect(body['language'], 'English');
    });
  });

  group('VirtualFieldTripRepository.save', () {
    test('uses the geography default the flow uses', () async {
      final client = okClient('vft-1');
      final container = containerWith(client);

      await container
          .read(virtualFieldTripRepositoryProvider)
          .save(
            trip: const FieldTrip(
              title: '',
              stops: <FieldTripStop>[],
              gradeLevel: '',
              subject: '',
              raw: <String, dynamic>{'stops': <dynamic>[]},
            ),
            request: const VirtualFieldTripRequest(topic: 'The Sundarbans'),
          );

      final body = bodyOf(client);
      expect(body['type'], 'virtual-field-trip');
      expect(body['title'], 'Trip: The Sundarbans');
      expect(body['topic'], 'The Sundarbans');
      expect(body['gradeLevel'], 'Class 5');
      expect(body['subject'], 'Geography');
    });
  });

  test('a failed save surfaces as the typed exception, not a silent null', () {
    final container = containerWith(
      FakeApiClient(
        postError: const ApiException(
          ApiErrorKind.server,
          'down',
          statusCode: 500,
        ),
      ),
    );

    expectLater(
      container
          .read(rubricRepositoryProvider)
          .save(
            rubric: const Rubric(title: 't', raw: <String, dynamic>{}),
            request: const RubricRequest(assignmentDescription: 'x'),
          ),
      throwsA(isA<ApiException>()),
    );
  });
}
