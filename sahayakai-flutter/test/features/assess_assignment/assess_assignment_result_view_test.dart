import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/assess_assignment/domain/assessment.dart';
import 'package:sahayakai/features/assess_assignment/presentation/widgets/assess_assignment_result_view.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';
import 'package:sahayakai/shared/widgets/score_ring.dart';

import 'assess_assignment_fixtures.dart';

/// Result-layer gates for the scorecard. Renders each mode's shape inside the
/// same scrolling, page-padded shell the screen uses, at the DESIGN_RUBRIC §11
/// Indic strings + an unbreakable compound word, and checks the empty path.
void main() {
  group('rendering', () {
    testWidgets('renders every section of a full assessment', (tester) async {
      await tester.pumpWidget(
        hostResult(AssessAssignmentResultView(assessment: buildAssessment())),
      );
      await tester.pumpAndSettle();

      // Score card: the ScoreRing gauge shows the score over its 100 denominator.
      expect(find.byType(ScoreRing), findsOneWidget);
      expect(find.text('75'), findsOneWidget);
      expect(find.text('/ 100'), findsOneWidget);
      expect(find.text('12 of 16 points'), findsOneWidget);
      expect(find.text('Confidence 82%'), findsOneWidget);
      expect(find.textContaining('Graded against:'), findsOneWidget);

      // Sections. Headings now render through the DocumentSheetSection, which
      // UPPERCASES Latin titles.
      expect(find.text('WHAT THE STUDENT WROTE'), findsOneWidget);
      expect(find.text('SCORES BY CRITERION'), findsOneWidget);
      expect(find.text('STRENGTHS'), findsOneWidget);
      expect(find.text('TO WORK ON'), findsOneWidget);
      expect(find.text('NEXT STEPS'), findsOneWidget);
      expect(find.text('NOTE FOR THE STUDENT'), findsOneWidget);

      // Per-criterion detail: points badge + a low-confidence tag on the 0.3.
      expect(find.text('3 / 4'), findsOneWidget);
      expect(find.text('Low confidence'), findsOneWidget);

      // The low_contrast warning is surfaced as human copy.
      expect(find.text('Please check'), findsOneWidget);
      expect(find.textContaining('faint'), findsOneWidget);

      expect(tester.takeException(), isNull);
    });

    testWidgets('a transcribe-only result leads with the transcript, no score',
        (tester) async {
      await tester.pumpWidget(
        hostResult(AssessAssignmentResultView(assessment: buildTranscribeOnly())),
      );
      await tester.pumpAndSettle();

      expect(find.text('WHAT THE STUDENT WROTE'), findsOneWidget);
      // No score gauge / no scores-by-criterion section on a transcribe-only pass.
      expect(find.byType(ScoreRing), findsNothing);
      expect(find.text('SCORES BY CRITERION'), findsNothing);
      expect(find.text('Overall score'), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('a blank-page result shows 0 and the blank-page warning',
        (tester) async {
      await tester.pumpWidget(
        hostResult(AssessAssignmentResultView(assessment: buildBlankPage())),
      );
      await tester.pumpAndSettle();

      expect(find.text('0'), findsOneWidget); // score
      expect(find.text('Please check'), findsOneWidget);
      expect(find.textContaining('blank'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('an empty assessment shows the dignified empty state',
        (tester) async {
      await tester.pumpWidget(
        hostResult(AssessAssignmentResultView(assessment: buildEmpty())),
      );
      await tester.pumpAndSettle();

      expect(find.byType(EmptyView), findsOneWidget);
      expect(find.textContaining('No assessment came back'), findsOneWidget);
    });
  });

  group('honest "Read only" mode', () {
    testWidgets(
        'Read only hides the score even when the backend returns a full grade',
        (tester) async {
      // The backend ignores mode and always scores, so a "Read only" run still
      // carries a grade + feedback. The view must suppress those and lead with
      // just the transcript, so the mode selector is not a false promise.
      await tester.pumpWidget(
        hostResult(
          AssessAssignmentResultView(
            assessment: buildAssessment(),
            mode: AssessmentMode.transcribe,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // The transcript still leads.
      expect(find.text('WHAT THE STUDENT WROTE'), findsOneWidget);
      expect(tester.takeException(), isNull);

      // Everything score-side is gone: no gauge, no percentage, no criteria,
      // no points/confidence badges, no evaluative feedback.
      expect(find.byType(ScoreRing), findsNothing);
      expect(find.text('75'), findsNothing);
      expect(find.text('SCORES BY CRITERION'), findsNothing);
      expect(find.text('12 of 16 points'), findsNothing);
      expect(find.text('Confidence 82%'), findsNothing);
      expect(find.text('STRENGTHS'), findsNothing);
      expect(find.text('TO WORK ON'), findsNothing);
      expect(find.text('NEXT STEPS'), findsNothing);
      expect(find.text('NOTE FOR THE STUDENT'), findsNothing);
    });

    testWidgets('full mode (default) still shows the whole scorecard',
        (tester) async {
      await tester.pumpWidget(
        hostResult(
          AssessAssignmentResultView(
            assessment: buildAssessment(),
            mode: AssessmentMode.full,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(ScoreRing), findsOneWidget);
      expect(find.text('SCORES BY CRITERION'), findsOneWidget);
      expect(find.text('STRENGTHS'), findsOneWidget);
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9, §12.10, §12.11, §12.13)', () {
    for (final brightness in Brightness.values) {
      testWidgets(
        'full scorecard: no overflow at 360dp x textScale 1.3 in ${brightness.name}',
        (tester) async {
          tester.view.physicalSize = kNarrowPhone;
          tester.view.devicePixelRatio = 1.0;
          addTearDown(tester.view.reset);

          await tester.pumpWidget(
            MediaQuery(
              data: const MediaQueryData(textScaler: TextScaler.linear(1.3)),
              child: hostResult(
                AssessAssignmentResultView(assessment: buildAssessment()),
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
