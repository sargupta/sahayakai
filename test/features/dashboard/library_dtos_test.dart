import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/shared/data/library_dtos.dart';
import 'package:sahayakai/shared/domain/library_item.dart';

import 'dashboard_fixtures.dart';

/// P0.3 — decoding `GET /api/content/list`.
///
/// The library is server-authored and OLDER than its own schema, so the point
/// of nearly every test here is that a surprising document degrades on its own
/// instead of taking out the teacher's whole recent list.
void main() {
  group('LibraryItemDto', () {
    test('decodes a full item', () {
      final item = LibraryItemDto.fromJson(contentItem()).toDomain();

      expect(item.id, '3f2a1b4c-0000-4000-8000-000000000001');
      expect(item.type, ContentType.lessonPlan);
      expect(item.title, 'Photosynthesis for Class 6');
      expect(item.gradeLevel, 'Class 6');
      expect(item.subject, 'Science');
      expect(item.topic, 'Photosynthesis');
      expect(item.language, 'English');
      // Local, not UTC: the teacher reads their own date, not the server's.
      expect(
        item.createdAt,
        DateTime.parse('2026-07-15T09:30:00.000Z').toLocal(),
      );
      expect(item.createdAt!.isUtc, isFalse);
    });

    test('every wire value of the backend ContentTypeSchema maps', () {
      // The route's own swagger comment lists only EIGHT types and omits
      // teacher-training, exam-paper and assessment. `ContentTypeSchema` — what
      // the writer actually stores — has ELEVEN. The Zod enum is the truth.
      const wire = <String, ContentType>{
        'lesson-plan': ContentType.lessonPlan,
        'quiz': ContentType.quiz,
        'worksheet': ContentType.worksheet,
        'visual-aid': ContentType.visualAid,
        'rubric': ContentType.rubric,
        'micro-lesson': ContentType.microLesson,
        'virtual-field-trip': ContentType.virtualFieldTrip,
        'instant-answer': ContentType.instantAnswer,
        'teacher-training': ContentType.teacherTraining,
        'exam-paper': ContentType.examPaper,
        'assessment': ContentType.assessment,
      };
      expect(wire, hasLength(11));

      for (final entry in wire.entries) {
        final item = LibraryItemDto.fromJson(
          contentItem(overrides: {'type': entry.key}),
        ).toDomain();
        expect(item.type, entry.value, reason: '"${entry.key}" must decode');
      }
    });

    test('an unknown type still renders, it is the teacher\'s own work', () {
      // A document written by a future tool must not vanish from its author's
      // recent list.
      final item = LibraryItemDto.fromJson(
        contentItem(overrides: {'type': 'holographic-lesson'}),
      ).toDomain();

      expect(item.type, ContentType.unknown);
      expect(item.title, 'Photosynthesis for Class 6');
    });

    test('a missing type is unknown, not a crash', () {
      final json = contentItem()..remove('type');
      expect(
        LibraryItemDto.fromJson(json).toDomain().type,
        ContentType.unknown,
      );
    });

    test('a missing title decodes to empty, so the view can substitute', () {
      final json = contentItem()..remove('title');
      expect(LibraryItemDto.fromJson(json).toDomain().title, '');
    });

    test('blank optional strings read as null, not as empty rows', () {
      final item = LibraryItemDto.fromJson(
        contentItem(overrides: {'gradeLevel': '   ', 'subject': ''}),
      ).toDomain();

      expect(item.gradeLevel, isNull);
      expect(item.subject, isNull);
    });

    group('createdAt', () {
      test('an absent createdAt is null: the row renders undated', () {
        // BaseContentSchema marks it optional, and documents predate it.
        final json = contentItem()..remove('createdAt');
        expect(LibraryItemDto.fromJson(json).toDomain().createdAt, isNull);
      });

      test('an unparseable string is null, not a throw', () {
        final item = LibraryItemDto.fromJson(
          contentItem(overrides: {'createdAt': 'last Tuesday'}),
        ).toDomain();
        expect(item.createdAt, isNull);
      });

      test('a raw Firestore timestamp map is null, not a cast error', () {
        // `dbAdapter.serialize` should have converted this to ISO. If one ever
        // escapes, the row must lose its date, not the list its rows.
        final item = LibraryItemDto.fromJson(
          contentItem(
            overrides: {
              'createdAt': {'_seconds': 1752570600, '_nanoseconds': 0},
            },
          ),
        ).toDomain();
        expect(item.createdAt, isNull);
      });

      test('null is null', () {
        final item = LibraryItemDto.fromJson(
          contentItem(overrides: {'createdAt': null}),
        ).toDomain();
        expect(item.createdAt, isNull);
      });
    });
  });

  group('LibraryListDto', () {
    test('decodes the envelope', () {
      final items = LibraryListDto.fromJson(contentListResponse()).toDomain();

      expect(items, hasLength(1));
      expect(items.single.type, ContentType.lessonPlan);
    });

    test('reads nextCursor, and tolerates its explicit null', () {
      expect(
        LibraryListDto.fromJson(
          contentListResponse(nextCursor: 'abc123'),
        ).nextCursor,
        'abc123',
      );
      // The route sends `nextCursor: null` rather than omitting it.
      expect(LibraryListDto.fromJson(contentListResponse()).nextCursor, isNull);
    });

    test('an absent items array is an empty library, not an error', () {
      expect(
        LibraryListDto.fromJson(<String, dynamic>{'count': 0}).toDomain(),
        isEmpty,
      );
    });

    test('an explicit null items array is empty too', () {
      expect(
        LibraryListDto.fromJson(<String, dynamic>{'items': null}).toDomain(),
        isEmpty,
      );
    });

    test('a non-object entry is skipped and the rest of the list survives', () {
      // One bad row must not cost the teacher every other row.
      final json = <String, dynamic>{
        'items': <dynamic>[
          contentItem(),
          'not an item',
          42,
          null,
          contentItem(overrides: {'type': 'quiz', 'title': 'Fractions quiz'}),
        ],
      };

      final items = LibraryListDto.fromJson(json).toDomain();
      expect(items, hasLength(2));
      expect(items.first.type, ContentType.lessonPlan);
      expect(items.last.type, ContentType.quiz);
    });

    test('an empty items array decodes to an empty list', () {
      expect(
        LibraryListDto.fromJson(contentListResponse(items: [])).toDomain(),
        isEmpty,
      );
    });
  });
}
