@Tags(['golden'])
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../features/dashboard/dashboard_fixtures.dart';
import '../features/onboarding/onboarding_fixtures.dart';

/// Pixel baselines for the states every screen shares.
///
/// Thirty routes render four states between them — populated, empty, failed and
/// loading — and they all reach for the same shared widgets. Baselining those
/// four here covers a failure mode on every screen at once, which is a far
/// better return than goldening a 27th tool form that fails for the same reason
/// the first one does.
///
/// The empty and error states matter more than they look. A teacher meets them
/// on a first launch and on a dropped connection, which on a 2G link in a rural
/// school is a routine Tuesday, not an edge case. They are also the states most
/// likely to be quietly broken by a copy change, because nobody screenshots
/// them.
///
/// Written unrolled rather than in a loop: the source is the coverage record, a
/// reader should be able to count what is asserted without executing the loop
/// in their head, and every baseline is greppable by name.
///
/// Platform note as in screens_golden_test.dart — macOS baselines do not match
/// ubuntu; CI is the authority.
void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('shared state baselines', () {
    testWidgets('library empty — light', (tester) async {
      await pumpDashboard(
        tester,
        client: libraryClient(response: contentListResponse(items: [])),
        surface: kNarrowPhone,
      );
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/state_empty_light.png'),
      );
    });

    testWidgets('library empty — dark', (tester) async {
      await pumpDashboard(
        tester,
        client: libraryClient(response: contentListResponse(items: [])),
        surface: kNarrowPhone,
        brightness: Brightness.dark,
      );
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/state_empty_dark.png'),
      );
    });

    testWidgets('library populated — light', (tester) async {
      await pumpDashboard(
        tester,
        client: libraryClient(),
        surface: kNarrowPhone,
      );
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/state_populated_light.png'),
      );
    });

    testWidgets('library populated — dark', (tester) async {
      await pumpDashboard(
        tester,
        client: libraryClient(),
        surface: kNarrowPhone,
        brightness: Brightness.dark,
      );
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/state_populated_dark.png'),
      );
    });

    testWidgets('library populated at textScale 1.3 — light', (tester) async {
      // The row that carries a title, a type and a class on one line is the
      // first thing to clip when a teacher turns large text on.
      await pumpDashboard(
        tester,
        client: libraryClient(),
        surface: kNarrowPhone,
        textScale: 1.3,
      );
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/state_populated_ts13_light.png'),
      );
    });

    testWidgets('signed-out profile surface — light', (tester) async {
      await pumpSignedInApp(
        tester,
        signedIn: false,
        surface: kNarrowPhone,
        textScale: 1.3,
      );
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/state_signed_out_ts13_light.png'),
      );
    });
  });
}
