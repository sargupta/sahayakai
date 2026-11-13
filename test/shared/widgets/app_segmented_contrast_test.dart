import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/shared/widgets/app_segmented.dart';

/// WCAG AA for the [AppSegmented] labels, read from the ACTUAL rendered label
/// colours. Light: AppSegmented now draws the UX map's segmented control
/// ([MapSegmented]) — unselected labels in `AppColors.textBody` on a white
/// track, the selected label white on the `AppColors.accentFill` pill — and
/// both pairs must clear 4.5:1. The dark case keeps the older glass-track
/// assertion (a pre-existing failure, tracked separately).
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

Future<(Color, Color)> _labelColors(
  WidgetTester tester,
  ThemeData theme,
) async {
  await _unselectedLabelColor(tester, theme);
  final unselected = tester.widget<Text>(find.text('Two')).style!.color!;
  final selected = tester.widget<Text>(find.text('One')).style!.color!;
  return (unselected, selected);
}

void main() {
  // Light: AppSegmented now draws the UX map's segmented control
  // ([MapSegmented]) — a WHITE pill track, the chosen option a saffron-600
  // ([AppColors.accentFill]) pill with white text, unselected labels in
  // [AppColors.textBody]. Both label/fill pairs must clear AA (4.5:1), read
  // from the ACTUAL rendered label colours.
  testWidgets(
    'AppSegmented unselected label clears AA on the track fill (light)',
    (tester) async {
      final theme = AppTheme.light();
      final (unselected, selected) = await _labelColors(tester, theme);

      // The map's segmented control: body ink on a white track.
      expect(unselected, AppColors.textBody);
      expect(
        _ratio(unselected, Colors.white),
        greaterThanOrEqualTo(4.5),
        reason:
            'the unselected segment label must meet AA (>=4.5) on the white '
            'track',
      );

      // The selected pill: white text on the saffron-600 fill.
      expect(selected, AppColors.textOnAccent);
      expect(
        _ratio(selected, AppColors.accentFill),
        greaterThanOrEqualTo(4.5),
        reason:
            'the selected segment label must meet AA (>=4.5) on the '
            'accentFill pill',
      );
    },
  );

  // Dark: the app ships light-only (there is no AppTheme.dark), so this
  // compared the LIGHT theme's label with the dark backdrop and could never
  // pass. Skipped, not deleted: switch it back on with the real dark theme if
  // dark mode returns (colour-scheme option D, on hold 2026-11).
  for (final brightness in [Brightness.dark]) {
    testWidgets(
      'AppSegmented unselected label clears AA on the track fill (${brightness.name})',
      skip: true,
      (tester) async {
        // Build the theme INSIDE the test body — constructing it at collection
        // time (a top-level literal) would build a theme before the binding inits.
        final theme = brightness == Brightness.dark
            ? AppTheme.light()
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
