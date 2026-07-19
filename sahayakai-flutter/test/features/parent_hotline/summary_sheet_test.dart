import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/parent_hotline/domain/call_summary.dart';
import 'package:sahayakai/features/parent_hotline/domain/parent_outreach.dart';
import 'package:sahayakai/features/parent_hotline/presentation/parent_hotline_controller.dart';
import 'package:sahayakai/features/parent_hotline/presentation/widgets/summary_sheet.dart';
import 'package:sahayakai/shared/widgets/app_card.dart';
import 'package:sahayakai/shared/widgets/document_sheet.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';

/// U-PH5 — the `summary` stage (SPEC §B.1 stage 6), the pillar HERO. Drives each
/// [HotlineSummaryOutcome] from [CallSummary] / [CallResult] fixtures: the full
/// DocumentSheet payoff (masthead + all present sections, hide-when-empty,
/// follow-up gating, the primary-toned action block, the toned+AA sentiment
/// badge, the collapsible transcript, the dedup-aware footer) and every terminal
/// panel. Also pins the reduce-motion Ink-settle still frame and the §12 Indic
/// overflow floor against the REAL translated chrome.
///
/// Firebase-gated: a real summary needs a real call (the routes 401 in
/// foundation-v1), so the hero is verified here from fixtures — never live.

// ─── WCAG helpers (verify every toned badge label clears AA on its fill) ──────

double _lin(double c) =>
    c <= 0.03928 ? c / 12.92 : math.pow((c + 0.055) / 1.055, 2.4).toDouble();
double _lum(Color c) => 0.2126 * _lin(c.r) + 0.7152 * _lin(c.g) + 0.0722 * _lin(c.b);
double _ratio(Color fg, Color bg) {
  final a = _lum(fg), b = _lum(bg);
  final hi = math.max(a, b), lo = math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

/// Composite a possibly-translucent [fg] over an opaque [bg] (the sheet surface
/// the badge sits on), so the effective fill of a tint badge can be measured.
Color _composite(Color fg, Color bg) {
  final a = fg.a;
  double c(double f, double b) => f * a + b * (1 - a);
  return Color.from(
    alpha: 1,
    red: c(fg.r, bg.r),
    green: c(fg.g, bg.g),
    blue: c(fg.b, bg.b),
  );
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const _transcript = <TranscriptTurn>[
  TranscriptTurn(
    role: TranscriptRole.agent,
    text: 'Hello, I am calling from the school about your child.',
    timestamp: 't1',
  ),
  TranscriptTurn(
    role: TranscriptRole.parent,
    text: 'Yes please, tell me what happened.',
    timestamp: 't2',
  ),
];

CallSummary _summary({
  ParentSentiment sentiment = ParentSentiment.cooperative,
  String parentResponse = 'The parent listened and agreed to help at home.',
  List<String> concerns = const ['Homework has been piling up at home.'],
  List<String> commitments = const ['Will check the school diary each night.'],
  List<String> actions = const ['Share this week revision sheet with the parent.'],
  List<String> guidance = const ['Read together for fifteen minutes a day.'],
  bool followUpNeeded = true,
  String? followUpSuggestion = 'Call again next Friday to check progress.',
}) =>
    CallSummary(
      parentResponse: parentResponse,
      parentConcerns: concerns,
      parentCommitments: commitments,
      actionItemsForTeacher: actions,
      guidanceGiven: guidance,
      parentSentiment: sentiment,
      callQuality: CallQuality.productive,
      followUpNeeded: followUpNeeded,
      followUpSuggestion: followUpSuggestion,
    );

CallResult _summaryResult(
  CallSummary summary, {
  int turnCount = 4,
  int? durationSeconds = 180,
  List<TranscriptTurn> transcript = _transcript,
}) =>
    CallResult(
      callStatus: CallStatus.completed,
      turnCount: turnCount,
      callDurationSeconds: durationSeconds,
      transcript: transcript,
      callSummary: summary,
    );

Future<void> _pump(
  WidgetTester tester, {
  required HotlineSummaryOutcome outcome,
  required CallResult? callResult,
  String studentName = 'Asha Rao',
  OutreachReason? reason = OutreachReason.consecutiveAbsences,
  bool isDedupBlocked = false,
  int? dedupRetryAfterSeconds,
  VoidCallback? onDone,
  VoidCallback? onCallAgain,
  VoidCallback? onRetry,
  VoidCallback? onCopyForWhatsApp,
  Brightness brightness = Brightness.light,
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
              child: SummarySheet(
                outcome: outcome,
                studentName: studentName,
                reason: reason,
                callResult: callResult,
                isDedupBlocked: isDedupBlocked,
                dedupRetryAfterSeconds: dedupRetryAfterSeconds,
                onDone: onDone ?? () {},
                onCallAgain: onCallAgain ?? () {},
                onRetry: onRetry ?? () {},
                onCopyForWhatsApp: onCopyForWhatsApp ?? () {},
              ),
            ),
          ),
        ),
      ),
    ),
  );
  // Reduce-motion → Ink-settle degrades to the composed frame; this must return.
  await tester.pumpAndSettle();
}

