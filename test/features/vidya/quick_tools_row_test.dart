import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/vidya/presentation/widgets/quick_tools_row.dart';
import 'package:sahayakai/shared/domain/tool_registry.dart';
import 'package:sahayakai/shared/widgets/app_card.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// DP-1 — the Quick Tools preview row on the VIDYA home's idle canvas.
///
/// [kToolRegistry] is the single source of truth (the same list the Prep desk
/// and the Create palette already walk), so these tests exercise the row
/// against the REAL registry rather than a hand-rolled tool list — a passing
/// test here can never mean "the preview lists a tool the app does not have."
///
/// The narrow phone the overflow gates target (DESIGN_RUBRIC §12).
const Size _kNarrowPhone = Size(360, 900);

/// The six tools the idle canvas previews (see `_quickToolsCount` on
/// `_EmptyLayout`).
List<ToolEntry> _firstSix() => kToolRegistry.take(6).toList();

/// A marker screen a pushed route resolves to, keyed so a tap-to-navigate
/// assertion does not have to drag each real tool's own provider graph into
/// this row's test (mirrors `content_creator_screen_test.dart`'s pattern).
class _DestMarker extends StatelessWidget {
  const _DestMarker(this.id);

  final String id;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(child: Text('DEST', key: Key('dest-$id'))),
    );
  }
}

GoRouter _buildRouter({required List<ToolEntry> tools}) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (_, _) => Scaffold(
          body: SafeArea(child: QuickToolsRow(tools: tools)),
        ),
      ),
      for (final tool in tools)
        GoRoute(path: tool.route, builder: (_, _) => _DestMarker(tool.id)),
      // The signed-out mic terminal panel routes here too (vidya home tests
      // cover that directly); registered so a stray push never 404s a test.
      GoRoute(
        path: Routes.login,
        builder: (_, _) => const _DestMarker('login'),
      ),
    ],
  );
}

Widget _host({
  required List<ToolEntry> tools,
  double textScale = 1.0,
  Locale locale = const Locale('en'),
  Brightness brightness = Brightness.light,
}) {
  return MaterialApp.router(
    routerConfig: _buildRouter(tools: tools),
    theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
    locale: locale,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(
        context,
      ).copyWith(textScaler: TextScaler.linear(textScale)),
      child: child!,
    ),
  );
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('renders the registry preview', () {
    testWidgets('a tile for each of the first six registry tools', (
      tester,
    ) async {
      await tester.pumpWidget(_host(tools: _firstSix()));
      await tester.pumpAndSettle();

      expect(find.byType(AppCard), findsNWidgets(6));
      expect(find.text('Lesson Plan'), findsOneWidget);
      expect(find.text('Quiz'), findsOneWidget);
      expect(find.text('Instant Answer'), findsOneWidget);
      expect(find.text('Worksheet'), findsOneWidget);
      expect(find.text('Rubric'), findsOneWidget);
      expect(find.text('Exam Paper'), findsOneWidget);
    });
  });

  group('layout (a Wrap of intrinsic-height tiles, never GridView.count)', () {
    testWidgets('two tiles per row, each roughly half the available width', (
      tester,
    ) async {
      tester.view.physicalSize = _kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host(tools: _firstSix()));
      await tester.pumpAndSettle();

      final cards = find.byType(AppCard);
      expect(cards, findsNWidgets(6));
      final firstWidth = tester.getSize(cards.at(0)).width;
      final secondWidth = tester.getSize(cards.at(1)).width;
      // Both tiles in the same row are the same, halved width — not a
      // full-width row and not three-plus columns.
      expect(firstWidth, closeTo(secondWidth, 0.5));
      expect(firstWidth, lessThan(_kNarrowPhone.width / 2));
      expect(firstWidth, greaterThan(_kNarrowPhone.width / 3));
    });

    testWidgets('a two-line title does not force every tile to one height', (
      tester,
    ) async {
      // A short and a very long title side by side: with an intrinsic-height
      // Wrap (not a fixed `childAspectRatio`), the long tile is free to grow
      // taller than its short neighbour instead of clipping.
      final tools = [
        ToolEntry(
          id: 'short',
          icon: LucideIcons.bookOpen,
          route: '/t-short',
          title: (_) => 'Quiz',
          subtitle: (_) => '',
        ),
        ToolEntry(
          id: 'long',
          icon: LucideIcons.fileText,
          route: '/t-long',
          title: (_) =>
              'A considerably longer tool name that wraps onto two lines',
          subtitle: (_) => '',
        ),
      ];
      await tester.pumpWidget(_host(tools: tools));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      final cards = find.byType(AppCard);
      final shortHeight = tester.getSize(cards.at(0)).height;
      final longHeight = tester.getSize(cards.at(1)).height;
      expect(longHeight, greaterThan(shortHeight));
    });
  });

  group('navigation (context.push to the tool\'s real route)', () {
    testWidgets('tapping the Lesson Plan tile pushes Routes.lessonPlan', (
      tester,
    ) async {
      await tester.pumpWidget(_host(tools: _firstSix()));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Lesson Plan'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('dest-lesson-plan')), findsOneWidget);
    });

    testWidgets('tapping the Quiz tile pushes Routes.quizGenerator', (
      tester,
    ) async {
      await tester.pumpWidget(_host(tools: _firstSix()));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Quiz'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('dest-quiz')), findsOneWidget);
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9)', () {
    for (final brightness in Brightness.values) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 with a Malayalam-length title '
        '(${brightness.name})',
        (tester) async {
          tester.view.physicalSize = _kNarrowPhone;
          tester.view.devicePixelRatio = 1.0;
          addTearDown(tester.view.reset);

          // A genuinely long, real Malayalam sentence (borrowed from the
          // VIDYA signed-out body copy already in `app_ml.arb`) standing in
          // for a tool title — the worst case a real translation could ever
          // reach, not a placeholder string invented for the test.
          const longMalayalamTitle =
              'സൈൻ ഇൻ ചെയ്യൂ, VIDYA നിങ്ങളുടെ ഭാഷയിൽ പാഠങ്ങൾ, ക്വിസുകൾ '
              'എന്നിവയും അതിലധികവും തയ്യാറാക്കും.';
          final tools = [
            for (final tool in _firstSix())
              ToolEntry(
                id: tool.id,
                icon: tool.icon,
                route: tool.route,
                title: (_) => longMalayalamTitle,
                subtitle: tool.subtitle,
              ),
          ];

          await tester.pumpWidget(
            _host(
              tools: tools,
              locale: const Locale('ml'),
              textScale: 1.3,
              brightness: brightness,
            ),
          );
          await tester.pumpAndSettle();

          expect(tester.takeException(), isNull);
          expect(find.byType(AppCard), findsNWidgets(6));
        },
      );
    }

    testWidgets(
      'the real (English) registry preview does not overflow either',
      (tester) async {
        tester.view.physicalSize = _kNarrowPhone;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(_host(tools: _firstSix(), textScale: 1.3));
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
      },
    );
  });
}
