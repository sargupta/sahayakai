import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/core/platform/clock.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/dashboard/presentation/floating_bottom_nav.dart';
import 'package:sahayakai/features/parent_hotline/presentation/parent_hotline_controller.dart';
import 'package:sahayakai/features/profile/domain/teacher_profile.dart';
import 'package:sahayakai/features/profile/presentation/profile_controller.dart';
import 'package:sahayakai/features/vidya/data/dto/vidya_action.dart';
import 'package:sahayakai/features/vidya/domain/deliverable.dart';
import 'package:sahayakai/features/vidya/presentation/deliverables_controller.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_controller.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_home_screen.dart';
import 'package:sahayakai/features/vidya/presentation/widgets/vidya_orb.dart';
import 'package:sahayakai/shared/domain/tool_prefill.dart';
import 'package:sahayakai/shared/domain/tool_registry.dart';
import 'package:sahayakai/shared/voice/audio_player_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import '../../support/fake_voice.dart';

/// The voice-first Home (UX map H-01): header (avatar, day, name, language
/// pill, messages), "Ask for anything in the app", three say-it rows that open
/// their tool prefilled, the big VIDYA orb carrying her state, the type box,
/// "Waiting for you" from real state only, the four tool tiles and the
/// all-tools link. Rendered with a fixed-state fake controller, so no mic and
/// no socket; the controller machine itself is covered by
/// vidya_controller_test.

class _FakeVidyaController extends VidyaController {
  _FakeVidyaController(this._state);
  final VidyaState _state;

  @override
  VidyaState build() => _state;

  // Tracked, so a test can prove the mic and the type box reach VIDYA.
  int micTaps = 0;
  final List<String> sentTexts = [];
  bool clearConversationCalled = false;

  @override
  Future<void> onMicTap() async => micTaps++;
  @override
  Future<void> sendText(String message) async => sentTexts.add(message);
  @override
  void clearConversation() => clearConversationCalled = true;
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
  @override
  Future<void> restoreSession() async {}
}

/// The header reads the teacher's name through `profileControllerProvider`,
/// which in production walks Firestore; this resolves to the design's persona.
class _FakeProfileController extends ProfileController {
  @override
  Future<TeacherProfile> build() async {
    return const TeacherProfile(displayName: 'Meena Kulkarni');
  }
}

List<Override> _homeSupportOverrides() => [
  nowProvider.overrideWithValue(() => DateTime(2018, 9, 18, 9, 41)),
  apiClientProvider.overrideWithValue(FakeApiClient()),
  audioPlayerServiceProvider.overrideWithValue(FakeAudioPlayerService()),
  profileControllerProvider.overrideWith(_FakeProfileController.new),
];

void _phone(
  WidgetTester tester, {
  Size surface = const Size(390, 844),
  double textScale = 1.0,
}) {
  tester.view.physicalSize = surface;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
}

Future<_FakeVidyaController> _pumpHome(
  WidgetTester tester, {
  VidyaState state = const VidyaState(),
  Locale locale = const Locale('en'),
  double textScale = 1.0,
  Size surface = const Size(390, 844),
  ValueChanged<int>? onOpenTab,
}) async {
  _phone(tester, surface: surface, textScale: textScale);
  final fake = _FakeVidyaController(state);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        vidyaControllerProvider.overrideWith(() => fake),
        ..._homeSupportOverrides(),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: VidyaHomeScreen(onOpenTab: onOpenTab),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return fake;
}

/// A destination a real `context.push` resolves to. It shows what prefill it
/// was opened with, so a test can read it back.
class _Dest extends StatelessWidget {
  const _Dest(this.id, this.extra);

  final String id;
  final Object? extra;

  @override
  Widget build(BuildContext context) {
    final prefill = extra is ToolPrefill ? extra! as ToolPrefill : null;
    return Scaffold(
      body: Column(
        children: [
          Text('DEST', key: Key('dest-$id')),
          if (prefill != null) ...[
            Text('topic:${prefill.topic}'),
            Text('grade:${prefill.gradeLevel}'),
            Text('count:${prefill.questionCount}'),
            Text('difficulty:${prefill.difficulty}'),
            Text('auto:${prefill.autoSubmit}'),
          ],
        ],
      ),
    );
  }
}

