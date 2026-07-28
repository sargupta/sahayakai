import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/dashboard/presentation/floating_bottom_nav.dart';
import 'package:sahayakai/features/vidya/data/dto/vidya_action.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_controller.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_home_screen.dart';
import 'package:sahayakai/features/vidya/presentation/widgets/seal_mic.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// U-V5 — the VIDYA home. Rendered with a fixed-state fake controller so each
/// phase is asserted in isolation (the machine itself is covered by
/// vidya_controller_test). No mic, no socket.

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
  // U-V7: the home now restores the session on load; the fake keeps it inert so
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
      ],
      child: MaterialApp(
        theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
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
    return Scaffold(body: Center(child: Text('DEST', key: Key('dest-$id'))));
  }
}

/// Boots the VIDYA home inside a real [GoRouter] rather than a bare
/// [MaterialApp], for the two tests that actually exercise a `context.push`
/// (the Quick Tools tile and the signed-out Sign in action) — the plain
/// [_pumpHome] harness has no router, so tapping a push-triggering control
/// there would throw ("No GoRouter found in context").
Future<void> _pumpHomeWithRouter(
  WidgetTester tester,
  VidyaState state, {
  Locale locale = const Locale('en'),
}) async {
  // Same reduce-motion default as [_pumpHome]: without it the idle seal's
  // breathing animation and the rotating prompt's timer never settle, and
  // `pumpAndSettle` below times out (DESIGN_RUBRIC's motion-off contract).
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

  final router = GoRouter(
    initialLocation: Routes.home,
    routes: [
      GoRoute(path: Routes.home, builder: (_, _) => const VidyaHomeScreen()),
      GoRoute(path: Routes.login, builder: (_, _) => const _DestMarker('login')),
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

String _expectedGreeting() {
  final hour = DateTime.now().hour;
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

VidyaDirective _dir(VidyaFlow flow) =>
    VidyaDirective(flow: flow, params: const VidyaDirectiveParams());

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('the nearly-empty first canvas', () {
    testWidgets('renders the Seal Mic, a time-aware greeting, and a prompt',
        (tester) async {
      await _pumpHome(tester, const VidyaState());
      await tester.pumpAndSettle();

      expect(find.byType(SealMic), findsOneWidget);
      expect(find.byIcon(LucideIcons.mic), findsOneWidget);
      expect(find.text(_expectedGreeting()), findsOneWidget);
      // The deck and the idle caption + first (static) rotating prompt.
      expect(find.text('Speak in your language, and I will prepare the work.'),
          findsOneWidget);
      expect(find.text('Tap to speak'), findsOneWidget);
      expect(find.text('Ask me to plan a lesson'), findsOneWidget);
      // The Prep desk is one tap away.
      expect(find.byIcon(LucideIcons.layoutGrid), findsOneWidget);
      // U-SI2 — the Network hub entry sits in the app bar next to the messages
      // entry.
      expect(find.byIcon(LucideIcons.network), findsOneWidget);
    });

    testWidgets('reduce-motion is a static frame (pumpAndSettle returns)',
        (tester) async {
      await _pumpHome(tester, const VidyaState());
      await tester.pumpAndSettle();
      expect(tester.binding.transientCallbackCount, 0);
      expect(find.byType(SealMic), findsOneWidget);
    });

    testWidgets('under motion the seal breathes and the page still builds',
        (tester) async {
      await _pumpHome(tester, const VidyaState(), reduceMotion: false);
      // The Seal Mic ticks its breathing controller; do not settle (infinite).
      expect(tester.binding.transientCallbackCount, greaterThan(0));
      expect(find.byType(SealMic), findsOneWidget);
      expect(find.text(_expectedGreeting()), findsOneWidget);
    });
  });

  group('a turn inks onto the page as a document block', () {
    testWidgets('a teacher + VIDYA turn render as composed blocks, not bubbles',
        (tester) async {
      await _pumpHome(
        tester,
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
      await tester.pumpAndSettle();

      expect(find.text('YOU SAID'), findsOneWidget);
      expect(find.text('plan a lesson on fractions'), findsOneWidget);
      expect(find.text('Making your fractions lesson plan.'), findsOneWidget);
      // The mic settles to the anchored control, still present.
      expect(find.byType(SealMic), findsOneWidget);
    });

    testWidgets('a compound reply renders confirm chips', (tester) async {
      await _pumpHome(
        tester,
        VidyaState(
          conversation: [
            const ConversationBlock(
              role: ConversationRole.teacher,
              text: 'make a lesson and a quiz',
            ),
            ConversationBlock(
              role: ConversationRole.vidya,
              text: 'I can make both.',
              directives: [_dir(VidyaFlow.lessonPlan), _dir(VidyaFlow.quizGenerator)],
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      // Two chips, each with the sparkles glyph and a flow label.
      expect(find.byIcon(LucideIcons.sparkles), findsNWidgets(2));
      expect(find.text('Lesson Plan'), findsOneWidget);
      expect(find.text('Quiz'), findsOneWidget);
    });
  });

  group('signed-out and terminal states', () {
    testWidgets('signed-out shows the dignified sign-in state with the mic',
        (tester) async {
      await _pumpHome(
        tester,
        const VidyaState(status: VidyaStatus.signedOut),
      );
      await tester.pumpAndSettle();

      expect(find.text('Sign in to talk to VIDYA'), findsOneWidget);
      // The mic is present-but-inert, never a crash.
      expect(find.byType(SealMic), findsOneWidget);
    });

    testWidgets(
        'DP-1: signed-out now offers a Sign in action that navigates to /login',
        (tester) async {
      await _pumpHomeWithRouter(
        tester,
        const VidyaState(status: VidyaStatus.signedOut),
      );

      // The dead end this unit fixes: micDenied/failed already had a
      // recovery action; signed-out now does too.
      final signIn = find.text('Sign in');
      expect(signIn, findsOneWidget);
      expect(find.byIcon(LucideIcons.logIn), findsOneWidget);

      // The idle canvas is a scrollable column (see `_EmptyLayout`); bring
      // the action into view before tapping (a tap only WARNS on a missed
      // hit-test, per the dashboard suite's `ensureVisible` pattern).
      await tester.ensureVisible(signIn);
      await tester.pumpAndSettle();
      await tester.tap(signIn);
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('dest-login')), findsOneWidget);
    });

    testWidgets('a permanent mic denial offers Open settings', (tester) async {
      await _pumpHome(
        tester,
        const VidyaState(status: VidyaStatus.micDenied),
      );
      await tester.pumpAndSettle();

      expect(find.text('Turn on the microphone'), findsOneWidget);
      expect(find.text('Open settings'), findsOneWidget);
    });

    testWidgets('a network failure offers a retry', (tester) async {
      await _pumpHome(
        tester,
        const VidyaState(status: VidyaStatus.failed),
      );
      await tester.pumpAndSettle();

      expect(find.text('That did not go through'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });
  });

  group('DP-1: the hero badge', () {
    testWidgets('renders the AI co-teaching badge above the eyebrow',
        (tester) async {
      await _pumpHome(tester, const VidyaState());
      await tester.pumpAndSettle();

      expect(find.text('Your AI co-teaching assistant'), findsOneWidget);
      // In the idle state (no confirm chips) the sparkles glyph belongs to
      // the badge alone.
      expect(find.byIcon(LucideIcons.sparkles), findsOneWidget);
      // The existing eyebrow still renders below it (EditorialSectionHeader
      // upper-cases Latin text; unlike the badge, which does not).
      expect(find.text('YOUR CO-TEACHER'), findsOneWidget);
    });
  });

  group('DP-1: Quick Tools preview (idle canvas only)', () {
    testWidgets('previews the first two registry tools below the mic',
        (tester) async {
      await _pumpHome(tester, const VidyaState());
      await tester.pumpAndSettle();

      // EditorialSectionHeader upper-cases Latin eyebrow text.
      expect(find.text('YOUR TEACHING TOOLS'), findsOneWidget);
      expect(find.text('Lesson Plan'), findsOneWidget);
      expect(find.text('Quiz'), findsOneWidget);
      // Floored at 2 (one row), not the full registry — the rest stay one
      // tap away at the Prep desk. See the DESIGN_PARITY_BLOCK DP-1 fix:
      // even a 2nd row measured below the floating bottom nav's top edge in
      // the real-geometry regression test, so the preview stops at one row.
      expect(find.text('Instant Answer'), findsNothing);
      expect(find.text('Worksheet'), findsNothing);
    });

    testWidgets(
        'Quick Tools tiles clear the floating bottom nav on first paint',
        (tester) async {
      // Regression test for the DP-1 design review finding: the bare
      // _pumpHome harness has no AppShell/FloatingBottomNav, so it could not
      // catch a tile being sliced off by the real nav bar. This wraps the
      // home in the same Scaffold+FloatingBottomNav shape AppShell gives it.
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
      tester.platformDispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            vidyaControllerProvider
                .overrideWith(() => _FakeVidyaController(const VidyaState())),
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
                items: const [
                  FloatingNavItem(icon: LucideIcons.mic, label: 'Home'),
                  FloatingNavItem(
                    icon: LucideIcons.sparkles,
                    label: 'Create',
                    isAction: true,
                  ),
                  FloatingNavItem(icon: LucideIcons.library, label: 'Library'),
                  FloatingNavItem(icon: LucideIcons.user, label: 'Me'),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // The last preview tile (the 2nd, at _quickToolsCount) must sit fully
      // above the floating nav's top edge, unscrolled — not merely present
      // in the tree (a bare find.text would pass even half-clipped).
      final lastTile = find.byKey(const ValueKey('quick-tool-quiz'));
      expect(lastTile, findsOneWidget);
      final navTop = tester.getTopLeft(find.byType(FloatingBottomNav)).dy;
      final tileBottom = tester.getBottomLeft(lastTile).dy;
      expect(
        tileBottom,
        lessThanOrEqualTo(navTop),
        reason: 'the last Quick Tools tile must clear the floating bottom '
            'nav on first paint, unscrolled',
      );
    });

    testWidgets('never appears once a conversation is active', (tester) async {
      await _pumpHome(
        tester,
        const VidyaState(
          conversation: [
            ConversationBlock(
              role: ConversationRole.teacher,
              text: 'plan a lesson on fractions',
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      // The Quick Tools preview is an idle-canvas affordance only — once a
      // turn lands, the transcript is the page and the tool grid stays a
      // Prep-desk tap away, not a second copy inline.
      expect(find.text('YOUR TEACHING TOOLS'), findsNothing);
    });

    testWidgets('tapping a tile pushes the tool\'s real route', (tester) async {
      await _pumpHomeWithRouter(tester, const VidyaState());

      final tile = find.text('Lesson Plan');
      await tester.ensureVisible(tile);
      await tester.pumpAndSettle();
      await tester.tap(tile);
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('dest-lesson-plan')), findsOneWidget);
    });
  });

  group('U9: manual "Clear conversation" action', () {
    testWidgets('is absent on the idle canvas (nothing to clear)',
        (tester) async {
      await _pumpHome(tester, const VidyaState());
      await tester.pumpAndSettle();

      expect(find.byIcon(LucideIcons.trash2), findsNothing);
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
      addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [vidyaControllerProvider.overrideWith(() => fake)],
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

      final clearAction = find.byIcon(LucideIcons.trash2);
      expect(clearAction, findsOneWidget);

      await tester.tap(clearAction);
      await tester.pump();

      expect(fake.clearConversationCalled, isTrue);
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9)', () {
    for (final brightness in Brightness.values) {
      testWidgets('no overflow at 360dp x 1.3 (${brightness.name})',
          (tester) async {
        await _pumpHome(
          tester,
          const VidyaState(),
          brightness: brightness,
          textScale: 1.3,
          surface: const Size(360, 900),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('no overflow with a Bengali conversation at 360dp x 1.3',
        (tester) async {
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
