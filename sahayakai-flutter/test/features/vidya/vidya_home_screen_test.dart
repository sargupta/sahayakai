import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/attendance/domain/attendance_record.dart';
import 'package:sahayakai/features/attendance/presentation/attendance_providers.dart';
import 'package:sahayakai/features/dashboard/presentation/app_tab_bar.dart';
import 'package:sahayakai/features/vidya/data/dto/vidya_action.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_controller.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_home_screen.dart';
import 'package:sahayakai/features/vidya/presentation/widgets/seal_mic.dart';
import 'package:sahayakai/features/vidya/presentation/widgets/vidya_orb.dart';
import 'package:sahayakai/shared/voice/audio_player_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import '../../support/fake_voice.dart';
import '../../support/home_day_fixtures.dart';

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

  // Tracked so a test can prove the type bar reaches the controller.
  final List<String> submitted = <String>[];
  @override
  Future<void> submitText(String text) async {
    submitted.add(text);
  }

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
  List<Override> overrides = const [],
  _FakeVidyaController? controller,
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
        vidyaControllerProvider.overrideWith(
          () => controller ?? _FakeVidyaController(state),
        ),
        // The home speaks a mother-tongue greeting on load; fake the TTS stack so
        // it never reaches the network (or leaves a pending timer under motion).
        apiClientProvider.overrideWithValue(FakeApiClient()),
        audioPlayerServiceProvider.overrideWithValue(FakeAudioPlayerService()),
        ...overrides,
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
/// [MaterialApp], for the two tests that actually exercise a `context.push`
/// (the Quick Tools tile and the signed-out Sign in action) — the plain
/// [_pumpHome] harness has no router, so tapping a push-triggering control
/// there would throw ("No GoRouter found in context").
Future<void> _pumpHomeWithRouter(
  WidgetTester tester,
  VidyaState state, {
  Locale locale = const Locale('en'),
  List<Override> overrides = const [],
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
      GoRoute(
        path: Routes.login,
        builder: (_, _) => const _DestMarker('login'),
      ),
      GoRoute(
        path: Routes.lessonPlan,
        builder: (_, _) => const _DestMarker('lesson-plan'),
      ),
      GoRoute(
        path: Routes.prepDesk,
        builder: (_, _) => const _DestMarker('prep-desk'),
      ),
      GoRoute(
        path: Routes.parentHotline,
        builder: (_, _) => const _DestMarker('parent-hotline'),
      ),
      GoRoute(
        path: Routes.attendanceMarkPattern,
        builder: (_, state) =>
            _DestMarker('mark-${state.pathParameters['classId']}'),
      ),
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        vidyaControllerProvider.overrideWith(() => _FakeVidyaController(state)),
        // The home speaks a mother-tongue greeting on load; fake the TTS stack so
        // it never reaches the network (or leaves a pending timer under motion).
        apiClientProvider.overrideWithValue(FakeApiClient()),
        audioPlayerServiceProvider.overrideWithValue(FakeAudioPlayerService()),
        ...overrides,
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
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('the idle Home: voice-first, on the teacher\'s day', () {
    testWidgets('renders the greeting, the day, the card of things to say, '
        'the hero orb and the type bar', (tester) async {
      await _pumpHome(tester, const VidyaState());
      await tester.pumpAndSettle();

      // The day headline (its states are covered in the 'the day' group).
      expect(find.byKey(const ValueKey('home-day-headline')), findsOneWidget);
      expect(find.text('SAY IT, I’LL OPEN IT'), findsOneWidget);
      // The orb is the hero: one sphere, no glyph, the idle caption under it.
      expect(find.byKey(const ValueKey('home-orb')), findsOneWidget);
      expect(find.byType(VidyaOrb), findsOneWidget);
      expect(find.text('Tap to speak'), findsOneWidget);
      // The type bar, voice's equal sibling.
      expect(find.byKey(const ValueKey('home-composer')), findsOneWidget);
      // The Prep desk is one tap away from the card.
      expect(find.byKey(const ValueKey('home-all-tools')), findsOneWidget);
      // Idle Home has no app bar: Network and Messages live in Community.
      expect(find.byType(AppBar), findsNothing);
      expect(find.byIcon(LucideIcons.network), findsNothing);
    });

    testWidgets('reduce-motion is a static frame (pumpAndSettle returns)', (
      tester,
    ) async {
      await _pumpHome(tester, const VidyaState());
      await tester.pumpAndSettle();
      expect(tester.binding.transientCallbackCount, 0);
      expect(find.byKey(const ValueKey('home-orb')), findsOneWidget);
    });

    testWidgets('under motion the orb floats and the page still builds', (
      tester,
    ) async {
      await _pumpHome(tester, const VidyaState(), reduceMotion: false);
      // The orb ticks its float; do not settle (infinite).
      expect(tester.binding.transientCallbackCount, greaterThan(0));
      expect(find.byKey(const ValueKey('home-orb')), findsOneWidget);
      expect(find.byKey(const ValueKey('home-day-headline')), findsOneWidget);
    });

    testWidgets('a typed line goes to VIDYA as a typed turn', (tester) async {
      final fake = _FakeVidyaController(const VidyaState());
      await _pumpHome(tester, const VidyaState(), controller: fake);
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const ValueKey('home-composer')),
        'Class 7 ke liye fractions ka lesson',
      );
      await tester.testTextInput.receiveAction(TextInputAction.send);
      await tester.pump();

      expect(fake.submitted, ['Class 7 ke liye fractions ka lesson']);
    });
  });

  group('a turn inks onto the page as a document block', () {
    testWidgets(
      'a teacher + VIDYA turn render as composed blocks, not bubbles',
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
      },
    );

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
              directives: [
                _dir(VidyaFlow.lessonPlan),
                _dir(VidyaFlow.quizGenerator),
              ],
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
    testWidgets('signed-out shows the dignified sign-in state with the mic', (
      tester,
    ) async {
      await _pumpHome(tester, const VidyaState(status: VidyaStatus.signedOut));
      await tester.pumpAndSettle();

      expect(find.text('Sign in to talk to VIDYA'), findsOneWidget);
      // The orb is present-but-inert, never a crash.
      expect(find.byKey(const ValueKey('home-orb')), findsOneWidget);
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
      },
    );

    testWidgets('a permanent mic denial offers Open settings', (tester) async {
      await _pumpHome(tester, const VidyaState(status: VidyaStatus.micDenied));
      await tester.pumpAndSettle();

      expect(find.text('Turn on the microphone'), findsOneWidget);
      expect(find.text('Open settings'), findsOneWidget);
    });

    testWidgets('a network failure offers a retry', (tester) async {
      await _pumpHome(tester, const VidyaState(status: VidyaStatus.failed));
      await tester.pumpAndSettle();

      expect(find.text('That did not go through'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });
  });

  group('the day: real counts, or none', () {
    testWidgets('the headline counts what is waiting; every row is real', (
      tester,
    ) async {
      await _pumpHome(
        tester,
        const VidyaState(),
        overrides: sampleDayOverrides(),
      );
      await tester.pumpAndSettle();

      expect(find.text('2 things waiting today'), findsOneWidget);
      expect(find.text('Class 7 Maths · Class 5 EVS'), findsOneWidget);
      expect(
        find.text('“Call the parents of 4 absentees in Class 7 Maths”'),
        findsOneWidget,
      );
      expect(find.text('“Take attendance for Class 5 EVS”'), findsOneWidget);
      // Examples are for an empty day only, never mixed with real items.
      expect(find.text('“A lesson plan for my next class”'), findsNothing);
    });

    testWidgets('a register that cannot be read makes no count claim', (
      tester,
    ) async {
      await _pumpHome(
        tester,
        const VidyaState(),
        overrides: [
          attendanceClassesProvider.overrideWith(
            (ref) async => const [sampleClass7, sampleClass5],
          ),
          dailyRegisterProvider.overrideWith((ref, key) async {
            if (key.classId == 'c5') throw StateError('offline');
            return sampleClass7Register(key.date);
          }),
        ],
      );
      await tester.pumpAndSettle();

      // Class 5 was never read, so "1 thing waiting" would be a guess.
      expect(find.textContaining('waiting today'), findsNothing);
      expect(find.text(_expectedGreeting()), findsOneWidget);
      // What WAS read still shows.
      expect(
        find.text('“Call the parents of 4 absentees in Class 7 Maths”'),
        findsOneWidget,
      );
    });

    testWidgets('a clear day says so and offers examples, not facts', (
      tester,
    ) async {
      await _pumpHome(
        tester,
        const VidyaState(),
        overrides: [
          attendanceClassesProvider.overrideWith(
            (ref) async => const [sampleClass5],
          ),
          dailyRegisterProvider.overrideWith(
            (ref, key) async => DailyAttendance(
              classId: key.classId,
              date: key.date,
              statuses: const {'s1': AttendanceStatus.present},
            ),
          ),
        ],
      );
      await tester.pumpAndSettle();

      expect(find.text('Nothing waiting today'), findsOneWidget);
      expect(find.text('“A lesson plan for my next class”'), findsOneWidget);
      expect(
        find.text('“A ten-question quiz on today’s topic”'),
        findsOneWidget,
      );
      expect(find.text('“Explain a hard idea simply”'), findsOneWidget);
    });
  });

  group('the card of things to say', () {
    testWidgets('a row opens its tool: an unmarked class opens its register', (
      tester,
    ) async {
      await _pumpHomeWithRouter(
        tester,
        const VidyaState(),
        overrides: sampleDayOverrides(),
      );

      await tester.tap(find.text('“Take attendance for Class 5 EVS”'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('dest-mark-c5')), findsOneWidget);
    });

    testWidgets('absentees open the parent calls', (tester) async {
      await _pumpHomeWithRouter(
        tester,
        const VidyaState(),
        overrides: sampleDayOverrides(),
      );

      await tester.tap(
        find.text('“Call the parents of 4 absentees in Class 7 Maths”'),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('dest-parent-hotline')), findsOneWidget);
    });

    testWidgets('an example opens its tool', (tester) async {
      await _pumpHomeWithRouter(tester, const VidyaState());

      await tester.tap(find.text('“A lesson plan for my next class”'));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('dest-lesson-plan')), findsOneWidget);
    });

    testWidgets('"Prep desk" opens the tools grid', (tester) async {
      await _pumpHomeWithRouter(tester, const VidyaState());

      await tester.tap(find.byKey(const ValueKey('home-all-tools')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('dest-prep-desk')), findsOneWidget);
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

      // Once a turn lands, the transcript is the page.
      expect(find.text('SAY IT, I’LL OPEN IT'), findsNothing);
      expect(find.byKey(const ValueKey('home-composer')), findsNothing);
    });

    testWidgets('the type bar clears the tab bar on first paint', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 760);
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
            vidyaControllerProvider.overrideWith(
              () => _FakeVidyaController(const VidyaState()),
            ),
            apiClientProvider.overrideWithValue(FakeApiClient()),
            audioPlayerServiceProvider.overrideWithValue(
              FakeAudioPlayerService(),
            ),
            ...sampleDayOverrides(),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(
              body: const VidyaHomeScreen(),
              bottomNavigationBar: AppTabBar(
                current: AppTab.home,
                onSelected: (_) {},
                labels: const {
                  AppTab.home: 'Home',
                  AppTab.library: 'Library',
                  AppTab.community: 'Community',
                  AppTab.profile: 'Me',
                },
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final barTop = tester.getTopLeft(find.byType(AppTabBar)).dy;
      final composer = find.byKey(const ValueKey('home-composer'));
      expect(tester.getBottomLeft(composer).dy, lessThanOrEqualTo(barTop));
      // The orb and the card are on the first screen, unscrolled.
      expect(
        tester.getBottomLeft(find.byKey(const ValueKey('home-orb'))).dy,
        lessThanOrEqualTo(barTop),
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('U9: manual "Clear conversation" action', () {
    testWidgets('is absent on the idle canvas (nothing to clear)', (
      tester,
    ) async {
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
        addTearDown(
          tester.platformDispatcher.clearAccessibilityFeaturesTestValue,
        );

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
      },
    );
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
        expect(tester.takeException(), isNull);
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
