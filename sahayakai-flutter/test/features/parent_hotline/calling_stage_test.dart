import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/parent_hotline/domain/parent_outreach.dart';
import 'package:sahayakai/features/parent_hotline/presentation/widgets/calling_stage.dart';
import 'package:sahayakai/shared/widgets/icon_well.dart';

/// U-PH4 — the `calling` stage: the honest breathing waiting state (SPEC §B.1
/// stage 5 + §B.5.4 "honest waiting"). Pins the status/turnCount → copy mapping,
/// the exchanges-pill threshold, the reduce-motion still frame (no infinite
/// ticker), the absence of ANY determinate progress affordance, and the §12
/// Indic overflow floor against the REAL translated strings.

/// Mounts [CallingStage] the way the screen does — inside a padded, 640-capped
/// scroll column — with localizations so `context.l10n` resolves. Animations are
/// disabled so the breathe freezes at its still frame and `pumpAndSettle`
/// returns (no infinite ticker).
Future<void> _pump(
  WidgetTester tester, {
  required String parentName,
  required CallResult? callResult,
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  Locale locale = const Locale('en'),
  Size surface = const Size(390, 1200),
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
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 640),
              child: CallingStage(
                parentName: parentName,
                callResult: callResult,
              ),
            ),
          ),
        ),
      ),
    ),
  );
  // Reduce-motion → the breathe is frozen; this must return, not time out.
  await tester.pumpAndSettle();
}

/// A CallResult on the calling stage (the only non-terminal status is
/// `initiated`); [turnCount] drives the status line + the exchanges pill.
CallResult _calling(int turnCount) =>
    CallResult(callStatus: CallStatus.initiated, turnCount: turnCount);

