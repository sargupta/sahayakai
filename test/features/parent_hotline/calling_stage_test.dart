import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/parent_hotline/domain/call_summary.dart';
import 'package:sahayakai/features/parent_hotline/domain/parent_outreach.dart';
import 'package:sahayakai/features/parent_hotline/presentation/widgets/calling_stage.dart';
import 'package:sahayakai/shared/widgets/icon_well.dart';

/// U-PH4 — the `calling` stage as the UX map draws it: the "Call in progress ·
/// m:ss" timer (only from a real placement time), the breathing glyph, the
/// headline, "Speaking {language} · N exchanges so far", the live transcript
/// (only turns the server returned, a speaker tag only when the server said
/// who), the poll-trouble note, and the reassurance. Pins the absence of ANY
/// determinate progress, the reduce-motion still frame, the single live
/// region, and the §12 Indic overflow floor against the REAL translations.

final _placedAt = DateTime(2026, 11, 4, 10);

/// A clock the test moves by hand.
class _Clock {
  _Clock(this.now);
  DateTime now;
  DateTime call() => now;
}

Future<void> _pump(
  WidgetTester tester, {
  String parentName = 'Asha Rao',
  CallResult? callResult,
  String? parentLanguage = 'Kannada',
  DateTime? callStartedAt,
  bool pollTrouble = false,
  _Clock? clock,
  double textScale = 1.0,
  Locale locale = const Locale('en'),
  Size surface = const Size(390, 1400),
}) async {
  tester.view.physicalSize = surface;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
  tester.platformDispatcher.accessibilityFeaturesTestValue =
      const FakeAccessibilityFeatures(disableAnimations: true);
  addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

  final c = clock ?? _Clock(_placedAt);
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
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
                parentLanguage: parentLanguage,
                callStartedAt: callStartedAt,
                pollTrouble: pollTrouble,
                now: c.call,
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

CallResult _calling(int turnCount, {List<TranscriptTurn>? transcript}) =>
    CallResult(
      callStatus: CallStatus.initiated,
      turnCount: turnCount,
      transcript: transcript ?? const [],
    );

TranscriptTurn _turn(TranscriptRole? role, String text) =>
    TranscriptTurn(role: role, text: text, timestamp: '');

void main() {
  group('timer line', () {
    testWidgets('counts from the real placement time and ticks each second', (
      tester,
    ) async {
      final clock = _Clock(_placedAt.add(const Duration(seconds: 75)));
      await _pump(
        tester,
        callResult: _calling(0),
        callStartedAt: _placedAt,
        clock: clock,
      );
      expect(find.text('CALL IN PROGRESS · 1:15'), findsOneWidget);

      clock.now = clock.now.add(const Duration(seconds: 1));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('CALL IN PROGRESS · 1:16'), findsOneWidget);
    });

    testWidgets('a resumed call (no placement time) shows no invented timer', (
      tester,
    ) async {
      await _pump(tester, callResult: _calling(0));
      expect(find.text('CALL IN PROGRESS'), findsOneWidget);
      expect(find.textContaining(':'), findsNothing);
    });

    testWidgets('a clock behind the placement time never shows negative', (
      tester,
    ) async {
      await _pump(
        tester,
        callResult: _calling(0),
        callStartedAt: _placedAt,
        clock: _Clock(_placedAt.subtract(const Duration(seconds: 5))),
      );
      expect(find.text('CALL IN PROGRESS · 0:00'), findsOneWidget);
    });
  });

  group('headline + speaking line', () {
    testWidgets('names the parent and the language in its own script', (
      tester,
    ) async {
      await _pump(tester, callResult: _calling(0));
      expect(find.text("Calling Asha Rao's parent…"), findsOneWidget);
      expect(find.text('Speaking ಕನ್ನಡ'), findsOneWidget);
      expect(find.byType(IconWell), findsOneWidget);
      expect(find.byIcon(LucideIcons.phoneCall), findsOneWidget);
    });

    testWidgets('counts the exchanges the server reported', (tester) async {
      await _pump(tester, callResult: _calling(3));
      expect(find.text('Speaking ಕನ್ನಡ · 3 exchanges so far'), findsOneWidget);
    });

    testWidgets('no language → no speaking line at all', (tester) async {
      await _pump(tester, callResult: _calling(3), parentLanguage: null);
      expect(find.textContaining('Speaking'), findsNothing);
    });

    testWidgets('the reassurance backing the resume path is shown', (
      tester,
    ) async {
      await _pump(tester, callResult: _calling(0));
      expect(
        find.text(
          'You can leave this screen — the summary will be waiting for you.',
        ),
        findsOneWidget,
      );
    });
  });

  group('live transcript', () {
    testWidgets('hidden until the server returns turns', (tester) async {
      await _pump(tester, callResult: _calling(0));
      expect(find.text('LIVE TRANSCRIPT'), findsNothing);
    });

    testWidgets('shows each returned turn with its speaker; an unattributed '
        'turn gets no tag', (tester) async {
      await _pump(
        tester,
        callResult: _calling(
          3,
          transcript: [
            _turn(TranscriptRole.agent, 'Namaskara, this is Asha’s school.'),
            _turn(TranscriptRole.parent, 'Yes, tell me.'),
            _turn(null, 'unclear line'),
          ],
        ),
      );
      expect(find.text('LIVE TRANSCRIPT'), findsOneWidget);
      expect(find.text('Namaskara, this is Asha’s school.'), findsOneWidget);
      expect(find.text('Yes, tell me.'), findsOneWidget);
      expect(find.text('unclear line'), findsOneWidget);
      expect(find.text('AI'), findsOneWidget);
      expect(find.text('Parent'), findsOneWidget);
    });
  });

  testWidgets('poll trouble says so plainly — the call may still be going', (
    tester,
  ) async {
    await _pump(tester, callResult: _calling(0), pollTrouble: true);
    expect(
      find.text(
        "We couldn't check on the call just now. It may still be going — "
        'still trying.',
      ),
      findsOneWidget,
    );
  });

  group('honest waiting', () {
    testWidgets('NO progress indicator anywhere (breathe only)', (
      tester,
    ) async {
      for (final turns in [0, 4]) {
        await _pump(tester, callResult: _calling(turns));
        expect(find.byType(LinearProgressIndicator), findsNothing);
        expect(find.byType(CircularProgressIndicator), findsNothing);
      }
    });

    testWidgets('reduce-motion renders a static frame — pumpAndSettle returns', (
      tester,
    ) async {
      await _pump(tester, callResult: _calling(2));
      expect(tester.takeException(), isNull);
      expect(find.byIcon(LucideIcons.phoneCall), findsOneWidget);
    });
  });

  testWidgets('the timer line is the one live region, not the headline', (
    tester,
  ) async {
    await _pump(tester, callResult: _calling(0));

    final liveRegion = find.byWidgetPredicate(
      (w) => w is Semantics && (w.properties.liveRegion ?? false),
    );
    expect(liveRegion, findsOneWidget);
    expect(
      find.descendant(of: liveRegion, matching: find.text('CALL IN PROGRESS')),
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

  group('overflow gates (DESIGN_RUBRIC §12) — real Indic translations', () {
    for (final code in ['bn', 'ta', 'ml']) {
      testWidgets('calling stage at 360dp x 1.3 in $code', (tester) async {
        final locale = Locale(code);
        await _pump(
          tester,
          callResult: _calling(
            5,
            transcript: [
              _turn(TranscriptRole.agent, 'A long opening line ' * 6),
              _turn(TranscriptRole.parent, 'A long reply ' * 8),
            ],
          ),
          callStartedAt: _placedAt,
          clock: _Clock(_placedAt.add(const Duration(minutes: 12))),
          pollTrouble: true,
          textScale: 1.3,
          locale: locale,
          surface: const Size(360, 2000),
        );
        expect(tester.takeException(), isNull);
        final l10n = lookupAppLocalizations(locale);
        expect(
          find.text(l10n.parentHotlineCallingTitle('Asha Rao')),
          findsOneWidget,
        );
      });
    }
  });
}
