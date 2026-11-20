// GL-1 foundation: GlassSurface must render cleanly (no overflow, no
// FlutterError) at a couple of sizes, and the token file it
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
    theme: AppTheme.light(),
    home: Scaffold(
      body: Center(
        child: SingleChildScrollView(
          child: Padding(padding: const EdgeInsets.all(16), child: child),
        ),
      ),
    ),
  );
}

void main() {
  for (final brightness in const [Brightness.light]) {
    for (final size in [_narrow, _wide]) {
      final label = '${brightness.name} @ ${size.width.toInt()}dp';

      testWidgets('GlassSurface (real blur) renders without error — $label', (
        tester,
      ) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(
          _host(
            brightness: brightness,
            child: const GlassSurface(
              child: SizedBox(
                width: 220,
                height: 120,
                child: Center(child: Text('Glass chrome')),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        expect(find.text('Glass chrome'), findsOneWidget);
      });

      testWidgets('GlassSurface.flat renders without error — $label', (
        tester,
      ) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(
          _host(
            brightness: brightness,
            child: const GlassSurface.flat(
              radius: 12,
              padding: EdgeInsets.all(12),
              child: SizedBox(
                width: 260,
                height: 90,
                child: Text('Glass flat fill, list-context reuse candidate'),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        expect(
          find.text('Glass flat fill, list-context reuse candidate'),
          findsOneWidget,
        );
      });
    }
  }

  group('AppGlass tokens are live, not dead code', () {
    test('chrome and flat fills are distinct, meaningfully translucent', () {
      for (final c in [AppGlass.lChromeFill, AppGlass.lFlatFill]) {
        expect(c.a, lessThan(1.0), reason: 'glass fills must be translucent');
        expect(
          c.a,
          greaterThan(0.5),
          reason: 'erred toward more opaque for contrast safety',
        );
      }
      expect(AppGlass.lChromeFill, isNot(AppGlass.lFlatFill));
    });

    test('the glass edge is a uniform 1px border-glass ring', () {
      expect(AppGlass.lBorderGradient.colors, [
        AppColors.borderGlass,
        AppColors.borderGlass,
      ]);
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
    testWidgets('chrome GlassSurface with a small intrinsic child in a '
        'bare Row', (tester) async {
      await tester.pumpWidget(
        _host(
          brightness: Brightness.light,
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              GlassSurface(
                radius: 12,
                padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Text('Chip'),
              ),
            ],
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Chip'), findsOneWidget);
    });

    testWidgets(
      'flat GlassSurface with a small intrinsic child in a bare Row',
      (tester) async {
        await tester.pumpWidget(
          _host(
            brightness: Brightness.light,
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                GlassSurface.flat(
                  radius: 8,
                  padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  child: Text('Badge'),
                ),
              ],
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        expect(find.text('Badge'), findsOneWidget);
      },
    );
  });
}
