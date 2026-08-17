import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/parent_hotline/presentation/widgets/reason_card.dart';

/// U-PH3 — the selectable reason tile. Pins the selected/unselected grammar (a
/// colour-independent check cue), the tap wiring, and the §12 overflow floor.
Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  Size surface = const Size(390, 844),
}) async {
  tester.view.physicalSize = surface;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

  await tester.pumpWidget(
    MaterialApp(
      theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
      home: Scaffold(
        body: Padding(padding: const EdgeInsets.all(16), child: child),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUp(() => GoogleFonts.config.allowRuntimeFetching = false);

  testWidgets('renders the label + description', (tester) async {
    await _pump(
      tester,
      const ReasonCard(
        icon: LucideIcons.trendingDown,
        label: 'Slipping in a subject',
        description: 'Recent marks need attention.',
        selected: false,
        onTap: _noop,
      ),
    );

    expect(find.text('Slipping in a subject'), findsOneWidget);
    expect(find.text('Recent marks need attention.'), findsOneWidget);
  });

  testWidgets('unselected shows the empty circle, selected shows the check', (
    tester,
  ) async {
    await _pump(
      tester,
      const ReasonCard(
        icon: LucideIcons.star,
        label: 'Good news',
        description: 'Celebrate a win.',
        selected: false,
        onTap: _noop,
      ),
    );
    expect(find.byIcon(LucideIcons.circle), findsOneWidget);
    expect(find.byIcon(LucideIcons.checkCircle2), findsNothing);

    await _pump(
      tester,
      const ReasonCard(
        icon: LucideIcons.star,
        label: 'Good news',
        description: 'Celebrate a win.',
        selected: true,
        onTap: _noop,
      ),
    );
    // A greyscale-legible selection cue (WCAG 1.4.1), not colour alone.
    expect(find.byIcon(LucideIcons.checkCircle2), findsOneWidget);
    expect(find.byIcon(LucideIcons.circle), findsNothing);
  });

  testWidgets('tapping fires onTap', (tester) async {
    var taps = 0;
    await _pump(
      tester,
      ReasonCard(
        icon: LucideIcons.calendarX2,
        label: 'Repeated absences',
        description: 'Several days missed.',
        selected: false,
        onTap: () => taps++,
      ),
    );

    await tester.tap(find.text('Repeated absences'));
    await tester.pumpAndSettle();
    expect(taps, 1);
  });

  group('overflow gates (DESIGN_RUBRIC §12)', () {
    for (final brightness in Brightness.values) {
      testWidgets('no overflow at 360dp x 1.3 (${brightness.name})', (
        tester,
      ) async {
        await _pump(
          tester,
          // A long Indic (Bengali) label + description at the narrow floor.
          const ReasonCard(
            icon: LucideIcons.alertTriangle,
            label: 'শ্রেণীকক্ষে আচরণ',
            description: 'অভিভাবকের জানা উচিত এমন কিছু ঘটেছে।',
            selected: true,
            onTap: _noop,
          ),
          brightness: brightness,
          textScale: 1.3,
          surface: const Size(360, 900),
        );
        expect(tester.takeException(), isNull);
        expect(find.text('শ্রেণীকক্ষে আচরণ'), findsOneWidget);
      });
    }
  });
}

void _noop() {}
