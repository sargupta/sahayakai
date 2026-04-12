import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/features/content/domain/content_models.dart';

void main() {
  group('ContentItem', () {
    test('fromJson parses all fields', () {
      final item = ContentItem.fromJson({
        'id': 'c1',
        'type': 'lesson-plan',
        'title': 'Photosynthesis LP',
        'gradeLevel': 'Class 7',
        'subject': 'Science',
        'language': 'English',
        'isPublic': true,
        'isDraft': false,
        'createdAt': '2026-04-01T10:00:00Z',
        'data': {'objectives': ['Explain light reactions']},
      });

      expect(item.id, 'c1');
      expect(item.type, 'lesson-plan');
      expect(item.typeLabel, 'Lesson Plan');
      expect(item.gradeLevel, 'Class 7');
      expect(item.isPublic, true);
      expect(item.data, isNotNull);
      expect(item.data!['objectives'], isNotEmpty);
    });

    test('fromJson handles minimal data', () {
      final item = ContentItem.fromJson({'id': 'x', 'type': 'quiz', 'title': 'Q'});
      expect(item.gradeLevel, isNull);
      expect(item.data, isNull);
      expect(item.isPublic, false);
    });

    test('typeLabel falls back to raw type for unknown types', () {
      final item = ContentItem.fromJson({
        'id': 'x',
        'type': 'some-new-type',
        'title': 'X',
      });
      expect(item.typeLabel, 'some-new-type');
    });
  });

  group('ContentListResponse', () {
    test('fromJson parses items and cursor', () {
      final response = ContentListResponse.fromJson({
        'items': [
          {'id': '1', 'type': 'quiz', 'title': 'Q1'},
          {'id': '2', 'type': 'rubric', 'title': 'R1'},
        ],
        'count': 2,
        'nextCursor': 'abc',
      });

      expect(response.items.length, 2);
      expect(response.count, 2);
      expect(response.nextCursor, 'abc');
    });

    test('fromJson handles empty list', () {
      final response = ContentListResponse.fromJson({
        'items': [],
        'count': 0,
      });
      expect(response.items, isEmpty);
      expect(response.nextCursor, isNull);
    });
  });

  group('ContentFilter equality', () {
    test('equal filters are ==', () {
      const a = ContentFilter(type: 'quiz', limit: 10);
      const b = ContentFilter(type: 'quiz', limit: 10);
      expect(a, equals(b));
      expect(a.hashCode, equals(b.hashCode));
    });

    test('different type !=', () {
      const a = ContentFilter(type: 'quiz');
      const b = ContentFilter(type: 'rubric');
      expect(a, isNot(equals(b)));
    });
  });
}
