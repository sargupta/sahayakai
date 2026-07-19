import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/features/dashboard/presentation/app_shell.dart';
import 'package:sahayakai/features/lesson_planner/presentation/lesson_plan_screen.dart';
import 'package:sahayakai/shared/domain/tool_registry.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../onboarding/onboarding_fixtures.dart';

/// P1.8 — the Create (command) palette.
///
/// The palette is reached the way a teacher reaches it: by booting the real app
/// onto the signed-in shell and tapping the Create action, so the sheet, the
/// search, the deep links and the shared registry are all asserted end to end.
///
/// The dashboard is still mounted behind the modal sheet, so its own tool tiles
/// carry the same names as the palette rows. Every palette-scoped assertion
/// therefore keys off `create-palette-<id>` (unique to a palette row) rather
/// than the tool name, which would match the tile behind the sheet too.

/// The 13 tools the build ships, by stable id.
const Set<String> _expectedIds = {
  'lesson-plan',
  'quiz',
  'instant-answer',
  'worksheet',
  'rubric',
  'exam-paper',
  'teacher-training',
  'parent-message',
  'parent-hotline',
  'assess-assignment',
  'visual-aid',
  'video-storyteller',
  'virtual-field-trip',
};

Key _rowKey(String id) => ValueKey('create-palette-$id');

/// Opens the palette from the shell's Create action.
Future<void> _openPalette(WidgetTester tester) async {
  // The Create destination is the only place the sparkles glyph appears.
  await tester.tap(find.byIcon(LucideIcons.sparkles));
  await tester.pumpAndSettle();
}

