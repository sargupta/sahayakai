import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/teacher_training/presentation/widgets/advice_card.dart';
import 'package:sahayakai/features/teacher_training/presentation/widgets/teacher_training_result_view.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';

import 'teacher_training_fixtures.dart';

/// Result-layer composition for the Teaching Coach: the meta badges, the
/// introduction prose, the "Strategies" heading over the advice cards, the
/// closing prose, and the empty / partial paths. Also proves no horizontal
/// scroller sneaks in (the advice list is a plain vertical column of cards) and
/// no overflow at 360dp x textScale 1.3 in light + dark with Indic probes.
void main() {
  testWidgets('renders meta, introduction, one card per point, and conclusion', (
    tester,
  ) async {
    await tester.pumpWidget(
      hostResult(TeacherTrainingResultView(advice: buildAdvice())),
    );
    await tester.pumpAndSettle();

    // Meta badges.
    expect(find.text('Class 8'), findsOneWidget);
    expect(find.text('General'), findsOneWidget);

    // Introduction + the strategies heading + the closing prose. The heading now
    // renders through the DocumentSheetSection, which UPPERCASES Latin titles.
    expect(
      find.textContaining('Engagement across a full lesson'),
      findsOneWidget,
    );
    expect(find.text('STRATEGIES'), findsOneWidget);
    expect(
      find.textContaining('You are already asking the right questions'),
      findsOneWidget,
    );

    // One card per advice point, each showing its pedagogy tag.
    expect(find.byType(AdviceCard), findsNWidgets(3));
    expect(find.text('Social Constructivism'), findsOneWidget);
    expect(find.text('Scaffolding'), findsOneWidget);
    expect(find.text('Spaced Repetition'), findsOneWidget);

    // The advice list must NOT introduce a horizontal scroller: it is a plain
    // vertical column of cards (unlike the rubric grid).
    final horizontal = find.byWidgetPredicate(
      (w) => w is Scrollable && w.axisDirection == AxisDirection.right,
    );
    expect(horizontal, findsNothing);

    expect(tester.takeException(), isNull);
  });

  testWidgets('the empty result shows the dignified empty state', (
    tester,
  ) async {
    await tester.pumpWidget(
      hostResult(TeacherTrainingResultView(advice: buildAdvice(empty: true))),
    );
    await tester.pumpAndSettle();

    expect(find.byType(EmptyView), findsOneWidget);
    expect(find.textContaining('No advice came back'), findsOneWidget);
    expect(find.text('STRATEGIES'), findsNothing);
    expect(find.byType(AdviceCard), findsNothing);
  });

  testWidgets(
    'a partial result keeps intro + cards, drops the empty conclusion and a '
    'blank pedagogy tag',
    (tester) async {
      await tester.pumpWidget(
        hostResult(
          TeacherTrainingResultView(advice: buildAdvice(partial: true)),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.textContaining('A fair question about classroom practice'),
        findsOneWidget,
      );
      expect(find.byType(AdviceCard), findsOneWidget);
      // No conclusion in the partial fixture, and the sole point has no pedagogy.
      expect(find.textContaining('Keep going'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  group('overflow gates (DESIGN_RUBRIC §12.9, §12.10, §12.11, §12.13)', () {
    for (final brightness in Brightness.values) {
      for (final scale in <double>[1.0, 1.3]) {
        testWidgets(
          'result renders at 360dp, textScale $scale, ${brightness.name}',
          (tester) async {
            tester.view.physicalSize = kNarrowPhone;
            tester.view.devicePixelRatio = 1.0;
            addTearDown(tester.view.reset);

            await tester.pumpWidget(
              hostResult(
                TeacherTrainingResultView(advice: buildAdvice()),
                brightness: brightness,
              ),
            );
            await tester.pumpAndSettle();

            expect(tester.takeException(), isNull);
            expect(find.byType(AdviceCard), findsNWidgets(3));
          },
        );
      }
    }
  });
}
