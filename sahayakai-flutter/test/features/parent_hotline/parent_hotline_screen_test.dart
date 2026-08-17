import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/auth/auth_providers.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/parent_hotline/data/parent_hotline_repository.dart';
import 'package:sahayakai/features/parent_hotline/domain/call_summary.dart';
import 'package:sahayakai/features/parent_hotline/domain/hotline_student.dart';
import 'package:sahayakai/features/parent_hotline/domain/parent_outreach.dart';
import 'package:sahayakai/features/parent_hotline/presentation/hotline_roster_provider.dart';
import 'package:sahayakai/features/parent_hotline/presentation/parent_hotline_controller.dart';
import 'package:sahayakai/features/parent_hotline/presentation/parent_hotline_screen.dart';
import 'package:sahayakai/features/parent_hotline/presentation/widgets/summary_sheet.dart';
import 'package:sahayakai/features/parent_message/data/parent_message_repository.dart';
import 'package:sahayakai/shared/widgets/app_skeleton.dart';
import 'package:sahayakai/shared/widgets/document_sheet.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';
import 'package:sahayakai/shared/widgets/note_banner.dart';
import 'package:sahayakai/shared/widgets/primary_button.dart';
import 'package:sahayakai/shared/widgets/secondary_button.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'fake_parent_hotline_repositories.dart';

/// U-PH3 — the Parent Hotline screen (stages 1–4 + decision bar).
///
/// Two rigs. Fixed-state facets (gates, dedup, callability, the placeholder
/// stages) are rendered with a [_FakeHotlineController] returning a crafted
/// [ParentHotlineState] — deterministic and timer-free. The happy-path flow
/// (pick → reason → compose → review), the F9-001 mask, and the WhatsApp copy
/// drive the REAL controller over the hand-written fake repositories so the UI
/// transitions are exercised end to end. No test opens a socket; animations are
/// disabled so `pumpAndSettle` returns.

HotlineStudent _student({
  String id = 's1',
  String name = 'Asha Rao',
  String classId = 'c1',
  String className = 'Class 6A',
  String parentLanguage = 'Kannada',
  bool hasParentPhone = true,
  String? parentPhoneLast4 = '4821',
}) => HotlineStudent(
  id: id,
  name: name,
  classId: classId,
  className: className,
  parentLanguage: parentLanguage,
  hasParentPhone: hasParentPhone,
  parentPhoneLast4: parentPhoneLast4,
);

Future<void> _pump(
  WidgetTester tester, {
  List<Override> overrides = const [],
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  Locale locale = const Locale('en'),
  Size surface = const Size(390, 1200),
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
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        theme: brightness == Brightness.dark
            ? AppTheme.dark()
            : AppTheme.light(),
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const ParentHotlineScreen(),
      ),
    ),
  );
  // A shimmering AppSkeleton animates forever, so its states pump one frame
  // (the postFrame init still runs) rather than settling.
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
    await tester.pump();
  }
}

/// Overrides that stand a fixed [state] up behind the screen.
List<Override> _fixed(
  ParentHotlineState state, {
  List<HotlineStudent>? roster,
}) => [
  parentHotlineControllerProvider.overrideWith(
    () => _FakeHotlineController(state),
  ),
  if (roster != null) hotlineStudentRosterProvider.overrideWithValue(roster),
];