// Expected sentiment tone roles (SPEC §B.1) — the label ink and the fill.
Color _expectedInk(ColorScheme s, ParentSentiment sent) => switch (sent) {
      ParentSentiment.grateful ||
      ParentSentiment.cooperative =>
        s.onSecondaryContainer,
      ParentSentiment.concerned ||
      ParentSentiment.confused =>
        s.onPrimaryContainer,
      ParentSentiment.upset => s.onSurface,
      ParentSentiment.indifferent => s.onSurface,
    };

Color _expectedFill(ColorScheme s, ParentSentiment sent, bool dark) =>
    switch (sent) {
      ParentSentiment.grateful ||
      ParentSentiment.cooperative =>
        s.secondaryContainer,
      ParentSentiment.concerned ||
      ParentSentiment.confused =>
        s.primaryContainer,
      ParentSentiment.upset =>
        s.error.withValues(alpha: dark ? 0.22 : 0.12),
      ParentSentiment.indifferent => s.surfaceContainerHigh,
    };

String _sentimentLabel(AppLocalizations l10n, ParentSentiment s) => switch (s) {
      ParentSentiment.cooperative => l10n.parentHotlineSentimentCooperative,
      ParentSentiment.concerned => l10n.parentHotlineSentimentConcerned,
      ParentSentiment.grateful => l10n.parentHotlineSentimentGrateful,
      ParentSentiment.upset => l10n.parentHotlineSentimentUpset,
      ParentSentiment.indifferent => l10n.parentHotlineSentimentIndifferent,
      ParentSentiment.confused => l10n.parentHotlineSentimentConfused,
    };

