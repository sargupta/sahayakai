import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/features/rubric_generator/data/rubric_dtos.dart';
import 'package:sahayakai/features/rubric_generator/domain/rubric.dart';

/// The wire contract for `POST /api/ai/rubric`, pinned against the backend's
/// `RubricGeneratorInputSchema` / `RubricGeneratorOutputSchema` + route handler
/// in `sahayakai-main`. If the client ever drifts from the endpoint's field
/// names or the returned shape, these fail first.
void main() {
  group('RubricRequestDto', () {
    test('serializes every field with the exact names the endpoint pins', () {
      final json = RubricRequestDto.fromDomain(
        RubricRequest(
          assignmentDescription: '  A Class 5 project on renewable energy  ',
          gradeLevel: 'Class 5',
          subject: 'Science',
          language: AppLocale.kn.aiName,
        ),
      ).toJson();

      expect(json, {
        'assignmentDescription': 'A Class 5 project on renewable energy',
        'gradeLevel': 'Class 5',
        'subject': 'Science',
        'language': 'Kannada', // AppLocale.aiName, not the code
      });
    });

    test('never sends server-injected fields', () {
      // Middleware injects userId + teacherContext from the verified Firebase
      // token; a client that sent its own would be both wrong and a
      // trust-boundary hole.
      final json = RubricRequestDto.fromDomain(
        const RubricRequest(assignmentDescription: 'An assignment'),
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
      final json = RubricRequestDto.fromDomain(
        const RubricRequest(
          assignmentDescription: 'An assignment',
          gradeLevel: '   ',
          subject: '',
        ),
      ).toJson();

      expect(json, {'assignmentDescription': 'An assignment'});
    });
  });

  group('RubricResponseDto', () {
    test('decodes the route shape: title, description, criteria grid', () {
      final rubric = RubricResponseDto.fromJson(<String, dynamic>{
        'title': 'Science Project Rubric',
        'description': 'For a renewable-energy project.',
        'criteria': [
          {
            'name': 'Research and Content',
            'description': 'Depth of the sources.',
            'levels': [
              {'name': 'Exemplary', 'description': 'Exceeds all.', 'points': 4},
              {'name': 'Proficient', 'description': 'Meets all.', 'points': 3},
              {'name': 'Developing', 'description': 'Some gaps.', 'points': 2},
              {'name': 'Beginning', 'description': 'Minimal.', 'points': 1},
            ],
          },
          {
            'name': 'Presentation',
            'description': 'Clarity of delivery.',
            'levels': [
              {'name': 'Exemplary', 'description': 'Very clear.', 'points': 4},
            ],
          },
        ],
        'gradeLevel': 'Class 5',
        'subject': 'Science',
      }).toDomain();

      expect(rubric.title, 'Science Project Rubric');
      expect(rubric.description, 'For a renewable-energy project.');
      expect(rubric.gradeLevel, 'Class 5');
      expect(rubric.subject, 'Science');
      expect(rubric.isEmpty, isFalse);

      expect(rubric.criteria, hasLength(2));
      final first = rubric.criteria.first;
      expect(first.name, 'Research and Content');
      expect(first.description, 'Depth of the sources.');
      expect(first.levels, hasLength(4));
      expect(first.levels.first.name, 'Exemplary');
      expect(first.levels.first.description, 'Exceeds all.');
      expect(first.levels.first.points, 4);
      expect(first.levels.first.pointsLabel, '4');

      // levelCount is the WIDEST criterion's level count; short rows are padded
      // in the grid, not here.
      expect(rubric.levelCount, 4);
      expect(rubric.headerLevels.map((l) => l.name),
          ['Exemplary', 'Proficient', 'Developing', 'Beginning']);
      expect(rubric.criteria[1].levels, hasLength(1));
    });

    test('a whole-number decimal points value drops its trailing zero', () {
      final rubric = RubricResponseDto.fromJson(<String, dynamic>{
        'title': 'R',
        'criteria': [
          {
            'name': 'C',
            'levels': [
              {'name': 'Exemplary', 'description': 'x', 'points': 4.0},
              {'name': 'Half', 'description': 'y', 'points': 2.5},
            ],
          },
        ],
      }).toDomain();

      expect(rubric.criteria.single.levels[0].pointsLabel, '4');
      expect(rubric.criteria.single.levels[1].pointsLabel, '2.5');
    });

    test('an entirely empty payload decodes to an empty rubric', () {
      final rubric =
          RubricResponseDto.fromJson(const <String, dynamic>{}).toDomain();
      expect(rubric.isEmpty, isTrue);
      expect(rubric.title, isEmpty);
      expect(rubric.criteria, isEmpty);
      expect(rubric.levelCount, 0);
      expect(rubric.headerLevels, isEmpty);
    });

    test('tolerates a criterion with NO levels (partial response)', () {
      final rubric = RubricResponseDto.fromJson(<String, dynamic>{
        'title': 'R',
        'criteria': [
          {'name': 'Research', 'description': 'Sources.'},
          {'name': 'Presentation', 'levels': <dynamic>[]},
        ],
      }).toDomain();

      expect(rubric.criteria, hasLength(2));
      expect(rubric.criteria.every((c) => c.levels.isEmpty), isTrue);
      // No levels anywhere -> zero grid columns; the grid falls back to a list.
      expect(rubric.levelCount, 0);
      expect(rubric.headerLevels, isEmpty);
      expect(rubric.isEmpty, isFalse);
    });

    test('drops empty criteria and content-less levels', () {
      final rubric = RubricResponseDto.fromJson(<String, dynamic>{
        'title': '  Rubric  ',
        'criteria': [
          {'name': '   ', 'levels': <dynamic>[]}, // no name, no levels -> dropped
          {
            'name': 'Kept',
            'levels': [
              {'name': '  ', 'description': '  '}, // blank -> dropped
              {'name': 'Real', 'description': 'A real level', 'points': 3},
            ],
          },
        ],
      }).toDomain();

      expect(rubric.title, 'Rubric');
      expect(rubric.criteria, hasLength(1));
      expect(rubric.criteria.single.name, 'Kept');
      expect(rubric.criteria.single.levels, hasLength(1));
      expect(rubric.criteria.single.levels.single.name, 'Real');
    });

    test('a level with a missing points value keeps a null pointsLabel', () {
      final rubric = RubricResponseDto.fromJson(<String, dynamic>{
        'title': 'R',
        'criteria': [
          {
            'name': 'C',
            'levels': [
              {'name': 'Exemplary', 'description': 'x'},
            ],
          },
        ],
      }).toDomain();

      expect(rubric.criteria.single.levels.single.points, isNull);
      expect(rubric.criteria.single.levels.single.pointsLabel, isNull);
    });
  });
}
