import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/features/instant_answer/data/instant_answer_dtos.dart';
import 'package:sahayakai/features/instant_answer/domain/instant_answer.dart';

/// The wire contract for `POST /api/ai/instant-answer`, pinned against
/// `docs/flutter/SCREEN_INVENTORY.md` §P0.6 and the backend's
/// `InstantAnswerInputSchema` / `InstantAnswerOutputSchema` in
/// `src/ai/flows/instant-answer.ts`. If the client ever drifts from the
/// endpoint's field names or casing, these fail first.
void main() {
  group('InstantAnswerRequestDto', () {
    test('serializes every field with the exact names SCREEN_INVENTORY pins',
        () {
      final json = InstantAnswerRequestDto.fromDomain(
        InstantAnswerRequest(
          question: '  What is photosynthesis?  ',
          gradeLevel: 'Class 5',
          subject: 'Science',
          language: AppLocale.kn.aiName,
        ),
      ).toJson();

      expect(json, {
        'question': 'What is photosynthesis?', // trimmed
        'gradeLevel': 'Class 5',
        'subject': 'Science',
        'language': 'Kannada', // AppLocale.aiName, not the code
      });
    });

    test('never sends server-injected fields', () {
      // The route parses `{...json, userId}` with userId taken from the
      // verified token's x-user-id header. A client that sent its own would be
      // both wrong and a trust-boundary hole.
      final json = InstantAnswerRequestDto.fromDomain(
        const InstantAnswerRequest(question: 'Why is the sky blue?'),
      ).toJson();

      for (final field in ['userId', 'user_id', 'teacherContext', 'plan']) {
        expect(
          json.containsKey(field),
          isFalse,
          reason: '$field is server-injected and must never be sent',
        );
      }
    });

    test('omits blank optionals instead of sending explicit nulls', () {
      // The flow back-fills language/grade from the profile for absent keys;
      // an explicit null is a different (and wrong) request.
      final json = InstantAnswerRequestDto.fromDomain(
        const InstantAnswerRequest(
          question: 'What is a fraction?',
          gradeLevel: '   ',
          subject: '',
        ),
      ).toJson();

      expect(json, {'question': 'What is a fraction?'});
    });

    test('question is the only required field', () {
      final json = InstantAnswerRequestDto.fromDomain(
        const InstantAnswerRequest(question: 'Q'),
      ).toJson();
      expect(json.keys, ['question']);
    });
  });

  group('InstantAnswerResponseDto', () {
    test('decodes the four keys the route responds with', () {
      final answer = InstantAnswerResponseDto.fromJson(<String, dynamic>{
        'answer': 'Plants make food from sunlight.',
        'videoSuggestionUrl': 'https://www.youtube.com/watch?v=abc',
        'gradeLevel': 'Class 5',
        'subject': 'Science',
      }).toDomain();

      expect(answer.answer, 'Plants make food from sunlight.');
      expect(answer.videoSuggestionUrl.toString(),
          'https://www.youtube.com/watch?v=abc');
      expect(answer.gradeLevel, 'Class 5');
      expect(answer.subject, 'Science');
      expect(answer.hasAnswer, isTrue);
    });

    test('a null videoSuggestionUrl decodes to null, not a crash', () {
      // The field is `.nullable().optional()` on the flow's output schema, so
      // null is the common case, not the exception.
      final answer = InstantAnswerResponseDto.fromJson(<String, dynamic>{
        'answer': 'An answer.',
        'videoSuggestionUrl': null,
        'gradeLevel': null,
        'subject': null,
      }).toDomain();

      expect(answer.videoSuggestionUrl, isNull);
      expect(answer.gradeLevel, isNull);
      expect(answer.subject, isNull);
      expect(answer.hasAnswer, isTrue);
    });

    test('an absent videoSuggestionUrl key decodes to null', () {
      final answer = InstantAnswerResponseDto.fromJson(
        const <String, dynamic>{'answer': 'An answer.'},
      ).toDomain();
      expect(answer.videoSuggestionUrl, isNull);
    });

    test('tolerates an empty payload', () {
      final answer =
          InstantAnswerResponseDto.fromJson(const <String, dynamic>{}).toDomain();

      expect(answer.answer, '');
      expect(answer.hasAnswer, isFalse);
      expect(answer.videoSuggestionUrl, isNull);
    });

    test('a blank answer reads as no answer', () {
      for (final blank in ['', '   ', '\n\n']) {
        final answer = InstantAnswerResponseDto.fromJson(
          <String, dynamic>{'answer': blank},
        ).toDomain();
        expect(answer.hasAnswer, isFalse, reason: 'blank: "$blank"');
      }
    });

    test('trims blank metadata to null', () {
      final answer = InstantAnswerResponseDto.fromJson(<String, dynamic>{
        'answer': '  Answer.  ',
        'gradeLevel': '   ',
        'subject': '',
      }).toDomain();

      expect(answer.answer, 'Answer.');
      expect(answer.gradeLevel, isNull);
      expect(answer.subject, isNull);
    });

    group('videoSuggestionUrl is untrusted model output', () {
      test('drops any non-http(s) scheme before it can reach a launcher', () {
        // The URL is LLM-generated and gets handed to the OS, so anything that
        // is not an absolute http(s) URL with a host must never render a card.
        const hostile = <String>[
          'javascript:alert(1)',
          'file:///etc/passwd',
          'intent://scan/#Intent;scheme=zxing;end',
          'data:text/html,<script>x</script>',
          'ftp://example.com/f',
        ];
        for (final url in hostile) {
          final answer = InstantAnswerResponseDto.fromJson(
            <String, dynamic>{'answer': 'A', 'videoSuggestionUrl': url},
          ).toDomain();
          expect(answer.videoSuggestionUrl, isNull, reason: url);
        }
      });

      test('drops relative and host-less junk', () {
        for (final url in ['/watch?v=abc', 'not a url', '#fragment', 'https://']) {
          final answer = InstantAnswerResponseDto.fromJson(
            <String, dynamic>{'answer': 'A', 'videoSuggestionUrl': url},
          ).toDomain();
          expect(answer.videoSuggestionUrl, isNull, reason: url);
        }
      });

      test('keeps plain http as well as https', () {
        final answer = InstantAnswerResponseDto.fromJson(
          <String, dynamic>{
            'answer': 'A',
            'videoSuggestionUrl': 'http://youtu.be/abc',
          },
        ).toDomain();
        expect(answer.videoSuggestionUrl?.scheme, 'http');
      });
    });
  });
}
