import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/shared/widgets/app_segmented.dart';

/// WCAG AA for the [AppSegmented] `_track` labels. The **unselected** label sits
/// on the track fill, not the thumb — it previously used `onSurfaceVariant`,
/// which is only 3.86:1 on the old `surfaceContainerHigh` fill (a fail for the
/// `labelLarge` text, which is not large text). It now uses full-ink
/// `onSurface` (matching the `_chips` fallback), which this test pins in both
/// themes by reading the ACTUAL rendered label colour and computing its ratio
/// against the actual track fill.
///
/// GL-3 (App-wide Glassmorphism Reskin) updated the track's fill from the
/// flat `surfaceContainerHigh` token to `AppGlass`'s translucent flat-fill
/// token (the same one `AppCard` now uses) — so the "actual track fill" this
/// test composites against is now [AppGlass.lFlatFill]/[AppGlass.dFlatFill]
/// alpha-blended over the screen backdrop, using the SAME `Color.alphaBlend`
/// composite method `theme_contrast_test.dart`'s own "GL-1 glassmorphism —
/// flat-fill token stays AA-safe" group already uses (and already proves
/// clears AA generically for this token) — not the plain opaque
/// `surfaceContainerHigh` colour this test asserted against before the
/// reskin.
double _lin(int c) {
  final s = c / 255.0;
  return s <= 0.03928
      ? s / 12.92
      : math.pow((s + 0.055) / 1.055, 2.4).toDouble();
}

double _luminance(Color c) =>
    0.2126 * _lin((c.r * 255).round()) +
    0.7152 * _lin((c.g * 255).round()) +
    0.0722 * _lin((c.b * 255).round());

double _ratio(Color a, Color b) {
  final la = _luminance(a);
  final lb = _luminance(b);
  final hi = math.max(la, lb);
  final lo = math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

Future<Color> _unselectedLabelColor(
  WidgetTester tester,
  ThemeData theme,
) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: theme,
      home: Scaffold(
        body: Center(
          child: AppSegmented<int>(
            value: 0, // 'One' selected → 'Two' is the unselected label
            onChanged: (_) {},
            segments: const [
              AppSegment<int>(value: 0, label: 'One'),
              AppSegment<int>(value: 1, label: 'Two'),
            ],
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  final label = tester.widget<Text>(find.text('Two'));
  return label.style!.color!;
}

void main() {
  for (final brightness in Brightness.values) {
    testWidgets(
      'AppSegmented unselected label clears AA on the track fill (${brightness.name})',
      (tester) async {
        // Build the theme INSIDE the test body — constructing it at collection
        // time (a top-level literal) would build a theme before the binding inits.
        final theme = brightness == Brightness.dark
            ? AppTheme.dark()
            : AppTheme.light();
        // The real rendered track fill post-GL-3: AppGlass's translucent flat
        // token composited over the screen backdrop it actually sits on (the
        // same backdrop AppGlass's own doc comments and theme_contrast_test.dart
        // assume — see the file header).
        final backdrop = brightness == Brightness.dark
            ? AppColors.dBackground
            : AppColors.lBackground;
        final glassFill = brightness == Brightness.dark
            ? AppGlass.dFlatFill
            : AppGlass.lFlatFill;
        final trackFill = Color.alphaBlend(glassFill, backdrop);
        final labelColor = await _unselectedLabelColor(tester, theme);

        // Full-ink, not the muted onSurfaceVariant (the regression this guards).
        expect(labelColor, theme.colorScheme.onSurface);
        expect(
          _ratio(labelColor, trackFill),
          greaterThanOrEqualTo(4.5),
          reason:
              'the unselected segment label must meet AA (>=4.5) on the '
              'surfaceContainerHigh track fill',
        );
      },
    );
  }
}
