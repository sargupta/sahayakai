import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/quiz_generator/domain/quiz.dart';
import 'package:sahayakai/features/quiz_generator/presentation/quiz_controller.dart';
import 'package:sahayakai/features/quiz_generator/presentation/quiz_generator_screen.dart';
import 'package:sahayakai/features/quiz_generator/presentation/widgets/quiz_result_view.dart';
import 'package:sahayakai/shared/domain/tool_prefill.dart';
import 'package:sahayakai/shared/widgets/app_segmented.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';
import 'package:sahayakai/shared/widgets/map_chip.dart';
import 'package:sahayakai/shared/widgets/map_option.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'quiz_fixtures.dart';

/// Form-layer gates: the question-type grid, the count slider, the Bloom's
/// chips and the More options card are the overflow-prone half of the screen, so they face the same DESIGN_RUBRIC §12 checks as the
/// result. Also pins the two validation rules the endpoint depends on: a topic
/// is required, and at least one question type must be selected.
///
/// No live API is exercised here; nothing taps Generate with a valid form.
Widget _hostScreen({
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  List<Override> overrides = const [],
  ToolPrefill? prefill,
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      theme: brightness == Brightness.dark
          ? AppTheme.light()
          : AppTheme.light(),
      locale: const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(
          context,
        ).copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: QuizGeneratorScreen(prefill: prefill),
    ),
  );
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  group('overflow gates (DESIGN_RUBRIC §12.9, §12.10, §12.13)', () {
    for (final brightness in Brightness.values) {
      for (final scale in <double>[1.0, 1.3]) {
        testWidgets(
          'form renders at 360dp, textScale $scale, ${brightness.name}',
          (tester) async {
            tester.view.physicalSize = kNarrowPhone;
            tester.view.devicePixelRatio = 1.0;
            addTearDown(tester.view.reset);

            await tester.pumpWidget(
              _hostScreen(brightness: brightness, textScale: scale),
            );
            await tester.pumpAndSettle();
            expect(tester.takeException(), isNull);

            // Every field is laid out, including the wrapping chip groups.
            // English labels render as the map's uppercase overline.
            expect(find.text('TOPIC'), findsOneWidget);
            expect(find.text('QUESTIONS'), findsOneWidget);
            expect(find.text('QUESTION TYPES'), findsOneWidget);
            expect(find.byType(MapOption), findsNWidgets(4));
            expect(find.byType(Slider), findsOneWidget);
            expect(find.text('BLOOM’S TAXONOMY LEVELS'), findsOneWidget);
            expect(find.byType(MapChip), findsNWidgets(6));
            expect(find.text('PEDAGOGICAL STRATEGY'), findsOneWidget);

            // The tucked-away fields lay out too once More options opens.
            await _openMoreOptions(tester);
            expect(tester.takeException(), isNull);
            expect(find.text('All levels'), findsOneWidget);
            expect(find.text('DIFFICULTY'), findsOneWidget);
          },
        );
      }
    }
  });

  group('states', () {
    testWidgets('opens on the bare form, with no idle empty state', (
      tester,
    ) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_hostScreen());
      await tester.pumpAndSettle();

      // Before the first quiz the result slot renders nothing: the form and
      // its Generate button are the whole screen.
      expect(find.byType(EmptyView), findsNothing);
      expect(find.textContaining('tap Generate'), findsNothing);
      expect(find.text('Generate quiz'), findsOneWidget);
    });

    testWidgets('defaults mirror the web form', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_hostScreen());
      await tester.pumpAndSettle();

      // numQuestions 5; multiple_choice + short_answer; Remember + Understand.
      expect(find.text('5'), findsOneWidget);
      expect(tester.widget<Slider>(find.byType(Slider)).value, 5);
      expect(_option(tester, 'Multiple choice').selected, isTrue);
      expect(_option(tester, 'Short answer').selected, isTrue);
      expect(_option(tester, 'Fill in the blanks').selected, isFalse);
      expect(_option(tester, 'True or false').selected, isFalse);
      expect(_bloom(tester, 'Remember').selected, isTrue);
      expect(_bloom(tester, 'Understand').selected, isTrue);
      expect(_bloom(tester, 'Apply').selected, isFalse);

      // No target difficulty -> the endpoint returns all three variants.
      await _openMoreOptions(tester);
      expect(
        tester
            .widget<AppSegmented<QuizDifficulty?>>(
              find.byType(AppSegmented<QuizDifficulty?>),
            )
            .value,
        isNull,
      );
      expect(find.text('All levels'), findsOneWidget);
    });
  });

  group('number of questions slider', () {
    testWidgets('steps up and down one question at a time', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
      final semantics = tester.ensureSemantics();

      await tester.pumpWidget(_hostScreen());
      await tester.pumpAndSettle();

      final slider = find.semantics.byValue('5 questions');
      tester.semantics.increase(slider);
      await tester.pumpAndSettle();
      expect(find.text('6'), findsOneWidget);
      expect(tester.widget<Slider>(find.byType(Slider)).value, 6);

      tester.semantics.decrease(find.semantics.byValue('6 questions'));
      await tester.pumpAndSettle();
      expect(find.text('5'), findsOneWidget);
      expect(tester.takeException(), isNull);
      semantics.dispose();
    });

    testWidgets('clamps at the composer bounds (3..20)', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_hostScreen());
      await tester.pumpAndSettle();

      final slider = tester.widget<Slider>(find.byType(Slider));
      expect(slider.min, 3);
      expect(slider.max, 20);

      // Drag far past the floor; the count stops at 3 rather than going lower.
      await tester.drag(find.byType(Slider), const Offset(-1000, 0));
      await tester.pumpAndSettle();
      expect(find.text('3'), findsOneWidget);
      expect(tester.widget<Slider>(find.byType(Slider)).value, 3);

      // And far past the ceiling.
      await tester.drag(find.byType(Slider), const Offset(1000, 0));
      await tester.pumpAndSettle();
      expect(find.text('20'), findsOneWidget);
      expect(tester.widget<Slider>(find.byType(Slider)).value, 20);
      expect(tester.takeException(), isNull);
    });

    for (final count in [2, 21]) {
      testWidgets('a prefilled count of $count (outside 3..20) is ignored', (
        tester,
      ) async {
        tester.view.physicalSize = kNarrowPhone;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(
          _hostScreen(prefill: ToolPrefill(questionCount: count)),
        );
        await tester.pumpAndSettle();

        expect(tester.widget<Slider>(find.byType(Slider)).value, 5);
        expect(find.text('5'), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('a prefilled count inside 3..20 seeds the slider', (
      tester,
    ) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        _hostScreen(prefill: const ToolPrefill(questionCount: 12)),
      );
      await tester.pumpAndSettle();

      expect(tester.widget<Slider>(find.byType(Slider)).value, 12);
      expect(find.text('12'), findsOneWidget);
    });
  });

  group('validation', () {
    testWidgets('an empty topic blocks submit', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_hostScreen());
      await tester.pumpAndSettle();

      await tester.tap(find.text('Generate quiz'));
      await tester.pumpAndSettle();

      expect(find.text('Please enter a topic for the quiz.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('deselecting every question type blocks submit', (
      tester,
    ) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_hostScreen());
      await tester.pumpAndSettle();

      // questionTypes is required by the endpoint's schema, so the form has to
      // catch it rather than let the request 400.
      await tester.tap(find.text('Multiple choice'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Short answer'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField), 'Fractions');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Generate quiz'));
      await tester.pumpAndSettle();

      expect(
        find.text('Please choose at least one question type.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('re-selecting a type clears the error', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_hostScreen());
      await tester.pumpAndSettle();

      await tester.tap(find.text('Multiple choice'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Short answer'));
      await tester.pumpAndSettle();
      expect(
        find.text('Please choose at least one question type.'),
        findsOneWidget,
      );

      await tester.tap(find.text('True or false'));
      await tester.pumpAndSettle();
      expect(
        find.text('Please choose at least one question type.'),
        findsNothing,
      );
    });
  });

  group(
    'empty-variants result keeps a retry affordance (T2-U11b dead-end fix)',
    () {
      testWidgets(
        'an empty quiz shows the empty state AND keeps the sticky Generate '
        'button',
        (tester) async {
          tester.view.physicalSize = const Size(400, 1400);
          tester.view.devicePixelRatio = 1.0;
          addTearDown(tester.view.reset);

          await tester.pumpWidget(
            _hostScreen(
              overrides: [
                quizControllerProvider.overrideWith(
                  () => _StubController(data: buildQuiz(empty: true)),
                ),
              ],
            ),
          );
          await tester.pumpAndSettle();

          // The by-design empty state renders (no variants came back)...
          expect(find.byType(QuizResultView), findsOneWidget);
          expect(
            find.text(
              'No questions came back for that topic. Please try a different '
              'topic.',
            ),
            findsOneWidget,
          );
          // ...and — the fix — the sticky Generate button is still there, so the
          // teacher can retry instead of being stranded past the skipped footer.
          expect(find.text('Generate quiz'), findsOneWidget);
          expect(tester.takeException(), isNull);
        },
      );
    },
  );
}

/// Injects a fixed [Quiz] so the empty-result state can be asserted without a
/// live API. Mirrors the visual-aid / field-trip screen-test stubs.
class _StubController extends QuizController {
  _StubController({this.data});

  final Quiz? data;

  @override
  FutureOr<Quiz?> build() => data;
}

/// A question-type row from the two-column grid.
MapOption _option(WidgetTester tester, String label) =>
    tester.widget<MapOption>(find.widgetWithText(MapOption, label));

/// A Bloom's level chip.
MapChip _bloom(WidgetTester tester, String label) =>
    tester.widget<MapChip>(find.widgetWithText(MapChip, label));

/// Expands the collapsed "More options" card (its fields stay Offstage until
/// it opens).
Future<void> _openMoreOptions(WidgetTester tester) async {
  await tester.ensureVisible(find.text('More options'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('More options'));
  await tester.pumpAndSettle();
}
