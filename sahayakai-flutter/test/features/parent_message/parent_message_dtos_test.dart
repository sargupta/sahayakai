import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/features/parent_message/data/parent_message_dtos.dart';
import 'package:sahayakai/features/parent_message/domain/parent_message.dart';

/// The wire contract for `POST /api/ai/parent-message`, pinned against the
/// backend's `ParentMessageInputSchema` / `ParentMessageOutputSchema` + route
/// handler in `sahayakai-main` (verified against
/// `src/app/api/ai/parent-message/route.ts` and
/// `src/ai/flows/parent-message-generator.ts`). If the client ever drifts from
/// the endpoint's field names, the reason enum, or the returned shape, these
/// fail first.
void main() {
  ParentMessageRequest request({
    ParentMessageReason reason = ParentMessageReason.poorPerformance,
    String parentLanguage = 'Tamil',
    String? reasonContext,
    String? teacherNote,
    int? consecutiveAbsentDays,
    String? teacherName,
    String? schoolName,
  }) {
    return ParentMessageRequest(
      studentName: '  Ravi Kumar  ',
      className: '  Class 6A  ',
      subject: '  Mathematics  ',
      reason: reason,
      parentLanguage: parentLanguage,
      reasonContext: reasonContext,
      teacherNote: teacherNote,
      consecutiveAbsentDays: consecutiveAbsentDays,
      teacherName: teacherName,
      schoolName: schoolName,
    );
  }

  group('ParentMessageReason enum', () {
    test('wire values match the backend Zod enum exactly', () {
      // z.enum(['consecutive_absences','poor_performance',
      //         'behavioral_concern','positive_feedback'])
      expect(
        ParentMessageReason.values.map((r) => r.wire).toList(),
        <String>[
          'consecutive_absences',
          'poor_performance',
          'behavioral_concern',
          'positive_feedback',
        ],
      );
    });

    test('only the absence reason flags the absent-days field', () {
      expect(ParentMessageReason.consecutiveAbsences.isAbsence, isTrue);
      expect(ParentMessageReason.poorPerformance.isAbsence, isFalse);
      expect(ParentMessageReason.behavioralConcern.isAbsence, isFalse);
      expect(ParentMessageReason.positiveFeedback.isAbsence, isFalse);
    });
  });

  group('ParentMessageRequestDto', () {
    test('serializes the five required fields with the exact endpoint names',
        () {
      final json = ParentMessageRequestDto.fromDomain(request()).toJson();

      expect(json['studentName'], 'Ravi Kumar'); // trimmed
      expect(json['className'], 'Class 6A');
      expect(json['subject'], 'Mathematics');
      expect(json['reason'], 'poor_performance'); // enum -> wire token
      expect(json['parentLanguage'], 'Tamil'); // full English name, not a code
    });

    test('parentLanguage is the AppLocale.aiName, not the code', () {
      final json = ParentMessageRequestDto.fromDomain(
        request(parentLanguage: AppLocale.bn.aiName),
      ).toJson();
      expect(json['parentLanguage'], 'Bengali');
    });

    test('never sends server-injected fields', () {
      // The route parses `{ ...body, userId, performanceSummary }`, with userId
      // from the verified token and performanceSummary derived server-side from
      // performanceContext. A client that sent any of these would be wrong and a
      // trust-boundary hole.
      final json = ParentMessageRequestDto.fromDomain(request()).toJson();
      for (final field in [
        'userId',
        'user_id',
        'performanceContext',
        'performanceSummary',
      ]) {
        expect(
          json.containsKey(field),
          isFalse,
          reason: '$field is server-injected and must never be sent',
        );
      }
    });

    test('omits blank optionals instead of sending explicit nulls', () {
      final json = ParentMessageRequestDto.fromDomain(
        request(reasonContext: '   ', teacherNote: '', schoolName: '  '),
      ).toJson();

      expect(json.keys.toSet(), {
        'studentName',
        'className',
        'subject',
        'reason',
        'parentLanguage',
      });
    });

    test('sends the optional fields when the teacher fills them', () {
      final json = ParentMessageRequestDto.fromDomain(
        request(
          reasonContext: '  Missed two weeks of fractions  ',
          teacherNote: 'Strong in group work',
          teacherName: 'Mrs. Rao',
          schoolName: 'Green Valley School',
        ),
      ).toJson();

      expect(json['reasonContext'], 'Missed two weeks of fractions'); // trimmed
      expect(json['teacherNote'], 'Strong in group work');
      expect(json['teacherName'], 'Mrs. Rao');
      expect(json['schoolName'], 'Green Valley School');
    });

    test('consecutiveAbsentDays is sent ONLY for an absence message', () {
      final absence = ParentMessageRequestDto.fromDomain(
        request(
          reason: ParentMessageReason.consecutiveAbsences,
          consecutiveAbsentDays: 3,
        ),
      ).toJson();
      expect(absence['consecutiveAbsentDays'], 3);

      // The same count on a non-absence reason is dropped (it is meaningless
      // there, and the backend ignores it).
      final performance = ParentMessageRequestDto.fromDomain(
        request(
          reason: ParentMessageReason.poorPerformance,
          consecutiveAbsentDays: 3,
        ),
      ).toJson();
      expect(performance.containsKey('consecutiveAbsentDays'), isFalse);
    });
  });

  group('ParentMessageResponseDto', () {
    test('decodes the three keys the route responds with', () {
      final message = ParentMessageResponseDto.fromJson(<String, dynamic>{
        'message': 'Dear parent, ...',
        'languageCode': 'ta-IN',
        'wordCount': 42,
      }).toDomain();

      expect(message.message, 'Dear parent, ...');
      expect(message.languageCode, 'ta-IN');
      expect(message.wordCount, 42);
      expect(message.isEmpty, isFalse);
    });

    test('a numeric wordCount that arrives as a double is floored to an int',
        () {
      final message = ParentMessageResponseDto.fromJson(<String, dynamic>{
        'message': 'x',
        'wordCount': 42.0,
      }).toDomain();
      expect(message.wordCount, 42);
      expect(message.wordCount, isA<int>());
    });

    test('a blank message decodes to an empty result', () {
      final message = ParentMessageResponseDto.fromJson(<String, dynamic>{
        'message': '   ',
      }).toDomain();
      expect(message.isEmpty, isTrue);
      expect(message.languageCode, isNull);
      expect(message.wordCount, isNull);
    });

    test('an entirely empty payload decodes to an empty result', () {
      final message =
          ParentMessageResponseDto.fromJson(const <String, dynamic>{})
              .toDomain();
      expect(message.isEmpty, isTrue);
      expect(message.message, isEmpty);
      expect(message.languageCode, isNull);
      expect(message.wordCount, isNull);
    });
  });
}