Future<void> _pumpHomeWithRouter(
  WidgetTester tester, {
  List<Override> extraOverrides = const [],
}) async {
  _phone(tester);
  GoRoute dest(String path, String id) =>
      GoRoute(path: path, builder: (_, state) => _Dest(id, state.extra));
  final router = GoRouter(
    initialLocation: Routes.home,
    routes: [
      GoRoute(path: Routes.home, builder: (_, _) => const VidyaHomeScreen()),
      dest(Routes.attendance, 'attendance'),
      dest(Routes.assessmentScanner, 'assessment-scanner'),
      dest(Routes.lessonPlan, 'lesson-plan'),
      dest(Routes.quizGenerator, 'quiz'),
      dest(Routes.parentHotline, 'parent-hotline'),
      dest(Routes.prepDesk, 'prep-desk'),
      dest(Routes.profile, 'profile'),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        vidyaControllerProvider.overrideWith(
          () => _FakeVidyaController(const VidyaState()),
        ),
        ..._homeSupportOverrides(),
        ...extraOverrides,
      ],
      child: MaterialApp.router(
        routerConfig: router,
        theme: AppTheme.light(),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

ProviderContainer _container(WidgetTester tester) =>
    ProviderScope.containerOf(tester.element(find.byType(VidyaHomeScreen)));

Future<void> _tapVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('header', () {
    testWidgets('avatar initials, the day, the name, language and messages', (
      tester,
    ) async {
      await _pumpHome(tester);

      expect(find.text('MK'), findsOneWidget);
      expect(find.text('Tue, 18 Sept'), findsOneWidget);
      expect(find.text('Meena Kulkarni'), findsOneWidget);
      expect(find.text('English'), findsOneWidget, reason: 'language pill');
      expect(find.byIcon(LucideIcons.messageCircle), findsOneWidget);
    });

    testWidgets('the avatar opens the Me tab', (tester) async {
      int? opened;
      await _pumpHome(tester, onOpenTab: (tab) => opened = tab);

      await tester.tap(find.text('MK'));
      expect(opened, VidyaHomeScreen.meTab);
    });

    testWidgets('clear conversation shows only while VIDYA holds a thread', (
      tester,
    ) async {
      await _pumpHome(tester);
      expect(find.byIcon(LucideIcons.trash2), findsNothing);
    });

    testWidgets('and clears it when tapped', (tester) async {
      final fake = await _pumpHome(
        tester,
        state: const VidyaState(
          conversation: [
            ConversationBlock(
              role: ConversationRole.teacher,
              text: 'plan a lesson on fractions',
            ),
          ],
        ),
      );

      await tester.tap(find.byIcon(LucideIcons.trash2));
      expect(fake.clearConversationCalled, isTrue);
    });
  });

  group('ask for anything', () {
    testWidgets('the eyebrow, headline and subline', (tester) async {
      await _pumpHome(tester);

      expect(find.text('VIDYA'), findsOneWidget);
      expect(find.text('Ask for anything\nin the app'), findsOneWidget);
      expect(
        find.text('Any tool, any language. She opens the right one.'),
        findsOneWidget,
      );
      expect(find.text('SAY IT, SHE ROUTES IT'), findsOneWidget);
    });

    testWidgets('three say-it rows, each naming the tool it opens', (
      tester,
    ) async {
      await _pumpHome(tester);

      expect(find.text('“Class 7 ka jal chakra lesson plan”'), findsOneWidget);
      expect(find.text('“Ten-question quiz, medium”'), findsOneWidget);
      expect(find.text('“Aaj ki attendance lagao”'), findsOneWidget);
      expect(find.text('Lesson Plan'), findsOneWidget);
      expect(find.text('Quiz'), findsOneWidget);
      expect(find.text('Attendance'), findsOneWidget);
    });

    testWidgets('the lesson row opens Lesson Plan prefilled, not running', (
      tester,
    ) async {
      await _pumpHomeWithRouter(tester);

      await _tapVisible(tester, find.byKey(const ValueKey('home-say-lesson')));

      expect(find.byKey(const Key('dest-lesson-plan')), findsOneWidget);
      expect(find.text('topic:Water cycle'), findsOneWidget);
      expect(find.text('grade:Class 7'), findsOneWidget);
      expect(find.text('auto:false'), findsOneWidget);
    });

    testWidgets('the quiz row opens Quiz with ten questions, medium', (
      tester,
    ) async {
      await _pumpHomeWithRouter(tester);

      await _tapVisible(tester, find.byKey(const ValueKey('home-say-quiz')));

      expect(find.byKey(const Key('dest-quiz')), findsOneWidget);
      expect(find.text('count:10'), findsOneWidget);
      expect(find.text('difficulty:medium'), findsOneWidget);
    });

    testWidgets('the attendance row opens Attendance', (tester) async {
      await _pumpHomeWithRouter(tester);

      await _tapVisible(
        tester,
        find.byKey(const ValueKey('home-say-attendance')),
      );

      expect(find.byKey(const Key('dest-attendance')), findsOneWidget);
    });
  });

  group('the big VIDYA orb', () {
    testWidgets('a 144px orb at rest, with what a tap does under it', (
      tester,
    ) async {
      await _pumpHome(tester);

      final orb = tester.widget<VidyaOrb>(
        find.byKey(const ValueKey('home-big-orb')),
      );
      expect(orb.size, 144);
      expect(orb.state, VidyaOrbVisual.resting);
      expect(find.text('Tap or hold to speak'), findsOneWidget);
    });

    testWidgets('a ready result turns it green with a count', (tester) async {
      await _pumpHome(tester);

      _container(tester)
          .read(deliverablesControllerProvider.notifier)
          .add(
            const Deliverable(
              id: 'ws-1',
              title: 'Fractions worksheet',
              text: '1. Which is larger?',
            ),
          );
      await tester.pumpAndSettle();

      final orb = tester.widget<VidyaOrb>(
        find.byKey(const ValueKey('home-big-orb')),
      );
      expect(orb.state, VidyaOrbVisual.ready);
      expect(orb.readyCount, 1);
      expect(find.text('Ready · Tap to deliver'), findsOneWidget);
    });

    testWidgets('a tap starts listening in the VIDYA sheet', (tester) async {
      final fake = await _pumpHome(tester);

      await _tapVisible(tester, find.byKey(const ValueKey('home-big-orb')));

      expect(fake.micTaps, 1);
    });
  });

  group('the type box', () {
    testWidgets('a typed request goes to VIDYA', (tester) async {
      final fake = await _pumpHome(tester);

      final field = find.byKey(const ValueKey('home-ask-field'));
      await tester.ensureVisible(field);
      await tester.enterText(field, 'make a quiz on plants');
      await tester.tap(find.byKey(const ValueKey('home-ask-send')));
      await tester.pumpAndSettle();

      expect(fake.sentTexts, ['make a quiz on plants']);
    });

    testWidgets('an empty box sends nothing', (tester) async {
      final fake = await _pumpHome(tester);

      await _tapVisible(tester, find.byKey(const ValueKey('home-ask-send')));

      expect(fake.sentTexts, isEmpty);
    });

    testWidgets('the mic is the same as tapping the orb', (tester) async {
      final fake = await _pumpHome(tester);

      await _tapVisible(tester, find.byKey(const ValueKey('home-ask-mic')));

      expect(fake.micTaps, 1);
    });
  });

  group('waiting for you', () {
    testWidgets('says so when nothing is waiting — never a sample count', (
      tester,
    ) async {
      await _pumpHome(tester);

      expect(find.text('WAITING FOR YOU'), findsOneWidget);
      expect(find.text('Nothing is waiting for you right now'), findsOneWidget);
      expect(find.textContaining('absentees'), findsNothing);
    });

    testWidgets('a parent call left running waits here, and opens the call', (
      tester,
    ) async {
      await _pumpHomeWithRouter(
        tester,
        extraOverrides: [
          parentHotlineControllerProvider.overrideWith(
            () => _FixedHotline(
              const ParentHotlineState(
                stage: HotlineStage.calling,
                studentName: 'Asha Rao',
                outreachId: 'o-1',
              ),
            ),
          ),
        ],
      );

      const row = "Call with Asha's parent · tap to return";
      expect(find.text(row), findsOneWidget);
      expect(find.text('Nothing is waiting for you right now'), findsNothing);
      await _tapVisible(tester, find.text(row));
      expect(find.byKey(const Key('dest-parent-hotline')), findsOneWidget);
    });

    testWidgets('a parent call that is not running does not wait here', (
      tester,
    ) async {
      await _pumpHomeWithRouter(
        tester,
        extraOverrides: [
          parentHotlineControllerProvider.overrideWith(
            () => _FixedHotline(
              const ParentHotlineState(
                stage: HotlineStage.summary,
                studentName: 'Asha Rao',
                outreachId: 'o-1',
              ),
            ),
          ),
        ],
      );
      expect(find.textContaining("Asha's parent"), findsNothing);
    });

    testWidgets('lists a ready result by its title', (tester) async {
      await _pumpHome(tester);

      _container(tester)
          .read(deliverablesControllerProvider.notifier)
          .add(
            const Deliverable(
              id: 'ws-1',
              title: 'Fractions worksheet',
              text: '1. Which is larger?',
            ),
          );
      await tester.pumpAndSettle();

      expect(find.text('Fractions worksheet is ready'), findsOneWidget);
      expect(find.text('Nothing is waiting for you right now'), findsNothing);
    });
  });

  group('your tools', () {
    testWidgets('four tiles, Call parents in the app language', (tester) async {
      await _pumpHome(tester);

      for (final title in const [
        'Roll call',
        'Make a lesson',
        'Scan a test',
        'Call parents',
      ]) {
        expect(find.text(title), findsOneWidget, reason: 'tile "$title"');
      }
      expect(find.text('Script in English'), findsOneWidget);
      expect(
        find.byWidgetPredicate((w) => w.runtimeType.toString() == '_Tile'),
        findsNWidgets(4),
      );
    });

    testWidgets('Roll call opens attendance; Scan a test opens the scanner', (
      tester,
    ) async {
      await _pumpHomeWithRouter(tester);
      await _tapVisible(tester, find.text('Roll call'));
      expect(find.byKey(const Key('dest-attendance')), findsOneWidget);
    });

    testWidgets('Scan a test opens the scanner', (tester) async {
      await _pumpHomeWithRouter(tester);
      await _tapVisible(tester, find.byKey(const ValueKey('home-tile-scan')));
      expect(find.byKey(const Key('dest-assessment-scanner')), findsOneWidget);
    });

    testWidgets('All tools counts the registry and opens the Prep desk', (
      tester,
    ) async {
      await _pumpHomeWithRouter(tester);

      await _tapVisible(tester, find.text('All ${kToolRegistry.length} tools'));

      expect(find.byKey(const Key('dest-prep-desk')), findsOneWidget);
    });
  });

  group('motion and semantics', () {
    testWidgets('reduce-motion is a static frame', (tester) async {
      await _pumpHome(tester);
      expect(tester.binding.transientCallbackCount, 0);
    });

    testWidgets('each tile and say-it row is one named button', (tester) async {
      await _pumpHome(tester);

      expect(
        find.bySemanticsLabel('Roll call, Speak the names'),
        findsOneWidget,
      );
      expect(
        find.bySemanticsLabel('“Ten-question quiz, medium”, Quiz'),
        findsOneWidget,
      );
    });
  });

  group('real geometry: nothing hides under the floating bar', () {
    testWidgets('the last tile row scrolls fully above the bar', (
      tester,
    ) async {
      _phone(tester);
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
              extendBody: true,
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

      await tester.drag(
        find.byType(SingleChildScrollView).first,
        const Offset(0, -3000),
      );
      await tester.pumpAndSettle();

      final navTop = tester.getTopLeft(find.byType(FloatingBottomNav)).dy;
      final tileBottom = tester
          .getBottomLeft(find.byKey(const ValueKey('home-tile-scan')))
          .dy;
      expect(tileBottom, lessThanOrEqualTo(navTop));
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9)', () {
    testWidgets('no overflow at 360dp x 1.3', (tester) async {
      await _pumpHome(tester, textScale: 1.3, surface: const Size(360, 900));
      expect(tester.takeException(), isNull);
    });

    for (final code in const ['hi', 'ta', 'ml']) {
      testWidgets('no overflow in $code at 360dp x 1.3', (tester) async {
        await _pumpHome(
          tester,
          locale: Locale(code),
          textScale: 1.3,
          surface: const Size(360, 900),
        );
        expect(tester.takeException(), isNull);
      });
    }
  });
}

/// A hotline controller standing still in one state (no repositories touched).
class _FixedHotline extends ParentHotlineController {
  _FixedHotline(this._state);

  final ParentHotlineState _state;

  @override
  ParentHotlineState build() => _state;
}
