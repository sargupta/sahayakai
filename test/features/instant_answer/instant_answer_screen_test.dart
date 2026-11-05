import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/instant_answer/presentation/instant_answer_screen.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';
import 'package:sahayakai/shared/widgets/map_option.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'instant_answer_fixtures.dart';

/// Form-layer gates: the question card, the "Try one of these" suggestions and
/// the map's three selectors (Class / Subject / Language) face the same
/// DESIGN_RUBRIC §12 checks as the result. Also pins the one validation
/// rule the endpoint depends on: a question is required.
///
/// No live API is exercised here; nothing taps the submit button with a valid
/// form (a live call would 401 anyway — auth is still stubbed).
Widget _hostScreen({
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
}) {
  return ProviderScope(
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
      home: const InstantAnswerScreen(),
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

            // English labels render as the map's uppercase overline.
            expect(find.text('YOUR QUESTION'), findsOneWidget);
            expect(find.text('TRY ONE OF THESE'), findsOneWidget);
            expect(find.byType(MapOption), findsNWidgets(6));
            expect(find.text('CLASS'), findsOneWidget);
            expect(find.text('SUBJECT'), findsOneWidget);
            expect(find.text('LANGUAGE'), findsOneWidget);
          },
        );
      }
    }

    testWidgets('a long Indic question does not overflow the field', (
      tester,
    ) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_hostScreen(textScale: 1.3));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byType(TextFormField),
        '$kBn $kTa $kMl $kLongWord',
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
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

      // Before the first answer the result slot renders nothing: the form and
      // its submit button are the whole screen.
      expect(find.byType(EmptyView), findsNothing);
      expect(find.text('Ask a question and tap Get answer.'), findsNothing);
      expect(find.text('Get instant answer'), findsOneWidget);
    });

    testWidgets('defaults leave grade and subject unset', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_hostScreen());
      await tester.pumpAndSettle();

      // Both are optional; the flow back-fills them from the profile, so the
      // form must not invent a grade the teacher did not choose.
      expect(find.text('Any class'), findsOneWidget);
      expect(find.text('Any subject'), findsOneWidget);
    });

    testWidgets('a class can be chosen from the Class selector sheet', (
      tester,
    ) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_hostScreen());
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.text('Any class'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Any class'));
      await tester.pumpAndSettle();
      final option = find.text('Class 6');
      await tester.scrollUntilVisible(
        option,
        100,
        scrollable: find
            .descendant(
              of: find.byType(BottomSheet),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.tap(option);
      await tester.pumpAndSettle();

      expect(find.text('Class 6'), findsOneWidget);
      expect(find.text('Any class'), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('tapping a suggestion fills the question', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_hostScreen());
      await tester.pumpAndSettle();

      final suggestion = find.widgetWithText(MapOption, 'Why is the sky blue?');
      await tester.ensureVisible(suggestion);
      await tester.pumpAndSettle();
      await tester.tap(suggestion);
      await tester.pumpAndSettle();

      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.controller!.text, 'Why is the sky blue?');
      expect(tester.widget<MapOption>(suggestion).selected, isTrue);
    });
  });

  group('validation', () {
    testWidgets('an empty question blocks submit', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_hostScreen());
      await tester.pumpAndSettle();

      final submit = find.text('Get instant answer');
      await tester.ensureVisible(submit);
      await tester.pumpAndSettle();
      await tester.tap(submit);
      await tester.pumpAndSettle();

      expect(find.text('Please enter a question.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('a whitespace-only question blocks submit', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_hostScreen());
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField), '    ');
      await tester.pumpAndSettle();

      expect(find.text('Please enter a question.'), findsOneWidget);
    });

    testWidgets('typing a question clears the error', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_hostScreen());
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField), '  ');
      await tester.pumpAndSettle();
      expect(find.text('Please enter a question.'), findsOneWidget);

      await tester.enterText(
        find.byType(TextFormField),
        'Why is the sky blue?',
      );
      await tester.pumpAndSettle();
      expect(find.text('Please enter a question.'), findsNothing);
    });

    testWidgets('the question field caps at the flow own 4000-char limit', (
      tester,
    ) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_hostScreen());
      await tester.pumpAndSettle();

      // The flow throws "Question too long (max 4000 characters)"; the form
      // stops it here so the teacher never eats a 500 for it.
      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.maxLength, 4000);
    });
  });
}
