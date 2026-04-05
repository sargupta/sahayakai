import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/vidya/data/vidya_repository.dart';
import 'package:sahayakai_mobile/src/features/vidya/domain/vidya_models.dart';
import '../helpers/mocks.dart';

void main() {
  late VidyaRepository repo;
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    repo = VidyaRepository(mocks.apiClient);
  });

  group('VidyaRepository', () {
    group('chat', () {
      test('returns response without action', () async {
        when(() => mockDio.post(
              '/assistant',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({
              'response': 'Hello! How can I help you today?',
              'action': null,
            }));

        final result = await repo.chat(message: 'Hi');

        expect(result.response, contains('Hello'));
        expect(result.action, isNull);
      });

      test('returns response with NAVIGATE_AND_FILL action', () async {
        when(() => mockDio.post(
              '/assistant',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({
              'response': 'Let me create a quiz for you!',
              'action': {
                'type': 'NAVIGATE_AND_FILL',
                'flow': 'quiz-generator',
                'label': 'Generate Quiz',
                'params': {
                  'topic': 'Photosynthesis',
                  'gradeLevel': 'Class 7',
                  'subject': 'Science',
                },
              },
            }));

        final result = await repo.chat(message: 'quiz chahiye');

        expect(result.action, isNotNull);
        expect(result.action!.flow, 'quiz-generator');
        expect(result.action!.params['topic'], 'Photosynthesis');
        expect(result.action!.routePath, '/quiz-config');
      });

      test('sends chat history correctly', () async {
        when(() => mockDio.post(
              '/assistant',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({
              'response': 'Sure, same topic.',
            }));

        await repo.chat(
          message: 'worksheet bana do',
          chatHistory: [
            {'user': 'quiz banao', 'ai': 'OK, quiz on photosynthesis.'},
          ],
        );

        final captured = verify(() => mockDio.post(
              '/assistant',
              data: captureAny(named: 'data'),
            )).captured.single as Map<String, dynamic>;

        expect(captured['chatHistory'], isNotEmpty);
        expect(captured['chatHistory'][0]['user'], 'quiz banao');
      });
    });

    group('session', () {
      test('getSession returns null on error', () async {
        when(() => mockDio.get('/vidya/session'))
            .thenThrow(Exception('Network error'));

        final session = await repo.getSession();
        expect(session, isNull);
      });

      test('getSession parses turns', () async {
        when(() => mockDio.get('/vidya/session'))
            .thenAnswer((_) async => successResponse({
                  'id': 's1',
                  'turns': [
                    {
                      'user': 'hello',
                      'ai': 'Hi teacher!',
                      'timestamp': '2026-04-05T10:00:00Z',
                    },
                  ],
                  'createdAt': '2026-04-05T10:00:00Z',
                  'updatedAt': '2026-04-05T10:01:00Z',
                }));

        final session = await repo.getSession();
        expect(session, isNotNull);
        expect(session!.turns.length, 1);
        expect(session.turns[0].user, 'hello');
      });
    });

    group('profile', () {
      test('getProfile returns null on 404', () async {
        when(() => mockDio.get('/vidya/profile'))
            .thenThrow(Exception('Not found'));

        final profile = await repo.getProfile();
        expect(profile, isNull);
      });

      test('getProfile parses correctly', () async {
        when(() => mockDio.get('/vidya/profile'))
            .thenAnswer((_) async => successResponse({
                  'preferredGrade': 'Class 8',
                  'preferredSubject': 'Science',
                  'schoolContext': 'Rural school in Rajasthan',
                }));

        final profile = await repo.getProfile();
        expect(profile!.preferredGrade, 'Class 8');
        expect(profile.schoolContext, contains('Rajasthan'));
      });

      test('getProfile returns null when response data is null', () async {
        when(() => mockDio.get('/vidya/profile'))
            .thenAnswer((_) async => successResponse(null));

        final profile = await repo.getProfile();
        expect(profile, isNull);
      });

      test('updateProfile sends correct data', () async {
        when(() => mockDio.post(
              '/vidya/profile',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({'ok': true}));

        const profile = VidyaProfile(
          preferredGrade: 'Class 10',
          preferredSubject: 'Mathematics',
          schoolContext: 'Urban CBSE school',
        );

        await repo.updateProfile(profile);

        final captured = verify(() => mockDio.post(
              '/vidya/profile',
              data: captureAny(named: 'data'),
            )).captured.single as Map<String, dynamic>;

        expect(captured['preferredGrade'], 'Class 10');
        expect(captured['preferredSubject'], 'Mathematics');
        expect(captured['schoolContext'], 'Urban CBSE school');
      });
    });

    group('saveSession', () {
      test('sends session data correctly', () async {
        when(() => mockDio.post(
              '/vidya/session',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({'ok': true}));

        final session = VidyaSession(
          id: 'session-1',
          turns: [
            VidyaTurn(
              user: 'hello',
              ai: 'Hi teacher!',
              timestamp: DateTime(2026, 4, 5),
            ),
          ],
          createdAt: DateTime(2026, 4, 5),
          updatedAt: DateTime(2026, 4, 5),
        );

        await repo.saveSession(session);

        verify(() => mockDio.post(
              '/vidya/session',
              data: any(named: 'data'),
            )).called(1);
      });
    });

    group('getSession', () {
      test('returns null when response data is null', () async {
        when(() => mockDio.get('/vidya/session'))
            .thenAnswer((_) async => successResponse(null));

        final session = await repo.getSession();
        expect(session, isNull);
      });

      test('returns null on non-200 status', () async {
        when(() => mockDio.get('/vidya/session'))
            .thenAnswer(
                (_) async => successResponse(null, statusCode: 404));

        final session = await repo.getSession();
        expect(session, isNull);
      });
    });

    group('chat — error paths', () {
      test('throws on non-200 status', () async {
        when(() => mockDio.post(
              '/assistant',
              data: any(named: 'data'),
            )).thenAnswer(
            (_) async => successResponse(null, statusCode: 500));

        expect(
          () => repo.chat(message: 'test'),
          throwsException,
        );
      });

      test('sends optional parameters when provided', () async {
        when(() => mockDio.post(
              '/assistant',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({
              'response': 'OK',
            }));

        await repo.chat(
          message: 'test',
          currentScreenContext: {'screen': 'home'},
          teacherProfile: {'grade': 'Class 7'},
          detectedLanguage: 'hi',
        );

        final captured = verify(() => mockDio.post(
              '/assistant',
              data: captureAny(named: 'data'),
            )).captured.single as Map<String, dynamic>;

        expect(captured['currentScreenContext'], {'screen': 'home'});
        expect(captured['teacherProfile'], {'grade': 'Class 7'});
        expect(captured['detectedLanguage'], 'hi');
      });
    });
  });

  group('VidyaAction.routePath', () {
    test('maps flow keys to GoRouter paths', () {
      expect(
        const VidyaAction(
            type: 'NAVIGATE_AND_FILL', flow: 'lesson-plan', label: 'LP')
            .routePath,
        '/create-lesson',
      );
      expect(
        const VidyaAction(
            type: 'NAVIGATE_AND_FILL', flow: 'quiz-generator', label: 'Q')
            .routePath,
        '/quiz-config',
      );
      expect(
        const VidyaAction(
            type: 'NAVIGATE_AND_FILL', flow: 'exam-paper', label: 'EP')
            .routePath,
        '/exam-paper',
      );
      expect(
        const VidyaAction(
            type: 'NAVIGATE_AND_FILL', flow: 'unknown-flow', label: 'X')
            .routePath,
        '/',
      );
    });
  });
}
