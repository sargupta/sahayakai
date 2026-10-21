import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/quiz_generator/domain/quiz.dart';
import 'package:sahayakai/features/quiz_generator/presentation/quiz_controller.dart';
import 'package:sahayakai/features/quiz_generator/presentation/quiz_generator_screen.dart';
import 'package:sahayakai/features/quiz_generator/presentation/widgets/quiz_result_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'quiz_fixtures.dart';

/// Form-layer gates: the chips, dropdowns and stepper are the overflow-prone
/// half of the screen, so they face the same DESIGN_RUBRIC §12 checks as the
/// result. Also pins the two validation rules the endpoint depends on: a topic
/// is required, and at least one question type must be selected.
///
/// No live API is exercised here; nothing taps Generate with a valid form.
Widget _hostScreen({
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
      locale: const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(
          context,
        ).copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: const QuizGeneratorScreen(),
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
            expect(find.text('Topic'), findsOneWidget);
            expect(find.text('Number of questions'), findsOneWidget);
            expect(find.text('Question types'), findsOneWidget);
            expect(find.text('All levels'), findsOneWidget);
            expect(find.text('Thinking skills'), findsOneWidget);
          },
        );
      }
    }
  });

  group('states', () {
    testWidgets('opens in the idle/empty state', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_hostScreen());
      await tester.pumpAndSettle();

      expect(find.textContaining('tap Generate'), findsOneWidget);
    });

    testWidgets('defaults mirror the web form', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_hostScreen());
      await tester.pumpAndSettle();

      // numQuestions 5; multiple_choice + short_answer; Remember + Understand.
      expect(find.text('5'), findsOneWidget);
      expect(
        tester.widget<FilterChip>(_chip('Multiple choice')).selected,
        isTrue,
      );
      expect(tester.widget<FilterChip>(_chip('Short answer')).selected, isTrue);
      expect(
        tester.widget<FilterChip>(_chip('Fill in the blanks')).selected,
        isFalse,
      );
      expect(tester.widget<FilterChip>(_chip('Remember')).selected, isTrue);
      expect(tester.widget<FilterChip>(_chip('Understand')).selected, isTrue);
      expect(tester.widget<FilterChip>(_chip('Apply')).selected, isFalse);

      // No target difficulty -> the endpoint returns all three variants.
      expect(tester.widget<ChoiceChip>(_choice('All levels')).selected, isTrue);
    });
  });

  group('number of questions stepper', () {
    testWidgets('increments and decrements', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_hostScreen());
      await tester.pumpAndSettle();

      await tester.tap(find.byIcon(LucideIcons.plus));
      await tester.pumpAndSettle();
      expect(find.text('6'), findsOneWidget);

      await tester.tap(find.byIcon(LucideIcons.minus));
      await tester.pumpAndSettle();
      expect(find.text('5'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('clamps at the endpoint bounds (1..20)', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_hostScreen());
      await tester.pumpAndSettle();

      // Walk down to the floor; the button then disables rather than going 0.
      for (var i = 0; i < 6; i++) {
        final minus = tester.widget<IconButton>(
          find.ancestor(
            of: find.byIcon(LucideIcons.minus),
            matching: find.byType(IconButton),
          ),
        );
        if (minus.onPressed == null) break;
        await tester.tap(find.byIcon(LucideIcons.minus));
        await tester.pumpAndSettle();
      }
      expect(find.text('1'), findsOneWidget);
      expect(
        tester
            .widget<IconButton>(
              find.ancestor(
                of: find.byIcon(LucideIcons.minus),
                matching: find.byType(IconButton),
              ),
            )
            .onPressed,
        isNull,
      );

      // And up to the ceiling.
      for (var i = 0; i < 25; i++) {
        final plus = tester.widget<IconButton>(
          find.ancestor(
            of: find.byIcon(LucideIcons.plus),
            matching: find.byType(IconButton),
          ),
        );
        if (plus.onPressed == null) break;
        await tester.tap(find.byIcon(LucideIcons.plus));
        await tester.pumpAndSettle();
      }
      expect(find.text('20'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('validation', () {
    testWidgets('an empty topic blocks submit', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_hostScreen());
      await tester.pumpAndSettle();

      await tester.tap(find.text('Generate'));
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
      await tester.tap(find.text('Generate'));
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
          expect(find.text('Generate'), findsOneWidget);
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

Finder _chip(String label) =>
    find.ancestor(of: find.text(label), matching: find.byType(FilterChip));

Finder _choice(String label) =>
    find.ancestor(of: find.text(label), matching: find.byType(ChoiceChip));