void main() {
  setUp(() => GoogleFonts.config.allowRuntimeFetching = false);

  group('status line + headline', () {
    testWidgets('ringing: initiated with no turns → headline + "Ringing…"', (
      tester,
    ) async {
      await _pump(tester, parentName: 'Asha Rao', callResult: _calling(0));

      expect(find.text("Calling Asha Rao's parent…"), findsOneWidget);
      expect(find.text('Ringing…'), findsOneWidget);
      expect(find.text('Conversation in progress'), findsNothing);
      // The signature glyph is present (the composed still frame).
      expect(find.byType(IconWell), findsOneWidget);
      expect(find.byIcon(LucideIcons.phoneCall), findsOneWidget);
    });

    testWidgets('null result (just entered calling) reads as ringing', (
      tester,
    ) async {
      await _pump(tester, parentName: 'Asha Rao', callResult: null);
      expect(find.text('Ringing…'), findsOneWidget);
      expect(find.text('Conversation in progress'), findsNothing);
    });

    testWidgets(
      'in progress: initiated with turns → "Conversation in progress"',
      (tester) async {
        await _pump(tester, parentName: 'Asha Rao', callResult: _calling(3));

        expect(find.text('Conversation in progress'), findsOneWidget);
        expect(find.text('Ringing…'), findsNothing);
      },
    );

    testWidgets('the reassurance backing the resume path is shown', (
      tester,
    ) async {
      await _pump(tester, parentName: 'Asha Rao', callResult: _calling(0));
      expect(
        find.text(
          'You can leave this screen — the summary will be waiting for you.',
        ),
        findsOneWidget,
      );
    });
  });

  group('exchanges pill threshold (shown only when turnCount > 1)', () {
    testWidgets('hidden at turnCount 0', (tester) async {
      await _pump(tester, parentName: 'Asha Rao', callResult: _calling(0));
      expect(find.textContaining('exchange'), findsNothing);
    });

    testWidgets('hidden at turnCount 1 (a lone opening greeting)', (
      tester,
    ) async {
      await _pump(tester, parentName: 'Asha Rao', callResult: _calling(1));
      expect(find.textContaining('exchange'), findsNothing);
    });

    testWidgets('shown at turnCount 2', (tester) async {
      await _pump(tester, parentName: 'Asha Rao', callResult: _calling(2));
      expect(find.text('2 exchanges'), findsOneWidget);
    });

    testWidgets('shown at turnCount 5', (tester) async {
      await _pump(tester, parentName: 'Asha Rao', callResult: _calling(5));
      expect(find.text('5 exchanges'), findsOneWidget);
    });
  });

  group('honest waiting (SPEC §B.5.4)', () {
    testWidgets(
      'NO determinate progress indicator anywhere (breathe/shimmer only)',
      (tester) async {
        // Cover both ringing and in-progress so neither introduces a bar/spinner.
        for (final turns in [0, 4]) {
          await _pump(
            tester,
            parentName: 'Asha Rao',
            callResult: _calling(turns),
          );

          // A determinate/percentage bar is an automatic FAIL.
          expect(find.byType(LinearProgressIndicator), findsNothing);
          // No spinner at all, and certainly no determinate (value != null) one.
          expect(find.byType(CircularProgressIndicator), findsNothing);
          for (final w in tester.widgetList<CircularProgressIndicator>(
            find.byType(CircularProgressIndicator),
          )) {
            expect(
              w.value,
              isNull,
              reason: 'no determinate progress — honest breathe only',
            );
          }
        }
      },
    );

    testWidgets('reduce-motion renders a static frame — pumpAndSettle returns', (
      tester,
    ) async {
      // _pump disables animations and calls pumpAndSettle; reaching here without
      // a timeout proves the breathe froze (no infinite ticker). The glyph is
      // still composed.
      await _pump(tester, parentName: 'Asha Rao', callResult: _calling(2));
      expect(tester.takeException(), isNull);
      expect(find.byIcon(LucideIcons.phoneCall), findsOneWidget);
    });
  });

  group('contrast + a11y', () {
    testWidgets(
      'exchanges pill count is full-ink onSurface (WCAG AA) with tabular '
      'figures',
      (tester) async {
        await _pump(tester, parentName: 'Asha Rao', callResult: _calling(3));
        final scheme = AppTheme.light().colorScheme;

        final pill = tester.widget<Text>(find.text('3 exchanges'));
        // onSurface on the surfaceContainerHigh pill clears ~14.6:1; the muted
        // onSurfaceVariant role would fail AA at 3.86:1 for this 15sp count.
        expect(pill.style?.color, scheme.onSurface);
        // The tabular figures survive the colour override, so the count never
        // reflows as it grows.
        expect(
          pill.style?.fontFeatures,
          contains(const FontFeature.tabularFigures()),
        );
      },
    );

    testWidgets('the status line is a live region for screen readers', (
      tester,
    ) async {
      await _pump(tester, parentName: 'Asha Rao', callResult: _calling(0));

      final liveRegion = find.byWidgetPredicate(
        (w) => w is Semantics && (w.properties.liveRegion ?? false),
      );
      expect(liveRegion, findsOneWidget);
      // …and it wraps the status line (so the ringing → in-progress change is
      // announced), not the headline.
      expect(
        find.descendant(of: liveRegion, matching: find.text('Ringing…')),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: liveRegion,
          matching: find.text("Calling Asha Rao's parent…"),
        ),
        findsNothing,
      );
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12) — real Indic translations', () {
    // 360dp × textScale 1.3, light + dark, driving the REAL bn/ta strings
    // (headline + status + the dataMedium exchanges pill) at the narrow floor.
    const probes = <(String, Locale, String, String)>[
      ('bn', Locale('bn'), 'রিং হচ্ছে…', 'অভিভাবক'),
      ('ta', Locale('ta'), 'மணி ஒலிக்கிறது…', 'பெற்றோர'),
    ];

    for (final brightness in Brightness.values) {
      for (final (code, locale, ringing, parentWord) in probes) {
        testWidgets(
          'calling stage at 360dp x 1.3 in $code (${brightness.name})',
          (tester) async {
            await _pump(
              tester,
              parentName: 'Asha Rao',
              // Ringing frame; the in-progress + tabular pill floor is covered by
              // the dedicated bn/dark probe below.
              callResult: _calling(0),
              brightness: brightness,
              textScale: 1.3,
              locale: locale,
              surface: const Size(360, 1200),
            );
            expect(tester.takeException(), isNull);
            // The REAL translated status + a real translated headline rendered.
            expect(find.text(ringing), findsOneWidget);
            expect(find.textContaining(parentWord), findsOneWidget);
          },
        );
      }
    }

    testWidgets('in-progress + pill at 360dp x 1.3 in bn (dark)', (
      tester,
    ) async {
      await _pump(
        tester,
        parentName: 'Asha Rao',
        callResult: _calling(4),
        brightness: Brightness.dark,
        textScale: 1.3,
        locale: const Locale('bn'),
        surface: const Size(360, 1200),
      );
      expect(tester.takeException(), isNull);
      expect(
        find.text('কথোপকথন চলছে'),
        findsOneWidget,
      ); // conversation in progress
    });
  });
}
