import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/vidya/data/vidya_repository.dart';
import 'package:sahayakai_mobile/src/features/vidya/domain/vidya_models.dart';
import 'package:sahayakai_mobile/src/features/vidya/presentation/providers/vidya_provider.dart';
import 'package:sahayakai_mobile/src/features/vidya/presentation/screens/vidya_chat_screen.dart';
import '../helpers/test_utils.dart';

class MockVidyaRepository extends Mock implements VidyaRepository {}

void main() {
  late MockVidyaRepository mockRepo;

  setUp(() {
    mockRepo = MockVidyaRepository();

    registerFallbackValue(VidyaSession(
      turns: [],
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    ));

    // Default stubs
    when(() => mockRepo.getSession()).thenAnswer((_) async => null);
    when(() => mockRepo.saveSession(any())).thenAnswer((_) async {});
  });

  group('VidyaChatScreen', () {
    testWidgets('shows welcome message when empty', (tester) async {
      await pumpTestApp(
        tester,
        const VidyaChatScreen(),
        overrides: [
          vidyaRepositoryProvider.overrideWithValue(mockRepo),
        ],
      );
      await tester.pumpAndSettle();

      expect(find.text("Namaste! I'm VIDYA"), findsOneWidget);
      expect(find.textContaining('teaching assistant'), findsOneWidget);
    });

    testWidgets('has text input and send button', (tester) async {
      await pumpTestApp(
        tester,
        const VidyaChatScreen(),
        overrides: [
          vidyaRepositoryProvider.overrideWithValue(mockRepo),
        ],
      );
      await tester.pumpAndSettle();

      expect(find.byType(TextField), findsOneWidget);
      expect(find.byIcon(Icons.send_rounded), findsOneWidget);
    });

    testWidgets('has clear chat button in app bar', (tester) async {
      await pumpTestApp(
        tester,
        const VidyaChatScreen(),
        overrides: [
          vidyaRepositoryProvider.overrideWithValue(mockRepo),
        ],
      );
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.delete_outline_rounded), findsOneWidget);
    });

    testWidgets('shows typing indicator during loading', (tester) async {
      when(() => mockRepo.chat(
            message: any(named: 'message'),
            chatHistory: any(named: 'chatHistory'),
            currentScreenContext: any(named: 'currentScreenContext'),
            teacherProfile: any(named: 'teacherProfile'),
            detectedLanguage: any(named: 'detectedLanguage'),
          )).thenAnswer((_) async {
        // Simulate slow response
        await Future.delayed(const Duration(seconds: 5));
        return const VidyaResponse(response: 'Done');
      });

      await pumpTestApp(
        tester,
        const VidyaChatScreen(),
        overrides: [
          vidyaRepositoryProvider.overrideWithValue(mockRepo),
        ],
      );
      await tester.pumpAndSettle();

      // Type and send a message
      await tester.enterText(find.byType(TextField), 'hello');
      await tester.tap(find.byIcon(Icons.send_rounded));
      await tester.pump(); // Don't settle -- loading state

      expect(find.text('VIDYA is thinking...'), findsOneWidget);
    });
  });
}
