import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/shared/widgets/primary_button.dart';
import 'package:sahayakai/shared/widgets/secondary_button.dart';

/// The app-wide CTA primitives must obey the mandatory textScale-1.3 no-overflow
/// rule (DESIGN_RUBRIC §12): a long localized label must never bleed below the
/// pill (a `ButtonStyleButton` defaults to `Clip.none`). The predecessor bug was
/// a fixed-height `SizedBox` around a `Flexible(Text)` with NO `maxLines`, so at
/// textScale 1.3 a long label wrapped to three-plus lines and overflowed.
///
/// Each probe pumps a button into a deliberately narrow column at textScale 1.3
/// with a long label and asserts BOTH that nothing overflows AND that the label
/// genuinely exceeded the two-line cap (`didExceedMaxLines`) — the latter proves
/// the probe is real: the same label under the old uncapped, fixed-height pill
/// would have overflowed. The happy-path cases confirm a short label at scale
/// 1.0 still renders at the exact pill height, so the fix changed nothing there.

// Long enough to spill past two lines in a narrow column at textScale 1.3 — the
// realistic "Continue with your school Google account" class of CTA label once
// localized into a longer script.
const _longLabel =
    'Continue with your school Google account now to keep going and finish setup';

Widget _host(Widget child, {Brightness brightness = Brightness.light}) {
  return MaterialApp(
    theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
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
  setUp(() => GoogleFonts.config.allowRuntimeFetching = false);

  for (final brightness in Brightness.values) {
    testWidgets(
      'PrimaryButton: a wrapping label never overflows at textScale 1.3 '
      '(${brightness.name})',
      (tester) async {
        tester.platformDispatcher.textScaleFactorTestValue = 1.3;
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

        await tester.pumpWidget(
          _host(
            PrimaryButton(label: _longLabel, onPressed: () {}),
            brightness: brightness,
          ),
        );
        await tester.pumpAndSettle();

        // The load-bearing assertion: the old fixed-height SizedBox clipped the
        // wrapped label and Flutter reported a RenderBox overflow here.
        expect(tester.takeException(), isNull);
        // ...and the label really was long enough to need clamping, so the old
        // uncapped pill would have overflowed it — this is not a label that
        // trivially fit on one line.
        expect(
          _label(tester, PrimaryButton).didExceedMaxLines,
          isTrue,
          reason: 'the probe must exercise a genuinely wrapping label',
        );
      },
    );

    testWidgets(
      'SecondaryButton: a wrapping label never overflows at textScale 1.3 '
      '(${brightness.name})',
      (tester) async {
        tester.platformDispatcher.textScaleFactorTestValue = 1.3;
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

        await tester.pumpWidget(
          _host(
            SecondaryButton(label: _longLabel, onPressed: () {}),
            brightness: brightness,
          ),
        );
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        expect(
          _label(tester, SecondaryButton).didExceedMaxLines,
          isTrue,
          reason: 'the probe must exercise a genuinely wrapping label',
        );
      },
    );
  }

  testWidgets('PrimaryButton: a short label at scale 1.0 still renders at 56dp',
      (tester) async {
    await tester.pumpWidget(
      _host(const PrimaryButton(label: 'Sign in', onPressed: _noop)),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(tester.getSize(find.byType(PrimaryButton)).height, 56);
  });

  testWidgets('SecondaryButton: a short label at scale 1.0 still renders at 52dp',
      (tester) async {
    await tester.pumpWidget(
      _host(const SecondaryButton(label: 'Skip', onPressed: _noop)),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(tester.getSize(find.byType(SecondaryButton)).height, 52);
  });
}

void _noop() {}
