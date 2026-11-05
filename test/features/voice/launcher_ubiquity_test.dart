import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/inbox/presentation/inbox_screen.dart';
import 'package:sahayakai/features/staffroom/presentation/staffroom_screen.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_cta_clearance.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_overlay.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_sheet.dart';
import 'package:sahayakai/features/vidya/presentation/widgets/vidya_orb.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/app_harness.dart';

/// VIDYA everywhere, exactly once. On the four tabs she is docked in the tab
/// bar; on every screen pushed over them (a tool, Settings, a chat…) she is
/// the floating orb; no screen carries a second VIDYA button of its own.

const _tool = '/a-tool';
const _plain = '/a-page';

GoRouter _router() => GoRouter(
  initialLocation: Routes.home,
  routes: [
    GoRoute(
      path: Routes.home,
      builder: (_, _) => const Scaffold(body: Text('the tabs')),
    ),
    GoRoute(
      path: _tool,
      builder: (_, _) => const Scaffold(
        body: Text('a tool'),
        bottomNavigationBar: VidyaCtaClearance(
          child: SizedBox(height: 60, child: Text('Generate')),
        ),
      ),
    ),
    GoRoute(
      path: _plain,
      builder: (_, _) => const Scaffold(body: Text('a page')),
    ),
  ],
);

Future<GoRouter> _pumpApp(WidgetTester tester) async {
  tester.view.physicalSize = const Size(400, 860);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  // The orb lives (spins, floats) unless motion is off; off lets frames settle.
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
  final router = _router();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [signedInOverride()],
      child: MaterialApp.router(
        theme: AppTheme.light(),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: router,
        builder: (context, child) => Stack(
          children: [
            ?child,
            Positioned.fill(child: VidyaOverlay(router: router)),
          ],
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  group('the floating orb', () {
    testWidgets('steps aside on the tabs, where VIDYA is docked', (
      tester,
    ) async {
      await _pumpApp(tester);
      expect(find.text('the tabs'), findsOneWidget);
      expect(find.byType(VidyaOrb), findsNothing);
    });

    testWidgets('floats, once, over every screen pushed on the tabs', (
      tester,
    ) async {
      final router = await _pumpApp(tester);

      unawaited(router.push(_plain));
      await tester.pumpAndSettle();
      expect(find.text('a page'), findsOneWidget);
      expect(find.byType(VidyaOrb), findsOneWidget);

      unawaited(router.push(_tool));
      await tester.pumpAndSettle();
      expect(find.byType(VidyaOrb), findsOneWidget);

      // Back to the tabs: docked again, the floating orb gone.
      router
        ..pop()
        ..pop();
      await tester.pumpAndSettle();
      expect(find.byType(VidyaOrb), findsNothing);
    });

    testWidgets('parks above a page\'s pinned button, not on it', (
      tester,
    ) async {
      final router = await _pumpApp(tester);

      unawaited(router.push(_plain));
      await tester.pumpAndSettle();
      final plainBottom = tester.getBottomLeft(find.byType(VidyaOrb)).dy;

      unawaited(router.push(_tool));
      await tester.pumpAndSettle();
      final toolBottom = tester.getBottomLeft(find.byType(VidyaOrb)).dy;
      final buttonTop = tester.getTopLeft(find.text('Generate')).dy;

      // The map: sphere at 172 over a full-width button instead of 100.
      expect(plainBottom - toolBottom, 72);
      expect(toolBottom, lessThanOrEqualTo(buttonTop));

      // Leaving the tool drops the lift again.
      router.pop();
      await tester.pumpAndSettle();
      expect(tester.getBottomLeft(find.byType(VidyaOrb)).dy, plainBottom);
    });
  });

  group('no second VIDYA button', () {
    Widget host(Widget screen) => ProviderScope(
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: screen,
      ),
    );

    for (final (name, screen) in [
      ('Pro Inbox', const InboxScreen()),
      ('Staffroom', const StaffroomScreen()),
    ]) {
      testWidgets('$name has no app-bar launcher: the floating orb is VIDYA', (
        tester,
      ) async {
        await tester.pumpWidget(host(screen));
        // pump (not pumpAndSettle): its deferred streams never settle, but
        // the app bar renders on the first frame.
        await tester.pump();
        expect(find.byType(VidyaAppBarAction), findsNothing);
        await tester.pumpWidget(const SizedBox());
        await tester.pump(const Duration(minutes: 1));
      });
    }
  });
}
