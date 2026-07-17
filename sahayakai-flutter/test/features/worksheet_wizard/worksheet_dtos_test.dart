import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/features/worksheet_wizard/data/worksheet_dtos.dart';
import 'package:sahayakai/features/worksheet_wizard/domain/worksheet.dart';

/// The wire contract for `POST /api/ai/worksheet`, pinned against the backend's
/// `WorksheetWizardInputSchema` / route in `sahayakai-main`. If the client ever
/// drifts from the endpoint's field names, casing or enum members, these fail
/// first.
void main() {
  group('WorksheetRequestDto', () {
    test('serializes every field with the exact names the endpoint pins', () {
      final json = WorksheetRequestDto.fromDomain(
        WorksheetRequest(
          imageDataUri: 'data:image/jpeg;base64,AAAA',
          prompt: '  Create a multiplication worksheet  ',
          gradeLevel: 'Class 4',
          subject: 'Mathematics',
          language: AppLocale.kn.aiName,
        ),
      ).toJson();

      expect(json, {
        'imageDataUri': 'data:image/jpeg;base64,AAAA',
        'prompt': 'Create a multiplication worksheet', // trimmed
        'gradeLevel': 'Class 4',
        'subject': 'Mathematics',
        'language': 'Kannada', // AppLocale.aiName, not the code
      });
    });

    test('sends the image data URI verbatim under the imageDataUri key', () {
      // The server validates the URI's exact length, so it must not be trimmed
      // or re-encoded on the way out.
      const uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEA';
      final json = WorksheetRequestDto.fromDomain(
        const WorksheetRequest(imageDataUri: uri, prompt: 'A worksheet'),
      ).toJson();

      expect(json['imageDataUri'], uri);
    });

    test('never sends server-injected fields', () {
      // Middleware injects userId + teacherContext from the verified Firebase
      // token; a client that sent its own would be both wrong and a
      // trust-boundary hole.
      final json = WorksheetRequestDto.fromDomain(
        const WorksheetRequest(
          imageDataUri: 'data:image/jpeg;base64,AAAA',
          prompt: 'A worksheet',
        ),
      ).toJson();

      for (final field in ['userId', 'teacherContext']) {
        expect(
          json.containsKey(field),
          isFalse,
          reason: '$field is server-injected and must never be sent',
        );
      }
    });

    test('omits blank optionals instead of sending explicit nulls', () {
      final json = WorksheetRequestDto.fromDomain(
        const WorksheetRequest(
          imageDataUri: 'data:image/jpeg;base64,AAAA',
          prompt: 'A worksheet',
          gradeLevel: '   ',
          subject: '',
        ),
      ).toJson();

      expect(json, {
        'imageDataUri': 'data:image/jpeg;base64,AAAA',
        'prompt': 'A worksheet',
      });
    });
  });

  group('WorksheetActivityType', () {
    test('maps every member to its wire value', () {
      expect(
        WorksheetActivityType.values.map((t) => t.wire),
        ['question', 'puzzle', 'creative_task'],
      );
    });

    test('tolerates unknown / absent members rather than throwing', () {
      expect(WorksheetActivityType.fromWire('martian_task'), isNull);
      expect(WorksheetActivityType.fromWire(null), isNull);
      expect(
        WorksheetActivityType.fromWire('creative_task'),
        WorksheetActivityType.creativeTask,
      );
    });
  });

  group('WorksheetResponseDto', () {
    test('decodes the route shape: learningObjectives, activities, answerKey',
        () {
      // NOTE the field name is `learningObjectives`, NOT the `objectives`
      // SCREEN_INVENTORY P1.1 prints (see docs/flutter/HANDOFF.md).
      final worksheet = WorksheetResponseDto.fromJson(<String, dynamic>{
        'title': 'Counting Mangoes',
        'gradeLevel': 'Class 2',
        'subject': 'Mathematics',
        'learningObjectives': ['Count up to 20', 'Group to add'],
        'studentInstructions': 'Solve each problem.',
        'activities': [
          {
            'type': 'question',
            'content': r'$5 + 3 = ?$',
            'explanation': 'Local fruit analogy.',
            'chalkboardNote': 'Draw two baskets.',
          },
          {
            'type': 'creative_task',
            'content': 'Draw a paddy field.',
            'explanation': 'Builds observation.',
          },
        ],
        'answerKey': [
          {'activityIndex': 0, 'answer': r'$8$'},
          {'activityIndex': 1, 'answer': 'Any labelled drawing'},
        ],
      }).toDomain();

      expect(worksheet.title, 'Counting Mangoes');
      expect(worksheet.gradeLevel, 'Class 2');
      expect(worksheet.subject, 'Mathematics');
      expect(worksheet.learningObjectives, ['Count up to 20', 'Group to add']);
      expect(worksheet.studentInstructions, 'Solve each problem.');

      expect(worksheet.activities, hasLength(2));
      final first = worksheet.activities.first;
      expect(first.type, WorksheetActivityType.question);
      expect(first.content, r'$5 + 3 = ?$');
      expect(first.explanation, 'Local fruit analogy.');
      expect(first.chalkboardNote, 'Draw two baskets.');
      // A missing chalkboardNote stays null (it is optional server-side).
      expect(worksheet.activities[1].chalkboardNote, isNull);

      // The 0-based activityIndex renders as a 1-based "Activity N".
      expect(worksheet.answerKey.first.activityIndex, 0);
      expect(worksheet.answerKey.first.displayNumber, 1);
      expect(worksheet.answerKey.first.answer, r'$8$');
      expect(worksheet.answerKey.last.displayNumber, 2);
    });

    test('an entirely empty payload decodes to an empty worksheet', () {
      final worksheet =
          WorksheetResponseDto.fromJson(const <String, dynamic>{}).toDomain();
      expect(worksheet.isEmpty, isTrue);
      expect(worksheet.title, isEmpty);
      expect(worksheet.learningObjectives, isEmpty);
      expect(worksheet.activities, isEmpty);
      expect(worksheet.answerKey, isEmpty);
    });

    test('drops blank objectives, content-less activities and blank answers',
        () {
      final worksheet = WorksheetResponseDto.fromJson(<String, dynamic>{
        'title': '  Worksheet  ',
        'learningObjectives': ['Keep this', '   ', ''],
        'activities': [
          {'type': 'question', 'content': '  '}, // no content -> dropped
          {'type': 'puzzle', 'content': 'A real puzzle'},
        ],
        'answerKey': [
          {'activityIndex': 0, 'answer': '   '}, // blank -> dropped
          {'answer': 'Keep this answer'},
        ],
      }).toDomain();

      expect(worksheet.title, 'Worksheet');
      expect(worksheet.learningObjectives, ['Keep this']);
      expect(worksheet.activities, hasLength(1));
      expect(worksheet.activities.single.type, WorksheetActivityType.puzzle);
      expect(worksheet.answerKey, hasLength(1));
      // An answer with no index falls back to no display number, never crashes.
      expect(worksheet.answerKey.single.displayNumber, isNull);
      expect(worksheet.answerKey.single.answer, 'Keep this answer');
    });

    test('tolerates an unknown activity type rather than throwing', () {
      final worksheet = WorksheetResponseDto.fromJson(<String, dynamic>{
        'title': 'W',
        'activities': [
          {'type': 'holographic_task', 'content': 'Still shown'},
        ],
      }).toDomain();

      expect(worksheet.activities.single.type, isNull);
      expect(worksheet.activities.single.content, 'Still shown');
    });
  });
}
