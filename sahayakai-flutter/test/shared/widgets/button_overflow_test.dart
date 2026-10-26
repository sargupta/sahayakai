import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/shared/widgets/primary_button.dart';
import 'package:sahayakai/shared/widgets/secondary_button.dart';

/// The app-wide CTA primitives must obey the no-overflow rule (DESIGN_RUBRIC
/// §12) at the phone's own text size: a long localized label never bleeds
/// below the pill (a `ButtonStyleButton` defaults to `Clip.none`).
///
/// Since the 12px-floor decision (26 Oct 2026) the label is not clamped: it
/// follows the system text scale, wraps without a line cap, and the pill grows
/// from its minimum height. Each probe pumps a button into a deliberately
/// narrow column at textScale 2.0 with a long label and asserts that nothing
/// overflows, nothing is truncated, the pill grew, and the paragraph renders
/// at the full 2.0 scale (no clamp). The happy-path cases confirm a short
/// label at scale 1.0 still renders at the exact pill height.

// Long enough to spill past two lines in a narrow column at textScale 1.3 — the
// realistic "Continue with your school Google account" class of CTA label once
// localized into a longer script.
const _longLabel =
    'Continue with your school Google account now to keep going and finish setup';

Widget _host(Widget child) {
  return MaterialApp(
    theme: AppTheme.light(),
    home: Scaffold(
      body: Center(
        // A bounded, narrow width forces the label to wrap — the exact case
        // that used to bleed below the fixed-height pill.
        child: SizedBox(width: 150, child: child),
      ),
    ),
  );
}

RenderParagraph _label(WidgetTester tester, Type buttonType) =>
    tester.renderObject<RenderParagraph>(
      find.descendant(
        of: find.byType(buttonType),
        matching: find.text(_longLabel),
      ),
    );

void main() {
  for (final (type, button, minHeight) in [
    (
      PrimaryButton,
      PrimaryButton(label: _longLabel, onPressed: () {}),
      56.0,
    ),
    (
      SecondaryButton,
      SecondaryButton(label: _longLabel, onPressed: () {}),
      52.0,
    ),
  ]) {
    testWidgets(
      '$type: a long label at textScale 2.0 wraps in full and the pill grows',
      (tester) async {
        tester.platformDispatcher.textScaleFactorTestValue = 2.0;
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

        await tester.pumpWidget(_host(button));
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        final label = _label(tester, type);
        // Not truncated: no line cap, no ellipsis.
        expect(label.didExceedMaxLines, isFalse);
        // Not clamped: the phone's own 2.0 reaches the label.
        expect(label.textScaler.scale(10), 20);
        // The pill grew to hold the wrapped label.
        expect(tester.getSize(find.byType(type)).height, greaterThan(minHeight));
      },
    );
  }

  testWidgets(
    'PrimaryButton: a short label at scale 1.0 still renders at 56dp',
    (tester) async {
      await tester.pumpWidget(
        _host(const PrimaryButton(label: 'Sign in', onPressed: _noop)),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(tester.getSize(find.byType(PrimaryButton)).height, 56);
    },
  );

  testWidgets(
    'SecondaryButton: a short label at scale 1.0 still renders at 52dp',
    (tester) async {
      await tester.pumpWidget(
        _host(const SecondaryButton(label: 'Skip', onPressed: _noop)),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(tester.getSize(find.byType(SecondaryButton)).height, 52);
    },
  );
}

void _noop() {}
