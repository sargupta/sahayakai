import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/features/assess_assignment/data/assess_assignment_dtos.dart';
import 'package:sahayakai/features/assess_assignment/domain/assessment.dart';

import 'assess_assignment_fixtures.dart';

/// The wire contract for `POST /api/ai/assess-assignment`, pinned against the
/// backend's `AssessAssignmentInputSchema` / `AssessAssignmentOutputSchema` and
/// the route in `sahayakai-main`. If the client drifts from the endpoint's
/// field names, casing, enum members or PII rules, these fail first.
void main() {
  group('AssessAssignmentRequestDto', () {
    test('serializes the required image + mode + language with exact names', () {
      final json = AssessAssignmentRequestDto.fromDomain(
        AssessAssignmentRequest(
          imageDataUri: 'data:image/jpeg;base64,AAAA',
          mode: AssessmentMode.full,
          language: AppLocale.kn.aiName,
        ),
      ).toJson();

      expect(json, {
        'imageDataUri': 'data:image/jpeg;base64,AAAA',
        'mode': 'full',
        'language': 'Kannada', // AppLocale.aiName, not the code
      });
    });

    test('sends the image data URI verbatim under imageDataUri', () {
      // The server validates the URI's exact length AND its
      // data:image/(jpeg|png|webp);base64, prefix, so it must not be re-encoded.
      const uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEA';
      final json = AssessAssignmentRequestDto.fromDomain(
        const AssessAssignmentRequest(imageDataUri: uri),
      ).toJson();

      expect(json['imageDataUri'], uri);
    });

    test('NEVER sends studentName / studentId or other stripped PII', () {
      // The route deletes studentName before the model; the schema also has no
      // studentName. The client models no student name/handle at all — grading
      // needs none. This is the trust-boundary pin.
      final json = AssessAssignmentRequestDto.fromDomain(
        AssessAssignmentRequest(
          imageDataUri: 'data:image/jpeg;base64,AAAA',
          rubric: buildRubric(),
          editedTranscript: 'x',
          mode: AssessmentMode.score,
        ),
      ).toJson();

      for (final field in [
        'studentName',
        'studentId',
        'userId',
        'teacherContext',
      ]) {
        expect(
          json.containsKey(field),
          isFalse,
          reason: '$field is stripped/injected server-side and must not be sent',
        );
      }
    });

    test('always sends mode, defaulting to full', () {
      final json = AssessAssignmentRequestDto.fromDomain(
        const AssessAssignmentRequest(imageDataUri: 'data:image/jpeg;base64,AA'),
      ).toJson();
      expect(json['mode'], 'full');
    });

    test('sends editedTranscript only when non-blank (score mode)', () {
      final withText = AssessAssignmentRequestDto.fromDomain(
        const AssessAssignmentRequest(
          imageDataUri: 'data:image/jpeg;base64,AA',
          mode: AssessmentMode.score,
          editedTranscript: '  corrected answer  ',
        ),
      ).toJson();
      expect(withText['editedTranscript'], 'corrected answer'); // trimmed

      final blank = AssessAssignmentRequestDto.fromDomain(
        const AssessAssignmentRequest(
          imageDataUri: 'data:image/jpeg;base64,AA',
          mode: AssessmentMode.score,
          editedTranscript: '   ',
        ),
      ).toJson();
      expect(blank.containsKey('editedTranscript'), isFalse);
    });

    test('omits a null rubric, serializes a provided one as the full shape', () {
      final without = AssessAssignmentRequestDto.fromDomain(
        const AssessAssignmentRequest(imageDataUri: 'data:image/jpeg;base64,AA'),
      ).toJson();
      expect(without.containsKey('rubricSnapshot'), isFalse);

      final with_ = AssessAssignmentRequestDto.fromDomain(
        AssessAssignmentRequest(
          imageDataUri: 'data:image/jpeg;base64,AA',
          rubric: buildRubric(),
        ),
      ).toJson();
      final rubric = with_['rubricSnapshot'] as Map<String, dynamic>;
      expect(rubric['title'], startsWith('Short-answer rubric'));
      final criteria = rubric['criteria'] as List;
      expect(criteria, hasLength(1));
      final levels = (criteria.first as Map)['levels'] as List;
      expect((levels.first as Map)['points'], 4);
      expect(rubric['gradeLevel'], 'Class 5');
      expect(rubric['subject'], 'Science');
    });
  });

  group('AssessmentMode', () {
    test('maps every member to its exact wire value', () {
      expect(
        AssessmentMode.values.map((m) => m.wire),
        ['full', 'transcribe', 'score'],
      );
    });

    test('tolerates unknown / absent members by falling back to full', () {
      expect(AssessmentMode.fromWire('galaxy'), AssessmentMode.full);
      expect(AssessmentMode.fromWire(null), AssessmentMode.full);
      expect(AssessmentMode.fromWire('score'), AssessmentMode.score);
    });
  });

  group('AssessAssignmentResponseDto', () {
    test('decodes the full scorecard shape', () {
      final a = AssessAssignmentResponseDto.fromJson(<String, dynamic>{
        'assessmentId': 'a1',
        'rawTranscript': 'The water cycle.',
        'editedTranscript': null,
        'language': 'English',
        'overallScore': 75,
        'pointsEarned': 12,
        'pointsPossible': 16,
        'perCriterionScores': [
          {
            'criterionName': 'Understanding',
            'level': 'Proficient',
            'points': 3,
            'maxPoints': 4,
            'feedback': 'Good grasp.',
            'confidence': 0.9,
          },
          {
            'criterionName': 'Accuracy',
            'level': 'Developing',
            'points': 2,
            'maxPoints': 4,
            'feedback': 'Some errors.',
            'confidence': 0.3,
          },
        ],
        'strengths': ['Clear opening'],
        'improvements': ['Add condensation'],
        'nextSteps': ['Draw the cycle'],
        'teacherNote': 'Well done.',
        'confidenceOverall': 0.82,
        'warnings': ['low_contrast'],
        'rubricSnapshot': {
          'title': 'Science rubric',
          'description': 'Grades science answers.',
          'criteria': [
            {
              'name': 'Understanding',
              'description': 'Grasp.',
              'levels': [
                {'name': 'Exemplary', 'description': 'All', 'points': 4},
              ],
            },
          ],
          'gradeLevel': 'Class 5',
          'subject': 'Science',
        },
        'studentId': null,
        'createdAtIso': '2026-07-18T00:00:00.000Z',
      }).toDomain();

      expect(a.rawTranscript, 'The water cycle.');
      expect(a.overallScore, 75);
      expect(a.scorePercent, 75);
      expect(a.pointsEarned, 12);
      expect(a.pointsPossible, 16);
      expect(a.hasScore, isTrue);
      expect(a.confidencePercent, 82);
      expect(a.perCriterionScores, hasLength(2));
      expect(a.perCriterionScores.first.criterionName, 'Understanding');
      expect(a.perCriterionScores.first.isLowConfidence, isFalse);
      expect(a.perCriterionScores[1].isLowConfidence, isTrue); // 0.3 < 0.5
      expect(a.strengths, ['Clear opening']);
      expect(a.improvements, ['Add condensation']);
      expect(a.nextSteps, ['Draw the cycle']);
      expect(a.teacherNote, 'Well done.');
      expect(a.warnings, ['low_contrast']);
      expect(a.rubric?.title, 'Science rubric');
      expect(a.rubric?.criteria.single.levels.single.points, 4);
    });

    test('transcribe-mode payload (transcript only) has no score to show', () {
      // In transcribe mode the score-side fields come back empty; the domain
      // must read that as "no score", so the view leads with the transcript.
      final a = AssessAssignmentResponseDto.fromJson(<String, dynamic>{
        'rawTranscript': 'पानी का चक्र.',
        'language': 'English',
        'perCriterionScores': <dynamic>[],
        'strengths': <dynamic>[],
        'improvements': <dynamic>[],
        'nextSteps': <dynamic>[],
        'warnings': <dynamic>[],
      }).toDomain();

      expect(a.rawTranscript, 'पानी का चक्र.');
      expect(a.displayTranscript, 'पानी का चक्र.');
      expect(a.hasScore, isFalse);
      expect(a.scorePercent, isNull);
      expect(a.isEmpty, isFalse);
    });

    test('an entirely empty payload decodes to an empty assessment', () {
      final a = AssessAssignmentResponseDto.fromJson(
        const <String, dynamic>{},
      ).toDomain();
      expect(a.isEmpty, isTrue);
      expect(a.hasScore, isFalse);
      expect(a.displayTranscript, isNull);
      expect(a.perCriterionScores, isEmpty);
    });

    test('editedTranscript wins over rawTranscript for display', () {
      final a = AssessAssignmentResponseDto.fromJson(<String, dynamic>{
        'rawTranscript': 'raw reading',
        'editedTranscript': 'teacher edit',
      }).toDomain();
      expect(a.displayTranscript, 'teacher edit');
    });

    test('clamps out-of-range score and confidence defensively', () {
      final a = AssessAssignmentResponseDto.fromJson(<String, dynamic>{
        'rawTranscript': 'x',
        'overallScore': 140, // model drift
        'pointsPossible': 10,
        'confidenceOverall': 1.5,
        'perCriterionScores': [
          {'criterionName': 'C', 'confidence': -0.2},
        ],
      }).toDomain();
      expect(a.scorePercent, 100); // clamped
      expect(a.confidencePercent, 100); // clamped
      expect(a.perCriterionScores.single.confidence, 0.0); // clamped
    });

    test('drops blank strengths / criteria with no name defensively', () {
      final a = AssessAssignmentResponseDto.fromJson(<String, dynamic>{
        'rawTranscript': 'x',
        'strengths': ['keep', '   ', ''],
        'perCriterionScores': [
          {'criterionName': '   '}, // no name -> dropped
          {'criterionName': 'Real', 'points': 2, 'maxPoints': 4},
        ],
      }).toDomain();
      expect(a.strengths, ['keep']);
      expect(a.perCriterionScores, hasLength(1));
      expect(a.perCriterionScores.single.criterionName, 'Real');
    });
  });
}
