import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/vidya/presentation/widgets/seal_mic.dart';

/// U-V4 — the Seal Mic, one test per visual state. Each proves the seal renders
/// and that reduce-motion collapses to a static composed frame (no ticking
/// controller), while the animated states really do tick under motion. No real
/// audio is involved — the widget takes a plain state enum + amplitude.

Future<void> _pumpSeal(
  WidgetTester tester,
  SealMicState state, {
  bool reduceMotion = false,
  double amplitude = 0,
  Brightness brightness = Brightness.light,
  VoidCallback? onTap,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
      home: Builder(
        builder: (context) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(disableAnimations: reduceMotion),
          child: Scaffold(
            body: Center(
              child: SealMic(
                state: state,
                amplitude: amplitude,
                onTap: onTap,
                semanticLabel: 'VIDYA voice',
                semanticHint: 'Tap to speak',
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump(); // build + first animation frame
}

/// The states whose ambient motion is driven by a repeating controller.
const _animatedStates = [
  SealMicState.idle,
  SealMicState.transcribing,
  SealMicState.thinking,
  SealMicState.speaking,
];

void main() {
  setUp(() => GoogleFonts.config.allowRuntimeFetching = false);

  group('every state renders the seal + mic glyph', () {
    for (final state in SealMicState.values) {
      testWidgets('${state.name} renders', (tester) async {
        await _pumpSeal(tester, state, amplitude: 0.6);
        expect(find.byType(SealMic), findsOneWidget);
        expect(find.byIcon(LucideIcons.mic), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }
  });

  group('reduce-motion is a static composed frame', () {
    for (final state in SealMicState.values) {
      testWidgets('${state.name} does not tick under reduce-motion', (
        tester,
      ) async {
        await _pumpSeal(tester, state, reduceMotion: true, amplitude: 0.6);
        // A static frame schedules no further work: pumpAndSettle returns
        // instead of timing out on an infinite animation.
        await tester.pumpAndSettle();
        expect(tester.binding.transientCallbackCount, 0);
        expect(find.byType(SealMic), findsOneWidget);
      });
    }
  });

  group('motion drives the animated states', () {
    for (final state in _animatedStates) {
      testWidgets('${state.name} ticks a repeating controller under motion', (
        tester,
      ) async {
        await _pumpSeal(tester, state);
        // A repeating controller keeps a transient (ticker) callback registered.
        expect(
          tester.binding.transientCallbackCount,
          greaterThan(0),
          reason: '$state must animate when motion is enabled',
        );
      });
    }

    testWidgets(
      'listening is amplitude-driven, not a free-running controller',
      (tester) async {
        // The ring reacts to the passed level (data), so no ambient controller
        // ticks — the home pushes amplitude frames in.
        await _pumpSeal(tester, SealMicState.listening, amplitude: 0.5);
        await tester.pumpAndSettle();
        expect(tester.binding.transientCallbackCount, 0);
        expect(find.byType(SealMic), findsOneWidget);
      },
    );
  });

  testWidgets('a tap fires onTap', (tester) async {
    var taps = 0;
    await _pumpSeal(tester, SealMicState.idle, onTap: () => taps++);
    await tester.tap(find.byType(SealMic));
    await tester.pump();
    expect(taps, 1);
  });

  testWidgets('exposes a button semantics node with the state hint', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await _pumpSeal(tester, SealMicState.idle, onTap: () {});
    expect(
      tester.getSemantics(find.byType(SealMic)),
      matchesSemantics(
        isButton: true,
        isEnabled: true,
        hasEnabledState: true,
        hasTapAction: true,
        label: 'VIDYA voice',
        hint: 'Tap to speak',
      ),
    );
    handle.dispose();
  });

  testWidgets('the 128dp disc clears the 48dp tap floor', (tester) async {
    await _pumpSeal(tester, SealMicState.idle, onTap: () {});
    final size = tester.getSize(find.byType(SealMic));
    expect(size.width, greaterThanOrEqualTo(48));
    expect(size.height, greaterThanOrEqualTo(48));
  });

  testWidgets('renders in dark without error', (tester) async {
    await _pumpSeal(
      tester,
      SealMicState.listening,
      amplitude: 0.8,
      brightness: Brightness.dark,
    );
    expect(tester.takeException(), isNull);
    expect(find.byType(SealMic), findsOneWidget);
  });
}