/// Scrolls the palette's own list (the last scrollable, mounted by the sheet) to
/// the end so every row is laid out — an overflow below the fold only surfaces
/// once its row is built.
Future<void> _scrollPalette(WidgetTester tester) async {
  final list = find.byType(Scrollable).last;
  var guard = 0;
  while (guard++ < 40) {
    final position = tester.state<ScrollableState>(list).position;
    if (position.pixels >= position.maxScrollExtent) break;
    await tester.drag(list, const Offset(0, -200));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  }
}

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('the shared registry', () {
    test('lists all thirteen built tools with valid routes and Lucide icons',
        () {
      expect(kToolRegistry, hasLength(13));
      expect(kToolRegistry.map((t) => t.id).toSet(), _expectedIds);

      const registered = {
        Routes.lessonPlan,
        Routes.quizGenerator,
        Routes.instantAnswer,
        Routes.worksheetWizard,
        Routes.rubricGenerator,
        Routes.examPaper,
        Routes.teacherTraining,
        Routes.parentMessage,
        Routes.parentHotline,
        Routes.assessAssignment,
        Routes.visualAid,
        Routes.videoStoryteller,
        Routes.virtualFieldTrip,
      };
      for (final tool in kToolRegistry) {
        expect(tool.route, isIn(registered), reason: '${tool.id} route');
        expect(tool.route, startsWith('/'), reason: '${tool.id} route shape');
        // A resolving Lucide glyph, never a Material fallback (DESIGN_RUBRIC
        // §13): the Lucide port stamps this family/package on every icon.
        expect(tool.icon.fontFamily, 'Lucide', reason: '${tool.id} icon family');
        expect(tool.icon.fontPackage, 'lucide_icons',
            reason: '${tool.id} icon package');
      }

      // No two tools collide on a route or an icon.
      expect(kToolRegistry.map((t) => t.route).toSet(), hasLength(13));
      expect(kToolRegistry.map((t) => t.icon.codePoint).toSet(), hasLength(13));
    });

    testWidgets('every tool has a resolving, distinct localized name',
        (tester) async {
      // Names come from the ARB, not hardcoded English: prove each getter
      // resolves to a real, non-empty, distinct string through the real
      // localization delegates.
      late AppLocalizations l10n;
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          locale: const Locale('en'),
          home: Builder(
            builder: (context) {
              l10n = AppLocalizations.of(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      );

      final names = <String>{};
      for (final tool in kToolRegistry) {
        expect(tool.title(l10n).trim(), isNotEmpty, reason: '${tool.id} title');
        expect(tool.subtitle(l10n).trim(), isNotEmpty,
            reason: '${tool.id} subtitle');
        names.add(tool.title(l10n));
      }
      expect(names, hasLength(kToolRegistry.length),
          reason: 'tool names must be distinct');
    });
  });

  group('opening', () {
    testWidgets('the Create action opens the palette over the shell',
        (tester) async {
      await pumpSignedInApp(tester);
      expect(find.byType(AppShell), findsOneWidget);

      await _openPalette(tester);

      // The search field and every tool row are present.
      expect(find.byType(TextField), findsOneWidget);
      for (final id in _expectedIds) {
        expect(find.byKey(_rowKey(id)), findsOneWidget, reason: id);
      }
    });
  });

  group('search', () {
    testWidgets('narrows the list to tools whose name matches', (tester) async {
      await pumpSignedInApp(tester);
      await _openPalette(tester);

      await tester.enterText(find.byType(TextField), 'quiz');
      await tester.pumpAndSettle();

      expect(find.byKey(_rowKey('quiz')), findsOneWidget);
      expect(find.byKey(_rowKey('lesson-plan')), findsNothing);
      expect(find.byKey(_rowKey('worksheet')), findsNothing);
    });

    testWidgets('matches case-insensitively', (tester) async {
      await pumpSignedInApp(tester);
      await _openPalette(tester);

      await tester.enterText(find.byType(TextField), 'QUIZ');
      await tester.pumpAndSettle();

      expect(find.byKey(_rowKey('quiz')), findsOneWidget);
      expect(find.byKey(_rowKey('lesson-plan')), findsNothing);
    });

    testWidgets('a search that matches nothing shows the empty state',
        (tester) async {
      await pumpSignedInApp(tester);
      await _openPalette(tester);

      await tester.enterText(find.byType(TextField), 'zzzzzzz');
      await tester.pumpAndSettle();

      // The palette's own empty copy, unique to it (the dashboard's empty state
      // behind the sheet uses different copy).
      expect(find.text('No tools match your search'), findsOneWidget);
      for (final id in _expectedIds) {
        expect(find.byKey(_rowKey(id)), findsNothing, reason: id);
      }

      // Clearing the query restores the full list.
      await tester.enterText(find.byType(TextField), '');
      await tester.pumpAndSettle();
      expect(find.byKey(_rowKey('quiz')), findsOneWidget);
    });
  });

  group('navigation', () {
    testWidgets('tapping a tool deep-links to its route and closes the sheet',
        (tester) async {
      await pumpSignedInApp(tester);
      await _openPalette(tester);

      final lessonPlan = find.byKey(_rowKey('lesson-plan'));
      await tester.ensureVisible(lessonPlan);
      await tester.pumpAndSettle();
      await tester.tap(lessonPlan);
      await tester.pumpAndSettle();

      // The real route was pushed...
      expect(find.byType(LessonPlanScreen), findsOneWidget);
      // ...and the sheet is gone: its rows (and its search-hint copy) are
      // unmounted. (The pushed form has its own TextField, so the palette's
      // closure is asserted by the palette-scoped key, not the field.)
      expect(find.byKey(_rowKey('lesson-plan')), findsNothing);
      expect(find.text('Search tools'), findsNothing);
    });

    testWidgets('a filtered result still deep-links to the right route',
        (tester) async {
      await pumpSignedInApp(tester);
      await _openPalette(tester);

      await tester.enterText(find.byType(TextField), 'lesson');
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(_rowKey('lesson-plan')));
      await tester.pumpAndSettle();

      expect(find.byType(LessonPlanScreen), findsOneWidget);
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9 / §12.10 / §12.11 / §12.13)', () {
    for (final brightness in Brightness.values) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 in ${brightness.name}',
        (tester) async {
          await pumpSignedInApp(
            tester,
            brightness: brightness,
            textScale: 1.3,
            surface: kNarrowPhone,
          );
          await _openPalette(tester);

          // No RenderFlex overflow when the sheet opens, nor as its list scrolls
          // every row into view at the narrow, scaled size.
          expect(tester.takeException(), isNull);
          await _scrollPalette(tester);
        },
      );
    }

    testWidgets('the dark palette really is dark', (tester) async {
      await pumpSignedInApp(tester, brightness: Brightness.dark);
      await _openPalette(tester);

      final theme = Theme.of(tester.element(find.byType(TextField)));
      expect(theme.brightness, Brightness.dark);
    });

    for (final locale in const [Locale('bn'), Locale('ta'), Locale('ml')]) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 in ${locale.languageCode} '
        '(Indic ARB probe)',
        (tester) async {
          // Under an Indic locale the palette's own chrome (the Create title,
          // the search hint) renders in Bengali / Tamil / Malayalam from the
          // ARB — a real Indic glyph probe at the narrow, scaled size.
          await pumpSignedInApp(
            tester,
            locale: locale,
            textScale: 1.3,
            surface: kNarrowPhone,
          );
          await _openPalette(tester);

          expect(tester.takeException(), isNull);
          await _scrollPalette(tester);
        },
      );
    }

    testWidgets('the empty state does not overflow at 360dp x 1.3',
        (tester) async {
      await pumpSignedInApp(
        tester,
        locale: const Locale('ml'),
        textScale: 1.3,
        surface: kNarrowPhone,
      );
      await _openPalette(tester);

      await tester.enterText(find.byType(TextField), 'zzzzzzz');
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byType(TextField), findsOneWidget);
    });
  });
}
