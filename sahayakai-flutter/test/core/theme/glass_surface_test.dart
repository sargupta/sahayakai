// GL-1 foundation: GlassSurface must render cleanly (no overflow, no
// FlutterError) in both themes at a couple of sizes, and the token file it
// draws from must actually be exercised (not dead code) — see
// theme_contrast_test.dart for the composited flat-fill AA-contrast check.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/shared/widgets/glass_surface.dart';

const _narrow = Size(360, 800);
const _wide = Size(800, 900);

Widget _host({required Widget child, required Brightness brightness}) {
  return MaterialApp(
    theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
    home: Scaffold(
      body: Center(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: child,
          ),
        ),
      ),
    ),
  );
}

void main() {
  for (final brightness in [Brightness.light, Brightness.dark]) {
    for (final size in [_narrow, _wide]) {
      final label = '${brightness.name} @ ${size.width.toInt()}dp';

      testWidgets('GlassSurface (real blur) renders without error — $label',
          (tester) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(_host(
          brightness: brightness,
          child: const GlassSurface(
            child: SizedBox(
              width: 220,
              height: 120,
              child: Center(child: Text('Glass chrome')),
            ),
          ),
        ));
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        expect(find.text('Glass chrome'), findsOneWidget);
      });

      testWidgets('GlassSurface.flat renders without error — $label',
          (tester) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(_host(
          brightness: brightness,
          child: GlassSurface.flat(
            radius: 12,
            padding: const EdgeInsets.all(12),
            child: const SizedBox(
              width: 260,
              height: 90,
              child: Text('Glass flat fill, list-context reuse candidate'),
            ),
          ),
        ));
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        expect(find.text('Glass flat fill, list-context reuse candidate'),
            findsOneWidget);
      });
    }
  }

  testWidgets('addSheen: false renders without error', (tester) async {
    tester.view.physicalSize = _narrow;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_host(
      brightness: Brightness.light,
      child: const GlassSurface(
        addSheen: false,
        child: SizedBox(width: 180, height: 80),
      ),
    ));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });

  group('AppGlass tokens are live, not dead code', () {
    test('blurSigma is tuned for low-end GPUs (18-24 range)', () {
      expect(AppGlass.blurSigma, inInclusiveRange(18.0, 24.0));
      // GlassSurface's real-blur constructor is the reachable call site.
      expect(const GlassSurface(child: SizedBox()).radius, isNotNull);
    });

    test('chrome and flat fill pairs are distinct, meaningfully translucent',
        () {
      for (final c in [
        AppGlass.lChromeFill,
        AppGlass.dChromeFill,
        AppGlass.lFlatFill,
        AppGlass.dFlatFill,
      ]) {
        expect(c.a, lessThan(1.0), reason: 'glass fills must be translucent');
        expect(c.a, greaterThan(0.5),
            reason: 'erred toward more opaque for contrast safety');
      }
      expect(AppGlass.lChromeFill, isNot(AppGlass.lFlatFill));
      expect(AppGlass.dChromeFill, isNot(AppGlass.dFlatFill));
    });

    test('border and sheen gradients exist and are barely-there', () {
      expect(AppGlass.lBorderGradient.colors, hasLength(2));
      expect(AppGlass.dBorderGradient.colors, hasLength(2));
      // Sheen must stay subtle — "if a gradient is noticeable at a glance,
      // it is too strong" (app_gradients.dart house style) — but the GL-1
      // review found the FIRST-PASS dose (alpha 0.08/0.06, <0.15 bound) too
      // faint to ever read as brand-tinted once composited; retuned to
      // 0.17/0.12. Bound loosened to match while still catching a genuinely
      // loud gradient (a "noticeable at a glance" sheen would run well
      // above 0.25).
      expect(AppGlass.lSheenGradient.colors.first.a, lessThan(0.25));
      expect(AppGlass.dSheenGradient.colors.first.a, lessThan(0.25));
    });
  });

  group('GlassSurface in a Row without Expanded (GL-2/GL-3 reuse shape)', () {
    // GL-2/GL-3 reuse GlassSurface for intrinsically-sized children — a
    // button, a badge, a chip — inside a Row that does NOT wrap it in
    // Expanded/Flexible. The GL-1 review flagged this as untested: Stack
    // sizes itself from its non-positioned child (the trailing
    // Padding(child: child)), and a Row gives its children unbounded width
    // unless constrained, which is exactly the shape that trips a
    // RenderFlex/"unbounded width" exception if a widget assumes it always
    // gets a tight or Expanded constraint.
    testWidgets('real-blur GlassSurface with a small intrinsic child in a '
        'bare Row', (tester) async {
      await tester.pumpWidget(_host(
        brightness: Brightness.light,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            GlassSurface(
              radius: 12,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: const Text('Chip'),
            ),
          ],
        ),
      ));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Chip'), findsOneWidget);
    });

    testWidgets(
        'flat GlassSurface with a small intrinsic child in a bare Row',
        (tester) async {
      await tester.pumpWidget(_host(
        brightness: Brightness.dark,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            GlassSurface.flat(
              radius: 8,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: const Text('Badge'),
            ),
          ],
        ),
      ));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Badge'), findsOneWidget);
    });
  });
}
