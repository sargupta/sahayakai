import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/shared/widgets/app_segmented.dart';

/// Contrast for the [AppSegmented] `_track` labels, read from the ACTUAL
/// rendered label colours.
///
/// Light follows the design system v2 `SegmentedControl`: the unselected label
/// is `text-body` on the 62% `surface-segment` glass composited over the milk
/// wash, which must clear AA (>=4.5) for 12px text. The selected label is
/// white on the `saffron-500` pill: 3.77:1, the open founder decision in guide
/// 10 (fix on the table: a `saffron-600` fill at 5.28:1). This test pins that
/// value as it stands rather than resolving it, and fails if it drops below the
/// 3:1 UI-component floor.
///
/// Dark keeps the pre-v2 glass track (dark mode is an open founder decision):
/// the unselected label is full-ink `onSurface` on `AppGlass.dFlatFill`.
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

Future<void> _pump(WidgetTester tester, ThemeData theme) async {
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
}

Color _labelColor(WidgetTester tester, String text) {
  final style = tester
      .widget<AnimatedDefaultTextStyle>(
        find
            .ancestor(
              of: find.text(text),
              matching: find.byType(AnimatedDefaultTextStyle),
            )
            .first,
      )
      .style;
  return style.color!;
}

void main() {
  testWidgets('light: unselected label is text-body and clears AA on the '
      'segment glass', (tester) async {
    await _pump(tester, AppTheme.light());
    final track = Color.alphaBlend(
      AppColors.surfaceSegment,
      AppColors.lBackground,
    );
    final label = _labelColor(tester, 'Two');

    expect(label, AppColors.textBody);
    expect(
      _ratio(label, track),
      greaterThanOrEqualTo(4.5),
      reason: 'the unselected segment label must meet AA on surface-segment',
    );
  });

  testWidgets('light: selected label is white on saffron-500 (open founder '
      'decision, 3.77:1)', (tester) async {
    final theme = AppTheme.light();
    await _pump(tester, theme);
    final label = _labelColor(tester, 'One');

    expect(label, theme.colorScheme.onPrimary);
    expect(theme.colorScheme.primary, AppColors.saffron500);
    final ratio = _ratio(label, AppColors.saffron500);
    expect(ratio, closeTo(3.77, 0.01));
    expect(ratio, greaterThanOrEqualTo(3.0));
  });

  testWidgets('dark: unselected label clears AA on the glass track', (
    tester,
  ) async {
    final theme = AppTheme.dark();
    await _pump(tester, theme);
    final track = Color.alphaBlend(AppGlass.dFlatFill, AppColors.dBackground);
    final label = _labelColor(tester, 'Two');

    expect(label, theme.colorScheme.onSurface);
    expect(_ratio(label, track), greaterThanOrEqualTo(4.5));
  });

  testWidgets('segments read as a radio group', (tester) async {
    await _pump(tester, AppTheme.light());
    expect(
      tester.getSemantics(find.bySemanticsLabel('One')),
      matchesSemantics(
        label: 'One',
        isButton: true,
        hasCheckedState: true,
        isChecked: true,
        isInMutuallyExclusiveGroup: true,
        hasTapAction: true,
        isFocusable: true,
        hasFocusAction: true,
      ),
    );
    expect(
      tester.getSemantics(find.bySemanticsLabel('Two')),
      matchesSemantics(
        label: 'Two',
        isButton: true,
        hasCheckedState: true,
        isChecked: false,
        isInMutuallyExclusiveGroup: true,
        hasTapAction: true,
        isFocusable: true,
        hasFocusAction: true,
      ),
    );
  });
}
