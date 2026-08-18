import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/features/exam_paper/data/exam_paper_dtos.dart';
import 'package:sahayakai/features/exam_paper/domain/exam_paper.dart';

import 'exam_paper_fixtures.dart';

/// The wire contract for `POST /api/ai/exam-paper`, pinned against the backend's
/// `ExamPaperInputSchema` / `ExamPaperDataSchema` + the route handler in
/// `sahayakai-main`. If the client ever drifts from the endpoint's field names,
/// the returned shape, or the 202 marker, these fail first.
void main() {
  group('ExamPaperRequestDto', () {
    test('serializes every field with the exact names the endpoint pins', () {
      final json = ExamPaperRequestDto.fromDomain(
        ExamPaperRequest(
          board: '  CBSE  ',
          gradeLevel: '  Class 10  ',
          subject: '  Mathematics  ',
          chapters: const ['  Quadratic Equations  ', 'Triangles'],
          difficulty: ExamDifficulty.hard,
          language: AppLocale.kn.aiName,
          includeAnswerKey: false,
          includeMarkingScheme: true,
        ),
      ).toJson();

      expect(json, {
        'board': 'CBSE',
        'gradeLevel': 'Class 10',
        'subject': 'Mathematics',
        'chapters': ['Quadratic Equations', 'Triangles'],
        'difficulty': 'hard',
        'includeAnswerKey': false,
        'includeMarkingScheme': true,
        'language': 'Kannada', // AppLocale.aiName, not the code
      });
    });

    test('never sends server-injected fields', () {
      // Middleware injects userId + teacherContext from the verified token, and
      // duration/maxMarks default from the blueprint. A client that sent its own
      // would be wrong (and, for userId, a trust-boundary hole).
      final json = ExamPaperRequestDto.fromDomain(
        const ExamPaperRequest(
          board: 'CBSE',
          gradeLevel: 'Class 10',
          subject: 'Mathematics',
        ),
      ).toJson();

      for (final field in [
        'userId',
        'teacherContext',
        'duration',
        'maxMarks',
      ]) {
        expect(
          json.containsKey(field),
          isFalse,
          reason: '$field is server-side and must never be sent',
        );
      }
    });

    test(
      'always sends chapters, even empty (a valid "all chapters" signal)',
      () {
        final json = ExamPaperRequestDto.fromDomain(
          const ExamPaperRequest(
            board: 'CBSE',
            gradeLevel: 'Class 10',
            subject: 'Mathematics',
            chapters: <String>[],
            difficulty: ExamDifficulty.mixed,
          ),
        ).toJson();

        expect(json['chapters'], <String>[]);
        expect(json['difficulty'], 'mixed');
        // Booleans default true and are always present.
        expect(json['includeAnswerKey'], isTrue);
        expect(json['includeMarkingScheme'], isTrue);
      },
    );

    test('drops blank chapters and blank language', () {
      final json = ExamPaperRequestDto.fromDomain(
        const ExamPaperRequest(
          board: 'CBSE',
          gradeLevel: 'Class 10',
          subject: 'Mathematics',
          chapters: <String>['Triangles', '   ', ''],
          language: '   ',
        ),
      ).toJson();

      expect(json['chapters'], ['Triangles']);
      expect(json.containsKey('language'), isFalse);
    });
  });

  group('examPaperNeedsChapters (the blueprint rule)', () {
    test(
      'a blueprinted CBSE Class 9/10 Maths/Science combo does NOT need them',
      () {
        expect(
          examPaperNeedsChapters('CBSE', 'Class 10', 'Mathematics'),
          isFalse,
        );
        expect(examPaperNeedsChapters('CBSE', 'Class 10', 'Science'), isFalse);
        expect(
          examPaperNeedsChapters('CBSE', 'Class 9', 'Mathematics'),
          isFalse,
        );
        expect(examPaperNeedsChapters('CBSE', 'Class 9', 'Science'), isFalse);
        // Case/spacing insensitive, mirroring the server's normalized match.
        expect(
          examPaperNeedsChapters('  cbse ', 'class 10', ' science '),
          isFalse,
        );
      },
    );

    test('everything else DOES need at least one chapter', () {
      expect(examPaperNeedsChapters('CBSE', 'Class 10', 'History'), isTrue);
      expect(examPaperNeedsChapters('CBSE', 'Class 8', 'Mathematics'), isTrue);
      expect(
        examPaperNeedsChapters('ICSE / ISC', 'Class 10', 'Science'),
        isTrue,
      );
      expect(examPaperNeedsChapters('CBSE', 'Nursery', 'Mathematics'), isTrue);
    });

    test(
      'a still-unset required field never double-reports (returns false)',
      () {
        expect(
          examPaperNeedsChapters(null, 'Class 10', 'Mathematics'),
          isFalse,
        );
        expect(examPaperNeedsChapters('CBSE', null, 'Mathematics'), isFalse);
        expect(examPaperNeedsChapters('CBSE', 'Class 10', null), isFalse);
      },
    );
  });

  group('ExamPaperResponseDto.resultFrom', () {
    test(
      'a 200 body decodes to a READY paper (sections, keys, blueprint, pyq)',
      () {
        final result = ExamPaperResponseDto.resultFrom(examPaperJson());
        expect(result, isA<ExamPaperReady>());
        final paper = (result as ExamPaperReady).paper;

        expect(
          paper.title,
          startsWith('CBSE Class 10 Mathematics Sample Paper'),
        );
        expect(paper.board, 'CBSE');
        expect(paper.subject, 'Mathematics');
        expect(paper.gradeLevel, 'Class 10');
        expect(paper.duration, '3 Hours');
        expect(paper.maxMarks, 80);
        expect(paper.generalInstructions, hasLength(2));
        expect(paper.isEmpty, isFalse);

        expect(paper.sections, hasLength(1));
        final section = paper.sections.single;
        expect(section.name, 'Section A');
        expect(section.label, 'Multiple Choice Questions');
        expect(section.totalMarks, 20);
        expect(section.questions, hasLength(2));

        final q1 = section.questions.first;
        expect(q1.number, 1);
        expect(q1.marks, 1);
        expect(q1.options, hasLength(4));
        expect(q1.answerKey, '(c) 4');
        expect(q1.hasAnswerKey, isTrue);
        expect(q1.hasMarkingScheme, isTrue);
        expect(q1.source, 'AI Generated');

        final q2 = section.questions[1];
        expect(q2.internalChoice, startsWith('Or, factorise'));
        expect(q2.source, 'PYQ 2019');

        expect(paper.blueprintSummary, isNotNull);
        expect(paper.blueprintSummary!.chapterWise, hasLength(2));
        expect(paper.blueprintSummary!.chapterWise.first.marks, 12);
        expect(paper.blueprintSummary!.difficultyWise, hasLength(2));
        expect(paper.blueprintSummary!.difficultyWise.first.percentage, 40);

        expect(paper.pyqSources, hasLength(1));
        expect(paper.pyqSources.first.year, 2019);
        expect(paper.pyqSources.first.chapter, 'Quadratic Equations');
      },
    );

    test(
      'keeps the raw JSON verbatim, so a save round-trips byte-for-byte',
      () {
        final json = examPaperJson();
        final ready = ExamPaperResponseDto.resultFrom(json) as ExamPaperReady;
        expect(ready.raw, same(json));
      },
    );

    test(
      'a 202 body decodes to the distinct IN-PROGRESS state, not a paper',
      () {
        final result = ExamPaperResponseDto.resultFrom(
          examPaperInProgressJson(),
        );
        expect(result, isA<ExamPaperInProgress>());
        expect(
          (result as ExamPaperInProgress).message,
          'Exam paper still generating. Check My Library in 1 minute.',
        );
      },
    );

    test('an entirely empty 200 payload decodes to an empty paper', () {
      final result = ExamPaperResponseDto.resultFrom(const <String, dynamic>{});
      expect(result, isA<ExamPaperReady>());
      final paper = (result as ExamPaperReady).paper;
      expect(paper.isEmpty, isTrue);
      expect(paper.title, isEmpty);
      expect(paper.sections, isEmpty);
    });

    test('money bug: a title-only malformed response (no sections) is EMPTY, '
        'not a fake success', () {
      // A real regression: the model (or a proxy/error page) returns a
      // title with no sections at all — no questions, nothing to render.
      // The old `title.isEmpty && sections.isEmpty && ...` AND-of-three
      // required every field empty before counting as empty, so this exact
      // shape read as "not empty" and rendered a full masthead + a tappable
      // Save button over zero content.
      final result = ExamPaperResponseDto.resultFrom(<String, dynamic>{
        'title': 'CBSE Class 10 Mathematics Sample Paper',
        'board': 'CBSE',
        'subject': 'Mathematics',
        'gradeLevel': 'Class 10',
        'generalInstructions': ['All questions are compulsory.'],
        'sections': <Map<String, dynamic>>[],
      });
      final paper = (result as ExamPaperReady).paper;
      expect(paper.title, isNotEmpty);
      expect(paper.generalInstructions, isNotEmpty);
      expect(paper.sections, isEmpty);
      expect(
        paper.isEmpty,
        isTrue,
        reason: 'no sections means no real paper, regardless of title',
      );
    });

    test(
      'tolerates a partial paper (missing marks, options, blueprint, pyq)',
      () {
        final result = ExamPaperResponseDto.resultFrom(<String, dynamic>{
          'title': 'Partial Paper',
          'board': 'CBSE',
          'sections': <Map<String, dynamic>>[
            <String, dynamic>{
              'name': 'Section A',
              'questions': <Map<String, dynamic>>[
                <String, dynamic>{
                  'number': 1,
                  'text': 'A question with no marks.',
                },
              ],
            },
          ],
        });
        final paper = (result as ExamPaperReady).paper;
        expect(paper.sections.single.questions.single.marks, isNull);
        expect(paper.sections.single.questions.single.options, isEmpty);
        expect(paper.sections.single.questions.single.hasAnswerKey, isFalse);
        expect(paper.blueprintSummary, isNull);
        expect(paper.pyqSources, isEmpty);
        expect(paper.isEmpty, isFalse);
      },
    );
  });
}