Future<void> _tapText(WidgetTester tester, String text) async {
  final finder = find.text(text);
  await tester.ensureVisible(finder);
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  // An in-memory clipboard so the WhatsApp-copy path can be exercised (the real
  // platform channel is absent under flutter_test).
  final clip = <String, Object?>{};
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    clip.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
          if (call.method == 'Clipboard.setData') {
            clip['text'] = (call.arguments as Map)['text'];
          } else if (call.method == 'Clipboard.getData') {
            return <String, Object?>{'text': clip['text']};
          }
          return null;
        });
  });
  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null);
  });

  // ── Stages render (fixed state) ────────────────────────────────────────────

  group('stages render', () {
    testWidgets('pickStudent lists roster rows; a no-phone row is disabled', (
      tester,
    ) async {
      final fake = _FakeHotlineController(const ParentHotlineState());
      await _pump(
        tester,
        overrides: [
          parentHotlineControllerProvider.overrideWith(() => fake),
          hotlineStudentRosterProvider.overrideWithValue([
            _student(),
            _student(
              id: 's2',
              name: 'Bhavya Nair',
              hasParentPhone: false,
              parentPhoneLast4: null,
            ),
          ]),
        ],
      );

      expect(find.text('Asha Rao'), findsOneWidget);
      expect(find.text('Bhavya Nair'), findsOneWidget);
      // The no-phone row carries the server-422 mirror hint.
      expect(find.text('No parent number saved'), findsOneWidget);

      // Tapping the with-phone student wires selectStudent…
      await _tapText(tester, 'Asha Rao');
      expect(fake.studentTaps, ['s1']);
      // …tapping the disabled no-phone student does nothing.
      await _tapText(tester, 'Bhavya Nair');
      expect(fake.studentTaps, ['s1']);
    });

    testWidgets('empty roster while SIGNED OUT shows the sign-in EmptyView '
        '(no faked identity)', (tester) async {
      await _pump(
        tester,
        overrides: [
          parentHotlineControllerProvider.overrideWith(
            () => _FakeHotlineController(const ParentHotlineState()),
          ),
          isSignedInProvider.overrideWithValue(false),
          // Default roster is empty (foundation-v1 has no student-roster API).
        ],
      );
      expect(find.byType(EmptyView), findsOneWidget);
      expect(find.text('Sign in to see your students'), findsOneWidget);
    });

    testWidgets(
      'empty roster while SIGNED IN shows the honest "not available yet" copy, '
      'never a false sign-in prompt',
      (tester) async {
        // The teacher IS authenticated; the roster is empty only because the
        // student-roster API isn't on the app yet (a future unit). Telling them to
        // "sign in" would be a lie — the honest state must own the gap instead.
        await _pump(
          tester,
          overrides: [
            parentHotlineControllerProvider.overrideWith(
              () => _FakeHotlineController(const ParentHotlineState()),
            ),
            isSignedInProvider.overrideWithValue(true),
          ],
        );
        expect(find.byType(EmptyView), findsOneWidget);
        expect(
          find.text("Your class list isn't available yet"),
          findsOneWidget,
        );
        expect(find.textContaining("can't load your students"), findsOneWidget);
        // Crucially, a signed-in teacher is NEVER told to sign in.
        expect(find.text('Sign in to see your students'), findsNothing);
      },
    );

    testWidgets(
      'reason stage renders the four selectable reasons, pre-selected',
      (tester) async {
        final fake = _FakeHotlineController(
          const ParentHotlineState(
            stage: HotlineStage.reason,
            selectedReason: OutreachReason.poorPerformance,
          ),
        );
        await _pump(
          tester,
          overrides: [parentHotlineControllerProvider.overrideWith(() => fake)],
        );

        expect(find.text('Repeated absences'), findsOneWidget);
        expect(find.text('Slipping in a subject'), findsOneWidget);
        expect(find.text('Behaviour in class'), findsOneWidget);
        expect(find.text('Good news to share'), findsOneWidget);

        // Tapping a reason wires selectReason with that exact reason.
        await _tapText(tester, 'Behaviour in class');
        expect(fake.reasonTaps, [OutreachReason.behavioralConcern]);
      },
    );

    testWidgets('compose stage shows the reason-aware evidence + note + CTA', (
      tester,
    ) async {
      await _pump(
        tester,
        overrides: _fixed(
          const ParentHotlineState(
            stage: HotlineStage.compose,
            selectedReason: OutreachReason.behavioralConcern,
          ),
        ),
      );
      expect(find.text('What happened'), findsOneWidget); // evidence header
      expect(find.text('Add a note'), findsOneWidget);
      expect(find.text('Draft the message'), findsOneWidget);
    });

    testWidgets('compose while drafting shows a skeleton, not the CTA', (
      tester,
    ) async {
      await _pump(
        tester,
        overrides: _fixed(
          const ParentHotlineState(
            stage: HotlineStage.compose,
            selectedReason: OutreachReason.poorPerformance,
            isBusy: true,
          ),
        ),
        settle: false, // the skeleton shimmer never settles
      );
      expect(find.byType(AppSkeleton), findsOneWidget);
      expect(find.text('Draft the message'), findsNothing);
    });

    testWidgets('review shows the message, Call, WhatsApp, and the AI notice', (
      tester,
    ) async {
      await _pump(
        tester,
        overrides: _fixed(
          const ParentHotlineState(
            stage: HotlineStage.review,
            parentLanguage: 'Kannada',
            draftedMessage: 'Namaste, Asha ke baare mein baat karni thi.',
          ),
        ),
      );
      expect(find.textContaining('Namaste'), findsOneWidget);
      expect(find.text('Call parent'), findsOneWidget);
      expect(find.text('Copy for WhatsApp'), findsOneWidget);
      expect(find.textContaining('automated AI voice notice'), findsOneWidget);
    });

    testWidgets(
      'the decision bar is pinned in the footer, not the scroll body',
      (tester) async {
        await _pump(
          tester,
          overrides: _fixed(
            const ParentHotlineState(
              stage: HotlineStage.review,
              parentLanguage: 'Kannada',
              draftedMessage: 'Message body',
            ),
          ),
        );

        // The CTAs are on screen…
        expect(find.text('Copy for WhatsApp'), findsOneWidget);
        expect(find.text('Call parent'), findsOneWidget);
        // …but pinned in the Scaffold footer, NOT scrolling inside the body's
        // SingleChildScrollView (so they never fall below the fold).
        final scrollBody = find.byType(SingleChildScrollView);
        expect(
          find.descendant(
            of: scrollBody,
            matching: find.text('Copy for WhatsApp'),
          ),
          findsNothing,
          reason:
              'the decision bar must be a sticky footer, not scroll content',
        );
        expect(
          find.descendant(of: scrollBody, matching: find.text('Call parent')),
          findsNothing,
        );
      },
    );
  });

  // ── Callability + dedup ────────────────────────────────────────────────────

  group('callability + dedup', () {
    testWidgets(
      '!canAutoCall hides Call and shows the WhatsApp fallback banner',
      (tester) async {
        await _pump(
          tester,
          overrides: _fixed(
            const ParentHotlineState(
              stage: HotlineStage.review,
              parentLanguage: 'Odia',
              canAutoCall: false,
              draftedMessage: 'Message body',
            ),
          ),
        );
        expect(find.text('Call parent'), findsNothing);
        expect(find.byType(PrimaryButton), findsNothing);
        expect(find.text('Copy for WhatsApp'), findsOneWidget);
        expect(find.byType(NoteBanner), findsOneWidget);
        expect(
          find.textContaining("Auto-call isn't available for Odia"),
          findsOneWidget,
        );
      },
    );

    testWidgets('dedup countdown disables Call but NOT WhatsApp copy', (
      tester,
    ) async {
      await _pump(
        tester,
        overrides: _fixed(
          const ParentHotlineState(
            stage: HotlineStage.review,
            parentLanguage: 'Kannada',
            canAutoCall: true,
            draftedMessage: 'Message body',
            dedupRetryAfterSeconds: 90,
          ),
        ),
      );

      // Call shows the mm:ss countdown and is disabled…
      expect(find.textContaining('1:30'), findsOneWidget);
      final call = tester.widget<PrimaryButton>(find.byType(PrimaryButton));
      expect(
        call.onPressed,
        isNull,
        reason: 'Call is blocked by the cool-down',
      );

      // …WhatsApp copy stays available (the universal fallback).
      final whatsApp = tester.widget<SecondaryButton>(
        find.widgetWithText(SecondaryButton, 'Copy for WhatsApp'),
      );
      expect(whatsApp.onPressed, isNotNull);
    });
  });

  // ── Terminal gates ─────────────────────────────────────────────────────────

  group('gates', () {
    testWidgets('signed-out replaces the flow with the sign-in EmptyView', (
      tester,
    ) async {
      await _pump(
        tester,
        overrides: _fixed(
          const ParentHotlineState(error: HotlineError.signedOut),
        ),
      );
      expect(find.byType(EmptyView), findsOneWidget);
      expect(find.textContaining('Sign in'), findsWidgets);
      expect(find.text('Call parent'), findsNothing);
    });

    testWidgets('premium-gated shows the dignified advanced-plan panel', (
      tester,
    ) async {
      await _pump(
        tester,
        overrides: _fixed(
          const ParentHotlineState(error: HotlineError.premiumRequired),
        ),
      );
      expect(
        find.text('Parent Hotline needs an advanced plan'),
        findsOneWidget,
      );
    });

    testWidgets('the calling stage renders the U-PH4 breathing waiting state', (
      tester,
    ) async {
      await _pump(
        tester,
        overrides: _fixed(
          const ParentHotlineState(
            stage: HotlineStage.calling,
            studentName: 'Asha Rao',
            callResult: CallResult(callStatus: CallStatus.initiated),
          ),
        ),
      );
      // The real waiting state, not the placeholder.
      expect(find.text("Calling Asha Rao's parent…"), findsOneWidget);
      expect(find.text('Ringing…'), findsOneWidget);
      expect(find.text('The call view is on its way'), findsNothing);
    });

    testWidgets('the summary stage renders the U-PH5 SummarySheet, not the '
        'placeholder', (tester) async {
      // A summary stage with no callResult resolves to the endedNoConversation
      // terminal — the real U-PH5 widget, not the old "coming soon" placeholder.
      await _pump(
        tester,
        overrides: _fixed(
          const ParentHotlineState(
            stage: HotlineStage.summary,
            studentName: 'Asha Rao',
          ),
        ),
      );
      expect(find.byType(SummarySheet), findsOneWidget);
      expect(find.text('The call ended too soon'), findsOneWidget);
      expect(find.text('The call view is on its way'), findsNothing);
    });

    testWidgets('the summary stage renders the full DocumentSheet when the AI '
        'summary landed', (tester) async {
      await _pump(
        tester,
        overrides: _fixed(
          ParentHotlineState(
            stage: HotlineStage.summary,
            studentName: 'Asha Rao',
            selectedReason: OutreachReason.consecutiveAbsences,
            callResult: const CallResult(
              callStatus: CallStatus.completed,
              turnCount: 4,
              callDurationSeconds: 120,
              callSummary: CallSummary(
                parentResponse: 'The parent understood and will help at home.',
                actionItemsForTeacher: ['Share the weekly plan.'],
                parentSentiment: ParentSentiment.cooperative,
                callQuality: CallQuality.productive,
              ),
            ),
          ),
        ),
      );
      expect(find.byType(DocumentSheet), findsOneWidget);
      expect(find.text("Asha Rao's parent"), findsOneWidget);
      expect(find.textContaining('understood'), findsOneWidget);
    });

    testWidgets(
      'leaving the calling screen (back/pop) stops polling via leaveCalling '
      '— the call itself is not cancelled (SPEC §B.5.5)',
      (tester) async {
        final fake = _FakeHotlineController(
          const ParentHotlineState(
            stage: HotlineStage.calling,
            studentName: 'Asha Rao',
            callResult: CallResult(callStatus: CallStatus.initiated),
          ),
        );
        await _pump(
          tester,
          overrides: [parentHotlineControllerProvider.overrideWith(() => fake)],
        );
        expect(fake.leaveCallingCount, 0);

        // Simulate the back affordance popping the screen. leaveCalling stops the
        // poll loop only; it never cancels the server-side call (that guarantee is
        // pinned in parent_hotline_controller_test.dart).
        final popScope =
            tester.widget(find.byKey(const Key('parentHotlinePopScope')))
                as PopScope;
        popScope.onPopInvokedWithResult?.call(true, null);
        expect(fake.leaveCallingCount, 1);
      },
    );
  });

  // ── Interactive flow (real controller over fake repositories) ───────────────

  group('flow: pick → reason → compose → review', () {
    late FakeParentHotlineRepository hotline;
    late FakeParentMessageRepository messages;

    List<Override> flowOverrides({
      List<HotlineStudent>? roster,
      CallabilityPolicy? policy,
    }) => [
      parentHotlineRepositoryProvider.overrideWithValue(hotline),
      parentMessageRepositoryProvider.overrideWithValue(messages),
      hotlineStudentRosterProvider.overrideWithValue(roster ?? [_student()]),
      if (policy != null) callabilityPolicyProvider.overrideWithValue(policy),
    ];

    setUp(() {
      hotline = FakeParentHotlineRepository();
      messages = FakeParentMessageRepository(
        message: 'Namaste, Asha ke baare mein baat karni thi.',
      );
    });

    Future<void> driveToReview(
      WidgetTester tester, {
      CallabilityPolicy? policy,
    }) async {
      await _pump(
        tester,
        overrides: flowOverrides(policy: policy),
        surface: const Size(390, 1400),
      );
      await _tapText(tester, 'Asha Rao'); // pick → reason
      await _tapText(tester, 'Slipping in a subject'); // reason → compose
      await _tapText(tester, 'Draft the message'); // compose → review
    }

    testWidgets('tapping a student advances to the reason stage', (
      tester,
    ) async {
      await _pump(tester, overrides: flowOverrides());
      expect(find.text('Asha Rao'), findsOneWidget);

      await _tapText(tester, 'Asha Rao');
      // The four reasons are now on screen.
      expect(find.text('Repeated absences'), findsOneWidget);
      expect(find.text('Good news to share'), findsOneWidget);
    });

    testWidgets(
      'choosing a reason advances to compose (evidence + draft CTA)',
      (tester) async {
        await _pump(tester, overrides: flowOverrides());
        await _tapText(tester, 'Asha Rao');
        await _tapText(tester, 'Slipping in a subject');

        expect(find.text('Recent marks'), findsOneWidget); // evidence header
        expect(find.text('Draft the message'), findsOneWidget);
      },
    );

    testWidgets('drafting advances to review and shows the drafted message', (
      tester,
    ) async {
      await driveToReview(tester);
      expect(find.textContaining('Namaste'), findsOneWidget);
      expect(find.text('Call parent'), findsOneWidget);
      // One draft request went out with the reason wire token.
      expect(messages.requests, hasLength(1));
      expect(messages.requests.single.reason.wire, 'poor_performance');
    });

    testWidgets(
      'F9-001: the review meta shows the masked last-4 and never a full number',
      (tester) async {
        await driveToReview(tester);

        // The pre-masked fragment is shown…
        expect(find.text('•••• 4821'), findsOneWidget);
        // …and NO rendered text anywhere contains a 5+ digit run (a real phone).
        final longDigits = RegExp(r'\d{5,}');
        for (final t in tester.widgetList<Text>(find.byType(Text))) {
          final data = t.data;
          if (data != null) {
            expect(
              longDigits.hasMatch(data),
              isFalse,
              reason: 'no full phone number may be rendered (F9-001): "$data"',
            );
          }
        }
      },
    );

    testWidgets(
      'Copy for WhatsApp persists a whatsapp_copy outreach + confirms',
      (tester) async {
        await driveToReview(tester);
        await _tapText(tester, 'Copy for WhatsApp');

        expect(hotline.createRequests, isNotEmpty);
        expect(
          hotline.createRequests.last.toJson()['deliveryMethod'],
          'whatsapp_copy',
        );
        // The client also copies the text to the clipboard for the paste.
        final clip = await Clipboard.getData(Clipboard.kTextPlain);
        expect(clip?.text, contains('Namaste'));
      },
    );

    testWidgets('an uncallable language hides Call at review, keeps WhatsApp', (
      tester,
    ) async {
      // A policy that only allows English → the Kannada student is not callable.
      await driveToReview(tester, policy: const CallabilityPolicy({'english'}));

      expect(find.byType(PrimaryButton), findsNothing); // no Call
      expect(find.text('Copy for WhatsApp'), findsOneWidget);
      expect(find.byType(NoteBanner), findsOneWidget);
    });
  });

  // ── Overflow gates (DESIGN_RUBRIC §12) ─────────────────────────────────────

  group('overflow gates', () {
    // The review chrome is now fully translated, so each probe exercises real
    // Indic buttons / banners / meta at the 360dp × 1.3 floor with a same-script
    // parent message (bn/ta from the review, te/ml added per review).
    const reviewProbes = <(String, String, String)>[
      (
        'bn',
        'Bengali',
        'নমস্কার, আপনার সন্তানের ক্লাসে উপস্থিতি নিয়ে কথা বলতে চেয়েছিলাম।',
      ),
      (
        'ta',
        'Tamil',
        'வணக்கம், உங்கள் பிள்ளையின் வகுப்பு வருகை குறித்து பேச விரும்பினேன்.',
      ),
      (
        'te',
        'Telugu',
        'నమస్కారం, మీ పిల్లల తరగతి హాజరు గురించి మాట్లాడాలనుకుంటున్నాను.',
      ),
      (
        'ml',
        'Malayalam',
        'നമസ്കാരം, നിങ്ങളുടെ കുട്ടിയുടെ ക്ലാസ് ഹാജരിനെക്കുറിച്ച് സംസാരിക്കാൻ ആഗ്രഹിച്ചു.',
      ),
    ];

    for (final brightness in Brightness.values) {
      for (final (code, language, message) in reviewProbes) {
        testWidgets(
          'review chrome at 360dp x 1.3 in $code (${brightness.name})',
          (tester) async {
            await _pump(
              tester,
              overrides: _fixed(
                ParentHotlineState(
                  stage: HotlineStage.review,
                  parentLanguage: language,
                  canAutoCall: true,
                  draftedMessage: message,
                ),
              ),
              brightness: brightness,
              textScale: 1.3,
              locale: Locale(code),
              surface: const Size(360, 1200),
            );
            expect(tester.takeException(), isNull);
          },
        );
      }

      testWidgets('reason stage at 360dp x 1.3, Tamil (${brightness.name})', (
        tester,
      ) async {
        await _pump(
          tester,
          overrides: _fixed(
            const ParentHotlineState(stage: HotlineStage.reason),
          ),
          brightness: brightness,
          textScale: 1.3,
          locale: const Locale('ta'),
          surface: const Size(360, 1200),
        );
        expect(tester.takeException(), isNull);
      });
    }
  });
}

