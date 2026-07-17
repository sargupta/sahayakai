import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/rubric_generator/presentation/widgets/rubric_result_view.dart';

import 'rubric_fixtures.dart';

/// The load-bearing gate for P1.2: the criteria x levels grid scrolls sideways
/// inside its OWN box while the page never does (DESIGN_RUBRIC §8, and the known
/// ToolScaffold crash). Rendered inside the same vertical-scrolling, page-padded
/// shell the real screen uses, so a stray horizontal page scroll would show up
/// here.
bool _isHorizontal(ScrollableState s) =>
    s.axisDirection == AxisDirection.left ||
    s.axisDirection == AxisDirection.right;

bool _isVertical(ScrollableState s) =>
    s.axisDirection == AxisDirection.up || s.axisDirection == AxisDirection.down;

List<ScrollableState> _scrollables(WidgetTester tester) =>
    tester.stateList<ScrollableState>(find.byType(Scrollable)).toList();

void main() {
  group('grid rendering', () {
    testWidgets('renders the header, criteria and level cells', (tester) async {
      await tester.pumpWidget(hostResult(RubricResultView(rubric: buildRubric())));
      await tester.pumpAndSettle();

      // Header: the criterion-column key + the level headers with points.
      expect(find.text('Criteria'), findsOneWidget);
      expect(find.text('Exemplary'), findsWidgets);
      expect(find.text('4 pts'), findsWidgets);
      expect(find.text('1 pts'), findsWidgets);

      // Criterion rows + a level description.
      expect(find.textContaining('Organisation'), findsOneWidget);
      expect(find.textContaining('Meets the standard expectations'),
          findsWidgets);

      expect(tester.takeException(), isNull);
    });

    testWidgets('an empty rubric shows the dignified empty state',
        (tester) async {
      await tester.pumpWidget(
        hostResult(RubricResultView(rubric: buildRubric(empty: true))),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('No rubric came back'), findsOneWidget);
      // No grid, so nothing scrolls sideways.
      expect(_scrollables(tester).where(_isHorizontal), isEmpty);
    });

    testWidgets('a levels-less response falls back to a criteria list, no grid',
        (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        hostResult(RubricResultView(rubric: buildRubric(partial: true))),
      );
      await tester.pumpAndSettle();

      // The criteria still render as full-width prose...
      expect(find.textContaining('Research and Content'), findsOneWidget);
      expect(find.textContaining('Presentation'), findsOneWidget);
      // ...but with no level columns there is no horizontal scroller and no
      // Table.
      expect(find.byType(Table), findsNothing);
      expect(_scrollables(tester).where(_isHorizontal), isEmpty);
      expect(tester.takeException(), isNull);
    });
  });

  group('scroll contract', () {
    testWidgets('the grid scrolls horizontally inside its own box',
        (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(hostResult(RubricResultView(rubric: buildRubric())));
      await tester.pumpAndSettle();

      // Exactly one horizontal scroller: the grid, and only the grid.
      final horizontal = _scrollables(tester).where(_isHorizontal).toList();
      expect(horizontal, hasLength(1));

      // At 360dp the grid (criterion column + four level columns) is wider than
      // its box, so there is real content to scroll to.
      final grid = horizontal.single;
      expect(grid.position.maxScrollExtent, greaterThan(0));

      // And it actually moves when dragged. The header corner cell is visible at
      // top-left, so it is a safe drag handle.
      final before = grid.position.pixels;
      await tester.drag(find.text('Criteria'), const Offset(-240, 0));
      await tester.pumpAndSettle();
      expect(
        _scrollables(tester).firstWhere(_isHorizontal).position.pixels,
        greaterThan(before),
      );
    });

    testWidgets('the PAGE never scrolls sideways — only the grid does',
        (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(hostResult(RubricResultView(rubric: buildRubric())));
      await tester.pumpAndSettle();

      final all = _scrollables(tester);
      // The one horizontal scroller is the grid; the page scroller is vertical.
      expect(all.where(_isHorizontal), hasLength(1));
      expect(all.where(_isVertical), isNotEmpty);
      for (final page in all.where(_isVertical)) {
        // A vertical scroller has no sideways travel by construction.
        expect(page.axisDirection, anyOf(AxisDirection.up, AxisDirection.down));
      }
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
