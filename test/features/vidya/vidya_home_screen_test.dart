import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/core/platform/clock.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/dashboard/presentation/floating_bottom_nav.dart';
import 'package:sahayakai/features/profile/domain/teacher_profile.dart';
import 'package:sahayakai/features/profile/presentation/profile_controller.dart';
import 'package:sahayakai/features/vidya/data/dto/vidya_action.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_controller.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_home_screen.dart';
import 'package:sahayakai/shared/voice/audio_player_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import '../../support/fake_voice.dart';

/// U-V5 — the v3 VIDYA voice home (Design System v3 Screen 02 "Voice home").
/// Rendered with a fixed-state fake controller so each surface is asserted in
/// isolation (the machine itself is covered by vidya_controller_test). No mic,
/// no socket.
///
/// What this screen renders now: a transparent app bar (network hub · inbox ·
/// conditional clear-conversation · prep desk), then a wash-gradient body with
/// the header row (glass avatar initials · the pinned date · the profile's
/// name · the active language's pill), the two-line hero, the "Waiting for
/// you" task card and the 2×2 tile grid. The former Seal Mic hero, greeting
/// prompt, quick-tools preview, hero badge and status panels are no longer
/// part of this surface.

class _FakeVidyaController extends VidyaController {
  _FakeVidyaController(this._state);
  final VidyaState _state;

  @override
  VidyaState build() => _state;

  // The home may tap these; the fake keeps them inert so no service is touched.
  @override
  Future<void> onMicTap() async {}
  @override
  Future<void> cancel() async {}
  @override
  void dispatchDirective(VidyaDirective directive) {}
  @override
  void consumeNavigation() {}
  @override
  void registerScreenContext(String path, {Map<String, dynamic>? uiState}) {}
  @override
  Future<void> openMicSettings() async {}
  // U-V7: the home restores the session on load; the fake keeps it inert so
  // the widget test never reaches the network.
  @override
  Future<void> restoreSession() async {}

  // U9: tracked (not just inert) so a test can prove the app-bar "Clear
  // conversation" action really reaches the controller.
  bool clearConversationCalled = false;
  @override
  void clearConversation() {
    clearConversationCalled = true;
  }
}

/// The profile seam for this suite: the header reads the teacher's name and
/// initials through `profileControllerProvider`, which in production walks
/// Firestore. The fake resolves instantly to the design's persona instead.
class _FakeProfileController extends ProfileController {
  @override
  Future<TeacherProfile> build() async {
    return const TeacherProfile(displayName: 'Meena Kulkarni');
  }
}

/// Everything the home needs beyond the controller under test: a pinned clock
/// for the header's dynamic date line, the fake network/TTS stack the greeting
/// uses, and the persona profile — without these the widget reaches for the
/// wall clock, production APIs and Firebase.
List<Override> _homeSupportOverrides() => [
  nowProvider.overrideWithValue(() => DateTime(2018, 9, 18, 9, 41)),
  apiClientProvider.overrideWithValue(FakeApiClient()),
  audioPlayerServiceProvider.overrideWithValue(FakeAudioPlayerService()),
  profileControllerProvider.overrideWith(_FakeProfileController.new),
];

Future<void> _pumpHome(
  WidgetTester tester,
  VidyaState state, {
  bool reduceMotion = true,
  Brightness brightness = Brightness.light,
  Locale locale = const Locale('en'),
  double textScale = 1.0,
  Size surface = const Size(390, 844),
}) async {
  tester.view.physicalSize = surface;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
  if (reduceMotion) {
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
  }

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        vidyaControllerProvider.overrideWith(() => _FakeVidyaController(state)),
        ..._homeSupportOverrides(),
      ],
      child: MaterialApp(
        theme: brightness == Brightness.dark
            ? AppTheme.dark()
            : AppTheme.light(),
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const VidyaHomeScreen(),
      ),
    ),
  );
  await tester.pump();
}

/// A marker screen a real `context.push` resolves to, so a navigation
/// assertion does not have to drag a whole tool screen's own provider graph
/// into this suite (mirrors `content_creator_screen_test.dart`'s pattern).
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

