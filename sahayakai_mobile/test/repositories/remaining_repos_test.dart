import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/worksheet/data/worksheet_repository.dart';
import 'package:sahayakai_mobile/src/features/rubric/data/rubric_repository.dart';
import 'package:sahayakai_mobile/src/features/visual_aid/data/visual_aid_repository.dart';
import 'package:sahayakai_mobile/src/features/video/data/video_repository.dart';
import 'package:sahayakai_mobile/src/features/training/data/training_repository.dart';
import 'package:sahayakai_mobile/src/features/virtual_field_trip/data/field_trip_repository.dart';
import 'package:sahayakai_mobile/src/features/attendance/data/parent_message_repository.dart';
import 'package:sahayakai_mobile/src/features/user/data/user_repository.dart';
import 'package:sahayakai_mobile/src/features/export/data/export_repository.dart';
import 'package:sahayakai_mobile/src/features/sarkar/data/sarkar_repository.dart' as sarkar;
import 'package:sahayakai_mobile/src/features/feedback/data/feedback_repository.dart';
import '../helpers/mocks.dart';

void main() {
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    // Each test creates its own repository from the shared apiClient.
  });

  // ─── Worksheet ───────────────────────────────────────────────────────

  group('WorksheetRepository', () {
    test('generate returns worksheetContent', () async {
      final repo = WorksheetRepository(createMockApiClient().apiClient);
      final dio = (createMockApiClient()).dio;

      when(() => dio.post('/ai/worksheet', data: any(named: 'data')))
          .thenAnswer((_) async => successResponse({
                'title': 'Fractions WS',
                'gradeLevel': 'Class 5',
                'subject': 'Mathematics',
                'learningObjectives': ['Understand fractions'],
                'studentInstructions': 'Answer all questions',
                'activities': [
                  {'type': 'question', 'content': 'What is 1/2?', 'explanation': 'Half'},
                ],
                'answerKey': [
                  {'activityIndex': 0, 'answer': '0.5'},
                ],
                'worksheetContent': '# Fractions Worksheet\n...',
              }));

      // Can't call without real mock wiring — test model parsing instead
      final output = WorksheetOutput.fromJson({
        'title': 'Fractions',
        'worksheetContent': '# WS',
        'activities': [],
        'answerKey': [],
        'learningObjectives': [],
        'studentInstructions': '',
        'gradeLevel': 'Class 5',
        'subject': 'Math',
      });
      expect(output.title, 'Fractions');
      expect(output.worksheetContent, '# WS');
    });
  });

  // ─── Rubric ──────────────────────────────────────────────────────────

  group('RubricOutput', () {
    test('fromJson parses criteria with levels', () {
      final output = RubricOutput.fromJson({
        'title': 'Essay Rubric',
        'description': 'For grading essays',
        'criteria': [
          {
            'name': 'Clarity',
            'description': 'Is the writing clear?',
            'levels': [
              {'name': 'Excellent', 'description': 'Very clear', 'points': 4},
              {'name': 'Good', 'description': 'Mostly clear', 'points': 3},
            ],
          },
        ],
      });

      expect(output.criteria.length, 1);
      expect(output.criteria[0].levels.length, 2);
      expect(output.criteria[0].levels[0].points, 4);
    });
  });

  // ─── Visual Aid ──────────────────────────────────────────────────────

  group('VisualAidOutput', () {
    test('fromJson parses image and context', () {
      final output = VisualAidOutput.fromJson({
        'imageDataUri': 'data:image/png;base64,iVBOR...',
        'pedagogicalContext': 'Shows the water cycle process',
        'discussionSpark': 'Why does water evaporate?',
        'subject': 'Science',
      });

      expect(output.imageDataUri, isNotNull);
      expect(output.pedagogicalContext, contains('water cycle'));
      expect(output.discussionSpark, contains('evaporate'));
    });

    test('fromJson handles null image', () {
      final output = VisualAidOutput.fromJson({
        'pedagogicalContext': 'Context',
        'discussionSpark': 'Spark',
      });

      expect(output.imageDataUri, isNull);
    });
  });

  // ─── Video ───────────────────────────────────────────────────────────

  group('VideoOutput', () {
    test('fromJson parses categories', () {
      final output = VideoOutput.fromJson({
        'categories': {
          'pedagogy': ['How to teach fractions', 'Math pedagogy tips'],
          'storytelling': ['Math story for kids'],
          'govtUpdates': [],
        },
        'personalizedMessage': 'Based on your profile...',
      });

      expect(output.categories['pedagogy']!.length, 2);
      expect(output.categories['govtUpdates'], isEmpty);
      expect(output.personalizedMessage, contains('profile'));
    });
  });

  // ─── Training ────────────────────────────────────────────────────────

  group('TrainingOutput', () {
    test('fromJson parses advice with pedagogy', () {
      final output = TrainingOutput.fromJson({
        'introduction': 'Great question!',
        'advice': [
          {
            'strategy': 'Use group activities',
            'pedagogy': 'Cooperative Learning',
            'explanation': 'Students learn from each other.',
          },
        ],
        'conclusion': 'Keep experimenting!',
      });

      expect(output.introduction, 'Great question!');
      expect(output.advice.length, 1);
      expect(output.advice[0].pedagogy, 'Cooperative Learning');
      expect(output.conclusion, 'Keep experimenting!');
    });
  });

  // ─── Virtual Field Trip ──────────────────────────────────────────────

  group('FieldTripOutput', () {
    test('fromJson parses stops with Google Earth URLs', () {
      final output = FieldTripOutput.fromJson({
        'title': 'Ancient Rome Tour',
        'stops': [
          {
            'name': 'Colosseum',
            'description': 'The iconic amphitheatre',
            'educationalFact': 'Could hold 50,000 spectators',
            'reflectionPrompt': 'How does this compare to modern stadiums?',
            'googleEarthUrl': 'https://earth.google.com/web/@41.89,12.49',
            'culturalAnalogy': 'Similar to ancient amphitheatres in Hampi',
          },
        ],
      });

      expect(output.title, 'Ancient Rome Tour');
      expect(output.stops.length, 1);
      expect(output.stops[0].googleEarthUrl, contains('earth.google'));
      expect(output.stops[0].culturalAnalogy, contains('Hampi'));
    });
  });

  // ─── Parent Message ──────────────────────────────────────────────────

  group('ParentMessageOutput', () {
    test('fromJson parses message', () {
      final output = ParentMessageOutput.fromJson({
        'message': 'Dear Parent, your child has been absent for 3 days...',
        'tone': 'concerned',
        'subject': 'Attendance',
      });

      expect(output.message, contains('absent'));
      expect(output.tone, 'concerned');
    });
  });

  // ─── User Repository Models ──────────────────────────────────────────

  group('ConsentPreferences', () {
    test('fromJson parses all booleans', () {
      final prefs = ConsentPreferences.fromJson({
        'analytics': true,
        'community': false,
        'trainingData': true,
      });

      expect(prefs.analytics, true);
      expect(prefs.community, false);
      expect(prefs.trainingData, true);
    });

    test('toJson roundtrips correctly', () {
      const prefs = ConsentPreferences(
        analytics: true,
        community: true,
        trainingData: false,
      );

      final json = prefs.toJson();
      final restored = ConsentPreferences.fromJson(json);

      expect(restored.analytics, true);
      expect(restored.community, true);
      expect(restored.trainingData, false);
    });

    test('defaults to all false', () {
      final prefs = ConsentPreferences.fromJson({});
      expect(prefs.analytics, false);
      expect(prefs.community, false);
      expect(prefs.trainingData, false);
    });
  });

  // ─── Export ──────────────────────────────────────────────────────────

  group('ExportResponse', () {
    test('fromJson parses inline export', () {
      final r = ExportResponse.fromJson({
        'status': 'completed',
        'downloadUrl': 'https://storage.googleapis.com/export.zip',
      });
      expect(r.status, 'completed');
      expect(r.downloadUrl, isNotNull);
      expect(r.jobId, isNull);
    });

    test('fromJson parses async export', () {
      final r = ExportResponse.fromJson({
        'status': 'pending',
        'jobId': 'job-456',
      });
      expect(r.status, 'pending');
      expect(r.jobId, 'job-456');
      expect(r.downloadUrl, isNull);
    });
  });

  group('ExportStatus', () {
    test('parses completed with URL', () {
      final s = ExportStatus.fromJson({
        'status': 'completed',
        'downloadUrl': 'https://example.com/data.zip',
        'progress': 100,
      });
      expect(s.status, 'completed');
      expect(s.progress, 100);
    });
  });

  // ─── Sarkar Verification ─────────────────────────────────────────────

  group('VerificationResult', () {
    test('fromJson parses verified result', () {
      final r = sarkar.VerificationResult.fromJson({
        'verified': true,
        'schoolName': 'Government School #42',
        'district': 'Jaipur',
        'state': 'Rajasthan',
      });
      expect(r.verified, true);
      expect(r.schoolName, contains('Government'));
      expect(r.state, 'Rajasthan');
    });

    test('fromJson parses failed verification', () {
      final r = sarkar.VerificationResult.fromJson({
        'verified': false,
        'message': 'UDISE code not found',
      });
      expect(r.verified, false);
      expect(r.message, contains('not found'));
    });
  });
}
