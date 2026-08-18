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
}
