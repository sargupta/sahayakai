import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/profile/presentation/widgets/plan_badge_chip.dart';

import 'profile_fixtures.dart';

/// AA gate for the shared [PlanBadgeChip] (the identity plan badge on the Me hub
/// and the profile editor). Locks the fix at the source:
///   • PAID label + glyph route through the saffron-TEXT token (`#AC4815` light /
///     `#EB9447` dark) on the primary@0.12 tint (~5.1:1), NEVER `scheme.primary`
///     (`#E0924D` = ~2.26:1 — the banned `#E0924D`-as-text anti-pattern).
///   • MUTED/free inks full onSurface on its surfaceContainer fill (~14:1), not
///     the sub-4.5 onSurfaceVariant it used before.

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

/// Composites the translucent chip fill over the opaque surface it sits on.
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

Color _labelColor(WidgetTester tester, String label) =>
    tester.widget<Text>(find.text(label)).style!.color!;

void main() {
  group('paid plan chip', () {
    testWidgets(
      'label + glyph use the saffron-TEXT token in light, not #E0924D',
      (tester) async {
        await tester.pumpWidget(
          hostProfile(
            const PlanBadgeChip(),
            overrides: [
              tokenOverride(fakeJwt({'planType': 'pro'})),
            ],
          ),
        );
        await tester.pumpAndSettle();

        expect(_labelColor(tester, 'Pro'), AppColors.lPrimaryText); // #AC4815
        expect(_labelColor(tester, 'Pro'), isNot(AppColors.brandSaffron));
        final icon = tester.widget<Icon>(find.byIcon(LucideIcons.sparkles));
        expect(icon.color, AppColors.lPrimaryText);
        expect(icon.color, isNot(AppColors.brandSaffron));
      },
    );

    testWidgets('label uses the dark saffron-text token in dark', (
      tester,
    ) async {
      await tester.pumpWidget(
        hostProfile(
          const PlanBadgeChip(),
          brightness: Brightness.dark,
          overrides: [
            tokenOverride(fakeJwt({'planType': 'gold'})),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(_labelColor(tester, 'Gold'), AppColors.dPrimaryText); // #EB9447
    });
  });

  group('muted / free plan chip', () {
    testWidgets('inks full onSurface, never the sub-4.5 muted token', (
      tester,
    ) async {
      await tester.pumpWidget(
        hostProfile(
          const PlanBadgeChip(),
          overrides: [
            tokenOverride(fakeJwt({'planType': 'free'})),
          ],
        ),
      );
      await tester.pumpAndSettle();

      final color = _labelColor(tester, 'Free');
      expect(color, AppColors.lForeground); // onSurface, NOT onSurfaceVariant
      expect(color, isNot(AppColors.lMutedForeground));
    });
  });

  group('WCAG AA ratios (computed vs the ACTUAL fill)', () {
    test('paid label clears 4.5 on the primary@0.12 tint; #E0924D fails', () {
      final tint = _over(
        AppColors.lPrimary.withValues(alpha: 0.12),
        AppColors.lCard,
      );
      expect(_ratio(AppColors.lPrimaryText, tint), greaterThanOrEqualTo(4.5));
      expect(_ratio(AppColors.brandSaffron, tint), lessThan(3.0));

      final darkTint = _over(
        AppColors.dPrimary.withValues(alpha: 0.12),
        AppColors.dCard,
      );
      expect(
        _ratio(AppColors.dPrimaryText, darkTint),
        greaterThanOrEqualTo(4.5),
      );
    });

    test(
      'muted label clears 4.5 on the surfaceContainer fill; old token failed',
      () {
        expect(
          _ratio(AppColors.lForeground, AppColors.lMuted),
          greaterThanOrEqualTo(4.5),
        );
        // The OLD muted label (onSurfaceVariant on surfaceContainer) was < 4.5.
        expect(
          _ratio(AppColors.lMutedForeground, AppColors.lMuted),
          lessThan(4.5),
        );
        expect(
          _ratio(AppColors.dForeground, AppColors.dMuted),
          greaterThanOrEqualTo(4.5),
        );
      },
    );
  });
}
