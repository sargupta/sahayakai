import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/features/lesson_planner/data/lesson_plan_dtos.dart';
import 'package:sahayakai/features/lesson_planner/domain/lesson_plan.dart';

/// The wire contract for `POST /api/ai/lesson-plan`, pinned against the
/// backend's `src/ai/flows/lesson-plan-generator.ts` input schema. Focused on
/// the optional textbook-page image (the rural "photograph the page" path),
/// which the flow reads as `{{media url=imageDataUri}}`.
void main() {
  group('LessonPlanRequestDto', () {
    test('carries imageDataUri only when a textbook photo is attached', () {
      const uri = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
      final withPhoto = LessonPlanRequestDto.fromDomain(
        LessonPlanRequest(
          topic: 'Photosynthesis',
          language: AppLocale.bn.aiName,
          imageDataUri: uri,
        ),
      ).toJson();
      expect(withPhoto['imageDataUri'], uri);

      // No photo -> the key is absent (not an explicit null), so the server
      // applies its text-only path unchanged.
      final without = LessonPlanRequestDto.fromDomain(
        LessonPlanRequest(
          topic: 'Photosynthesis',
          language: AppLocale.bn.aiName,
        ),
      ).toJson();
      expect(without.containsKey('imageDataUri'), isFalse);
    });

    test('trims the topic and sends the language as the full English name', () {
      final json = LessonPlanRequestDto.fromDomain(
        LessonPlanRequest(
          topic: '  Fractions  ',
          language: AppLocale.kn.aiName,
        ),
      ).toJson();
      expect(json['topic'], 'Fractions');
      expect(json['language'], 'Kannada');
      expect(json.containsKey('imageDataUri'), isFalse);
    });
  });

  group('Include emphasis (v3 05) folds into the topic the model reads', () {
    String topicFor(Set<LessonInclude> includes) =>
        LessonPlanRequestDto.fromDomain(
          LessonPlanRequest(
            topic: 'Fractions',
            language: AppLocale.en.aiName,
            includes: includes,
          ),
        ).toJson()['topic'] as String;

    test('no selection leaves the topic byte-for-byte unchanged', () {
      // The whole point of defaulting to none: a plain plan is exactly as
      // before, so the server-side NCERT chapter match is never disturbed.
      expect(topicFor(const <LessonInclude>{}), 'Fractions');
    });

    test('selected components become one plain emphasis line', () {
      final topic = topicFor({
        LessonInclude.activity,
        LessonInclude.boardWork,
      });
      expect(topic, startsWith('Fractions'));
      expect(topic, contains('Please include:'));
      expect(topic, contains(LessonInclude.activity.emphasis));
      expect(topic, contains(LessonInclude.boardWork.emphasis));
    });

    test('the emphasis order is stable regardless of set iteration order', () {
      final a = topicFor({LessonInclude.homework, LessonInclude.activity});
      final b = topicFor({LessonInclude.activity, LessonInclude.homework});
      expect(a, b);
      // Declaration order: activity before homework.
      expect(
        a.indexOf(LessonInclude.activity.emphasis),
        lessThan(a.indexOf(LessonInclude.homework.emphasis)),
      );
    });
  });
}
