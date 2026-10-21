import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/rubric_generator/presentation/widgets/rubric_result_view.dart';

import 'rubric_fixtures.dart';

/// The load-bearing gate for P1.2, re-cut for v3 screen 10: the rubric is now
/// STACKED — one card per criterion, its performance levels listed vertically
/// inside — so nothing scrolls sideways at all. The old contract (a criteria ×
/// levels `Table` in its own horizontal scroller) is retired: on a 360dp phone
/// that forced a sideways scroll the design dropped. These tests pin the new
/// contract — real content, no `Table`, no horizontal scroller, no overflow.
bool _isHorizontal(ScrollableState s) =>
    s.axisDirection == AxisDirection.left ||
    s.axisDirection == AxisDirection.right;

bool _isVertical(ScrollableState s) =>
    s.axisDirection == AxisDirection.up ||
    s.axisDirection == AxisDirection.down;

List<ScrollableState> _scrollables(WidgetTester tester) =>
    tester.stateList<ScrollableState>(find.byType(Scrollable)).toList();

void main() {
  group('stacked rendering', () {
    testWidgets('renders each criterion, its levels and their points', (
      tester,
    ) async {
      await tester.pumpWidget(
        hostResult(RubricResultView(rubric: buildRubric())),
      );
      await tester.pumpAndSettle();

      // Every criterion is present (all four, stacked — not one representative
      // header row).
      expect(find.textContaining('Organisation'), findsOneWidget);
      expect(find.textContaining('Teamwork'), findsOneWidget);

      // Level names and their point chips render for each criterion (4 criteria
      // × 4 levels), and a level description shows.
      expect(find.text('Exemplary'), findsWidgets);
      expect(find.text('Beginning'), findsWidgets);
      expect(find.text('4'), findsWidgets); // the top level's point chip
      expect(find.text('1'), findsWidgets); // the bottom level's point chip
      expect(
        find.textContaining('Meets the standard expectations'),
        findsWidgets,
      );

      // The stacked layout uses no Table and no sideways scroller.
      expect(find.byType(Table), findsNothing);
      expect(_scrollables(tester).where(_isHorizontal), isEmpty);
      expect(tester.takeException(), isNull);
    });

    testWidgets('an empty rubric shows the dignified empty state', (
      tester,
    ) async {
      await tester.pumpWidget(
        hostResult(RubricResultView(rubric: buildRubric(empty: true))),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('No rubric came back'), findsOneWidget);
      expect(_scrollables(tester).where(_isHorizontal), isEmpty);
    });

    testWidgets('a levels-less response still stacks the criteria', (
      tester,
    ) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        hostResult(RubricResultView(rubric: buildRubric(partial: true))),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Research and Content'), findsOneWidget);
      expect(find.textContaining('Presentation'), findsOneWidget);
      expect(find.byType(Table), findsNothing);
      expect(_scrollables(tester).where(_isHorizontal), isEmpty);
      expect(tester.takeException(), isNull);
    });
  });

  group('scroll contract', () {
    testWidgets('the page scrolls only vertically — nothing sideways', (
      tester,
    ) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        hostResult(RubricResultView(rubric: buildRubric())),
      );
      await tester.pumpAndSettle();

      final all = _scrollables(tester);
      expect(all.where(_isHorizontal), isEmpty);
      expect(all.where(_isVertical), isNotEmpty);
      expect(tester.takeException(), isNull);
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
                RubricResultView(rubric: buildRubric()),
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
