import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/core/services/teacher_activity_service.dart';

void main() {
  group('TeacherActivityService', () {
    // Fire-and-forget service — should never crash the app.

    test('log does not throw on network error', () async {
      await TeacherActivityService.log(activityType: 'lesson_plan_created');
    });

    test('log with metadata does not throw', () async {
      await TeacherActivityService.log(
        activityType: 'quiz_generated',
        metadata: {
          'topic': 'Photosynthesis',
          'gradeLevel': 'Class 7',
          'questionCount': 10,
        },
      );
    });

    test('log with various activity types does not throw', () async {
      for (final type in [
        'content_shared',
        'tts_used',
        'stt_used',
        'vidya_chat',
        'lesson_plan_created',
      ]) {
        await TeacherActivityService.log(activityType: type);
      }
    });

    test('log without metadata does not throw', () async {
      await TeacherActivityService.log(activityType: 'tts_used');
    });

    test('log handles empty activityType', () async {
      await TeacherActivityService.log(activityType: '');
    });

    test('log handles null metadata gracefully', () async {
      // metadata is optional, defaults to null
      await TeacherActivityService.log(
        activityType: 'stt_used',
        metadata: null,
      );
    });
  });
}
