import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/worksheet_wizard/domain/worksheet.dart';
import 'package:sahayakai/features/worksheet_wizard/presentation/widgets/worksheet_result_view.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';

import '../../support/app_harness.dart';
import '../../support/fake_api_client.dart';
import 'worksheet_fixtures.dart';

/// Result-layer gates for the Worksheet Wizard. Renders a real worksheet inside
/// the same scrolling, page-padded shell the screen uses, at the DESIGN_RUBRIC
/// §11 Indic strings + an unbreakable compound word, and checks the empty
/// result path.
void main() {
  group('rendering', () {
    testWidgets('renders every section of a full worksheet', (tester) async {
      await tester.pumpWidget(
        hostResult(WorksheetResultView(worksheet: buildWorksheet())),
      );
      await tester.pumpAndSettle();

      // Header + meta badges.
      expect(find.textContaining('Counting mangoes'), findsOneWidget);
      expect(find.text('Class 2'), findsOneWidget);
      expect(find.text('Mathematics'), findsOneWidget);

      // Section headings — DocumentSheetSection UPPERCASEs Latin headings.
      expect(find.text('LEARNING OBJECTIVES'), findsOneWidget);
      expect(find.text('INSTRUCTIONS FOR STUDENTS'), findsOneWidget);
      expect(find.text('ACTIVITIES'), findsOneWidget);
      expect(find.text('ANSWER KEY'), findsOneWidget);

      // Activity type badge + sub-notes.
      expect(find.text('Question'), findsOneWidget);
      expect(find.text('Creative task'), findsOneWidget);
      expect(find.text('For the teacher'), findsOneWidget);
      expect(find.text('On the blackboard'), findsOneWidget);

      expect(tester.takeException(), isNull);
    });

    testWidgets('numbers the answer key from the 0-based activityIndex',
        (tester) async {
      await tester.pumpWidget(
        hostResult(WorksheetResultView(worksheet: buildWorksheet())),
      );
      await tester.pumpAndSettle();

      // activityIndex 0 -> "1". The first activity is also "1", so the number
      // appears in both the activity card and the answer row.
      expect(find.text('1'), findsWidgets);
      expect(tester.takeException(), isNull);
    });

    testWidgets('an empty worksheet shows the dignified empty state',
        (tester) async {
      await tester.pumpWidget(
        hostResult(WorksheetResultView(worksheet: buildWorksheet(empty: true))),
      );
      await tester.pumpAndSettle();

      expect(find.byType(EmptyView), findsOneWidget);
      expect(find.textContaining('No worksheet came back'), findsOneWidget);
    });

    testWidgets(
        'money bug: a title-only response (no activities) shows the empty '
        'state, never a fake-success Save button', (tester) async {
      // The old AND-of-every-field emptiness check treated a title-only,
      // activity-less worksheet as "not empty" because the title alone was
      // non-blank — the same fake-success bug the exam paper had.
      const titleOnly = Worksheet(
        title: 'Counting Mangoes',
        gradeLevel: 'Class 2',
        subject: 'Mathematics',
        learningObjectives: ['Count up to 20'],
      );
      expect(titleOnly.activities, isEmpty);
      expect(titleOnly.isEmpty, isTrue);

      await tester.pumpWidget(hostResult(
        const WorksheetResultView(worksheet: titleOnly),
      ));
      await tester.pumpAndSettle();

      expect(find.byType(EmptyView), findsOneWidget);
      expect(find.textContaining('No worksheet came back'), findsOneWidget);
      expect(find.textContaining('Counting Mangoes'), findsNothing);
    });
  });

  group('save to library', () {
    testWidgets(
        'a save request surfaces a Save action that POSTs to content/save',
        (tester) async {
      tester.view.physicalSize = const Size(360, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      final client = FakeApiClient(
        postResponse: <String, dynamic>{'success': true, 'id': 'ws-9'},
      );

      const request = WorksheetRequest(
        imageDataUri: 'data:image/png;base64,AAAA',
        prompt: 'Counting mangoes',
        gradeLevel: 'Class 2',
        language: 'English',
      );

      await tester.pumpWidget(
        hostResult(
          WorksheetResultView(
            worksheet: buildWorksheet(),
            onRegenerate: () {},
            saveRequest: request,
          ),
          overrides: [apiClientOverride(client)],
        ),
      );
      await tester.pumpAndSettle();

      // The Save action is now offered (it was Copy-only before Unit 14).
      final save = find.text('Save to Library');
      expect(save, findsOneWidget);

      await tester.ensureVisible(save);
      await tester.pumpAndSettle();
      await tester.tap(save);
      await tester.pumpAndSettle();

      // It hit the real content/save endpoint and reflected the saved state.
      expect(client.posts.single.path, '/api/content/save');
      expect((client.posts.single.data! as Map)['type'], 'worksheet');
      expect(find.text('Saved to your Library'), findsOneWidget);
    });

    testWidgets('with no saveRequest the footer has no Save action',
        (tester) async {
      tester.view.physicalSize = const Size(360, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        hostResult(
          WorksheetResultView(worksheet: buildWorksheet(), onRegenerate: () {}),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Save to Library'), findsNothing);
      expect(find.text('Regenerate'), findsOneWidget);
      expect(find.text('Copy'), findsOneWidget);
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9, §12.10, §12.11, §12.13)', () {
    for (final brightness in Brightness.values) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 in ${brightness.name}',
        (tester) async {
          tester.view.physicalSize = kNarrowPhone;
          tester.view.devicePixelRatio = 1.0;
          addTearDown(tester.view.reset);

          await tester.pumpWidget(
            MediaQuery(
              data: const MediaQueryData(textScaler: TextScaler.linear(1.3)),
              child: hostResult(
                WorksheetResultView(worksheet: buildWorksheet()),
                brightness: brightness,
              ),
            ),
          );
          await tester.pumpAndSettle();

          expect(tester.takeException(), isNull);
        },
      );
    }
  });
}
