import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/features/visual_aid/data/visual_aid_dtos.dart';
import 'package:sahayakai/features/visual_aid/domain/visual_aid.dart';

import 'visual_aid_fixtures.dart';

/// The wire contract for `POST /api/ai/visual-aid`, pinned against the backend's
/// `VisualAidInputSchema` / `VisualAidOutputSchema` in
/// `src/ai/flows/visual-aid-designer.ts` and the route in
/// `src/app/api/ai/visual-aid/route.ts` (which responds with `imageDataUri`,
/// `pedagogicalContext`, `discussionSpark`, `subject`). If the client ever
/// drifts from the endpoint's field names or the image encoding, these fail
/// first.
void main() {
  group('VisualAidRequestDto', () {
    test('serializes every field with the exact names the schema pins', () {
      final json = VisualAidRequestDto.fromDomain(
        VisualAidRequest(
          prompt: '  Structure of a plant cell  ',
          gradeLevel: 'Class 6',
          subject: 'Science',
          language: AppLocale.kn.aiName,
        ),
      ).toJson();

      expect(json, {
        'prompt': 'Structure of a plant cell', // trimmed
        'gradeLevel': 'Class 6',
        'subject': 'Science',
        'language': 'Kannada', // AppLocale.aiName, not the code
      });
    });

    test('never sends server-injected fields', () {
      // The route parses `{...json, userId}` with userId taken from the verified
      // token's x-user-id header. A client that sent its own would be both wrong
      // and a trust-boundary hole.
      final json = VisualAidRequestDto.fromDomain(
        const VisualAidRequest(prompt: 'A water cycle diagram'),
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
      // The flow back-fills language/grade from the profile for absent keys; an
      // explicit null is a different (and wrong) request.
      final json = VisualAidRequestDto.fromDomain(
        const VisualAidRequest(
          prompt: 'A number line',
          gradeLevel: '   ',
          subject: '',
        ),
      ).toJson();

      expect(json, {'prompt': 'A number line'});
    });

    test('prompt is the only required field', () {
      final json = VisualAidRequestDto.fromDomain(
        const VisualAidRequest(prompt: 'P'),
      ).toJson();
      expect(json.keys, ['prompt']);
    });
  });

  group('VisualAidResponseDto — the image field', () {
    test('decodes a data-URI image to the exact PNG bytes', () {
      final aid = VisualAidResponseDto.fromJson(visualAidJson()).toDomain();

      // The bytes are the decoded PNG, not the data URI, and they are a real
      // PNG (magic number 0x89 'P' 'N' 'G'), so Image.memory will paint them.
      expect(aid.hasImage, isTrue);
      expect(aid.imageBytes, base64Decode(k1x1PngBase64));
      expect(aid.imageBytes.sublist(0, 4), [0x89, 0x50, 0x4E, 0x47]);
    });

    test('decodes a raw base64 string with no data: prefix', () {
      // The schema is `z.string()`; if the model ever returns bare base64 the
      // decode must still work (the prefix strip is tolerant, not required).
      final aid = VisualAidResponseDto.fromJson(<String, dynamic>{
        'imageDataUri': k1x1PngBase64,
      }).toDomain();

      expect(aid.hasImage, isTrue);
      expect(aid.imageBytes, base64Decode(k1x1PngBase64));
    });

    test('tolerates embedded whitespace in the payload', () {
      final aid = VisualAidResponseDto.fromJson(<String, dynamic>{
        'imageDataUri': 'data:image/png;base64, $k1x1PngBase64\n',
      }).toDomain();

      expect(aid.hasImage, isTrue);
      expect(aid.imageBytes, base64Decode(k1x1PngBase64));
    });

    test('an empty / null / absent image decodes to no-image, not a crash', () {
      for (final value in <Object?>['', '   ', null]) {
        final aid = VisualAidResponseDto.fromJson(<String, dynamic>{
          'imageDataUri': value,
          'pedagogicalContext': 'notes',
        }).toDomain();
        expect(aid.hasImage, isFalse, reason: 'value: "$value"');
        expect(aid.imageBytes, isEmpty);
        // The rest of the payload still decodes — the view shows the empty state.
        expect(aid.pedagogicalContext, 'notes');
      }

      final absent = VisualAidResponseDto.fromJson(
        const <String, dynamic>{},
      ).toDomain();
      expect(absent.hasImage, isFalse);
    });

    test('un-decodable base64 degrades to no-image rather than throwing', () {
      final aid = VisualAidResponseDto.fromJson(<String, dynamic>{
        'imageDataUri': 'data:image/png;base64,%%%not-base64%%%',
      }).toDomain();
      expect(aid.hasImage, isFalse);
      expect(aid.imageBytes, isEmpty);
    });
  });

  group('VisualAidResponseDto — the captions', () {
    test('decodes the prose and subject the route responds with', () {
      final aid = VisualAidResponseDto.fromJson(<String, dynamic>{
        'imageDataUri': kVisualAidDataUri,
        'pedagogicalContext': 'Point at each labelled part.',
        'discussionSpark': 'Which part carries water?',
        'subject': 'Science',
      }).toDomain();

      expect(aid.pedagogicalContext, 'Point at each labelled part.');
      expect(aid.discussionSpark, 'Which part carries water?');
      expect(aid.subject, 'Science');
    });

    test('trims blank captions and a blank subject to empty / null', () {
      final aid = VisualAidResponseDto.fromJson(<String, dynamic>{
        'imageDataUri': kVisualAidDataUri,
        'pedagogicalContext': '   ',
        'discussionSpark': '',
        'subject': '  ',
      }).toDomain();

      expect(aid.pedagogicalContext, '');
      expect(aid.discussionSpark, '');
      expect(aid.subject, isNull);
    });

    test('a nullable subject decodes to null, not a crash', () {
      final aid = VisualAidResponseDto.fromJson(<String, dynamic>{
        'imageDataUri': kVisualAidDataUri,
        'subject': null,
      }).toDomain();
      expect(aid.subject, isNull);
      expect(aid.hasImage, isTrue);
    });
  });
}
