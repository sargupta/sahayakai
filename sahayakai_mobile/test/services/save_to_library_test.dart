import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/content/data/content_repository.dart';
import 'package:sahayakai_mobile/src/components/save_to_library_button.dart';
import '../helpers/mocks.dart';

class MockContentRepository extends Mock implements ContentRepository {}

void main() {
  late MockContentRepository mockRepo;

  setUp(() {
    mockRepo = MockContentRepository();
  });

  Widget buildTestWidget() {
    return ProviderScope(
      overrides: [
        contentRepositoryProvider.overrideWithValue(mockRepo),
      ],
      child: const MaterialApp(
        home: Scaffold(
          body: SaveToLibraryButton(
            type: 'lesson-plan',
            title: 'Test Plan',
            data: {'title': 'Test'},
          ),
        ),
      ),
    );
  }

  group('SaveToLibraryButton', () {
    testWidgets('shows bookmark icon initially', (tester) async {
      await tester.pumpWidget(buildTestWidget());

      expect(find.byIcon(Icons.bookmark_add_rounded), findsOneWidget);
    });

    testWidgets('shows checkmark after successful save', (tester) async {
      when(() => mockRepo.saveContent(
            type: any(named: 'type'),
            title: any(named: 'title'),
            data: any(named: 'data'),
            gradeLevel: any(named: 'gradeLevel'),
            subject: any(named: 'subject'),
            topic: any(named: 'topic'),
            language: any(named: 'language'),
            isPublic: any(named: 'isPublic'),
          )).thenAnswer((_) async => 'saved-id');

      await tester.pumpWidget(buildTestWidget());
      await tester.tap(find.byIcon(Icons.bookmark_add_rounded));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);
      expect(find.byIcon(Icons.bookmark_add_rounded), findsNothing);
    });

    testWidgets('shows snackbar on error', (tester) async {
      when(() => mockRepo.saveContent(
            type: any(named: 'type'),
            title: any(named: 'title'),
            data: any(named: 'data'),
            gradeLevel: any(named: 'gradeLevel'),
            subject: any(named: 'subject'),
            topic: any(named: 'topic'),
            language: any(named: 'language'),
            isPublic: any(named: 'isPublic'),
          )).thenThrow(Exception('Network error'));

      await tester.pumpWidget(buildTestWidget());
      await tester.tap(find.byIcon(Icons.bookmark_add_rounded));
      await tester.pumpAndSettle();

      expect(find.textContaining('Save failed'), findsOneWidget);
      // Button should still be visible (not checkmark)
      expect(find.byIcon(Icons.bookmark_add_rounded), findsOneWidget);
    });

    testWidgets('prevents double-save', (tester) async {
      when(() => mockRepo.saveContent(
            type: any(named: 'type'),
            title: any(named: 'title'),
            data: any(named: 'data'),
            gradeLevel: any(named: 'gradeLevel'),
            subject: any(named: 'subject'),
            topic: any(named: 'topic'),
            language: any(named: 'language'),
            isPublic: any(named: 'isPublic'),
          )).thenAnswer((_) async => 'id');

      await tester.pumpWidget(buildTestWidget());
      await tester.tap(find.byIcon(Icons.bookmark_add_rounded));
      await tester.pumpAndSettle();

      // Now shows checkmark — tapping should do nothing.
      await tester.tap(find.byIcon(Icons.check_circle_rounded));
      await tester.pumpAndSettle();

      // saveContent should have been called exactly once.
      verify(() => mockRepo.saveContent(
            type: any(named: 'type'),
            title: any(named: 'title'),
            data: any(named: 'data'),
            gradeLevel: any(named: 'gradeLevel'),
            subject: any(named: 'subject'),
            topic: any(named: 'topic'),
            language: any(named: 'language'),
            isPublic: any(named: 'isPublic'),
          )).called(1);
    });
  });
}
