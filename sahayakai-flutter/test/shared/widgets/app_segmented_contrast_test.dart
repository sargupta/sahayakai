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
/// white on the `accent-fill` pill (`saffron-600`, 5.28:1), never on
/// `saffron-500` (3.77:1), decided 26 Oct 2026.
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

  testWidgets('light: selected label is white on the accent-fill pill (AA)', (
    tester,
  ) async {
    await _pump(tester, AppTheme.light());
    final label = _labelColor(tester, 'One');
    final pill = tester
        .widgetList<DecoratedBox>(find.byType(DecoratedBox))
        .map((b) => b.decoration)
        .whereType<ShapeDecoration>()
        .where((d) => d.shape is StadiumBorder && d.color != null)
        .map((d) => d.color)
        .toList();

    expect(label, AppColors.textOnAccent);
    expect(pill, contains(AppColors.accentFill));
    expect(_ratio(label, AppColors.accentFill), greaterThanOrEqualTo(4.5));
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
