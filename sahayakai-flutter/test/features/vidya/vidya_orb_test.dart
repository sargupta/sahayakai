import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/vidya/presentation/widgets/vidya_orb.dart';

/// The floating VIDYA orb (v3 presence layer), one test per visual state. Proves
/// each state renders, that reduce-motion collapses the animated states to a
/// static composed frame (no ticking controller), that the ready badge shows its
/// count, and that a tap and the button semantics work. No controller or audio
/// is involved — the widget takes a plain state enum.

Future<void> _pumpOrb(
  WidgetTester tester,
  VidyaOrbVisual state, {
  bool reduceMotion = false,
  int readyCount = 0,
  VoidCallback? onTap,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      home: Builder(
        builder: (context) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(disableAnimations: reduceMotion),
          child: Scaffold(
            body: Center(
              child: VidyaOrb(
                state: state,
                readyCount: readyCount,
                onTap: onTap,
                semanticLabel: 'VIDYA',
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
  VidyaOrbVisual.resting,
  VidyaOrbVisual.listening,
  VidyaOrbVisual.working,
];

/// The states with no continuous motion — the overlay/badge drives them.
const _staticStates = [VidyaOrbVisual.dragging, VidyaOrbVisual.ready];

void main() {
  group('every state renders', () {
    for (final state in VidyaOrbVisual.values) {
      testWidgets('${state.name} renders without error', (tester) async {
        await _pumpOrb(tester, state, readyCount: 3);
        expect(find.byType(VidyaOrb), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }
  });

  group('no glyph: a sphere is VIDYA, a mic glyph is a control', () {
    // Design system v2 `Orb`: "The orb carries no glyph. Its meaning comes
    // from the state colour and motion, plus the words beside it."
    for (final state in VidyaOrbVisual.values) {
      testWidgets('${state.name} draws no glyph', (tester) async {
        await _pumpOrb(tester, state, readyCount: 2);
        expect(find.byIcon(LucideIcons.mic), findsNothing);
        expect(find.byIcon(LucideIcons.sparkles), findsNothing);
      });
    }
  });

  group('ready badge', () {
    testWidgets('shows the count when ready', (tester) async {
      await _pumpOrb(tester, VidyaOrbVisual.ready, readyCount: 2);
      expect(find.text('2'), findsOneWidget);
    });

    testWidgets('caps at 9+', (tester) async {
      await _pumpOrb(tester, VidyaOrbVisual.ready, readyCount: 42);
      expect(find.text('9+'), findsOneWidget);
    });

    testWidgets('a zero count paints no badge', (tester) async {
      await _pumpOrb(tester, VidyaOrbVisual.ready);
      expect(find.text('0'), findsNothing);
    });

    testWidgets('a count on a non-ready state paints no badge', (tester) async {
      await _pumpOrb(tester, VidyaOrbVisual.resting, readyCount: 5);
      expect(find.text('5'), findsNothing);
    });
  });

  group('reduce-motion is a static composed frame', () {
    for (final state in VidyaOrbVisual.values) {
      testWidgets('${state.name} does not tick under reduce-motion', (
        tester,
      ) async {
        await _pumpOrb(tester, state, reduceMotion: true, readyCount: 1);
        await tester.pumpAndSettle();
        expect(tester.binding.transientCallbackCount, 0);
        expect(find.byType(VidyaOrb), findsOneWidget);
      });
    }
  });

  group('motion drives the animated states', () {
    for (final state in _animatedStates) {
      testWidgets('${state.name} ticks under motion', (tester) async {
        await _pumpOrb(tester, state);
        expect(
          tester.binding.transientCallbackCount,
          greaterThan(0),
          reason: '$state must animate when motion is enabled',
        );
      });
    }

    for (final state in _staticStates) {
      testWidgets('${state.name} is a still frame under motion', (tester) async {
        await _pumpOrb(tester, state, readyCount: 1);
        await tester.pumpAndSettle();
        expect(tester.binding.transientCallbackCount, 0);
      });
    }
  });

  testWidgets('a tap fires onTap', (tester) async {
    var taps = 0;
    await _pumpOrb(tester, VidyaOrbVisual.resting, onTap: () => taps++);
    await tester.tap(find.byType(VidyaOrb));
    await tester.pump();
    expect(taps, 1);
  });

  testWidgets('exposes a button semantics node with the state hint', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await _pumpOrb(tester, VidyaOrbVisual.resting, onTap: () {});
    expect(
      tester.getSemantics(find.byType(VidyaOrb)),
      matchesSemantics(
        isButton: true,
        isEnabled: true,
        hasEnabledState: true,
        hasTapAction: true,
        label: 'VIDYA',
        hint: 'Tap to speak',
      ),
    );
    handle.dispose();
  });

  testWidgets('the orb clears the 48dp tap floor', (tester) async {
    await _pumpOrb(tester, VidyaOrbVisual.resting, onTap: () {});
    final size = tester.getSize(find.byType(VidyaOrb));
    expect(size.width, greaterThanOrEqualTo(48));
    expect(size.height, greaterThanOrEqualTo(48));
  });

}
