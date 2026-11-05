import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations_en.dart';
import 'package:sahayakai/features/attendance/presentation/attendance_classes_screen.dart';
import 'package:sahayakai/features/dashboard/presentation/dashboard_screen.dart';
import 'package:sahayakai/features/inbox/data/messages_stream_provider.dart';
import 'package:sahayakai/features/instant_answer/presentation/instant_answer_screen.dart';
import 'package:sahayakai/features/lesson_planner/presentation/lesson_plan_screen.dart';
import 'package:sahayakai/features/profile/data/profile_doc_source.dart';
import 'package:sahayakai/features/quiz_generator/presentation/quiz_generator_screen.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_providers.dart';
import 'package:sahayakai/features/worksheet_wizard/presentation/worksheet_wizard_screen.dart';
import 'package:sahayakai/shared/domain/tool_registry.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import 'dashboard_fixtures.dart';

/// P0.3 — Dashboard Home, now the UX map's Make hub (`/prep-desk`).
///
/// Boots the real app and arrives here through the real redirect, so the tool
/// tiles are asserted against the routes they really reach.
///
/// The map's Make hub carries no greeting, setup nudge, "Your classes" or
/// Recent work: those sections were removed from this screen by design, so
/// their tests went with them (recent work stays covered by the Home tab and
/// Library suites).

/// Boots the Prep desk through the real app.
///
/// The v3 shell boots with all four tabs, so the landing also mounts the
/// Community tab (staffroom + inbox). Those two surfaces resolve their uid off
/// `FirebaseAuth.instance` as soon as the harness's signed-in auth is in
/// place — and a widget test never initializes Firebase, so the boot throws
/// `[core/no-app]` before the redirect ever reaches the Prep desk. The uid
/// seams are deliberately thin, overridable test seams (see their own docs),
/// so they are pinned to a signed-out uid here: the hub renders its documented
/// sign-in surface, the Firebase reads stay deferred, and this suite keeps
/// asserting what it actually covers — the Prep desk.
Future<void> _pumpDashboard(
  WidgetTester tester, {
  FakeApiClient? client,
  ProfileDocSource? docs,
  Brightness? brightness,
  double textScale = 1.0,
  Locale? locale,
  Size surface = kTallSurface,
  bool settle = true,
  List<Override> extraOverrides = const [],
}) async {
  await pumpDashboard(
    tester,
    client: client,
    docs: docs,
    brightness: brightness,
    textScale: textScale,
    locale: locale,
    surface: surface,
    settle: settle,
    extraOverrides: [
      currentStaffroomUserIdProvider.overrideWithValue(null),
      currentInboxUserIdProvider.overrideWithValue(null),
      ...extraOverrides,
    ],
  );
}

/// The tool ids the Make hub lays out, group by group, in the map's order.
const _hubGroups = <String, List<String>>{
  'PREPARE': ['lesson-plan', 'worksheet', 'exam-paper', 'visual-aid'],
  'ASSESS': [
    'quiz',
    'rubric',
    'assessment-scanner',
    'attendance',
    'assess-assignment',
  ],
  'EXPLORE': [
    'instant-answer',
    'virtual-field-trip',
    'video-storyteller',
    'teacher-training',
  ],
  'PARENTS': ['parent-message', 'parent-hotline'],
};

final Map<String, ToolEntry> _toolsById = {
  for (final tool in [...kToolRegistry, kAttendanceEntry]) tool.id: tool,
};

/// The hub's own scroll view (the shell keeps other tabs' scrollables mounted).
Finder get _hubScrollable => find
    .descendant(
      of: find.byType(DashboardScreen),
      matching: find.byType(Scrollable),
    )
    .first;

