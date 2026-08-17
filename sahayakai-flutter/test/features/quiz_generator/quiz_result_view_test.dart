import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/quiz_generator/presentation/widgets/quiz_result_view.dart';
import 'package:sahayakai/features/quiz_generator/presentation/widgets/quiz_skeleton.dart';
import 'package:sahayakai/shared/widgets/document_sheet.dart';

import 'quiz_fixtures.dart';

/// Result-layer gates from DESIGN_RUBRIC §12: no RenderFlex overflow at 360dp
/// or textScale 1.3, in light AND dark, with Indic prose and an unbreakable
/// compound word; plus the tab and answer-reveal behaviour the screen promises.
void main() {
  group('overflow gates (DESIGN_RUBRIC §12.9, §12.10, §12.13)', () {
    for (final brightness in Brightness.values) {
      for (final scale in <double>[1.0, 1.3]) {
        testWidgets('renders at 360dp, textScale $scale, ${brightness.name}', (
          tester,
        ) async {
          tester.view.physicalSize = kNarrowPhone;
          tester.view.devicePixelRatio = 1.0;
          addTearDown(tester.view.reset);

          await tester.pumpWidget(
            MediaQuery(
              data: MediaQueryData(textScaler: TextScaler.linear(scale)),
              child: hostResult(
                QuizResultView(quiz: buildQuiz()),
                brightness: brightness,
              ),
            ),
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);

          // Revealing every answer is the tallest, widest state. The richer
          // DocumentSheet masthead pushes the reveal control below the fold at
          // 360dp, so scroll it in before tapping (structure only).
          await tester.ensureVisible(find.text('Show all answers'));
          await tester.pumpAndSettle();
          await tester.tap(find.text('Show all answers'));
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          expect(find.text('Correct answer'), findsWidgets);

          // Switching variants must not overflow either. Scope to the tab
          // bar: 'Hard' also appears as a per-question difficulty badge.
          final hardTab = find.descendant(
            of: find.byType(TabBar),
            matching: find.text('Hard'),
          );
          await tester.ensureVisible(hardTab);
          await tester.pumpAndSettle();
          await tester.tap(hardTab);
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
        });
      }
    }

    testWidgets('skeleton renders at 360dp', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(hostResult(const QuizSkeleton()));
      await tester.pump(const Duration(milliseconds: 100)); // shimmer runs
      expect(tester.takeException(), isNull);
    });
  });

  group('difficulty variants', () {
    testWidgets('three variants get three tabs', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(hostResult(QuizResultView(quiz: buildQuiz())));
      await tester.pumpAndSettle();

      expect(find.byType(TabBar), findsOneWidget);
      expect(
        find.descendant(of: find.byType(TabBar), matching: find.byType(Tab)),
        findsNWidgets(3),
      );
    });

    testWidgets('a single variant renders without a tab bar', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        hostResult(QuizResultView(quiz: buildQuiz(onlyMedium: true))),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byType(TabBar), findsNothing);
      expect(find.text('Show all answers'), findsOneWidget);
    });

    testWidgets('no variants shows the empty view, never an empty tab', (
      tester,
    ) async {
      await tester.pumpWidget(
        hostResult(QuizResultView(quiz: buildQuiz(empty: true))),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byType(TabBar), findsNothing);
      expect(find.textContaining('No questions came back'), findsOneWidget);
    });

    testWidgets('switching tabs re-hides the answers', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(hostResult(QuizResultView(quiz: buildQuiz())));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Show all answers'));
      await tester.pumpAndSettle();
      expect(find.text('Correct answer'), findsWidgets);

      await tester.tap(
        find.descendant(of: find.byType(TabBar), matching: find.text('Hard')),
      );
      await tester.pumpAndSettle();

      // A fresh variant starts unspoiled.
      expect(find.text('Correct answer'), findsNothing);
    });
  });

  group('answer reveal', () {
    testWidgets('answers are hidden on first paint', (tester) async {
      tester.view.physicalSize = const Size(360, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(hostResult(QuizResultView(quiz: buildQuiz())));
      await tester.pumpAndSettle();

      // The whole point: a teacher can read a question aloud unspoiled.
      expect(find.text('Correct answer'), findsNothing);
      expect(find.text('Why'), findsNothing);
    });

    testWidgets('revealing one question leaves the others hidden', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(hostResult(QuizResultView(quiz: buildQuiz())));
      await tester.pumpAndSettle();

      expect(find.text('Show answer'), findsNWidgets(3));
      final firstShow = find.text('Show answer').first;
      await tester.ensureVisible(firstShow);
      await tester.pumpAndSettle();
      await tester.tap(firstShow);
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Why'), findsOneWidget);
      expect(find.text('Hide answer'), findsOneWidget);
      expect(find.text('Show answer'), findsNWidgets(2));
    });

    testWidgets('reveal is reversible', (tester) async {
      tester.view.physicalSize = const Size(360, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(hostResult(QuizResultView(quiz: buildQuiz())));
      await tester.pumpAndSettle();

      final firstShow = find.text('Show answer').first;
      await tester.ensureVisible(firstShow);
      await tester.pumpAndSettle();
      await tester.tap(firstShow);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Hide answer'));
      await tester.pumpAndSettle();

      expect(find.text('Why'), findsNothing);
      expect(find.text('Show answer'), findsNWidgets(3));
    });

    testWidgets('show-all toggles to hide-all', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(hostResult(QuizResultView(quiz: buildQuiz())));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Show all answers'));
      await tester.pumpAndSettle();
      expect(find.text('Hide all answers'), findsOneWidget);

      await tester.tap(find.text('Hide all answers'));
      await tester.pumpAndSettle();
      expect(find.text('Show all answers'), findsOneWidget);
      expect(find.text('Correct answer'), findsNothing);
    });

    testWidgets('a marked multiple-choice answer is not repeated below', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(hostResult(QuizResultView(quiz: buildQuiz())));
      await tester.pumpAndSettle();

      // Q1's correct answer ("One half") is one of its options, so it gets
      // marked inline and the spelled-out answer line is redundant.
      final firstShow = find.text('Show answer').first;
      await tester.ensureVisible(firstShow);
      await tester.pumpAndSettle();
      await tester.tap(firstShow);
      await tester.pumpAndSettle();

      expect(find.text('One half'), findsOneWidget); // the option, marked once
      expect(find.text('Why'), findsOneWidget); // the explanation still shows
    });

    testWidgets('a non-option answer is spelled out', (tester) async {
      tester.view.physicalSize = const Size(360, 1400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(hostResult(QuizResultView(quiz: buildQuiz())));
      await tester.pumpAndSettle();

      // Q2 is fill-in-the-blanks: nothing to mark, so state the answer.
      // It sits below the fold at 360dp, so scroll it in before tapping.
      final second = find.text('Show answer').at(1);
      await tester.ensureVisible(second);
      await tester.pumpAndSettle();
      await tester.tap(second);
      await tester.pumpAndSettle();

      expect(find.text('Correct answer'), findsOneWidget);
    });
  });

  group('metadata', () {
    testWidgets('header shows grade, subject and question count', (
      tester,
    ) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(hostResult(QuizResultView(quiz: buildQuiz())));
      await tester.pumpAndSettle();

      expect(find.text('Class 6'), findsOneWidget);
      expect(find.text('Mathematics'), findsOneWidget);
      expect(find.text('3 questions'), findsOneWidget);
    });

    testWidgets('a validation warning surfaces as a note, not an error', (
      tester,
    ) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(hostResult(QuizResultView(quiz: buildQuiz())));
      await tester.pumpAndSettle();

      expect(find.text('A gentle note.'), findsOneWidget);
      // The quiz still renders alongside it.
      expect(find.byType(TabBar), findsOneWidget);
    });

    testWidgets('teacher instructions render', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(hostResult(QuizResultView(quiz: buildQuiz())));
      await tester.pumpAndSettle();

      expect(find.text('How to run this in class'), findsOneWidget);
    });
  });

  group('document sheet (PREMIUM_DESIGN_SPEC §5 / U8)', () {
    testWidgets('wraps the quiz in a DocumentSheet with masthead + meta', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(hostResult(QuizResultView(quiz: buildQuiz())));
      await tester.pumpAndSettle();

      expect(find.byType(DocumentSheet), findsOneWidget);
      // The masthead doc-type eyebrow (uppercased Latin) and the topic title.
      expect(find.text('QUIZ'), findsOneWidget);
      expect(find.text('Fractions'), findsOneWidget);
      // Meta badges carry the grade, subject and question count.
      expect(find.text('Class 6'), findsOneWidget);
      expect(find.text('Mathematics'), findsOneWidget);
      expect(find.text('3 questions'), findsOneWidget);
      // The variants still render in the body.
      expect(find.byType(TabBar), findsOneWidget);
    });

    testWidgets('the action bar offers Regenerate and Copy, wired', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      var regenerated = false;
      await tester.pumpWidget(
        hostResult(
          QuizResultView(
            quiz: buildQuiz(),
            onRegenerate: () => regenerated = true,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Regenerate'), findsOneWidget);
      expect(find.text('Copy'), findsOneWidget);

      // The action bar is the foot of a long document; bring it into view.
      await tester.ensureVisible(find.text('Regenerate'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Regenerate'));
      await tester.pump();
      expect(regenerated, isTrue, reason: 'Regenerate re-runs generation');
    });

    testWidgets('Copy writes the quiz to the clipboard and confirms', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        hostResult(QuizResultView(quiz: buildQuiz(), onRegenerate: () {})),
      );
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.text('Copy'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Copy'));
      await tester.pump(); // let the snackbar appear

      expect(find.text('Copied to clipboard'), findsOneWidget);
    });

    testWidgets('Copy excludes hidden answers and includes revealed ones (the '
        'hide-answers toggle is honoured)', (tester) async {
      tester.view.physicalSize = const Size(360, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      // Capture whatever is written to the clipboard.
      String? clipped;
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          if (call.method == 'Clipboard.setData') {
            clipped = (call.arguments as Map)['text'] as String?;
          }
          return null;
        },
      );
      addTearDown(
        () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          null,
        ),
      );

      // A single variant keeps the reveal state simple (no tabs).
      await tester.pumpWidget(
        hostResult(
          QuizResultView(
            quiz: buildQuiz(onlyMedium: true),
            onRegenerate: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      Future<void> tapCopy() async {
        await tester.ensureVisible(find.text('Copy'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Copy'));
        await tester.pump();
      }

      // Answers start hidden, so the export must NOT carry the answer key.
      await tapCopy();
      expect(clipped, isNotNull);
      expect(clipped, contains('What is one half')); // the question is there
      expect(
        clipped,
        isNot(contains('Correct answer:')),
        reason: 'a hidden answer must not leak into the clipboard',
      );
      expect(clipped, isNot(contains('Half means two equal parts')));

      // Reveal every answer, then copy again — now the key is included.
      await tester.ensureVisible(find.text('Show all answers'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Show all answers'));
      await tester.pumpAndSettle();

      await tapCopy();
      expect(
        clipped,
        contains('Correct answer:'),
        reason: 'a revealed answer is included in the export',
      );
      expect(clipped, contains('Half means two equal parts'));
    });

    testWidgets('with no onRegenerate the footer action bar is absent', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(hostResult(QuizResultView(quiz: buildQuiz())));
      await tester.pumpAndSettle();

      expect(find.text('Regenerate'), findsNothing);
      expect(find.text('Copy'), findsNothing);
    });

    testWidgets('reduce-motion renders the composed frame, no exception', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        hostResult(QuizResultView(quiz: buildQuiz()), reduceMotion: true),
      );
      // With animations disabled the ink-settle blocks are static, so the
      // document is fully composed on the first frame.
      await tester.pump();

      expect(tester.takeException(), isNull);
      expect(find.byType(DocumentSheet), findsOneWidget);
      expect(find.text('Fractions'), findsOneWidget);
      expect(find.byType(TabBar), findsOneWidget);
    });
  });
}
