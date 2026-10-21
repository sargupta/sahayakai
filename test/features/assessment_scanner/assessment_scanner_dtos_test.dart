import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/assessment_scanner/data/assessment_scanner_dtos.dart';
import 'package:sahayakai/features/assessment_scanner/domain/assessment_scan.dart';

import 'assessment_scanner_fixtures.dart';

/// The wire contract for `POST /api/ai/assessment-scanner`, pinned against the
/// backend's `AssessmentScannerInputSchema` / `AssessmentScannerOutputSchema`
/// and the route in `sahayakai-main`. If the client drifts from the endpoint's
/// field names (the multi-page `pageUrls`, the per-question `marksMax`, the
/// overall `scorePct`), these fail first.
void main() {
  group('AssessmentScannerRequestDto', () {
    test('serializes the multi-page request with the exact field names', () {
      final json = AssessmentScannerRequestDto.fromDomain(
        const AssessmentScanRequest(
          assessmentId: 'abcdef00-1111-4222-8333-444444444444',
          pageDataUris: [
            'data:image/jpeg;base64,AAAA',
            'data:image/png;base64,BBBB',
          ],
          subject: 'Mathematics',
          gradeLevel: 'Class 5',
          language: 'Kannada',
          teacherAnswerKeyText: 'Q1: 5',
        ),
      ).toJson();

      // The multi-page array is `pageUrls` (NOT `pages`/`images`), bare strings.
      expect(json['pageUrls'], [
        'data:image/jpeg;base64,AAAA',
        'data:image/png;base64,BBBB',
      ]);
      expect(json['assessmentId'], 'abcdef00-1111-4222-8333-444444444444');
      expect(json['subject'], 'Mathematics');
      expect(json['gradeLevel'], 'Class 5');
      expect(json['language'], 'Kannada');
      expect(json['teacherAnswerKeyText'], 'Q1: 5');
    });

    test('omits the optionals the teacher left blank', () {
      final json = AssessmentScannerRequestDto.fromDomain(
        const AssessmentScanRequest(
          assessmentId: 'abcdef00-1111-4222-8333-444444444444',
          pageDataUris: ['data:image/jpeg;base64,AAAA'],
          subject: 'Science',
          gradeLevel: 'Class 8',
          language: 'English',
          teacherAnswerKeyText: '   ',
        ),
      ).toJson();

      expect(json.containsKey('teacherAnswerKeyText'), isFalse);
      expect(json.containsKey('educationBoard'), isFalse);
    });

    test('NEVER sends userId / studentId / classId (injected server-side)', () {
      final json = AssessmentScannerRequestDto.fromDomain(
        const AssessmentScanRequest(
          assessmentId: 'abcdef00-1111-4222-8333-444444444444',
          pageDataUris: ['data:image/jpeg;base64,AAAA'],
          subject: 'Hindi',
          gradeLevel: 'Class 3',
        ),
      ).toJson();

      for (final field in ['userId', 'studentId', 'classId']) {
        expect(
          json.containsKey(field),
          isFalse,
          reason: '$field is server-side',
        );
      }
    });
  });

  group('newAssessmentId', () {
    test('is a well-formed, unique v4 UUID', () {
      final a = newAssessmentId();
      final b = newAssessmentId();
      final uuidV4 = RegExp(
        r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
      );
      expect(uuidV4.hasMatch(a), isTrue, reason: a);
      expect(uuidV4.hasMatch(b), isTrue, reason: b);
      expect(a, isNot(b));
    });
  });

  group('AssessmentScannerResponseDto', () {
    test('decodes the multi-page, per-question scorecard shape', () {
      final r = AssessmentScannerResponseDto.fromJson(scanJson()).toDomain();

      // Overall score drives the ScoreRing.
      expect(r.status, 'graded');
      expect(r.pageCount, 2);
      expect(r.scorePct, 58);
      expect(r.scorePercent, 58);
      expect(r.totalAwardedMarks, 7);
      expect(r.totalMaxMarks, 12);
      expect(r.letterGrade, 'C');
      expect(r.needsReviewCount, 1);
      expect(r.imageQualityWarnings, hasLength(1));

      // Per-question detail, with the marks ceiling under `marksMax`.
      expect(r.questions, hasLength(3));
      final q1 = r.questions[0];
      expect(q1.marksAwarded, 5);
      expect(q1.marksMax, 5);
      expect(q1.outcome, QuestionOutcome.correct);
      expect(q1.isScored, isTrue);

      final q2 = r.questions[1];
      expect(q2.marksAwarded, 2);
      expect(q2.marksMax, 4);
      expect(q2.outcome, QuestionOutcome.partial);

      final q3 = r.questions[2];
      expect(q3.marksAwarded, 0);
      expect(q3.marksMax, 3);
      expect(q3.outcome, QuestionOutcome.incorrect);
      expect(q3.needsTeacherReview, isTrue);

      expect(r.recommendedNextSteps, hasLength(2));
      expect(r.studentRecommendations, hasLength(1));
      expect(r.isEmpty, isFalse);
    });

    test('clamps out-of-range marks and confidence defensively', () {
      final r = AssessmentScannerResponseDto.fromJson(<String, dynamic>{
        'scorePct': 140, // model drift
        'questions': [
          {
            'questionId': 'q1',
            'questionText': 'x',
            'studentAnswer': 'y',
            'marksAwarded': 6, // exceeds max
            'marksMax': 5,
            'confidence': 1.5, // out of unit range
          },
        ],
      }).toDomain();

      expect(r.scorePct, 100); // clamped to 0..100
      final q = r.questions.single;
      expect(q.marksAwarded, 5); // clamped to marksMax
      expect(q.confidence, 1.0); // clamped to unit
      expect(q.outcome, QuestionOutcome.correct);
    });

    test('drops questions with neither text nor answer, keeps real ones', () {
      final r = AssessmentScannerResponseDto.fromJson(<String, dynamic>{
        'scorePct': 50,
        'questions': [
          {'questionId': 'blank', 'questionText': '   ', 'studentAnswer': ''},
          {
            'questionId': 'real',
            'questionText': 'Real question',
            'studentAnswer': 'ans',
            'marksAwarded': 1,
            'marksMax': 2,
          },
        ],
        'recommendedNextSteps': ['keep', '   ', ''],
      }).toDomain();

      expect(r.questions, hasLength(1));
      expect(r.questions.single.questionId, 'real');
      expect(r.recommendedNextSteps, ['keep']);
    });

    test('a 0/0 question is unscored (excluded from the outcome signal)', () {
      final r = AssessmentScannerResponseDto.fromJson(<String, dynamic>{
        'scorePct': 0,
        'questions': [
          {
            'questionId': 'q',
            'questionText': 'On a question-only page',
            'studentAnswer': '',
            'marksAwarded': 0,
            'marksMax': 0,
          },
        ],
      }).toDomain();

      expect(r.questions.single.isScored, isFalse);
    });

    test('an entirely empty payload decodes to the empty state', () {
      final r = AssessmentScannerResponseDto.fromJson(
        const <String, dynamic>{},
      ).toDomain();
      expect(r.isEmpty, isTrue);
      expect(r.questions, isEmpty);
      expect(r.scorePct, 0);
    });
  });
}
