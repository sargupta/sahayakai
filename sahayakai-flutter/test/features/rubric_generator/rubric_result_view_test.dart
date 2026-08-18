import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/rubric_generator/presentation/widgets/rubric_result_view.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';

import 'rubric_fixtures.dart';

/// Result-layer composition for the Rubric Generator: the header (title + grade
/// / subject badges), the assignment description, the swipe affordance, and the
/// empty-result path. The grid's scroll mechanics live in rubric_grid_test.dart.
void main() {
  testWidgets('renders the header, meta badges, description and scroll hint', (
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

    // The assignment description and the horizontal-scroll affordance.
    expect(
      find.textContaining('Grades a Class 5 renewable-energy project'),
      findsOneWidget,
    );
    expect(find.text('Swipe across to see all levels.'), findsOneWidget);

    expect(tester.takeException(), isNull);
  });

  testWidgets('the empty result shows the dignified empty state, no hint', (
    tester,
  ) async {
    await tester.pumpWidget(
      hostResult(RubricResultView(rubric: buildRubric(empty: true))),
    );
    await tester.pumpAndSettle();

    expect(find.byType(EmptyView), findsOneWidget);
    expect(find.textContaining('No rubric came back'), findsOneWidget);
    expect(find.text('Swipe across to see all levels.'), findsNothing);
  });

  testWidgets(
    'a levels-less rubric keeps the header but drops the scroll hint',
    (tester) async {
      await tester.pumpWidget(
        hostResult(RubricResultView(rubric: buildRubric(partial: true))),
      );
      await tester.pumpAndSettle();

      expect(
        find.textContaining('Renewable Energy Project Rubric'),
        findsOneWidget,
      );
      // With no level columns, the swipe affordance would be a lie.
      expect(find.text('Swipe across to see all levels.'), findsNothing);
    },
  );
}
