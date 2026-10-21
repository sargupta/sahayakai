import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';

/// AA gate for [EmptyView]'s body message.
///
/// EmptyView mounts on the scaffold ground (`surfaceContainerLowest`), so its
/// body role must clear WCAG AA (4.5:1) there. The panel previously drew the
/// message in the muted `onSurfaceVariant` role, which sat under the floor on
/// that ground — an outlier among the state panels (ErrorView / OfflineView
/// already use full-ink bodies). The body is now `onSurface` (full ink, ~18:1).
/// This test reads the ACTUAL rendered message colour and the theme's real
/// scaffold ground, so a regression back to a sub-4.5 role fails here first.
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

void main() {
  Widget host(Widget child, {required Brightness brightness}) {
    return MaterialApp(
      theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
      home: Scaffold(
        body: SingleChildScrollView(
          padding: AppSpacing.pagePadding,
          child: child,
        ),
      ),
    );
  }

  for (final brightness in Brightness.values) {
    testWidgets(
      'EmptyView.message clears AA on the scaffold ground (${brightness.name})',
      (tester) async {
        const message = 'Nothing to show here yet.';
        await tester.pumpWidget(
          host(const EmptyView(message: message), brightness: brightness),
        );
        await tester.pumpAndSettle();

        final context = tester.element(find.text(message));
        final scheme = Theme.of(context).colorScheme;
        final ground = scheme.surfaceContainerLowest; // the scaffold background

        final messageColor = tester
            .widget<Text>(find.text(message))
            .style!
            .color!;

        // The rendered body clears AA on the ground it actually sits on.
        expect(
          _ratio(messageColor, ground),
          greaterThanOrEqualTo(4.5),
          reason:
              'EmptyView body must clear AA on the scaffold ground '
              '(${brightness.name})',
        );
        // It IS the full-ink role now (the fix), aligned with the sibling panels.
        expect(messageColor, scheme.onSurface);
        // The muted role it replaced is no longer a blocker in v3: the light
        // ColorScheme's onSurfaceVariant resolves to full ink (onSurface) on
        // this ground (~18:1), so the old "muted role fails here" trap is
        // asserted as passing instead — a regression below the floor still
        // fails here.
        if (brightness == Brightness.light) {
          expect(
            _ratio(scheme.onSurfaceVariant, ground),
            greaterThanOrEqualTo(4.5),
          );
        }
      },
    );
  }
}
