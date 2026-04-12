import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/vidya/data/vidya_repository.dart';
import 'package:sahayakai_mobile/src/features/vidya/domain/vidya_models.dart';
import 'package:sahayakai_mobile/src/features/vidya/presentation/providers/vidya_provider.dart';

class MockVidyaRepository extends Mock implements VidyaRepository {}

void main() {
  late VidyaChatNotifier notifier;
  late MockVidyaRepository mockRepo;

  setUp(() {
    mockRepo = MockVidyaRepository();
    notifier = VidyaChatNotifier(mockRepo);

    // Stub saveSession (fire-and-forget, shouldn't throw).
    when(() => mockRepo.saveSession(any()))
        .thenAnswer((_) async {});
  });

  setUpAll(() {
    registerFallbackValue(VidyaSession(
      turns: [],
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    ));
  });

  group('VidyaChatNotifier', () {
    test('initial state is empty', () {
      expect(notifier.state.turns, isEmpty);
      expect(notifier.state.isLoading, false);
      expect(notifier.state.error, isNull);
    });

    test('sendMessage appends turn on success', () async {
      when(() => mockRepo.chat(
            message: any(named: 'message'),
            chatHistory: any(named: 'chatHistory'),
            currentScreenContext: any(named: 'currentScreenContext'),
            teacherProfile: any(named: 'teacherProfile'),
            detectedLanguage: any(named: 'detectedLanguage'),
          )).thenAnswer((_) async => const VidyaResponse(
            response: 'Here is your answer!',
          ));

      await notifier.sendMessage('What is photosynthesis?');

      expect(notifier.state.turns.length, 1);
      expect(notifier.state.turns[0].user, 'What is photosynthesis?');
      expect(notifier.state.turns[0].ai, 'Here is your answer!');
      expect(notifier.state.turns[0].action, isNull);
      expect(notifier.state.isLoading, false);
    });

    test('sendMessage preserves action in turn', () async {
      when(() => mockRepo.chat(
            message: any(named: 'message'),
            chatHistory: any(named: 'chatHistory'),
            currentScreenContext: any(named: 'currentScreenContext'),
            teacherProfile: any(named: 'teacherProfile'),
            detectedLanguage: any(named: 'detectedLanguage'),
          )).thenAnswer((_) async => const VidyaResponse(
            response: 'Creating a quiz for you!',
            action: VidyaAction(
              type: 'NAVIGATE_AND_FILL',
              flow: 'quiz-generator',
              label: 'Quiz',
              params: {'topic': 'Plants'},
            ),
          ));

      await notifier.sendMessage('quiz banao');

      expect(notifier.state.turns[0].action, isNotNull);
      expect(notifier.state.turns[0].action!.flow, 'quiz-generator');
    });

    test('sendMessage sets error on failure', () async {
      when(() => mockRepo.chat(
            message: any(named: 'message'),
            chatHistory: any(named: 'chatHistory'),
            currentScreenContext: any(named: 'currentScreenContext'),
            teacherProfile: any(named: 'teacherProfile'),
            detectedLanguage: any(named: 'detectedLanguage'),
          )).thenThrow(Exception('Network error'));

      await notifier.sendMessage('hello');

      expect(notifier.state.turns, isEmpty);
      expect(notifier.state.error, isNotNull);
      expect(notifier.state.isLoading, false);
    });

    test('sendMessage ignores empty text', () async {
      await notifier.sendMessage('');
      await notifier.sendMessage('   ');

      expect(notifier.state.turns, isEmpty);
      verifyNever(() => mockRepo.chat(
            message: any(named: 'message'),
            chatHistory: any(named: 'chatHistory'),
            currentScreenContext: any(named: 'currentScreenContext'),
            teacherProfile: any(named: 'teacherProfile'),
            detectedLanguage: any(named: 'detectedLanguage'),
          ));
    });

    test('clearHistory resets state', () async {
      when(() => mockRepo.chat(
            message: any(named: 'message'),
            chatHistory: any(named: 'chatHistory'),
            currentScreenContext: any(named: 'currentScreenContext'),
            teacherProfile: any(named: 'teacherProfile'),
            detectedLanguage: any(named: 'detectedLanguage'),
          )).thenAnswer((_) async => const VidyaResponse(response: 'Hi'));

      await notifier.sendMessage('hello');
      expect(notifier.state.turns.length, 1);

      notifier.clearHistory();
      expect(notifier.state.turns, isEmpty);
      expect(notifier.state.error, isNull);
    });

    test('chatHistory builds correctly for multi-turn', () async {
      when(() => mockRepo.chat(
            message: any(named: 'message'),
            chatHistory: any(named: 'chatHistory'),
            currentScreenContext: any(named: 'currentScreenContext'),
            teacherProfile: any(named: 'teacherProfile'),
            detectedLanguage: any(named: 'detectedLanguage'),
          )).thenAnswer((_) async => const VidyaResponse(response: 'Reply'));

      await notifier.sendMessage('Turn 1');
      await notifier.sendMessage('Turn 2');

      expect(notifier.state.turns.length, 2);
      expect(notifier.state.chatHistory.length, 2);
      expect(notifier.state.chatHistory[0]['user'], 'Turn 1');
      expect(notifier.state.chatHistory[1]['user'], 'Turn 2');
    });
  });
}
