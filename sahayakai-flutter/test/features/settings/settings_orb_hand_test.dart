import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/settings/presentation/settings_screen.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_orb_placement_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'settings_fixtures.dart';

/// The "Floating assistant · On the left hand" toggle (v3 screen 16) flips the
/// orb's hand through [VidyaOrbPlacementController].

void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  testWidgets('the orb-hand toggle flips VIDYA to the left hand', (
    tester,
  ) async {
    tester.view.physicalSize = kTallSurface;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    late ProviderContainer container;
    await tester.pumpWidget(
      hostSettings(
        Consumer(
          builder: (context, ref, _) {
            container = ProviderScope.containerOf(context);
            return const SettingsScreen();
          },
        ),
        overrides: [signedInOverride(), profileDocOverride(doc: {})],
      ),
    );
    await tester.pumpAndSettle();

    // Default: right hand.
    expect(
      container.read(vidyaOrbPlacementControllerProvider).hand,
      VidyaHand.right,
    );

    final toggle = find.ancestor(
      of: find.text('On the left hand'),
      matching: find.byType(SwitchListTile),
    );
    expect(toggle, findsOneWidget);

    await tester.tap(toggle);
    await tester.pumpAndSettle();

    expect(
      container.read(vidyaOrbPlacementControllerProvider).hand,
      VidyaHand.left,
    );
    expect(
      container.read(vidyaOrbPlacementControllerProvider).perch,
      VidyaPerch.bottomLeft, // default bottom band, now left column
    );
  });
}