Future<void> _scrollWholeList(WidgetTester tester) async {
  final position = tester.state<ScrollableState>(_hubScrollable).position;
  var guard = 0;
  while (position.pixels < position.maxScrollExtent && guard++ < 60) {
    await tester.drag(_hubScrollable, const Offset(0, -280));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  }
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('Make hub', () {
    testWidgets('renders the title, the speak card and the four groups', (
      tester,
    ) async {
      await _pumpDashboard(tester);

      expect(find.text('What are we making?'), findsOneWidget);
      expect(find.text('Tap and speak'), findsOneWidget);
      // English overlines render uppercase (the map's overline style).
      for (final heading in _hubGroups.keys) {
        await tester.scrollUntilVisible(
          find.text(heading),
          200,
          scrollable: _hubScrollable,
        );
        expect(find.text(heading), findsOneWidget, reason: heading);
      }
    });

    testWidgets('lays out one tile per tool, under its group', (tester) async {
      await _pumpDashboard(tester);

      for (final ids in _hubGroups.values) {
        for (final id in ids) {
          final tile = find.byKey(ValueKey('make-$id'));
          await tester.scrollUntilVisible(
            tile,
            200,
            scrollable: _hubScrollable,
          );
          expect(tile, findsOneWidget, reason: 'the $id tile is missing');
          // The tile is named by the tool it opens.
          expect(
            find.descendant(
              of: tile,
              matching: find.text(_toolsById[id]!.title(AppLocalizationsEn())),
            ),
            findsOneWidget,
            reason: '$id tile title',
          );
        }
      }
      final allIds = _hubGroups.values.expand((ids) => ids).toSet();
      final tileIds = tester
          .widgetList(
            find.byWidgetPredicate(
              (w) =>
                  w.key is ValueKey<String> &&
                  (w.key! as ValueKey<String>).value.startsWith('make-'),
              skipOffstage: false,
            ),
          )
          .map((w) => (w.key! as ValueKey<String>).value.substring(5))
          .toSet();
      expect(tileIds, allIds, reason: 'no dead or unexpected tiles');
    });

    for (final id in _hubGroups.values.expand((ids) => ids)) {
      testWidgets('tapping the $id tile pushes its route', (tester) async {
        await _pumpDashboard(tester);
        final tile = find.byKey(ValueKey('make-$id'));
        await tester.scrollUntilVisible(tile, 200, scrollable: _hubScrollable);
        await tester.pumpAndSettle();

        await tester.tap(tile);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 500));

        expect(
          routerOf(
            tester,
          ).routerDelegate.currentConfiguration.last.matchedLocation,
          _toolsById[id]!.route,
        );
        // Pushed, not replaced: the hub is still underneath to come back to.
        expect(
          find.byType(DashboardScreen, skipOffstage: false),
          findsOneWidget,
        );
      });
    }
  });

  group('tool tiles', () {
    testWidgets('lists only tools that exist, with no dead tiles', (
      tester,
    ) async {
      await _pumpDashboard(tester);

      expect(find.text('Lesson Plan'), findsOneWidget);
      expect(find.text('Quiz'), findsOneWidget);
      expect(find.text('Instant Answer'), findsOneWidget);
      // Worksheet (P1.1) now has a real screen, so its tile is live.
      expect(find.text('Worksheet'), findsOneWidget);
    });

    testWidgets('attendance is reachable, and opens the real class list', (
      tester,
    ) async {
      // The six attendance screens shipped behind `/attendance` with nothing
      // linking to them — a feature a teacher cannot reach is not shipped.
      // This asserts the way in, not the destination's own behaviour.
      await _pumpDashboard(tester);

      await tester.ensureVisible(find.text('Attendance'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Attendance'));
      await tester.pumpAndSettle();

      expect(find.byType(AttendanceClassesScreen), findsOneWidget);
    });

    test('attendance is deliberately outside the Create palette registry', () {
      // The palette and the VIDYA home quick-tools preview both walk
      // `kToolRegistry`, so keeping attendance out of that list is what keeps a
      // daily classroom routine off a "what do you want to create?" shelf.
      // Asserted so a later "just add it to the registry" cannot quietly
      // reverse the decision.
      expect(
        kToolRegistry.map((tool) => tool.id),
        isNot(contains(kAttendanceEntry.id)),
      );
    });

    testWidgets('the lesson plan tile opens the real lesson plan screen', (
      tester,
    ) async {
      await _pumpDashboard(tester);

      await tester.tap(find.text('Lesson Plan'));
      await tester.pumpAndSettle();

      expect(find.byType(LessonPlanScreen), findsOneWidget);
    });

    testWidgets('the quiz tile opens the real quiz screen', (tester) async {
      await _pumpDashboard(tester);

      await tester.tap(find.text('Quiz'));
      await tester.pumpAndSettle();

      expect(find.byType(QuizGeneratorScreen), findsOneWidget);
    });

    testWidgets(
      'the instant answer tile opens the real instant answer screen',
      (tester) async {
        await _pumpDashboard(tester);

        await tester.tap(find.text('Instant Answer'));
        await tester.pumpAndSettle();

        expect(find.byType(InstantAnswerScreen), findsOneWidget);
      },
    );

    testWidgets('the worksheet tile opens the real worksheet screen', (
      tester,
    ) async {
      await _pumpDashboard(tester);

      // The tile can sit below the fold at some sizes; bring it into view so the
      // tap lands (tap only WARNS on a missed hit-test).
      await tester.ensureVisible(find.text('Worksheet'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Worksheet'));
      await tester.pumpAndSettle();

      expect(find.byType(WorksheetWizardScreen), findsOneWidget);
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9 / §12.10 / §12.11)', () {
    for (final brightness in Brightness.values) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 in ${brightness.name}',
        (tester) async {
          await _pumpDashboard(
            tester,
            brightness: brightness,
            textScale: 1.3,
            surface: kNarrowPhone,
          );

          expect(tester.takeException(), isNull);
          await _scrollWholeList(tester);
        },
      );
    }

    for (final locale in const [Locale('bn'), Locale('ta'), Locale('ml')]) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 in ${locale.languageCode}',
        (tester) async {
          // The real localized hub at a real Indic locale: the long tool names
          // and group headings must wrap inside their tiles.
          await _pumpDashboard(
            tester,
            locale: locale,
            textScale: 1.3,
            surface: kNarrowPhone,
          );

          expect(tester.takeException(), isNull);
          expect(
            find.byKey(const ValueKey('make-lesson-plan')),
            findsOneWidget,
          );
          await _scrollWholeList(tester);
        },
      );
    }
  });
}