/// Boots the VIDYA home inside a real [GoRouter] rather than a bare
/// [MaterialApp], for the tests that actually exercise a `context.push` (the
/// 2×2 tile grid and a task-card "Open" action) — the plain [_pumpHome]
/// harness has no router, so tapping a push-triggering control there would
/// throw ("No GoRouter found in context").
Future<void> _pumpHomeWithRouter(
  WidgetTester tester,
  VidyaState state, {
  Locale locale = const Locale('en'),
}) async {
  // Same reduce-motion default as [_pumpHome]: without it any lingering
  // animation can keep `pumpAndSettle` below running (DESIGN_RUBRIC's
  // motion-off contract). Same 390×844 phone surface as [_pumpHome] too —
  // the default 800×600 test window is not the geometry the screen targets.
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

  final router = GoRouter(
    initialLocation: Routes.home,
    routes: [
      GoRoute(path: Routes.home, builder: (_, _) => const VidyaHomeScreen()),
      GoRoute(
        path: Routes.attendance,
        builder: (_, _) => const _DestMarker('attendance'),
      ),
      GoRoute(
        path: Routes.assessmentScanner,
        builder: (_, _) => const _DestMarker('assessment-scanner'),
      ),
      GoRoute(
        path: Routes.lessonPlan,
        builder: (_, _) => const _DestMarker('lesson-plan'),
      ),
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        vidyaControllerProvider.overrideWith(() => _FakeVidyaController(state)),
        ..._homeSupportOverrides(),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        theme: AppTheme.light(),
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('the v3 voice home canvas', () {
    testWidgets('renders the header row: initials, date, name, language pill', (
      tester,
    ) async {
      await _pumpHome(tester, const VidyaState());
      await tester.pumpAndSettle();

      // The 36px glass avatar, the date/name column, the language pill.
      expect(find.text('MK'), findsOneWidget);
      expect(find.text('Tue, 18 Sept'), findsOneWidget);
      expect(find.text('Meena Kulkarni'), findsOneWidget);
      // The pill names the ACTIVE language — its endonym, not a hard-coded
      // other-language shortcut.
      expect(find.text('English'), findsOneWidget);
    });

    testWidgets('the language pill opens the shared language picker', (
      tester,
    ) async {
      await _pumpHome(tester, const VidyaState());
      await tester.pumpAndSettle();

      await tester.tap(find.text('English'));
      await tester.pumpAndSettle();

      // The SAME sheet the You tab's switcher opens — titled with the
      // language label and one radio per language, not a home-grown picker.
      expect(find.text('Language'), findsOneWidget);
      expect(find.byType(RadioListTile<AppLocale>), findsNWidgets(11));
    });

    testWidgets('renders the hero title and its middle-dot subtitle', (
      tester,
    ) async {
      await _pumpHome(tester, const VidyaState());
      await tester.pumpAndSettle();

      // The hero now shows a time-based greeting plus a profile-derived
      // subtitle (fallback when the profile has no grades/subjects).
      expect(find.textContaining('Good '), findsWidgets);
      expect(
        find.text(
          'Complete your profile to personalize your experience',
          findRichText: true,
        ),
        findsOneWidget,
      );
    });

    testWidgets('renders exactly four tiles in the 2×2 grid', (tester) async {
      await _pumpHome(tester, const VidyaState());
      await tester.pumpAndSettle();

      for (final title in const [
        'Roll call',
        'Make a lesson',
        'Scan a test',
        'Call parents',
      ]) {
        expect(find.text(title), findsOneWidget, reason: 'tile "$title"');
      }
      // _Tile is private to the screen — count by runtime type to prove the
      // grid is exactly 2×2 (four find.text calls alone would pass with a
      // stray 5th tile attached anywhere).
      expect(
        find.byWidgetPredicate(
          (w) => w.runtimeType.toString() == '_Tile',
          description: 'home tile',
        ),
        findsNWidgets(4),
      );
    });
  });

  group('the home routes to its tools', () {
    testWidgets('tapping the Roll call tile pushes the attendance route', (
      tester,
    ) async {
      await _pumpHomeWithRouter(tester, const VidyaState());

      await tester.tap(find.text('Roll call'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('dest-attendance')), findsOneWidget);
    });

    testWidgets(
      'tapping the Scan a test tile pushes the assessment-scanner route',
      (tester) async {
        await _pumpHomeWithRouter(tester, const VidyaState());

        await tester.tap(find.text('Scan a test'));
        await tester.pumpAndSettle();

        expect(
          find.byKey(const Key('dest-assessment-scanner')),
          findsOneWidget,
        );
      },
    );

  });

  group('the app bar entries', () {
    testWidgets('shows the network hub, inbox and prep desk actions', (
      tester,
    ) async {
      await _pumpHome(tester, const VidyaState());
      await tester.pumpAndSettle();

      // U-SI2 — the Network hub entry sits in the app bar next to the inbox
      // entry; the Prep desk is the right-most action.
      expect(find.byIcon(Icons.public_outlined), findsOneWidget);
      expect(find.byIcon(LucideIcons.messageCircle), findsOneWidget);
      expect(find.byIcon(Icons.dashboard_outlined), findsOneWidget);
    });
  });

  group('U9: manual "Clear conversation" action', () {
    testWidgets('is absent on the idle canvas (nothing to clear)', (
      tester,
    ) async {
      await _pumpHome(tester, const VidyaState());
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.delete_outline), findsNothing);
    });

    testWidgets(
      'appears once a conversation is active, and tapping it clears it',
      (tester) async {
        final fake = _FakeVidyaController(
          const VidyaState(
            conversation: [
              ConversationBlock(
                role: ConversationRole.teacher,
                text: 'plan a lesson on fractions',
              ),
              ConversationBlock(
                role: ConversationRole.vidya,
                text: 'Making your fractions lesson plan.',
              ),
            ],
          ),
        );

        tester.view.physicalSize = const Size(390, 844);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);
        tester.platformDispatcher.accessibilityFeaturesTestValue =
            const FakeAccessibilityFeatures(disableAnimations: true);
        addTearDown(
          tester.platformDispatcher.clearAccessibilityFeaturesTestValue,
        );

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              vidyaControllerProvider.overrideWith(() => fake),
              ..._homeSupportOverrides(),
            ],
            child: MaterialApp(
              theme: AppTheme.light(),
              locale: const Locale('en'),
              localizationsDelegates: AppLocalizations.localizationsDelegates,
              supportedLocales: AppLocalizations.supportedLocales,
              home: const VidyaHomeScreen(),
            ),
          ),
        );
        await tester.pumpAndSettle();

        // The app-bar action is conditional on state.hasConversation — it
        // appears iff the transcript is non-empty.
        final clearAction = find.byIcon(Icons.delete_outline);
        expect(clearAction, findsOneWidget);

        await tester.tap(clearAction);
        await tester.pump();

        expect(fake.clearConversationCalled, isTrue);
      },
    );
  });

  group('motion and semantics', () {
    testWidgets('reduce-motion is a static frame (pumpAndSettle returns)', (
      tester,
    ) async {
      await _pumpHome(tester, const VidyaState());
      await tester.pumpAndSettle();
      expect(tester.binding.transientCallbackCount, 0);
      expect(find.text('Meena Kulkarni'), findsOneWidget);
    });

    testWidgets("exposes the home's key text to assistive tech", (
      tester,
    ) async {
      await _pumpHome(tester, const VidyaState());
      await tester.pumpAndSettle();

      expect(find.bySemanticsLabel('Meena Kulkarni'), findsOneWidget);
      // The tile's InkWell semantics merge title + subtitle into one label.
      expect(
        find.bySemanticsLabel('Roll call\nSpeak the names'),
        findsOneWidget,
      );
    });
  });

  group('real-geometry regression: the tile grid clears the floating nav', () {
    testWidgets('the 2×2 tile grid clears the floating bottom nav on first '
        'paint', (tester) async {
      // Regression test for the DP-1 design review finding: the bare _pumpHome
      // harness has no AppShell/FloatingBottomNav, so it could not catch the
      // tile grid being sliced off by the real nav bar. This wraps the home in
      // the same Scaffold+FloatingBottomNav shape AppShell gives it (v3 nav:
      // currentIndex + onSelected only — no items parameter).
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
      tester.platformDispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            vidyaControllerProvider.overrideWith(
              () => _FakeVidyaController(const VidyaState()),
            ),
            ..._homeSupportOverrides(),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(
              body: const VidyaHomeScreen(),
              bottomNavigationBar: FloatingBottomNav(
                currentIndex: 0,
                onSelected: (_) {},
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // The bottom tile row (Scan a test shares it with Call parents) must sit
      // fully above the floating nav's top edge, unscrolled — not merely
      // present in the tree (a bare find.text would pass even half-clipped).
      final lastTile = find.byKey(const ValueKey('home-tile-scan'));
      expect(lastTile, findsOneWidget);
      final navTop = tester.getTopLeft(find.byType(FloatingBottomNav)).dy;
      final tileBottom = tester.getBottomLeft(lastTile).dy;
      expect(
        tileBottom,
        lessThanOrEqualTo(navTop),
        reason:
            'the last tile row must clear the floating bottom '
            'nav on first paint, unscrolled',
      );
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9)', () {
    for (final brightness in Brightness.values) {
      testWidgets('no overflow at 360dp x 1.3 (${brightness.name})', (
        tester,
      ) async {
        await _pumpHome(
          tester,
          const VidyaState(),
          brightness: brightness,
          textScale: 1.3,
          surface: const Size(360, 900),
        );
        await tester.pumpAndSettle();
      });
    }

    testWidgets('no overflow with a Bengali conversation at 360dp x 1.3', (
      tester,
    ) async {
      await _pumpHome(
        tester,
        const VidyaState(
          conversation: [
            ConversationBlock(
              role: ConversationRole.teacher,
              text: 'শিক্ষকদের জন্য কৃত্রিম বুদ্ধিমত্তা সহায়ক প্রশ্ন',
            ),
            ConversationBlock(
              role: ConversationRole.vidya,
              text: 'আপনার পাঠ পরিকল্পনা তৈরি করছি।',
            ),
          ],
        ),
        textScale: 1.3,
        surface: const Size(360, 900),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
