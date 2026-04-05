import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:sahayakai_mobile/src/features/content/domain/content_models.dart';
import 'package:sahayakai_mobile/src/features/content/presentation/providers/content_provider.dart';
import 'package:sahayakai_mobile/src/features/home/presentation/screens/my_library_screen.dart';
import '../helpers/test_utils.dart';

void main() {
  group('MyLibraryScreen', () {
    testWidgets('shows empty state when no content', (tester) async {
      await pumpTestApp(
        tester,
        const Scaffold(body: MyLibraryScreen()),
        overrides: [
          contentListProvider.overrideWith(
            (ref, filter) async => const ContentListResponse(items: [], count: 0),
          ),
        ],
      );
      await tester.pumpAndSettle();

      expect(find.text('My Library'), findsOneWidget);
      expect(find.text('No Content Yet'), findsOneWidget);
    });

    testWidgets('shows content items', (tester) async {
      await pumpTestApp(
        tester,
        const Scaffold(body: MyLibraryScreen()),
        overrides: [
          contentListProvider.overrideWith(
            (ref, filter) async => ContentListResponse(
              items: [
                ContentItem.fromJson({
                  'id': '1',
                  'type': 'lesson-plan',
                  'title': 'Photosynthesis LP',
                  'gradeLevel': 'Class 7',
                }),
                ContentItem.fromJson({
                  'id': '2',
                  'type': 'quiz',
                  'title': 'Fractions Quiz',
                }),
              ],
              count: 2,
            ),
          ),
        ],
      );
      await tester.pumpAndSettle();

      expect(find.text('Photosynthesis LP'), findsOneWidget);
      expect(find.text('Fractions Quiz'), findsOneWidget);
    });

    testWidgets('shows type filter chips', (tester) async {
      await pumpTestApp(
        tester,
        const Scaffold(body: MyLibraryScreen()),
        overrides: [
          contentListProvider.overrideWith(
            (ref, filter) async => const ContentListResponse(items: [], count: 0),
          ),
        ],
      );
      await tester.pumpAndSettle();

      expect(find.text('All'), findsOneWidget);
      expect(find.text('Lesson Plan'), findsOneWidget);
      expect(find.text('Quiz'), findsOneWidget);
      expect(find.text('Worksheet'), findsOneWidget);
    });
  });
}
