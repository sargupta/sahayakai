import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/dashboard/presentation/app_shell.dart';
import 'package:sahayakai/features/dashboard/presentation/app_tab_bar.dart';
import 'package:sahayakai/features/inbox/data/inbox_transport.dart';
import 'package:sahayakai/features/inbox/data/messages_stream_provider.dart';
import 'package:sahayakai/features/library/presentation/library_screen.dart';
import 'package:sahayakai/features/profile/presentation/me_screen.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_providers.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_transport.dart';
import 'package:sahayakai/features/staffroom/presentation/network_hub_screen.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_home_screen.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_overlay.dart';
import 'package:sahayakai/features/vidya/presentation/widgets/vidya_orb.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_block_c_transports.dart';
import '../onboarding/onboarding_fixtures.dart';

/// The signed-in shell on design system v2: the four-tab capsule (Home,
/// Library, Community, Profile) and VIDYA's orb as the way creation starts.

/// The Network hub's transports, faked, so the Community tab builds without
/// a Firebase app.
List<Override> _hubOverrides() => [
  staffroomTransportProvider.overrideWithValue(FakeStaffroomTransport()),
  currentStaffroomUserIdProvider.overrideWithValue('u-me'),
  inboxTransportProvider.overrideWithValue(FakeInboxTransport()),
  currentInboxUserIdProvider.overrideWithValue('u-me'),
];

/// The parked orb: the one the overlay mounts above the Navigator.
Finder get _parkedOrb => find.descendant(
  of: find.byType(VidyaOverlay),
  matching: find.byType(VidyaOrb),
);

Future<void> _tap(WidgetTester tester, AppTab tab) async {
  await tester.tap(find.byKey(ValueKey('tab-${tab.name}')));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  testWidgets('the shell runs the v2 tab bar: four tabs, Home first', (
    tester,
  ) async {
    await pumpSignedInApp(tester, extraOverrides: _hubOverrides());
    expect(find.byType(AppShell), findsOneWidget);
    expect(find.byType(AppTabBar), findsOneWidget);
    for (final tab in AppTab.values) {
      expect(find.byKey(ValueKey('tab-${tab.name}')), findsOneWidget);
    }
    expect(find.byType(VidyaHomeScreen), findsOneWidget);
  });

  testWidgets('each tab shows its destination', (tester) async {
    await pumpSignedInApp(tester, extraOverrides: _hubOverrides());

    await _tap(tester, AppTab.library);
    expect(find.byType(LibraryScreen), findsOneWidget);

    await _tap(tester, AppTab.community);
    expect(find.byType(NetworkHubScreen), findsOneWidget);

    await _tap(tester, AppTab.profile);
    expect(find.byType(MeScreen), findsOneWidget);
  });

  testWidgets('Community is not built until it is first visited', (
    tester,
  ) async {
    await pumpSignedInApp(tester, extraOverrides: _hubOverrides());
    expect(
      find.byType(NetworkHubScreen, skipOffstage: false),
      findsNothing,
      reason: 'its live feeds must not open at app start',
    );
    await _tap(tester, AppTab.community);
    await _tap(tester, AppTab.home);
    expect(
      find.byType(NetworkHubScreen, skipOffstage: false),
      findsOneWidget,
      reason: 'kept warm after the first visit',
    );
  });

  testWidgets('the parked orb stays off Home (Home\'s hero is the orb) and '
      'shows on every other tab, where it is how creation starts', (
    tester,
  ) async {
    await pumpSignedInApp(tester, extraOverrides: _hubOverrides());
    expect(_parkedOrb, findsNothing);
    // Exactly one VIDYA on Home: the hero.
    expect(find.byType(VidyaOrb), findsOneWidget);

    for (final tab in [AppTab.library, AppTab.community, AppTab.profile]) {
      await _tap(tester, tab);
      expect(_parkedOrb, findsOneWidget, reason: tab.name);
      // Home's hero is offstage in the IndexedStack, so still one orb shows.
      expect(find.byType(VidyaOrb), findsOneWidget, reason: tab.name);
    }

    await _tap(tester, AppTab.home);
    expect(_parkedOrb, findsNothing);
  });
}
