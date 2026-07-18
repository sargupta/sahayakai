import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
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
