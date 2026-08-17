import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/features/teacher_training/data/teacher_training_dtos.dart';
import 'package:sahayakai/features/teacher_training/domain/teacher_advice.dart';

/// The wire contract for `POST /api/ai/teacher-training`, pinned against the
/// backend's `TeacherTrainingInputSchema` / `TeacherTrainingOutputSchema` +
/// route handler in `sahayakai-main` (verified against `route.ts` and
/// `src/ai/flows/teacher-training.ts`). If the client ever drifts from the
/// endpoint's field names or the returned shape, these fail first.
void main() {
  group('TeacherTrainingRequestDto', () {
    test('serializes every field with the exact names the endpoint pins', () {
      final json = TeacherTrainingRequestDto.fromDomain(
        TeacherTrainingRequest(
          question: '  How do I manage a class of 40?  ',
          subject: 'General',
          language: AppLocale.kn.aiName,
        ),
      ).toJson();

      expect(json, {
        'question': 'How do I manage a class of 40?', // trimmed
        'subject': 'General',
        'language': 'Kannada', // AppLocale.aiName, not the code
      });
    });

    test('never sends server-injected fields', () {
      // The route parses `{ ...json, userId }`, with userId taken from the
      // verified token's x-user-id header; a client that sent its own would be
      // both wrong and a trust-boundary hole.
      final json = TeacherTrainingRequestDto.fromDomain(
        const TeacherTrainingRequest(question: 'A question'),
      ).toJson();

      for (final field in ['userId', 'user_id', 'teacherContext', 'plan']) {
        expect(
          json.containsKey(field),
          isFalse,
          reason: '$field is server-injected and must never be sent',
        );
      }
    });

    test('never sends a gradeLevel key (the input schema has none)', () {
      // TeacherTrainingInputSchema is { question, language?, subject?, userId }.
      // There is no gradeLevel input — the model infers it — so the request DTO
      // must not model or send one.
      final json = TeacherTrainingRequestDto.fromDomain(
        const TeacherTrainingRequest(
          question: 'A question',
          subject: 'Science',
        ),
      ).toJson();

      expect(json.containsKey('gradeLevel'), isFalse);
      expect(json.keys.toSet(), {'question', 'subject'});
    });

    test('omits blank optionals instead of sending explicit nulls', () {
      final json = TeacherTrainingRequestDto.fromDomain(
        const TeacherTrainingRequest(
          question: 'A question',
          subject: '   ',
          language: '',
        ),
      ).toJson();

      expect(json, {'question': 'A question'});
    });

    test('question is the only required field', () {
      final json = TeacherTrainingRequestDto.fromDomain(
        const TeacherTrainingRequest(question: 'Q'),
      ).toJson();
      expect(json.keys, ['question']);
    });
  });

  group('TeacherTrainingResponseDto', () {
    test('decodes the five keys the route responds with', () {
      final advice = TeacherTrainingResponseDto.fromJson(<String, dynamic>{
        'introduction': 'A fair challenge.',
        'advice': [
          {
            'strategy': 'Use think-pair-share.',
            'pedagogy': 'Social Constructivism',
            'explanation': 'Dialogue builds understanding.',
          },
          {
            'strategy': 'Scaffold each step.',
            'pedagogy': 'Scaffolding',
            'explanation': 'Support until independence.',
          },
        ],
        'conclusion': 'Keep going.',
        'gradeLevel': 'Class 8',
        'subject': 'General',
      }).toDomain();

      expect(advice.introduction, 'A fair challenge.');
      expect(advice.conclusion, 'Keep going.');
      expect(advice.gradeLevel, 'Class 8');
      expect(advice.subject, 'General');
      expect(advice.isEmpty, isFalse);

      expect(advice.advice, hasLength(2));
      final first = advice.advice.first;
      expect(first.strategy, 'Use think-pair-share.');
      expect(first.pedagogy, 'Social Constructivism');
      expect(first.explanation, 'Dialogue builds understanding.');
    });

    test('an entirely empty payload decodes to an empty result', () {
      final advice = TeacherTrainingResponseDto.fromJson(
        const <String, dynamic>{},
      ).toDomain();

      expect(advice.isEmpty, isTrue);
      expect(advice.introduction, isEmpty);
      expect(advice.advice, isEmpty);
      expect(advice.conclusion, isEmpty);
      expect(advice.gradeLevel, isNull);
      expect(advice.subject, isNull);
    });

    test('tolerates an empty advice list and a missing conclusion', () {
      final advice = TeacherTrainingResponseDto.fromJson(<String, dynamic>{
        'introduction': 'Only an introduction came back.',
        'advice': <dynamic>[],
        // no conclusion key
      }).toDomain();

      expect(advice.introduction, 'Only an introduction came back.');
      expect(advice.advice, isEmpty);
      expect(advice.conclusion, isEmpty);
      // Introduction alone is still usable content.
      expect(advice.isEmpty, isFalse);
    });

    test('drops advice points with no strategy and no explanation', () {
      final advice = TeacherTrainingResponseDto.fromJson(<String, dynamic>{
        'introduction': 'Intro.',
        'advice': [
          {
            'strategy': '  ',
            'pedagogy': 'Nothing',
            'explanation': '  ',
          }, // dropped
          {'strategy': 'A real strategy.', 'pedagogy': '', 'explanation': ''},
          {'strategy': '', 'pedagogy': 'X', 'explanation': 'A real why.'},
        ],
        'conclusion': 'End.',
      }).toDomain();

      expect(advice.advice, hasLength(2));
      // A point with only a strategy is kept; its blank pedagogy is tolerated.
      expect(advice.advice[0].strategy, 'A real strategy.');
      expect(advice.advice[0].pedagogy, isEmpty);
      expect(advice.advice[0].explanation, isEmpty);
      // A point with only an explanation is kept too.
      expect(advice.advice[1].strategy, isEmpty);
      expect(advice.advice[1].explanation, 'A real why.');
    });

    test('trims blank metadata to null and blank prose to empty', () {
      final advice = TeacherTrainingResponseDto.fromJson(<String, dynamic>{
        'introduction': '  Intro.  ',
        'advice': <dynamic>[],
        'conclusion': '   ',
        'gradeLevel': '   ',
        'subject': '',
      }).toDomain();

      expect(advice.introduction, 'Intro.');
      expect(advice.conclusion, isEmpty);
      expect(advice.gradeLevel, isNull);
      expect(advice.subject, isNull);
    });
  });
}