/// A fixed-state [ParentHotlineController] for rendering one stage / facet in
/// isolation. `build()` returns the crafted state and every intent is inert or
/// records the tap, so the screen paints deterministically and no repository is
/// touched (mirrors the vidya_home_screen_test fake).
class _FakeHotlineController extends ParentHotlineController {
  _FakeHotlineController(this._state);

  final ParentHotlineState _state;

  final List<String> studentTaps = [];
  final List<OutreachReason> reasonTaps = [];
  int leaveCallingCount = 0;

  @override
  ParentHotlineState build() => _state;

  @override
  void leaveCalling() => leaveCallingCount++;

  @override
  Future<void> init({
    String? studentId,
    String? studentName,
    String? classId,
    String? className,
    String? parentLanguage,
    String? subject,
    OutreachReason? suggestedReason,
  }) async {}

  @override
  void selectStudent({
    required String studentId,
    required String studentName,
    required String classId,
    required String className,
    required String parentLanguage,
    String? subject,
    OutreachReason? suggestedReason,
  }) {
    studentTaps.add(studentId);
  }

  @override
  void selectReason(OutreachReason reason) => reasonTaps.add(reason);

  @override
  void updateNote(String note) {}

  @override
  Future<void> draftMessage({
    int? consecutiveAbsentDays,
    Map<String, dynamic>? performanceContext,
  }) async {}

  @override
  Future<void> createAndCall() async {}

  @override
  Future<void> copyForWhatsApp() async {}
}
