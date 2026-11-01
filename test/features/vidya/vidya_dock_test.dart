import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/features/dashboard/presentation/floating_bottom_nav.dart';
import 'package:sahayakai/features/vidya/domain/deliverable.dart';
import 'package:sahayakai/features/vidya/presentation/deliver_tray.dart';
import 'package:sahayakai/features/vidya/presentation/deliverables_controller.dart';
import 'package:sahayakai/features/vidya/presentation/widgets/vidya_dock.dart';
import 'package:sahayakai/features/vidya/presentation/widgets/vidya_orb.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../onboarding/onboarding_fixtures.dart';

/// VIDYA docked in the tab bar (v2 9a, "VIDYA lives in the tab bar").
///
/// Three places split the app between them, one orb each: Home's big orb (the
/// dock steps aside there), the docked orb on the other three tabs, and the
/// overlay's floating orb on a pushed screen with no tab bar. These boot the
/// REAL app via [pumpSignedInApp], because the floating orb is mounted through
/// `MaterialApp.router.builder`.
void main() {
  setUp(() {
    // The placement controller reads its remembered hand from prefs on build,
    // and the locale controller seeds itself the same way.
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  Finder dockedOrb() => find.descendant(
    of: find.byType(FloatingBottomNav),
    matching: find.byType(VidyaOrb),
  );

  Future<void> openTab(WidgetTester tester, int index) async {
    await tester.tap(find.byKey(ValueKey('tab_$index')));
    await tester.pumpAndSettle();
  }

  testWidgets('on Home the big orb is the one orb; the bar has no dock', (
    tester,
  ) async {
    await pumpSignedInApp(tester);

    expect(find.byType(VidyaOrb), findsOneWidget);
    expect(find.byKey(const ValueKey('home-big-orb')), findsOneWidget);
    expect(find.byType(VidyaDockOrb), findsNothing);
    expect(find.text('Tap or hold to speak'), findsOneWidget);
  });

  testWidgets('on the other tabs the one orb is docked in the tab bar', (
    tester,
  ) async {
    await pumpSignedInApp(tester);
    await openTab(tester, 1);

    expect(find.byType(VidyaDockOrb), findsOneWidget);
    expect(dockedOrb(), findsOneWidget);
    expect(
      find.byKey(const ValueKey('home-big-orb')).hitTestable(),
      findsNothing,
    );
  });

  testWidgets('the dock orb sits after the four tabs, inside the capsule', (
    tester,
  ) async {
    await pumpSignedInApp(tester);
    await openTab(tester, 1);

    final orb = tester.getCenter(find.byType(VidyaDockOrb));
    final lastTab = tester.getRect(find.byKey(const ValueKey('tab_3')));
    expect(orb.dx, greaterThan(lastTab.right));
    expect((orb.dy - lastTab.center.dy).abs(), lessThan(1));
    expect(
      tester.getSize(find.byType(VidyaDockOrb)),
      const Size.square(44),
      reason: 'a 42px sphere in a 44px touch cell',
    );
  });

  testWidgets('the tabs keep their size whether the dock shows or not', (
    tester,
  ) async {
    await pumpSignedInApp(tester);
    final onHome = tester.getSize(find.byKey(const ValueKey('tab_0')));
    await openTab(tester, 1);
    final onLibrary = tester.getSize(find.byKey(const ValueKey('tab_0')));

    expect(onHome, onLibrary);
  });

  testWidgets('a pushed screen with no tab bar gets the floating orb back', (
    tester,
  ) async {
    await pumpSignedInApp(tester);

    routerOf(tester).go(Routes.library);
    await tester.pumpAndSettle();

    expect(find.byType(FloatingBottomNav), findsNothing);
    expect(find.byType(VidyaOrb), findsOneWidget);
  });

  testWidgets(
    'off Home, a ready result shows the deliver capsule; a tap opens the tray',
    (tester) async {
      await pumpSignedInApp(tester);
      await openTab(tester, 1);

      containerOf(tester)
          .read(deliverablesControllerProvider.notifier)
          .add(
            const Deliverable(
              id: 'ws-1',
              title: 'Fractions worksheet',
              text: '1. Which is larger, 3/4 or 2/4?',
            ),
          );
      await tester.pumpAndSettle();

      final capsule = find.text('Ready · Tap to deliver');
      expect(capsule, findsOneWidget);
      final orb = tester.widget<VidyaOrb>(dockedOrb());
      expect(orb.state, VidyaOrbVisual.ready);
      expect(orb.readyCount, 1);

      await tester.tap(capsule);
      await tester.pumpAndSettle();

      expect(find.byType(DeliverTray), findsOneWidget);
    },
  );

  testWidgets('on Home a ready result shows on the big orb, not a capsule', (
    tester,
  ) async {
    await pumpSignedInApp(tester);

    containerOf(tester)
        .read(deliverablesControllerProvider.notifier)
        .add(
          const Deliverable(
            id: 'ws-1',
            title: 'Fractions worksheet',
            text: '1. Which is larger, 3/4 or 2/4?',
          ),
        );
    await tester.pumpAndSettle();

    final big = tester.widget<VidyaOrb>(
      find.byKey(const ValueKey('home-big-orb')),
    );
    expect(big.state, VidyaOrbVisual.ready);
    expect(
      find.descendant(
        of: find.byType(FloatingBottomNav),
        matching: find.text('Ready · Tap to deliver'),
      ),
      findsNothing,
    );
  });
}
