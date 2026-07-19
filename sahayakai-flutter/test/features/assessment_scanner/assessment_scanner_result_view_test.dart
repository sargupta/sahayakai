import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/assessment_scanner/domain/assessment_scan.dart';
import 'package:sahayakai/features/assessment_scanner/presentation/widgets/assessment_scanner_result_view.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';
import 'package:sahayakai/shared/widgets/score_ring.dart';

import 'assessment_scanner_fixtures.dart';

// ── WCAG 2.1 relative-luminance contrast (mirrors theme_contrast_test) ──
double _lin(int c) {
  final s = c / 255.0;
  return s <= 0.03928 ? s / 12.92 : math.pow((s + 0.055) / 1.055, 2.4).toDouble();
}

double _luminance(Color c) =>
    0.2126 * _lin((c.r * 255).round()) +
    0.7152 * _lin((c.g * 255).round()) +
    0.0722 * _lin((c.b * 255).round());

double _ratio(Color a, Color b) {
  final la = _luminance(a);
  final lb = _luminance(b);
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

/// Result-layer gates for the answer-sheet scorecard: the ScoreRing, the
/// per-question cards with their marks badges and correct/partial/incorrect
/// chips, the next-steps sections, the empty path, the DESIGN_RUBRIC §11 Indic
/// overflow gate, and the WCAG AA contract on the marks badge and the outcome
/// chips computed against their ACTUAL rendered fills.
void main() {
  group('rendering', () {
    testWidgets('renders the overall gauge, per-question cards and sections',
        (tester) async {
      await tester
          .pumpWidget(hostResult(AssessmentScannerResultView(result: buildResult())));
      await tester.pumpAndSettle();

      // Hero gauge: the overall scorePct over 100.
      expect(find.byType(ScoreRing), findsOneWidget);
      expect(find.text('58'), findsOneWidget);
      expect(find.text('/ 100'), findsOneWidget);
      expect(find.text('7 of 12 marks'), findsOneWidget);

      // Masthead meta.
      expect(find.text('2 pages'), findsOneWidget);
      expect(find.text('C'), findsOneWidget);
      expect(find.text('1 to review'), findsOneWidget);

      // Per-question marks badges "{awarded}/{max}".
      expect(find.text('5/5'), findsOneWidget);
      expect(find.text('2/4'), findsOneWidget);
      expect(find.text('0/3'), findsOneWidget);

      // Sections (DocumentSheetSection uppercases Latin headings).
      expect(find.text('QUESTION BY QUESTION'), findsOneWidget);
      expect(find.text('RECOMMENDED NEXT STEPS'), findsOneWidget);
      expect(find.text('FOR THE STUDENT'), findsOneWidget);
      expect(find.text('Photo quality'), findsOneWidget);

      expect(tester.takeException(), isNull);
    });

    testWidgets('the correct/partial/incorrect state is icon + text, not colour '
        'alone', (tester) async {
      await tester
          .pumpWidget(hostResult(AssessmentScannerResultView(result: buildResult())));
      await tester.pumpAndSettle();

      // Each outcome chip carries a DISTINCT glyph AND a word — a colour-blind
      // teacher reads the state from the shape and the label, never the hue.
      expect(find.text('Correct'), findsOneWidget);
      expect(find.byIcon(LucideIcons.checkCircle2), findsOneWidget);
      expect(find.text('Partly correct'), findsOneWidget);
      expect(find.byIcon(LucideIcons.minusCircle), findsOneWidget);
      expect(find.text('Incorrect'), findsOneWidget);
      expect(find.byIcon(LucideIcons.xCircle), findsOneWidget);

      // The needs-review flag is likewise icon + text.
      expect(find.text('Check this'), findsOneWidget);
      expect(find.byIcon(LucideIcons.alertCircle), findsWidgets);
    });

    testWidgets('the empty result shows the dignified empty state',
        (tester) async {
      await tester.pumpWidget(
        hostResult(AssessmentScannerResultView(result: buildEmptyResult())),
      );
      await tester.pumpAndSettle();

      expect(find.byType(EmptyView), findsOneWidget);
      expect(find.textContaining('No grades came back'), findsOneWidget);
      expect(find.byType(ScoreRing), findsNothing);
    });
  });

  group('WCAG AA — computed against the actual rendered fills', () {
    for (final brightness in Brightness.values) {
      test('marks badge + outcome chips clear 4.5:1 in ${brightness.name}', () {
        final scheme = (brightness == Brightness.dark
                ? AppTheme.dark()
                : AppTheme.light())
            .colorScheme;
        final isDark = brightness == Brightness.dark;

        // Marks badge: saffron-TEXT on the accent tint (primary@0.12) composited
        // over the inset question card (surfaceContainerLow) — NOT the #E0924D
        // fill, which as ink would fail AA.
        final marksFg = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;
        final marksBg = Color.alphaBlend(
          scheme.primary.withValues(alpha: 0.12),
          scheme.surfaceContainerLow,
        );
        expect(_ratio(marksFg, marksBg), greaterThanOrEqualTo(4.5),
            reason: 'marks badge label vs its actual fill (${brightness.name})');

        // "Correct" chip: the green container pairing.
        expect(_ratio(scheme.onSecondaryContainer, scheme.secondaryContainer),
            greaterThanOrEqualTo(4.5),
            reason: 'correct chip (${brightness.name})');

        // Partial / incorrect / review chips: full ink on the neutral fill.
        expect(_ratio(scheme.onSurface, scheme.surfaceContainerHigh),
            greaterThanOrEqualTo(4.5),
            reason: 'neutral outcome/review chip (${brightness.name})');
      });
    }
  });

  group('WCAG AA — the previously-muted sites are now full ink (>=4.5)', () {
    // Regression guard for the design-review AA class: every text that once used
    // the muted onSurfaceVariant on a NON-white fill now uses onSurface, so this
    // failure class cannot ship green again. Each pairing is computed against the
    // site's ACTUAL fill, in BOTH themes.
    for (final brightness in Brightness.values) {
      test('every fixed site clears 4.5:1 in ${brightness.name}', () {
        final scheme = (brightness == Brightness.dark
                ? AppTheme.dark()
                : AppTheme.light())
            .colorScheme;

        // 1. Empty page-capture well prompt — on the well's surfaceContainerHigh.
        // 2. Privacy NoteBanner body — same fill.
        expect(_ratio(scheme.onSurface, scheme.surfaceContainerHigh),
            greaterThanOrEqualTo(4.5),
            reason: 'empty-well prompt + privacy note (${brightness.name})');
        // 3. Page counter + pages-full label — on the scaffold paper ground.
        // 4. Error _PromptView body — same ground.
        expect(_ratio(scheme.onSurface, scheme.surfaceContainerLowest),
            greaterThanOrEqualTo(4.5),
            reason:
                'page counter / pages-full / error prompt body (${brightness.name})');
        // 5. "Not scored" meta — inside the inset question card
        //    (surfaceContainerLow).
        expect(_ratio(scheme.onSurface, scheme.surfaceContainerLow),
            greaterThanOrEqualTo(4.5),
            reason: 'not-scored meta (${brightness.name})');
      });

      // A REAL widget-level guard for the in-file site: render an unscored
      // question and read the ACTUAL "Not scored" colour, so a revert to the
      // muted role would bite here, not just pass a token-pair contract.
      testWidgets('the rendered "Not scored" colour clears AA (${brightness.name})',
          (tester) async {
        final scheme = (brightness == Brightness.dark
                ? AppTheme.dark()
                : AppTheme.light())
            .colorScheme;
        const unscored = AssessmentResult(
          assessmentId: 'x',
          status: 'partial',
          pageCount: 1,
          totalAwardedMarks: 0,
          totalMaxMarks: 0,
          scorePct: 0,
          letterGrade: '',
          questions: <GradedQuestion>[
            GradedQuestion(
              questionId: 'q',
              pageIndex: 0,
              questionText: 'On a question-only page',
              studentAnswer: '',
              marksAwarded: 0,
              marksMax: 0,
            ),
          ],
        );

        await tester.pumpWidget(hostResult(
          const AssessmentScannerResultView(result: unscored),
          brightness: brightness,
        ));
        await tester.pumpAndSettle();

        final color = tester.widget<Text>(find.text('Not scored')).style?.color;
        expect(color, isNotNull);
        expect(_ratio(color!, scheme.surfaceContainerLow),
            greaterThanOrEqualTo(4.5),
            reason: 'not-scored rendered colour vs the inset card fill');
      });
    }
  });

  group('overflow gates (DESIGN_RUBRIC §12.9, §12.10, §12.11, §12.13)', () {
    for (final brightness in Brightness.values) {
      testWidgets(
        'scorecard: no overflow at 360dp x textScale 1.3 in ${brightness.name}',
        (tester) async {
          tester.view.physicalSize = kNarrowPhone;
          tester.view.devicePixelRatio = 1.0;
          addTearDown(tester.view.reset);

          await tester.pumpWidget(
            MediaQuery(
              data: const MediaQueryData(textScaler: TextScaler.linear(1.3)),
              child: hostResult(
                AssessmentScannerResultView(result: buildResult()),
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
