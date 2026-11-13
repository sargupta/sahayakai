import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/lesson_planner/domain/lesson_plan.dart';
import 'package:sahayakai/features/lesson_planner/presentation/lesson_plan_controller.dart';
import 'package:sahayakai/features/lesson_planner/presentation/lesson_plan_screen.dart';
import 'package:sahayakai/features/vidya/presentation/widgets/inline_field_mic.dart';
import 'package:sahayakai/shared/domain/tool_prefill.dart';
import 'package:sahayakai/shared/widgets/map_chip.dart';
import 'package:sahayakai/shared/widgets/map_select.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// U-V6 — the reference for threading a VIDYA directive INTO a tool: the
/// LessonPlanScreen seeds its form from an optional [ToolPrefill], and opens
/// blank (unchanged) when none is passed. Also that the inline dictation mic is
/// present on the primary (topic) field.

Widget _host({ToolPrefill? prefill, List<Override> overrides = const []}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      theme: AppTheme.light(),
      locale: const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: LessonPlanScreen(prefill: prefill),
    ),
  );
}

/// The single-choice Class selector (the map's tap-to-change tile).
MapSelect<String?> _classSelect(WidgetTester tester) => tester.widget(
  find.byWidgetPredicate((w) => w is MapSelect<String?> && w.label == 'Class'),
);

/// A controller that records the request instead of generating.
class _CapturingLessonController extends LessonPlanController {
  LessonPlanRequest? request;

  @override
  Future<void> generate(LessonPlanRequest request) async {
    this.request = request;
  }
}

/// A controller that starts generating and never finishes, to look at the
/// screen mid-generation.
class _StillWritingController extends LessonPlanController {
  bool started = false;

  @override
  Future<void> generate(LessonPlanRequest request) async {
    started = true;
    state = const AsyncLoading<LessonPlan?>();
  }
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  // Class gate (founder report, 2026-11-13): "if I ask it to make something
  // the blue orb comes up and I have to minimise it manually every time". A
  // request VIDYA opens generates by itself, and nothing covers the page that
  // the teacher has to dismiss while it works.
  testWidgets('a spoken request generates with no working panel to dismiss', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(420, 1600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    final controller = _StillWritingController();

    await tester.pumpWidget(
      _host(
        prefill: const ToolPrefill(
          topic: 'Water cycle',
          gradeLevel: 'Class 7',
          autoSubmit: true,
        ),
        overrides: [
          lessonPlanControllerProvider.overrideWith(() => controller),
        ],
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(controller.started, isTrue, reason: 'it must generate by itself');
    expect(find.text('Minimise to orb'), findsNothing);
    expect(find.text('Working on it'), findsNothing);
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
    // Class is a single-choice selector now: the prefilled class is its value.
    expect(_classSelect(tester).value, 'Class 10');
    expect(find.text('Class 10'), findsOneWidget);
    expect(find.text('Science'), findsOneWidget);
    // language 'kn' → the Kannada endonym is shown in the language picker,
    // which lives under "More options".
    await tester.tap(find.text('More options'));
    await tester.pumpAndSettle();
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
      expect(_classSelect(tester).value, isNull);
      expect(find.text('Any class'), findsOneWidget);
      expect(find.text('Any subject'), findsOneWidget);
      expect(find.text('Grade 99'), findsNothing);
      expect(find.text('Astrophysics'), findsNothing);
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

      expect(find.text('Make a lesson'), findsOneWidget);
      expect(find.text('Fractions'), findsNothing);
      expect(_classSelect(tester).value, isNull);
      expect(find.text('Any class'), findsOneWidget);
    },
  );

  testWidgets(
    'Class is a single choice picked from the sheet, sent as gradeLevels',
    (tester) async {
      tester.view.physicalSize = const Size(420, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      final controller = _CapturingLessonController();
      await tester.pumpWidget(
        _host(
          overrides: [
            lessonPlanControllerProvider.overrideWith(() => controller),
          ],
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField).first, 'Fractions');

      // Pick Class 7, then change it to Class 8: only one class is ever held.
      await tester.tap(find.text('CLASS'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Class 7').last);
      await tester.pumpAndSettle();
      expect(_classSelect(tester).value, 'Class 7');

      await tester.tap(find.text('CLASS'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Class 8').last);
      await tester.pumpAndSettle();
      expect(_classSelect(tester).value, 'Class 8');
      expect(find.text('Class 7'), findsNothing);

      await tester.tap(find.text('Generate lesson'));
      await tester.pumpAndSettle();

      expect(controller.request, isNotNull);
      expect(controller.request!.topic, 'Fractions');
      expect(controller.request!.gradeLevels, ['Class 8']);
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

  group('v3 screen 05 composer refinements', () {
    final l10n = lookupAppLocalizations(const Locale('en'));

    testWidgets('the Include chips render and default to none selected', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(420, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      MapChip chip(String label) =>
          tester.widget<MapChip>(find.widgetWithText(MapChip, label));

      // All four v3 components are offered.
      for (final label in [
        l10n.lessonPlanIncludeActivity,
        l10n.lessonPlanIncludeBoardWork,
        l10n.lessonPlanIncludeHomework,
        l10n.lessonPlanIncludeStoryHook,
      ]) {
        expect(find.widgetWithText(MapChip, label), findsOneWidget);
        // None preselected — a plain plan sends exactly the typed topic.
        expect(chip(label).selected, isFalse, reason: label);
      }

      // A tap toggles one on, a second tap off again.
      await tester.tap(find.text(l10n.lessonPlanIncludeActivity));
      await tester.pumpAndSettle();
      expect(chip(l10n.lessonPlanIncludeActivity).selected, isTrue);
      await tester.tap(find.text(l10n.lessonPlanIncludeActivity));
      await tester.pumpAndSettle();
      expect(chip(l10n.lessonPlanIncludeActivity).selected, isFalse);
    });

    testWidgets('no NCERT banner until a grade is chosen', (tester) async {
      tester.view.physicalSize = const Size(420, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();
      expect(find.text(l10n.lessonPlanNcertTitle), findsNothing);
    });

    testWidgets('a chosen grade brings the NCERT banner in, naming the class', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(420, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        _host(prefill: const ToolPrefill(gradeLevel: 'Class 7')),
      );
      await tester.pumpAndSettle();
      expect(find.text(l10n.lessonPlanNcertTitle), findsOneWidget);
      expect(find.text(l10n.lessonPlanNcertBody('Class 7')), findsOneWidget);
    });
  });
}
