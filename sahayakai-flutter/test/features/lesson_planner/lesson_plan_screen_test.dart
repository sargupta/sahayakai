import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/lesson_planner/presentation/lesson_plan_screen.dart';
import 'package:sahayakai/features/vidya/presentation/widgets/inline_field_mic.dart';
import 'package:sahayakai/shared/domain/tool_prefill.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// U-V6 — the reference for threading a VIDYA directive INTO a tool: the
/// LessonPlanScreen seeds its form from an optional [ToolPrefill], and opens
/// blank (unchanged) when none is passed. Also that the inline dictation mic is
/// present on the primary (topic) field.

Widget _host({ToolPrefill? prefill}) {
  return ProviderScope(
    child: MaterialApp(
      theme: AppTheme.light(),
      locale: const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: LessonPlanScreen(prefill: prefill),
    ),
  );
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  testWidgets('a VIDYA prefill seeds topic, grade, subject and language', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(420, 1600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      _host(
        prefill: const ToolPrefill(
          topic: 'Fractions',
          gradeLevel: 'Class 10',
          subject: 'Science',
          language: 'kn',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Fractions'), findsOneWidget);
    expect(
      tester
          .widget<FilterChip>(find.widgetWithText(FilterChip, 'Class 10'))
          .selected,
      isTrue,
    );
    expect(find.text('Science'), findsOneWidget);
    // language 'kn' → the Kannada endonym is shown in the language picker.
    expect(find.text('ಕನ್ನಡ'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'an unknown grade/subject is ignored, never crashing a dropdown',
    (tester) async {
      tester.view.physicalSize = const Size(420, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        _host(
          prefill: const ToolPrefill(
            topic: 'Photosynthesis',
            gradeLevel: 'Grade 99', // not a known grade
            subject: 'Astrophysics', // not a known subject
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Topic still seeds; the unknown grade/subject simply do not apply.
      expect(find.text('Photosynthesis'), findsOneWidget);
      expect(
        tester
            .widget<FilterChip>(find.widgetWithText(FilterChip, 'Class 10'))
            .selected,
        isFalse,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'no prefill opens the blank form (existing behaviour unchanged)',
    (tester) async {
      tester.view.physicalSize = const Size(420, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      expect(find.text('Fractions'), findsNothing);
      expect(
        tester
            .widget<FilterChip>(find.widgetWithText(FilterChip, 'Class 10'))
            .selected,
        isFalse,
      );
    },
  );

  testWidgets('the topic field carries the inline dictation mic', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(420, 1600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_host());
    await tester.pumpAndSettle();

    expect(find.byType(InlineFieldMic), findsOneWidget);
  });
}
