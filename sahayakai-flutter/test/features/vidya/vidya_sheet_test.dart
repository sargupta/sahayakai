import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/vidya/data/dto/vidya_action.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_controller.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_sheet.dart';
import 'package:sahayakai/features/vidya/presentation/widgets/seal_mic.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// U-V7 — the VIDYA-on-every-screen affordance: tapping the shared app-bar
/// action opens the VIDYA sheet (reusing the Seal Mic + the top-level
/// controller), and the running conversation renders inside it.

class _FakeVidyaController extends VidyaController {
  _FakeVidyaController(this._state);
  final VidyaState _state;

  @override
  VidyaState build() => _state;

  @override
  Future<void> onMicTap() async {}
  @override
  Future<void> cancel() async {}
  @override
  void dispatchDirective(VidyaDirective directive) {}
  @override
  void consumeNavigation() {}
  @override
  Future<void> restoreSession() async {}
}

Future<void> _pumpHost(WidgetTester tester, {VidyaState? state}) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  // Reduce-motion so the Seal Mic in the opened sheet is a static frame and
  // pumpAndSettle returns.
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        if (state != null)
          vidyaControllerProvider.overrideWith(
            () => _FakeVidyaController(state),
          ),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          appBar: AppBar(actions: const [VidyaAppBarAction()]),
          body: const SizedBox.expand(),
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  testWidgets('the app-bar action opens the VIDYA sheet with the Seal Mic', (
    tester,
  ) async {
    await _pumpHost(tester);

    // The action is present and unobtrusive (one glyph).
    expect(find.byIcon(LucideIcons.sparkles), findsOneWidget);
    // Nothing is open yet.
    expect(find.byType(SealMic), findsNothing);

    await tester.tap(find.byIcon(LucideIcons.sparkles));
    await tester.pumpAndSettle();

    // The sheet opened: its title and the Seal Mic are on screen.
    expect(find.text('Ask VIDYA'), findsWidgets);
    expect(find.byType(SealMic), findsOneWidget);
  });

  testWidgets('the running conversation renders inside the sheet', (
    tester,
  ) async {
    await _pumpHost(
      tester,
      state: const VidyaState(
        conversation: [
          ConversationBlock(
            role: ConversationRole.teacher,
            text: 'make a quiz on fractions',
          ),
          ConversationBlock(
            role: ConversationRole.vidya,
            text: 'Making your fractions quiz.',
          ),
        ],
      ),
    );

    await tester.tap(find.byIcon(LucideIcons.sparkles));
    await tester.pumpAndSettle();

    expect(find.text('make a quiz on fractions'), findsOneWidget);
    expect(find.text('Making your fractions quiz.'), findsOneWidget);
    expect(find.byType(SealMic), findsOneWidget);
  });

  testWidgets('a 48dp+ tap target for the action', (tester) async {
    await _pumpHost(tester);
    final size = tester.getSize(find.byType(VidyaAppBarAction));
    expect(size.width, greaterThanOrEqualTo(48));
    expect(size.height, greaterThanOrEqualTo(48));
  });
}
