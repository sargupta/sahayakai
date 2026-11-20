import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/vidya/data/dto/vidya_action.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_controller.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_sheet.dart';
import 'package:sahayakai/features/vidya/presentation/widgets/seal_mic.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// U-V7 — the VIDYA sheet the floating orb opens: it reuses the Seal Mic and
/// the top-level controller, the running conversation renders inside it, and
/// it raises [vidyaSurfaceOpenProvider] while open so the orb steps aside
/// (one orb per screen).

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
          body: Builder(
            builder: (context) => Center(
              child: TextButton(
                onPressed: () => showVidyaSheet(context),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  testWidgets('showVidyaSheet opens the VIDYA sheet with the Seal Mic', (
    tester,
  ) async {
    await _pumpHost(tester);

    // Nothing is open yet.
    expect(find.byType(SealMic), findsNothing);

    await tester.tap(find.text('open'));
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

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.text('make a quiz on fractions'), findsOneWidget);
    expect(find.text('Making your fractions quiz.'), findsOneWidget);
    expect(find.byType(SealMic), findsOneWidget);
  });

  testWidgets('the sheet raises the surface-open flag until it closes', (
    tester,
  ) async {
    await _pumpHost(tester);
    final container = ProviderScope.containerOf(
      tester.element(find.text('open')),
    );
    expect(container.read(vidyaSurfaceOpenProvider), isFalse);

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(container.read(vidyaSurfaceOpenProvider), isTrue);

    // Dismiss on the scrim.
    await tester.tapAt(const Offset(195, 20));
    await tester.pumpAndSettle();
    expect(find.byType(SealMic), findsNothing);
    expect(container.read(vidyaSurfaceOpenProvider), isFalse);
  });
}
