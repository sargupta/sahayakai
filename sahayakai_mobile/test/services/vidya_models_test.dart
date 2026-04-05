import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/features/vidya/domain/vidya_models.dart';

void main() {
  group('VidyaResponse', () {
    test('fromJson without action', () {
      final r = VidyaResponse.fromJson({
        'response': 'Namaste teacher!',
        'action': null,
      });
      expect(r.response, 'Namaste teacher!');
      expect(r.action, isNull);
    });

    test('fromJson with action', () {
      final r = VidyaResponse.fromJson({
        'response': 'Creating a lesson plan.',
        'action': {
          'type': 'NAVIGATE_AND_FILL',
          'flow': 'lesson-plan',
          'label': 'Create Lesson Plan',
          'params': {
            'topic': 'Photosynthesis',
            'gradeLevel': 'Class 7',
          },
        },
      });
      expect(r.action, isNotNull);
      expect(r.action!.flow, 'lesson-plan');
      expect(r.action!.params['topic'], 'Photosynthesis');
    });
  });

  group('VidyaAction.routePath', () {
    final testCases = {
      'lesson-plan': '/create-lesson',
      'quiz-generator': '/quiz-config',
      'worksheet-wizard': '/worksheet-wizard',
      'visual-aid-designer': '/visual-aid-creator',
      'video-storyteller': '/video-storyteller',
      'teacher-training': '/teacher-training',
      'virtual-field-trip': '/virtual-field-trip',
      'rubric-generator': '/rubric-generator',
      'instant-answer': '/instant-answer',
      'exam-paper': '/exam-paper',
      'unknown': '/',
    };

    for (final entry in testCases.entries) {
      test('${entry.key} → ${entry.value}', () {
        final action = VidyaAction(
          type: 'NAVIGATE_AND_FILL',
          flow: entry.key,
          label: 'Test',
        );
        expect(action.routePath, entry.value);
      });
    }
  });

  group('VidyaTurn', () {
    test('toJson and fromJson roundtrip', () {
      final turn = VidyaTurn(
        user: 'hello',
        ai: 'hi there',
        action: const VidyaAction(
          type: 'NAVIGATE_AND_FILL',
          flow: 'quiz-generator',
          label: 'Quiz',
          params: {'topic': 'Plants'},
        ),
        timestamp: DateTime(2026, 4, 5, 10, 0),
      );

      final json = turn.toJson();
      final restored = VidyaTurn.fromJson(json);

      expect(restored.user, 'hello');
      expect(restored.ai, 'hi there');
      expect(restored.action, isNotNull);
      expect(restored.action!.flow, 'quiz-generator');
      expect(restored.action!.params['topic'], 'Plants');
    });
  });

  group('VidyaSession', () {
    test('fromJson parses multiple turns', () {
      final session = VidyaSession.fromJson({
        'id': 's1',
        'turns': [
          {'user': 'a', 'ai': 'b', 'timestamp': '2026-04-05T10:00:00Z'},
          {'user': 'c', 'ai': 'd', 'timestamp': '2026-04-05T10:01:00Z'},
        ],
        'createdAt': '2026-04-05T10:00:00Z',
        'updatedAt': '2026-04-05T10:01:00Z',
      });

      expect(session.turns.length, 2);
      expect(session.id, 's1');
    });

    test('toJson preserves structure', () {
      final session = VidyaSession(
        id: 'test',
        turns: [
          VidyaTurn(user: 'x', ai: 'y', timestamp: DateTime(2026, 1, 1)),
        ],
        createdAt: DateTime(2026, 1, 1),
        updatedAt: DateTime(2026, 1, 1),
      );

      final json = session.toJson();
      expect(json['id'], 'test');
      expect((json['turns'] as List).length, 1);
    });
  });

  group('VidyaProfile', () {
    test('fromJson and toJson', () {
      final profile = VidyaProfile.fromJson({
        'preferredGrade': 'Class 8',
        'preferredSubject': 'Science',
        'schoolContext': 'Rural school in Rajasthan',
      });

      expect(profile.preferredGrade, 'Class 8');

      final json = profile.toJson();
      expect(json['preferredSubject'], 'Science');
      expect(json.containsKey('notes'), false); // null omitted
    });
  });
}
