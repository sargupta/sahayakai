import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_orb_placement_controller.dart';
import 'package:sahayakai/features/vidya/presentation/widgets/vidya_orb.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../onboarding/onboarding_fixtures.dart';

/// The parked "Tap to speak" capsule from Screen 02 — the design's caption
/// sitting 9px off the resting orb's sphere. It lives in the overlay, which
/// the real app mounts through `MaterialApp.router.builder`, so a bare home
/// widget cannot show it: these boot the REAL app via [pumpSignedInApp].
void main() {
  setUp(() {
    // The placement controller reads its remembered hand from prefs on build,
    // and the locale controller seeds itself the same way.
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  testWidgets('shows on the voice home while the orb rests', (tester) async {
    await pumpSignedInApp(tester);

    expect(find.byType(VidyaOrb), findsOneWidget);
    expect(find.text('Tap to speak'), findsOneWidget);
  });

  testWidgets('hides on any other route — the caption belongs to the home', (
    tester,
  ) async {
    await pumpSignedInApp(tester);
    expect(find.text('Tap to speak'), findsOneWidget);

    routerOf(tester).go(Routes.library);
    await tester.pumpAndSettle();

    // The orb rides along everywhere; only the caption is the home's.
    expect(find.byType(VidyaOrb), findsOneWidget);
    expect(find.text('Tap to speak'), findsNothing);
  });

  testWidgets(
    'sits left of the parked orb, and mirrors when the left hand takes over',
    (tester) async {
      await pumpSignedInApp(tester);

      final rightOrb = tester.getRect(find.byType(VidyaOrb));
      final rightCap = tester.getRect(find.text('Tap to speak'));
      expect(
        rightCap.right,
        lessThan(rightOrb.left),
        reason: 'with the orb parked right, the caption sits to its left',
      );

      // The same move Settings' "Orb on the left hand" switch makes.
      final container = containerOf(tester);
      await container
          .read(vidyaOrbPlacementControllerProvider.notifier)
          .setHand(VidyaHand.left);
      await tester.pumpAndSettle();

      final leftOrb = tester.getRect(find.byType(VidyaOrb));
      final leftCap = tester.getRect(find.text('Tap to speak'));
      expect(
        leftCap.left,
        greaterThan(leftOrb.right),
        reason: 'on a left-hand perch the caption mirrors to the orb\'s right '
            'instead of running off-screen',
      );
    },
  );
}
