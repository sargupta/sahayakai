import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/instant_answer/domain/instant_answer.dart';
import 'package:sahayakai/features/instant_answer/presentation/widgets/answer_markdown_view.dart';
import 'package:sahayakai/features/instant_answer/presentation/widgets/instant_answer_result_view.dart';
import 'package:sahayakai/features/instant_answer/presentation/widgets/instant_answer_skeleton.dart';
import 'package:sahayakai/shared/widgets/document_sheet.dart';

import '../../support/fake_clipboard.dart';
import 'instant_answer_fixtures.dart';

/// Result-layer gates from DESIGN_RUBRIC §12: no RenderFlex overflow at 360dp
/// or textScale 1.3, in light AND dark, with Indic prose and an unbreakable
/// compound word; plus the markdown rendering and the optional video card the
/// screen promises.
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
                InstantAnswerResultView(answer: buildAnswer()),
                brightness: brightness,
                linkOpener: FakeLinkOpener(),
              ),
            ),
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);

          // The Indic probes and the unbreakable compound word are the
          // widest things on the screen; they must wrap, not overflow.
          expect(find.byType(AnswerMarkdownView), findsOneWidget);
        });
      }
    }

    testWidgets('skeleton renders at 360dp', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(hostResult(const InstantAnswerSkeleton()));
      await tester.pump(const Duration(milliseconds: 100)); // shimmer runs
      expect(tester.takeException(), isNull);
    });
  });

  group('markdown rendering', () {
    testWidgets('a basic answer renders its prose, headings and lists', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        hostResult(
          const InstantAnswerResultView(
            answer: InstantAnswer(
              answer:
                  '# Photosynthesis\n\n'
                  'Plants make **their own** food.\n\n'
                  '- Sunlight\n'
                  '- Water\n\n'
                  '1. Roots draw water\n',
            ),
          ),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      // Markdown syntax is rendered, never shown raw.
      final rendered = _renderedText(tester);
      expect(rendered, contains('Photosynthesis'));
      expect(rendered, contains('Plants make their own food.'));
      expect(rendered, contains('Sunlight'));
      expect(rendered, contains('Water'));
      expect(rendered, contains('Roots draw water'));
      expect(rendered, isNot(contains('**')));
      expect(rendered, isNot(contains('# ')));
      expect(find.text('1.'), findsOneWidget); // the numbered marker
    });

    testWidgets('AI prose keeps line-height 1.7 and full height behaviour', (
      tester,
    ) async {
      // DESIGN_RUBRIC §3 / §12.4: AI output blocks run at 1.7 with the height
      // applied to the first ascent and last descent, or Indic matras clip.
      await tester.pumpWidget(
        hostResult(
          const InstantAnswerResultView(
            answer: InstantAnswer(answer: 'Plain prose. $kBn'),
          ),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      final rich = tester.widget<Text>(
        find.descendant(
          of: find.byType(AnswerMarkdownView),
          matching: find.byType(Text),
        ),
      );
      expect(rich.textHeightBehavior?.applyHeightToFirstAscent, isTrue);
      expect(rich.textHeightBehavior?.applyHeightToLastDescent, isTrue);
      expect(rich.textSpan!.style?.height, 1.7);
    });

    testWidgets('an empty answer shows the rephrase state, not a blank card', (
      tester,
    ) async {
      await tester.pumpWidget(
        hostResult(
          InstantAnswerResultView(answer: buildAnswer(empty: true)),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.textContaining('No answer came back'), findsOneWidget);
      expect(find.byType(AnswerMarkdownView), findsNothing);
    });
  });

  group('videoSuggestionUrl', () {
    testWidgets('renders a tappable card that opens the video externally', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      final opener = FakeLinkOpener();
      await tester.pumpWidget(
        hostResult(
          InstantAnswerResultView(answer: buildAnswer()),
          linkOpener: opener,
        ),
      );
      await tester.pumpAndSettle();

      final card = find.text('Watch a related video');
      expect(card, findsOneWidget);

      // tap() only WARNS on a missed hit-test, so scroll it in first or this
      // could pass without ever touching the card.
      await tester.ensureVisible(card);
      await tester.pumpAndSettle();
      await tester.tap(card);
      await tester.pumpAndSettle();

      expect(opener.opened, [
        Uri.parse('https://www.youtube.com/watch?v=abc123'),
      ]);
    });

    testWidgets('the whole card clears the 48dp touch target', (tester) async {
      tester.view.physicalSize = const Size(360, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        hostResult(
          InstantAnswerResultView(answer: buildAnswer()),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      // The DocumentSheet is itself an AppCard with an InkWell, so scope to the
      // nearest (the video card's own) InkWell — structure only; the >=48dp
      // touch-target assertion is unchanged.
      final size = tester.getSize(
        find
            .ancestor(
              of: find.text('Watch a related video'),
              matching: find.byType(InkWell),
            )
            .first,
      );
      expect(size.height, greaterThanOrEqualTo(48));
    });

    testWidgets('a null videoSuggestionUrl renders no card and no crash', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        hostResult(
          InstantAnswerResultView(answer: buildAnswer(withVideo: false)),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      // The answer still renders; only the suggestion is absent.
      expect(find.text('Watch a related video'), findsNothing);
      expect(find.byType(AnswerMarkdownView), findsOneWidget);
    });
  });

  group('metadata', () {
    testWidgets('shows the grade and subject the answer was tailored to', (
      tester,
    ) async {
      await tester.pumpWidget(
        hostResult(
          InstantAnswerResultView(answer: buildAnswer()),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Class 5'), findsOneWidget);
      expect(find.text('Science'), findsOneWidget);
    });

    testWidgets('null metadata renders no chips and no crash', (tester) async {
      await tester.pumpWidget(
        hostResult(
          const InstantAnswerResultView(
            answer: InstantAnswer(answer: 'An answer.'),
          ),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byType(AnswerMarkdownView), findsOneWidget);
    });
  });

  group('document sheet (PREMIUM_DESIGN_SPEC §5 / U8)', () {
    testWidgets('wraps the answer in a DocumentSheet titled by the question', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        hostResult(
          InstantAnswerResultView(
            answer: buildAnswer(withVideo: false),
            question: 'Why is the sky blue?',
          ),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(DocumentSheet), findsOneWidget);
      // The masthead doc-type eyebrow (uppercased Latin) and the question title.
      expect(find.text('INSTANT ANSWER'), findsOneWidget);
      expect(find.text('Why is the sky blue?'), findsOneWidget);
      // Meta badges carry the grade and subject.
      expect(find.text('Class 5'), findsOneWidget);
      expect(find.text('Science'), findsOneWidget);
      // The Markdown body is still rendered through the matra-safe renderer.
      expect(find.byType(AnswerMarkdownView), findsOneWidget);
    });

    testWidgets('falls back to the localized Answer title with no question', (
      tester,
    ) async {
      await tester.pumpWidget(
        hostResult(
          const InstantAnswerResultView(
            answer: InstantAnswer(answer: 'An answer.'),
          ),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(DocumentSheet), findsOneWidget);
      // Masthead title 'Answer' (Fraunces); the section header is uppercased.
      expect(find.text('Answer'), findsOneWidget);
      expect(find.text('ANSWER'), findsOneWidget);
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
          InstantAnswerResultView(
            answer: buildAnswer(),
            question: 'Why is the sky blue?',
            onRegenerate: () => regenerated = true,
          ),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Regenerate'), findsOneWidget);
      expect(find.text('Copy'), findsOneWidget);

      await tester.ensureVisible(find.text('Regenerate'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Regenerate'));
      await tester.pump();
      expect(regenerated, isTrue, reason: 'Regenerate re-runs the ask');
    });

    testWidgets('Copy writes the answer to the clipboard and confirms', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
      final copied = interceptClipboard(tester);

      await tester.pumpWidget(
        hostResult(
          InstantAnswerResultView(
            answer: buildAnswer(),
            question: 'Why is the sky blue?',
            onRegenerate: () {},
          ),
          linkOpener: FakeLinkOpener(),
        ),
      );
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.text('Copy'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Copy'));
      // The shared bar awaits the clipboard write before confirming, so settle
      // rather than a single pump — a bare pump lands before the snackbar.
      await tester.pumpAndSettle();

      expect(copied, hasLength(1));
      expect(find.text('Copied to clipboard'), findsOneWidget);
    });

    testWidgets('with no onRegenerate the footer action bar is absent', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        hostResult(
          InstantAnswerResultView(answer: buildAnswer(withVideo: false)),
          linkOpener: FakeLinkOpener(),
        ),
      );
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
        hostResult(
          InstantAnswerResultView(
            answer: buildAnswer(withVideo: false),
            question: 'Why is the sky blue?',
          ),
          linkOpener: FakeLinkOpener(),
          reduceMotion: true,
        ),
      );
      // With animations disabled the ink-settle blocks are static, so the
      // document is fully composed on the first frame.
      await tester.pump();

      expect(tester.takeException(), isNull);
      expect(find.byType(DocumentSheet), findsOneWidget);
      expect(find.text('Why is the sky blue?'), findsOneWidget);
      expect(find.byType(AnswerMarkdownView), findsOneWidget);
    });
  });
}

/// Every string the markdown renderer actually painted, concatenated.
String _renderedText(WidgetTester tester) {
  final texts = tester.widgetList<Text>(
    find.descendant(
      of: find.byType(AnswerMarkdownView),
      matching: find.byType(Text),
    ),
  );
  return texts.map((t) => t.data ?? t.textSpan?.toPlainText() ?? '').join('\n');
}