void main() {
  setUp(() => GoogleFonts.config.allowRuntimeFetching = false);

  final en = lookupAppLocalizations(const Locale('en'));

  // ── The full summary payoff ────────────────────────────────────────────────

  group('full summary (outcome == summary)', () {
    testWidgets('renders the DocumentSheet masthead + every present section',
        (tester) async {
      await _pump(
        tester,
        outcome: HotlineSummaryOutcome.summary,
        callResult: _summaryResult(_summary()),
      );

      // Masthead: saffron eyebrow (uppercased Latin), Fraunces title, meta.
      expect(find.byType(DocumentSheet), findsOneWidget);
      expect(find.text('PARENT CALL · ABSENCES'), findsOneWidget);
      expect(find.text("Asha Rao's parent"), findsOneWidget);

      // Every populated section header (DocumentSheetSection uppercases Latin).
      expect(find.text('WHAT THE PARENT SAID'), findsOneWidget);
      expect(find.text('CONCERNS RAISED'), findsOneWidget);
      expect(find.text('PARENT COMMITMENTS'), findsOneWidget);
      expect(find.text('YOUR ACTION ITEMS'), findsOneWidget);
      expect(find.text('GUIDANCE SHARED'), findsOneWidget);
      expect(find.text('FOLLOW-UP'), findsOneWidget);

      // The prose flows through (server-localized, rendered as-is).
      expect(find.textContaining('listened and agreed'), findsOneWidget);
      // The transcript disclosure is present (2 turns).
      expect(find.text('View conversation · 2 messages'), findsOneWidget);
    });

    testWidgets('the meta shows a duration and an exchanges badge',
        (tester) async {
      await _pump(
        tester,
        outcome: HotlineSummaryOutcome.summary,
        callResult: _summaryResult(_summary(), turnCount: 4, durationSeconds: 180),
      );
      expect(find.text('3 min'), findsOneWidget); // 180s → 3 min
      expect(find.text('4 exchanges'), findsOneWidget);
    });

    testWidgets('empty concerns / commitments / guidance sections are HIDDEN',
        (tester) async {
      await _pump(
        tester,
        outcome: HotlineSummaryOutcome.summary,
        callResult: _summaryResult(
          _summary(
            concerns: const [],
            commitments: const [],
            guidance: const [],
            followUpNeeded: false,
          ),
        ),
      );

      // The always-present sections stay…
      expect(find.text('WHAT THE PARENT SAID'), findsOneWidget);
      expect(find.text('YOUR ACTION ITEMS'), findsOneWidget);
      // …the empty ones vanish entirely (never an empty header).
      expect(find.text('CONCERNS RAISED'), findsNothing);
      expect(find.text('PARENT COMMITMENTS'), findsNothing);
      expect(find.text('GUIDANCE SHARED'), findsNothing);
    });

    testWidgets('FOLLOW-UP shows only when followUpNeeded', (tester) async {
      await _pump(
        tester,
        outcome: HotlineSummaryOutcome.summary,
        callResult: _summaryResult(_summary(followUpNeeded: false)),
      );
      expect(find.text('FOLLOW-UP'), findsNothing);

      await _pump(
        tester,
        outcome: HotlineSummaryOutcome.summary,
        callResult: _summaryResult(
          _summary(
            followUpNeeded: true,
            followUpSuggestion: 'Call again next Friday to check progress.',
          ),
        ),
      );
      expect(find.text('FOLLOW-UP'), findsOneWidget);
      expect(find.textContaining('next Friday'), findsOneWidget);
    });

    testWidgets(
        'the action-items block is the ONE primary-toned block (saffron)',
        (tester) async {
      const action = 'Share this week revision sheet with the parent.';
      await _pump(
        tester,
        outcome: HotlineSummaryOutcome.summary,
        callResult: _summaryResult(_summary(actions: const [action])),
      );
      final scheme = AppTheme.light().colorScheme;

      // The action item prose sits inside a Container tinted with
      // primaryContainer — the saffron block the teacher must act on.
      final tonedBox = find.ancestor(
        of: find.text(action),
        matching: find.byWidgetPredicate(
          (w) =>
              w is Container &&
              w.decoration is BoxDecoration &&
              (w.decoration as BoxDecoration).color == scheme.primaryContainer,
        ),
      );
      expect(tonedBox, findsOneWidget);
      // Each to-do carries the arrow-right glyph.
      expect(find.byIcon(LucideIcons.arrowRight), findsWidgets);
    });
  });

  // ── Sentiment badge: tone per sentiment + WCAG AA on the fill ───────────────

  group('sentiment badge tone + WCAG AA', () {
    for (final brightness in Brightness.values) {
      for (final sentiment in ParentSentiment.values) {
        testWidgets(
            'sentiment ${sentiment.name} (${brightness.name}): correct ink role '
            'and label clears AA 4.5:1 on its fill', (tester) async {
          await _pump(
            tester,
            outcome: HotlineSummaryOutcome.summary,
            callResult: _summaryResult(_summary(sentiment: sentiment)),
            brightness: brightness,
          );
          final scheme = (brightness == Brightness.dark
                  ? AppTheme.dark()
                  : AppTheme.light())
              .colorScheme;

          final label = _sentimentLabel(en, sentiment);
          final labelWidget = tester.widget<Text>(find.text(label));
          final ink = _expectedInk(scheme, sentiment);

          // The label uses the sanctioned full-ink / onXContainer role — never
          // the muted onSurfaceVariant (the U-PH4 3.86:1 trap).
          expect(labelWidget.style?.color, ink,
              reason: 'sentiment ${sentiment.name} label ink role');
          expect(labelWidget.style?.color, isNot(scheme.onSurfaceVariant));

          // …and it clears WCAG AA on its own (composited) fill.
          final fill = _composite(
            _expectedFill(scheme, sentiment, brightness == Brightness.dark),
            scheme.surface,
          );
          final ratio = _ratio(ink, fill);
          expect(ratio, greaterThanOrEqualTo(4.5),
              reason:
                  'sentiment ${sentiment.name} (${brightness.name}) = '
                  '${ratio.toStringAsFixed(2)}:1');
        });
      }
    }
  });

  // ── Transcript agent line: WCAG AA on its fill (the design-review miss) ─────

  group('transcript agent line WCAG AA', () {
    const agentLine = 'Hello, I am calling from the school about your child.';

    for (final brightness in Brightness.values) {
      testWidgets(
          'agent (muted) turn clears AA 4.5:1 on the transcript card '
          '(${brightness.name})', (tester) async {
        await _pump(
          tester,
          outcome: HotlineSummaryOutcome.summary,
          callResult: _summaryResult(_summary(), transcript: _transcript),
          brightness: brightness,
        );
        final scheme = (brightness == Brightness.dark
                ? AppTheme.dark()
                : AppTheme.light())
            .colorScheme;

        // Expand so the agent turn is in the tree.
        await tester.ensureVisible(find.text('View conversation · 2 messages'));
        await tester.tap(find.text('View conversation · 2 messages'));
        await tester.pumpAndSettle();

        // The agent turn renders muted (onSurfaceVariant); the parent turn is
        // full ink — both must stay legible.
        final agent = tester.widget<Text>(find.text(agentLine));
        expect(agent.style?.color, scheme.onSurfaceVariant,
            reason: 'agent turn renders muted');

        // The transcript sits on a FLAT card (surface fill), NOT the inset
        // surfaceContainerLow — that is what lifts the muted line over the AA
        // floor in light (4.70:1 vs the inset's 4.49:1). Guards against a
        // regression back to inset.
        final card = tester
            .widgetList<AppCard>(
              find.ancestor(
                of: find.text(agentLine),
                matching: find.byType(AppCard),
              ),
            )
            .first;
        expect(card.variant, AppCardVariant.flat,
            reason: 'transcript must render on the white surface, not inset');

        // The actual contrast check: muted agent ink on the card surface.
        final ratio = _ratio(scheme.onSurfaceVariant, scheme.surface);
        expect(ratio, greaterThanOrEqualTo(4.5),
            reason: 'agent line on transcript surface (${brightness.name}) = '
                '${ratio.toStringAsFixed(2)}:1');
      });
    }

    testWidgets('regression guard: the inset fill WOULD fail AA in light',
        (tester) async {
      // Pin the exact reason the fix was needed — the muted role on the inset
      // surfaceContainerLow is 4.49:1 (under the floor), while the surface fill
      // clears it — so the transcript must never regress to inset.
      final scheme = AppTheme.light().colorScheme;
      expect(_ratio(scheme.onSurfaceVariant, scheme.surfaceContainerLow),
          lessThan(4.5));
      expect(_ratio(scheme.onSurfaceVariant, scheme.surface),
          greaterThanOrEqualTo(4.5));
    });
  });

  // ── Transcript ExpansionTile ───────────────────────────────────────────────

  group('transcript disclosure', () {
    testWidgets('collapsed by default, expands on tap', (tester) async {
      await _pump(
        tester,
        outcome: HotlineSummaryOutcome.summary,
        callResult: _summaryResult(_summary(), transcript: _transcript),
      );

      // The real ExpansionTile, collapsed → the turns are not in the tree yet.
      expect(find.byType(ExpansionTile), findsOneWidget);
      expect(find.text('View conversation · 2 messages'), findsOneWidget);
      expect(find.textContaining('calling from the school'), findsNothing);

      // Tapping the disclosure reveals the turns.
      await tester.ensureVisible(find.text('View conversation · 2 messages'));
      await tester.tap(find.text('View conversation · 2 messages'));
      await tester.pumpAndSettle();
      expect(find.textContaining('calling from the school'), findsOneWidget);
      expect(find.textContaining('tell me what happened'), findsOneWidget);
      // Agent + parent glyphs.
      expect(find.byIcon(LucideIcons.bot), findsOneWidget);
      expect(find.byIcon(LucideIcons.userCircle), findsOneWidget);
    });

    testWidgets('no transcript → no disclosure', (tester) async {
      await _pump(
        tester,
        outcome: HotlineSummaryOutcome.summary,
        callResult: _summaryResult(_summary(), transcript: const []),
      );
      expect(find.byType(ExpansionTile), findsNothing);
    });
  });

  // ── Footer + dedup countdown ───────────────────────────────────────────────

  group('footer', () {
    testWidgets('Done and Call-again-later fire their callbacks', (tester) async {
      var done = 0, callAgain = 0;
      await _pump(
        tester,
        outcome: HotlineSummaryOutcome.summary,
        callResult: _summaryResult(_summary()),
        onDone: () => done++,
        onCallAgain: () => callAgain++,
      );

      await tester.ensureVisible(find.text('Done'));
      await tester.tap(find.text('Done'));
      expect(done, 1);

      await tester.ensureVisible(find.text('Call again later'));
      await tester.tap(find.text('Call again later'));
      expect(callAgain, 1);
    });

    testWidgets('dedup: "Call again later" is disabled and shows the countdown',
        (tester) async {
      var callAgain = 0;
      await _pump(
        tester,
        outcome: HotlineSummaryOutcome.summary,
        callResult: _summaryResult(_summary()),
        isDedupBlocked: true,
        dedupRetryAfterSeconds: 90,
        onCallAgain: () => callAgain++,
      );

      // The mm:ss countdown replaces the label…
      expect(find.textContaining('1:30'), findsOneWidget);
      expect(find.text('Call again later'), findsNothing);
      // …and the ghost is disabled (no error loop).
      final ghost = tester.widget<TextButton>(
        find.ancestor(
          of: find.textContaining('1:30'),
          matching: find.byType(TextButton),
        ),
      );
      expect(ghost.onPressed, isNull);

      // Done stays available.
      final ghostTapAttempt = callAgain;
      expect(ghostTapAttempt, 0);
    });
  });

  // ── Terminal non-summary states ────────────────────────────────────────────

  group('terminal states', () {
    testWidgets('manual → "Message copied" + a copy affordance', (tester) async {
      var copy = 0;
      await _pump(
        tester,
        outcome: HotlineSummaryOutcome.manual,
        callResult: const CallResult(callStatus: CallStatus.manual),
        onCopyForWhatsApp: () => copy++,
      );
      expect(find.byType(EmptyView), findsOneWidget);
      expect(find.byType(DocumentSheet), findsNothing);
      expect(find.text('Message copied'), findsOneWidget);
      expect(find.textContaining('Paste it in WhatsApp'), findsOneWidget);

      await tester.ensureVisible(find.text('Copy for WhatsApp'));
      await tester.tap(find.text('Copy for WhatsApp'));
      expect(copy, 1);
    });

    for (final (status, line) in const [
      (CallStatus.busy, 'The line was busy'),
      (CallStatus.noAnswer, 'No answer'),
      (CallStatus.failed, "The call couldn't connect"),
    ]) {
      testWidgets('callFailed (${status.name}) → "$line" + Try again + WhatsApp',
          (tester) async {
        var retry = 0, copy = 0;
        await _pump(
          tester,
          outcome: HotlineSummaryOutcome.callFailed,
          callResult: CallResult(callStatus: status),
          onRetry: () => retry++,
          onCopyForWhatsApp: () => copy++,
        );
        expect(find.text(line), findsOneWidget);
        expect(find.byIcon(LucideIcons.phoneOff), findsOneWidget);

        await tester.ensureVisible(find.text('Try again'));
        await tester.tap(find.text('Try again'));
        expect(retry, 1);
        await tester.ensureVisible(find.text('Copy for WhatsApp'));
        await tester.tap(find.text('Copy for WhatsApp'));
        expect(copy, 1);
      });
    }

    testWidgets('endedNoConversation → the "ended too soon" copy', (tester) async {
      await _pump(
        tester,
        outcome: HotlineSummaryOutcome.endedNoConversation,
        callResult: const CallResult(
          callStatus: CallStatus.completed,
          turnCount: 1,
        ),
      );
      expect(find.text('The call ended too soon'), findsOneWidget);
      expect(find.textContaining('before a conversation could happen'),
          findsOneWidget);
      expect(find.byType(DocumentSheet), findsNothing);
    });

    testWidgets('summaryUnavailable → the copy + the transcript below',
        (tester) async {
      await _pump(
        tester,
        outcome: HotlineSummaryOutcome.summaryUnavailable,
        callResult: const CallResult(
          callStatus: CallStatus.completed,
          turnCount: 3,
          transcript: _transcript,
        ),
      );
      expect(find.text("Summary isn't available"), findsOneWidget);
      // The transcript is offered so the teacher still sees the conversation.
      expect(find.byType(ExpansionTile), findsOneWidget);
      expect(find.text('View conversation · 2 messages'), findsOneWidget);
    });

    testWidgets('summaryUnavailable with no transcript → just the copy',
        (tester) async {
      await _pump(
        tester,
        outcome: HotlineSummaryOutcome.summaryUnavailable,
        callResult: const CallResult(
          callStatus: CallStatus.completed,
          turnCount: 0,
        ),
      );
      expect(find.text("Summary isn't available"), findsOneWidget);
      expect(find.byType(ExpansionTile), findsNothing);
    });
  });

  // ── Reduce-motion ──────────────────────────────────────────────────────────

  group('reduce-motion', () {
    testWidgets('Ink-settle renders the final composed frame (settles)',
        (tester) async {
      // _pump disables animations and pumpAndSettles; reaching here without a
      // timeout proves the Ink-settle degraded to the static frame. The whole
      // document is composed.
      await _pump(
        tester,
        outcome: HotlineSummaryOutcome.summary,
        callResult: _summaryResult(_summary()),
      );
      expect(tester.takeException(), isNull);
      expect(find.text("Asha Rao's parent"), findsOneWidget);
      expect(find.text('WHAT THE PARENT SAID'), findsOneWidget);
      expect(find.text('YOUR ACTION ITEMS'), findsOneWidget);
    });
  });

  // ── Overflow gates (DESIGN_RUBRIC §12) — real translated chrome ─────────────

  group('overflow gates — 360dp x 1.3, real Indic chrome + content', () {
    // Realistic same-script summary CONTENT (server-localized; we render as-is)
    // + the REAL translated chrome at the narrow floor, light + dark.
    const probes = <(String, Locale, CallSummary, String)>[
      (
        'bn',
        Locale('bn'),
        CallSummary(
          parentResponse:
              'অভিভাবক মন দিয়ে শুনেছেন এবং বাড়িতে সাহায্য করতে রাজি হয়েছেন।',
          parentConcerns: ['বাড়ির কাজ জমে যাচ্ছে।'],
          parentCommitments: ['প্রতিদিন ডায়েরি দেখবেন।'],
          actionItemsForTeacher: ['এই সপ্তাহের অনুশীলন পত্র পাঠান।'],
          guidanceGiven: ['প্রতিদিন পনেরো মিনিট একসাথে পড়ুন।'],
          parentSentiment: ParentSentiment.grateful,
          callQuality: CallQuality.productive,
          followUpNeeded: true,
          followUpSuggestion: 'আগামী শুক্রবার আবার কল করুন।',
        ),
        'কথোপকথন দেখুন · 2টি বার্তা',
      ),
      (
        'ta',
        Locale('ta'),
        CallSummary(
          parentResponse:
              'பெற்றோர் கவனமாகக் கேட்டு, வீட்டில் உதவ ஒப்புக்கொண்டார்.',
          parentConcerns: ['வீட்டுப்பாடம் தேங்கிவிட்டது.'],
          parentCommitments: ['தினமும் நாட்குறிப்பைப் பார்ப்பேன்.'],
          actionItemsForTeacher: ['இந்த வார பயிற்சித் தாளை அனுப்பவும்.'],
          guidanceGiven: ['தினமும் பதினைந்து நிமிடம் ஒன்றாகப் படியுங்கள்.'],
          parentSentiment: ParentSentiment.upset,
          callQuality: CallQuality.difficult,
          followUpNeeded: true,
          followUpSuggestion: 'அடுத்த வெள்ளிக்கிழமை மீண்டும் அழைக்கவும்.',
        ),
        'உரையாடலைப் பார்க்க · 2 செய்திகள்',
      ),
    ];

    for (final brightness in Brightness.values) {
      for (final (code, locale, summary, transcriptLabel) in probes) {
        testWidgets('full summary at 360dp x 1.3 in $code (${brightness.name})',
            (tester) async {
          await _pump(
            tester,
            outcome: HotlineSummaryOutcome.summary,
            callResult: _summaryResult(summary, transcript: _transcript),
            brightness: brightness,
            textScale: 1.3,
            locale: locale,
            surface: const Size(360, 1600),
          );
          expect(tester.takeException(), isNull);
          // The REAL translated transcript disclosure rendered at the floor.
          expect(find.text(transcriptLabel), findsOneWidget);
        });
      }
    }

    testWidgets('a callFailed terminal at 360dp x 1.3 in ta (dark)',
        (tester) async {
      await _pump(
        tester,
        outcome: HotlineSummaryOutcome.callFailed,
        callResult: const CallResult(callStatus: CallStatus.busy),
        brightness: Brightness.dark,
        textScale: 1.3,
        locale: const Locale('ta'),
        surface: const Size(360, 1400),
      );
      expect(tester.takeException(), isNull);
      // The real Tamil "line was busy" chrome.
      expect(find.text('இணைப்பு பிஸியாக இருந்தது'), findsOneWidget);
    });
  });
}
