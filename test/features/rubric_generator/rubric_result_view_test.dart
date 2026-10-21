import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/rubric_generator/presentation/widgets/rubric_result_view.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';

import 'rubric_fixtures.dart';

/// Result-layer composition for the Rubric Generator: the header (title + grade
/// / subject badges), the assignment description, and the empty-result path. The
/// rubric now renders stacked (v3 screen 10) — one card per criterion, no
/// sideways scroller and no swipe affordance. The stacked layout mechanics live
/// in rubric_grid_test.dart.
void main() {
  testWidgets('renders the header, meta badges and description', (
    tester,
  ) async {
    await tester.pumpWidget(
      hostResult(RubricResultView(rubric: buildRubric())),
    );
    await tester.pumpAndSettle();

    // Title + grade/subject badges.
    expect(
      find.textContaining('Renewable Energy Project Rubric'),
      findsOneWidget,
    );
    expect(find.text('Class 5'), findsOneWidget);
    expect(find.text('Science'), findsOneWidget);

    // The assignment description. The retired swipe affordance is gone.
    expect(
      find.textContaining('Grades a Class 5 renewable-energy project'),
      findsOneWidget,
    );
    expect(find.text('Swipe across to see all levels.'), findsNothing);

    expect(tester.takeException(), isNull);
  });

  testWidgets('the empty result shows the dignified empty state', (
    tester,
  ) async {
    await tester.pumpWidget(
      hostResult(RubricResultView(rubric: buildRubric(empty: true))),
    );
    await tester.pumpAndSettle();

    expect(find.byType(EmptyView), findsOneWidget);
    expect(find.textContaining('No rubric came back'), findsOneWidget);
  });

  testWidgets('a levels-less rubric still renders its criteria', (
    tester,
  ) async {
    await tester.pumpWidget(
      hostResult(RubricResultView(rubric: buildRubric(partial: true))),
    );
    await tester.pumpAndSettle();

    expect(
      find.textContaining('Renewable Energy Project Rubric'),
      findsOneWidget,
    );
    expect(find.textContaining('Research and Content'), findsOneWidget);
  });
}
