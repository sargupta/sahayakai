import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/shared/widgets/app_badge.dart';

/// AA gate for the shared [AppBadge] accent tone (the grade/points/ordinal badge
/// every result masthead uses). Its label is SMALL TEXT, so it must route
/// through the saffron-TEXT token (`#AC4815` light / `#EB9447` dark), never the
/// `#E0924D` brand FILL, which as text on the primary@0.12 tint is only ~2.26:1
/// — a gross AA fail AND the exact `#E0924D`-as-text use `app_colors.dart` bans.
/// This locks the fix at the source so all ~15 accent call sites stay AA.

// WCAG 2.1 relative-luminance ratio, mirroring theme_contrast_test.dart.
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
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

/// Composites a translucent [fg] over an opaque [bg] — the badge fill is
/// `primary @ 0.12`, so the label's real background is that tint over the
/// surface the badge sits on (a DocumentSheet masthead = `scheme.surface`).
Color _over(Color fg, Color bg) {
  final a = fg.a;
  double ch(double f, double b) => f * a + b * (1 - a);
  return Color.from(
    alpha: 1,
    red: ch(fg.r, bg.r),
    green: ch(fg.g, bg.g),
    blue: ch(fg.b, bg.b),
  );
}

Color _accentLabelColor(WidgetTester tester, String label) =>
    tester.widget<Text>(find.text(label)).style!.color!;

Widget _host(Widget child) => MaterialApp(
  theme: AppTheme.light(),
  home: Scaffold(body: Center(child: child)),
);

void main() {
  group('accent label routes through the saffron-TEXT token (not the fill)', () {
    testWidgets('light uses saffron-700 #AC4815', (tester) async {
      await tester.pumpWidget(
        _host(const AppBadge(
            icon: LucideIcons.graduationCap,
            label: 'Class 6',
            tone: AppBadgeTone.accent,
          ),
        ),
      );

      final color = _accentLabelColor(tester, 'Class 6');
      expect(color, AppColors.lPrimaryTextOnTint); // saffron-700, NOT saffron-500
      expect(color, isNot(AppColors.brandSaffron));
    });

    testWidgets('the ordinal count badge (accent) uses the same token', (
      tester,
    ) async {
      await tester.pumpWidget(
        _host(const AppBadge.count('3')),
      );
      expect(_accentLabelColor(tester, '3'), AppColors.lPrimaryTextOnTint);
    });

    testWidgets(
      'the accent GLYPH shares the saffron-text token, not the fill',
      (tester) async {
        // The glyph now routes through the same saffron-text token as the label
        // (~5.15:1 on the tint), NOT `scheme.primary` (#E0924D = ~2.26:1) — so
        // glyph and label read as one accent unit.
        await tester.pumpWidget(
          _host(const AppBadge(
              icon: LucideIcons.graduationCap,
              label: 'Class 6',
              tone: AppBadgeTone.accent,
            ),
          ),
        );
        final icon = tester.widget<Icon>(
          find.byIcon(LucideIcons.graduationCap),
        );
        expect(icon.color, AppColors.lPrimaryTextOnTint);
        expect(icon.color, isNot(AppColors.brandSaffron)); // never #E0924D
      },
    );

    testWidgets('the neutral tone is untouched (regular = onSurface ink)', (
      tester,
    ) async {
      await tester.pumpWidget(
        _host(const AppBadge(label: 'Science'), // neutral, regular
        ),
      );
      // The fix is scoped to accent; neutral content text stays full ink.
      expect(_accentLabelColor(tester, 'Science'), AppColors.lForeground);
    });
  });

  group('accent label clears WCAG AA (>=4.5) on the primary@0.12 tint', () {
    test('light: saffron-700 on the tint over a white card', () {
      final tint = _over(
        AppColors.lPrimary.withValues(alpha: 0.12),
        AppColors.lCard,
      );
      expect(
        _ratio(AppColors.lPrimaryTextOnTint, tint),
        greaterThanOrEqualTo(4.5),
        reason: 'saffron-700 label must meet AA on the accent tint',
      );
      // saffron-500 as text is a documented AA fail on the same tint (3.23:1).
      expect(_ratio(AppColors.brandSaffron, tint), lessThan(4.5));
    });

  });

  // The small NEUTRAL tone used to mute its label to onSurfaceVariant, which is
  // only 3.86:1 on the surfaceContainerHigh fill — a fail the Me hub's board /
  // language / plan chips surfaced. The label is now full-ink onSurface for both
  // sizes (the fill is opaque, so no compositing); only the text STYLE stays
  // small. This locks the fix so every neutral AppBadge site stays AA.
  group(
    'small neutral label clears WCAG AA on the surfaceContainerHigh fill',
    () {
      testWidgets('light: full-ink onSurface, not the sub-4.5 muted token', (
        tester,
      ) async {
        await tester.pumpWidget(
          _host(const AppBadge(label: 'Kannada', size: AppBadgeSize.small),
          ),
        );

        final color = _accentLabelColor(tester, 'Kannada');
        expect(color, AppColors.lForeground); // onSurface, NOT onSurfaceVariant
        expect(
          _ratio(color, AppColors.lSurfaceContainerHigh),
          greaterThanOrEqualTo(4.5),
        );
        // Pre-v2 the muted slate label was a documented fail (3.86:1) on this
        // fill. v2's body ink clears it, but the badge keeps full ink: the
        // assertion above is the contract, the palette is not.
      });

    },
  );
}
