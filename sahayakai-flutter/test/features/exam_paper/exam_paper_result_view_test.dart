import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/exam_paper/domain/exam_paper.dart';
import 'package:sahayakai/features/exam_paper/presentation/widgets/exam_paper_result_view.dart';

import '../../support/app_harness.dart';
import '../../support/fake_api_client.dart';
import 'exam_paper_fixtures.dart';

/// Result-layer gates: the paper renders every part (sections, questions,
/// answer key, marking scheme, blueprint, PYQ), the save action reports
/// success/failure, and none of it overflows at 360dp x textScale 1.3 in light
/// or dark with the Indic + unbreakable-word probes.
void main() {
  group('render', () {
    testWidgets('renders the header, a section, a question and its answer', (
      tester,
    ) async {
      await tester.pumpWidget(
        hostResult(
          ExamPaperResultView(ready: buildReady()),
          overrides: [apiClientOverride(FakeApiClient())],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('CBSE Class 10 Mathematics Sample Paper'),
          findsOneWidget);
      expect(find.text('Section A'), findsOneWidget);
      expect(find.text('Multiple Choice Questions'), findsOneWidget);
      expect(find.textContaining('What is the value of x here?'), findsOneWidget);
      // The answer-key and marking-scheme blocks (the request toggles that came
      // back on).
      expect(find.text('Answer'), findsWidgets);
      expect(find.text('Marking scheme'), findsWidgets);
      // The internal-choice (OR) alternative.
      expect(find.text('Or attempt'), findsOneWidget);
      // Blueprint + PYQ sections — DocumentSheetSection UPPERCASEs Latin
      // headings.
      expect(find.text('BLUEPRINT SUMMARY'), findsOneWidget);
      expect(find.text('PREVIOUS-YEAR QUESTIONS'), findsOneWidget);
    });

    testWidgets('an empty paper shows the no-content state', (tester) async {
      await tester.pumpWidget(
        hostResult(
          const ExamPaperResultView(
            ready: _emptyReady,
          ),
          overrides: [apiClientOverride(FakeApiClient())],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('No exam paper came back'), findsOneWidget);
    });

    testWidgets(
        'money bug: a title-only response (no sections) shows the '
        'no-content state, never a fake-success Save button',
        (tester) async {
      await tester.pumpWidget(
        hostResult(
          const ExamPaperResultView(ready: _titleOnlyReady, onRegenerate: null),
          overrides: [apiClientOverride(FakeApiClient())],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('No exam paper came back'), findsOneWidget);
      expect(find.textContaining('CBSE Class 10'), findsNothing);
      expect(find.text('Save to Library'), findsNothing);
    });
  });

  group('save action', () {
    testWidgets('a successful save shows the saved confirmation and PUTs paper',
        (tester) async {
      final ready = buildReady();
      final client = FakeApiClient(
        putResponse: <String, dynamic>{'success': true, 'contentId': 'c-1'},
      );
      await tester.pumpWidget(
        hostResult(
          ExamPaperResultView(ready: ready, onRegenerate: () {}),
          overrides: [apiClientOverride(client)],
        ),
      );
      await tester.pumpAndSettle();

      // The Save action now lives in the DocumentSheet footer (§5 action bar) at
      // the bottom of a tall paper, so scroll it into view before tapping — the
      // save behaviour (PUT + saved confirmation) is asserted unchanged.
      await tester.ensureVisible(find.text('Save to Library'));
      await tester.tap(find.text('Save to Library'));
      await tester.pump();
      await tester.pump();

      expect(find.text('Saved to your Library'), findsOneWidget);
      expect(client.puts.single.path, '/api/ai/exam-paper');
      expect(client.puts.single.data, {'paper': ready.raw});
    });

    testWidgets('a failed save shows the failure and a retry', (tester) async {
      final client = FakeApiClient(
        putError: const ApiException(
          ApiErrorKind.server,
          'x',
          statusCode: 500,
        ),
      );
      await tester.pumpWidget(
        hostResult(
          ExamPaperResultView(ready: buildReady(), onRegenerate: () {}),
          overrides: [apiClientOverride(client)],
        ),
      );
      await tester.pumpAndSettle();

      // Footer Save action — scroll it into view before tapping (see above).
      await tester.ensureVisible(find.text('Save to Library'));
      await tester.tap(find.text('Save to Library'));
      await tester.pump();
      await tester.pump();

      expect(find.text('Could not save'), findsOneWidget);
      expect(find.text('Try saving again'), findsOneWidget);
    });
  });

  group('read-only from Library (money bug regression)', () {
    testWidgets(
        'onRegenerate omitted (a saved item reopened from Library) hides the '
        'ENTIRE footer — Save included, not just Regenerate/Copy',
        (tester) async {
      await tester.pumpWidget(
        hostResult(
          ExamPaperResultView(ready: buildReady()),
          overrides: [apiClientOverride(FakeApiClient())],
        ),
      );
      await tester.pumpAndSettle();

      // The paper itself still renders...
      expect(find.text('Section A'), findsOneWidget);
      // ...but nothing that would PUT a duplicate to the library, or imply a
      // live generate controller exists behind this render.
      expect(find.text('Save to Library'), findsNothing);
      expect(find.text('Regenerate'), findsNothing);
      expect(find.text('Copy'), findsNothing);
    });

    testWidgets('onRegenerate provided (the live generate screen) shows Save',
        (tester) async {
      await tester.pumpWidget(
        hostResult(
          ExamPaperResultView(ready: buildReady(), onRegenerate: () {}),
          overrides: [apiClientOverride(FakeApiClient())],
        ),
      );
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.text('Save to Library'));
      expect(find.text('Save to Library'), findsOneWidget);
      expect(find.text('Regenerate'), findsOneWidget);
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9, §12.10, §12.11, §12.13)', () {
    for (final brightness in Brightness.values) {
      for (final scale in <double>[1.0, 1.3]) {
        testWidgets(
          'paper renders at 360dp, textScale $scale, ${brightness.name}',
          (tester) async {
            tester.view.physicalSize = kNarrowPhone;
            tester.view.devicePixelRatio = 1.0;
            addTearDown(tester.view.reset);

            await tester.pumpWidget(
              MediaQuery(
                data: MediaQueryData(textScaler: TextScaler.linear(scale)),
                child: hostResult(
                  ExamPaperResultView(ready: buildReady()),
                  brightness: brightness,
                  overrides: [apiClientOverride(FakeApiClient())],
                ),
              ),
            );
            await tester.pumpAndSettle();

            expect(tester.takeException(), isNull);
            expect(find.text('Section A'), findsOneWidget);
          },
        );
      }
    }
  });
}

const _emptyReady = ExamPaperReady(
  paper: ExamPaper(title: '', board: '', subject: '', gradeLevel: ''),
  raw: <String, dynamic>{},
);

/// A malformed response with a title but no sections — no actual questions.
/// The money bug: the old AND-of-three emptiness check treated this as
/// "not empty" because the title was non-blank, rendering a full masthead and
/// a tappable Save button over zero content.
const _titleOnlyReady = ExamPaperReady(
  paper: ExamPaper(
    title: 'CBSE Class 10 Mathematics Sample Paper',
    board: 'CBSE',
    subject: 'Mathematics',
    gradeLevel: 'Class 10',
    generalInstructions: ['All questions are compulsory.'],
  ),
  raw: <String, dynamic>{},
);
