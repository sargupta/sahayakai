import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/parent_hotline/domain/parent_outreach.dart';
import 'package:sahayakai/features/parent_hotline/presentation/widgets/evidence_panel.dart';
import 'package:sahayakai/shared/widgets/app_skeleton.dart';

/// U-PH3 — the reason-aware evidence panel. Pins the four reason bodies, the
/// graceful "no marks" empty (the performance read 401s in foundation-v1), the
/// loading skeleton, and the §12 overflow floor.
Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  Locale locale = const Locale('en'),
  Size surface = const Size(390, 844),
  bool settle = true,
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
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: Padding(padding: const EdgeInsets.all(16), child: child),
      ),
    ),
  );
  // A shimmering AppSkeleton animates forever, so its state pumps a frame
  // instead of settling.
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
  }
}

void main() {
  testWidgets('absences: header + absent-days badge + prompt', (tester) async {
    await _pump(
      tester,
      const EvidencePanel(
        reason: OutreachReason.consecutiveAbsences,
        consecutiveAbsentDays: 3,
      ),
    );
    expect(find.text('Attendance'), findsOneWidget);
    expect(find.text('3 days absent in a row'), findsOneWidget);
    expect(find.textContaining('Confirm the days missed'), findsOneWidget);
  });

  testWidgets(
    'poor performance with no snapshot degrades to the empty prompt',
    (tester) async {
      await _pump(
        tester,
        const EvidencePanel(
          reason: OutreachReason.poorPerformance,
          // foundation-v1: no performance snapshot (the read 401s).
        ),
      );
      expect(find.text('Recent marks'), findsOneWidget);
      expect(
        find.textContaining('No recent marks on record yet'),
        findsOneWidget,
      );
    },
  );

  testWidgets('behavioural concern shows the what-happened prompt', (
    tester,
  ) async {
    await _pump(
      tester,
      const EvidencePanel(reason: OutreachReason.behavioralConcern),
    );
    expect(find.text('What happened'), findsOneWidget);
    expect(find.textContaining('Describe what happened'), findsOneWidget);
  });

  testWidgets('positive feedback shows the celebrate prompt', (tester) async {
    await _pump(
      tester,
      const EvidencePanel(reason: OutreachReason.positiveFeedback),
    );
    expect(find.text('The good news'), findsOneWidget);
    expect(find.textContaining('Share the win'), findsOneWidget);
  });

  testWidgets('isLoading shows the shaped skeleton, not a prompt', (
    tester,
  ) async {
    await _pump(
      tester,
      const EvidencePanel(
        reason: OutreachReason.poorPerformance,
        isLoading: true,
      ),
      settle: false, // the skeleton shimmer never settles
    );
    expect(find.byType(AppSkeleton), findsOneWidget);
    expect(find.textContaining('No recent marks'), findsNothing);
  });

  group('overflow gates (DESIGN_RUBRIC §12)', () {
    for (final brightness in Brightness.values) {
      testWidgets('no overflow at 360dp x 1.3, Tamil (${brightness.name})', (
        tester,
      ) async {
        await _pump(
          tester,
          const EvidencePanel(
            reason: OutreachReason.consecutiveAbsences,
            consecutiveAbsentDays: 5,
          ),
          brightness: brightness,
          textScale: 1.3,
          locale: const Locale('ta'),
          surface: const Size(360, 900),
        );
        expect(tester.takeException(), isNull);
      });
    }
  });
}
