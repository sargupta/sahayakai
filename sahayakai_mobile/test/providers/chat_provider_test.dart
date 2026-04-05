import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/chat/presentation/providers/chat_provider.dart';
import '../helpers/mocks.dart';

void main() {
  late MockChatRepository mockRepo;
  late ChatNotifier notifier;

  setUp(() {
    mockRepo = MockChatRepository();
    notifier = ChatNotifier(mockRepo);
  });

  group('ChatNotifier', () {
    test('initial state is empty list', () {
      expect(notifier.state, isEmpty);
    });

    test('askQuestion adds user message then assistant message on success',
        () async {
      when(() => mockRepo.sendQuestion(any(), any(), any())).thenAnswer(
        (_) async => {
          'answer': 'Photosynthesis is the process...',
          'videoSuggestionUrl': 'https://youtube.com/xyz',
        },
      );

      await notifier.askQuestion('What is photosynthesis?');

      expect(notifier.state.length, 2);

      // User message
      final userMsg = notifier.state[0];
      expect(userMsg.isUser, true);
      expect(userMsg.text, 'What is photosynthesis?');
      expect(userMsg.id, isNotEmpty);

      // Assistant message
      final aiMsg = notifier.state[1];
      expect(aiMsg.isUser, false);
      expect(aiMsg.text, 'Photosynthesis is the process...');
      expect(aiMsg.videoUrl, 'https://youtube.com/xyz');
    });

    test('askQuestion uses fallback text when answer key is null', () async {
      when(() => mockRepo.sendQuestion(any(), any(), any())).thenAnswer(
        (_) async => <String, dynamic>{},
      );

      await notifier.askQuestion('Test');

      expect(notifier.state.length, 2);
      expect(notifier.state[1].text, 'No answer received.');
      expect(notifier.state[1].videoUrl, isNull);
    });

    test('askQuestion adds error message on exception', () async {
      when(() => mockRepo.sendQuestion(any(), any(), any()))
          .thenThrow(Exception('Network failure'));

      await notifier.askQuestion('Test');

      expect(notifier.state.length, 2);

      final errorMsg = notifier.state[1];
      expect(errorMsg.isUser, false);
      expect(errorMsg.text, contains('Error'));
      expect(errorMsg.text, contains('Network failure'));
    });

    test('multiple questions accumulate messages', () async {
      when(() => mockRepo.sendQuestion(any(), any(), any())).thenAnswer(
        (_) async => {'answer': 'Response'},
      );

      await notifier.askQuestion('Q1');
      await notifier.askQuestion('Q2');

      expect(notifier.state.length, 4);
      expect(notifier.state[0].text, 'Q1');
      expect(notifier.state[1].text, 'Response');
      expect(notifier.state[2].text, 'Q2');
      expect(notifier.state[3].text, 'Response');
    });

    test('each message gets a unique id', () async {
      when(() => mockRepo.sendQuestion(any(), any(), any())).thenAnswer(
        (_) async => {'answer': 'A'},
      );

      await notifier.askQuestion('Q');

      final ids = notifier.state.map((m) => m.id).toSet();
      expect(ids.length, 2, reason: 'Each message should have a unique id');
    });

    test('passes fixed language and grade to repository', () async {
      when(() => mockRepo.sendQuestion(any(), any(), any())).thenAnswer(
        (_) async => {'answer': 'ok'},
      );

      await notifier.askQuestion('Hi');

      verify(() => mockRepo.sendQuestion('Hi', 'English', 'Grade 6')).called(1);
    });
  });
}
