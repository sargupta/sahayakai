import 'dart:async';

// fake_async ships transitively via flutter_test; imported directly to drive the
// poll cadence under fake time without real delays (pubspec is out of scope).
// ignore: depend_on_referenced_packages
import 'package:fake_async/fake_async.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/parent_hotline/data/parent_hotline_errors.dart';
import 'package:sahayakai/features/parent_hotline/data/parent_hotline_repository.dart';
import 'package:sahayakai/features/parent_hotline/domain/call_summary.dart';
import 'package:sahayakai/features/parent_hotline/domain/parent_outreach.dart';
import 'package:sahayakai/features/parent_hotline/presentation/parent_hotline_controller.dart';
import 'package:sahayakai/features/parent_message/data/parent_message_repository.dart';

import 'fake_parent_hotline_repositories.dart';

/// U-PH2 — the Parent Hotline state machine + poll discipline + resume.
///
/// Fake time drives the poll cadence (`package:fake_async`) so nothing waits on
/// real seconds; hand-written fakes stand in for the two repositories so nothing
/// opens a socket. Each test pins a rule from SPEC §B.3 / §B.5.
void main() {
  // ── shared builders ──

  CallResult initiated({int turnCount = 1, List<TranscriptTurn>? transcript}) =>
      CallResult(
        callStatus: CallStatus.initiated,
        turnCount: turnCount,
        transcript:
            transcript ??
            const [
              TranscriptTurn(
                role: TranscriptRole.agent,
                text: 'Namaste.',
                timestamp: 't0',
              ),
            ],
      );

  CallResult completedWithSummary() => const CallResult(
    callStatus: CallStatus.completed,
    callDurationSeconds: 132,
    turnCount: 4,
    transcript: [
      TranscriptTurn(
        role: TranscriptRole.agent,
        text: 'Namaste.',
        timestamp: 't0',
      ),
      TranscriptTurn(
        role: TranscriptRole.parent,
        text: 'Haan ji.',
        timestamp: 't1',
      ),
    ],
    callSummary: CallSummary(
      parentResponse: 'Grateful and engaged.',
      actionItemsForTeacher: ['Share worksheets'],
      parentSentiment: ParentSentiment.grateful,
      callQuality: CallQuality.productive,
    ),
  );

  CallResult completedNoSummary({
    int turnCount = 4,
    List<TranscriptTurn>? transcript,
  }) => CallResult(
    callStatus: CallStatus.completed,
    turnCount: turnCount,
    transcript:
        transcript ??
        const [
          TranscriptTurn(
            role: TranscriptRole.agent,
            text: 'Namaste.',
            timestamp: 't0',
          ),
          TranscriptTurn(
            role: TranscriptRole.parent,
            text: 'Haan.',
            timestamp: 't1',
          ),
        ],
  );

  ProviderContainer makeContainer({
    required FakeParentHotlineRepository hotline,
    FakeParentMessageRepository? messages,
    CallabilityPolicy? policy,
  }) {
    final container = ProviderContainer(
      overrides: [
        parentHotlineRepositoryProvider.overrideWithValue(hotline),
        parentMessageRepositoryProvider.overrideWithValue(
          messages ?? FakeParentMessageRepository(),
        ),
        if (policy != null) callabilityPolicyProvider.overrideWithValue(policy),
      ],
    );
    // A test may dispose the container early (to prove cancel-on-dispose); guard
    // the teardown so the second dispose is a no-op rather than a throw.
    addTearDown(() {
      try {
        container.dispose();
      } catch (_) {}
    });
    return container;
  }

  /// Drives the flow to the `review` stage with a drafted message ready to call.
  void driveToReview(
    FakeAsync async,
    ProviderContainer container, {
    String parentLanguage = 'Kannada',
  }) {
    final ctrl = container.read(parentHotlineControllerProvider.notifier);
    ctrl.selectStudent(
      studentId: 's1',
      studentName: 'Asha',
      classId: 'c1',
      className: 'Class 6A',
      parentLanguage: parentLanguage,
      subject: 'Mathematics',
    );
    ctrl.selectReason(OutreachReason.poorPerformance);
    unawaited(ctrl.draftMessage());
    async.flushMicrotasks();
  }

  // ── 1. Fresh flow + pinned cadence ──

  test('fresh flow: first poll at 3s, second at +5s, then summary', () {
    fakeAsync((async) {
      final hotline = FakeParentHotlineRepository(
        pollResults: [initiated(), completedWithSummary()],
      );
      final container = makeContainer(hotline: hotline);
      final ctrl = container.read(parentHotlineControllerProvider.notifier);

      driveToReview(async, container);
      expect(
        container.read(parentHotlineControllerProvider).stage,
        HotlineStage.review,
      );
      expect(
        container.read(parentHotlineControllerProvider).draftedMessage,
        isNotNull,
      );

      unawaited(ctrl.createAndCall());
      async.flushMicrotasks(); // create + place resolve → calling
      expect(
        container.read(parentHotlineControllerProvider).stage,
        HotlineStage.calling,
      );
      expect(hotline.pollCount, 0, reason: 'no poll before the 3s delay');

      async.elapse(const Duration(seconds: 2));
      expect(hotline.pollCount, 0, reason: 'the FIRST poll must wait 3s');

      async.elapse(const Duration(seconds: 1)); // t = 3s
      expect(hotline.pollCount, 1, reason: 'the FIRST poll fires at 3s');
      final s1 = container.read(parentHotlineControllerProvider);
      expect(s1.stage, HotlineStage.calling);
      expect(s1.callResult!.callStatus, CallStatus.initiated);
      expect(s1.callResult!.transcript, hasLength(1));

      async.elapse(const Duration(seconds: 4)); // t = 7s
      expect(hotline.pollCount, 1, reason: 'the SECOND poll is +5s, not +4s');

      async.elapse(const Duration(seconds: 1)); // t = 8s
      expect(hotline.pollCount, 2, reason: 'the SECOND poll fires at +5s');
      final s2 = container.read(parentHotlineControllerProvider);
      expect(s2.stage, HotlineStage.summary);
      expect(s2.summaryOutcome, HotlineSummaryOutcome.summary);
      expect(s2.callResult!.callSummary, isNotNull);
    });
  });

  // ── 2. Terminal-without-summary → summary-wait cadence → exhaustion ──

  test('completed without summary switches to 3s cadence and exhausts', () {
    fakeAsync((async) {
      final hotline = FakeParentHotlineRepository(
        pollResults: [
          completedNoSummary(),
        ], // repeats: always completed, no summary
      );
      final container = makeContainer(hotline: hotline);
      final ctrl = container.read(parentHotlineControllerProvider.notifier);

      driveToReview(async, container);
      unawaited(ctrl.createAndCall());
      async.flushMicrotasks();

      async.elapse(const Duration(seconds: 3)); // wait #1 (terminal detected)
      expect(hotline.pollCount, 1);
      expect(
        container.read(parentHotlineControllerProvider).stage,
        HotlineStage.calling,
        reason: 'still waiting for the summary',
      );

      // Seven more 3s waits (waits #2..#8) → exhaustion at #8.
      async.elapse(const Duration(seconds: 3 * 7));
      expect(hotline.pollCount, kMaxSummaryWaits);
      final s = container.read(parentHotlineControllerProvider);
      expect(s.stage, HotlineStage.summary);
      expect(
        s.summaryOutcome,
        HotlineSummaryOutcome.summaryUnavailable,
        reason: 'a transcript exists but no summary',
      );
    });
  });

  test('a terminal FAILURE (busy) leaves calling on the FIRST poll, not after '
      'the summary-wait window', () {
    fakeAsync((async) {
      // The first poll returns a terminal `busy` with no summary. A busy /
      // no_answer / failed call never produces a summary, so the controller must
      // flip to the summary stage's honest `callFailed` outcome AT ONCE — never
      // sit on the calling stage (which would falsely read "Conversation in
      // progress") for the ~24s summary-wait window the web modal also skips.
      final hotline = FakeParentHotlineRepository(
        pollResults: [const CallResult(callStatus: CallStatus.busy)],
      );
      final container = makeContainer(hotline: hotline);
      final ctrl = container.read(parentHotlineControllerProvider.notifier);

      driveToReview(async, container);
      unawaited(ctrl.createAndCall());
      async.flushMicrotasks();

      async.elapse(const Duration(seconds: 3)); // the FIRST poll fires
      expect(hotline.pollCount, 1);
      final s = container.read(parentHotlineControllerProvider);
      expect(
        s.stage,
        HotlineStage.summary,
        reason: 'a terminal failure flips immediately, not after 8 waits',
      );
      expect(s.summaryOutcome, HotlineSummaryOutcome.callFailed);

      // …and polling has STOPPED — no summary-wait window is burned on a call
      // that can never produce a summary.
      async.elapse(const Duration(seconds: 3 * kMaxSummaryWaits));
      expect(
        hotline.pollCount,
        1,
        reason: 'a failed call is terminal — the poll loop is done',
      );
    });
  });

  test('poll-exhausted with no conversation → endedNoConversation', () {
    fakeAsync((async) {
      final hotline = FakeParentHotlineRepository(
        pollResults: [
          const CallResult(callStatus: CallStatus.completed, turnCount: 1),
        ],
      );
      final container = makeContainer(hotline: hotline);
      final ctrl = container.read(parentHotlineControllerProvider.notifier);

      driveToReview(async, container);
      unawaited(ctrl.createAndCall());
      async.flushMicrotasks();

      async.elapse(const Duration(seconds: 3 * kMaxSummaryWaits));
      final s = container.read(parentHotlineControllerProvider);
      expect(s.stage, HotlineStage.summary);
      expect(s.summaryOutcome, HotlineSummaryOutcome.endedNoConversation);
    });
  });

  test(
    'NIT-1: turnCount==1 with a lone-greeting transcript → endedNoConversation',
    () {
      fakeAsync((async) {
        // A completed, no-summary call with only the agent's opening line: the
        // SPEC's turnCount<2 rule must win over the transcript-present rule.
        final hotline = FakeParentHotlineRepository(
          pollResults: [
            const CallResult(
              callStatus: CallStatus.completed,
              turnCount: 1,
              transcript: [
                TranscriptTurn(
                  role: TranscriptRole.agent,
                  text: 'Namaste.',
                  timestamp: 't0',
                ),
              ],
            ),
          ],
        );
        final container = makeContainer(hotline: hotline);
        final ctrl = container.read(parentHotlineControllerProvider.notifier);

        driveToReview(async, container);
        unawaited(ctrl.createAndCall());
        async.flushMicrotasks();
        async.elapse(const Duration(seconds: 3 * kMaxSummaryWaits));

        expect(
          container.read(parentHotlineControllerProvider).summaryOutcome,
          HotlineSummaryOutcome.endedNoConversation,
          reason: 'turnCount<2 beats transcript-present (SPEC §B.1 ordering)',
        );
      });
    },
  );

  // ── 3. Cancel on dispose (the guard is load-bearing) ──

  test('disposing WITH a poll in flight: the post-await guard blocks re-entry', () {
    fakeAsync((async) {
      // The gate holds poll #1 suspended (after pollCount was bumped, before the
      // result resolves) precisely while we dispose. The result is `initiated`,
      // so IF the `_disposed || gen != _pollGen` guard in `_poll` were removed,
      // the continuation would `_schedulePoll` a new timer post-dispose and
      // `elapse(30s)` would drive pollCount past 1. The guard is what freezes it.
      final gate = Completer<void>();
      final hotline = FakeParentHotlineRepository(
        pollResults: [initiated()],
        pollGate: gate,
      );
      final container = makeContainer(hotline: hotline);
      final ctrl = container.read(parentHotlineControllerProvider.notifier);

      var emissions = 0;
      container.listen(parentHotlineControllerProvider, (_, _) => emissions++);

      driveToReview(async, container);
      unawaited(ctrl.createAndCall());
      async.flushMicrotasks();

      async.elapse(
        const Duration(seconds: 3),
      ); // poll #1 fires → suspends on the gate
      async.flushMicrotasks();
      expect(hotline.pollCount, 1, reason: 'poll #1 is IN FLIGHT (awaiting)');
      final emissionsBeforeDispose = emissions;

      container.dispose(); // dispose WHILE poll #1 is awaiting the repository

      gate.complete(); // the in-flight pollSummary now resolves, post-dispose
      async.flushMicrotasks(); // its continuation runs → must hit the guard
      async.elapse(const Duration(seconds: 30)); // no rescheduled poll may fire

      expect(
        hotline.pollCount,
        1,
        reason: 'the guarded continuation must not reschedule a poll',
      );
      expect(
        emissions,
        emissionsBeforeDispose,
        reason: 'no state may be emitted after dispose',
      );
    });
  });

  // ── 4. Leave calling stops polling; re-enter resumes ──

  test('leaveCalling stops polling without error; init re-binds and resumes', () {
    fakeAsync((async) {
      final hotline = FakeParentHotlineRepository(
        // Once resumed, latestForStudent hands back an in-flight call to re-bind.
        latest: LatestOutreach(outreachId: 'o-1', result: initiated()),
      );
      final container = makeContainer(hotline: hotline);
      final ctrl = container.read(parentHotlineControllerProvider.notifier);

      driveToReview(async, container);
      unawaited(ctrl.createAndCall());
      async.flushMicrotasks();

      async.elapse(const Duration(seconds: 3)); // poll #1
      expect(hotline.pollCount, 1);

      ctrl.leaveCalling();
      async.elapse(const Duration(seconds: 30));
      expect(hotline.pollCount, 1, reason: 'leaving calling stops polling');
      expect(
        container.read(parentHotlineControllerProvider).error,
        HotlineError.none,
        reason: 'leaving is not an error',
      );
      expect(
        container.read(parentHotlineControllerProvider).stage,
        HotlineStage.calling,
        reason: 'the call itself is not cancelled',
      );

      unawaited(ctrl.init(studentId: 's1', parentLanguage: 'Kannada'));
      async.flushMicrotasks(); // latestForStudent resolves → re-bind
      expect(
        container.read(parentHotlineControllerProvider).stage,
        HotlineStage.calling,
      );
      expect(hotline.latestQueries, contains('s1'));

      async.elapse(const Duration(seconds: 3)); // resumed poll fires
      expect(hotline.pollCount, 2, reason: 'polling resumed on re-entry');
    });
  });

  // ── 5. Resume cases a / b / c ──

  test('resume (a): terminal + summary → jump straight to summary', () {
    fakeAsync((async) {
      final hotline = FakeParentHotlineRepository(
        latest: LatestOutreach(
          outreachId: 'o-a',
          result: completedWithSummary(),
        ),
      );
      final container = makeContainer(hotline: hotline);
      final ctrl = container.read(parentHotlineControllerProvider.notifier);

      unawaited(ctrl.init(studentId: 's1', parentLanguage: 'Kannada'));
      async.flushMicrotasks();

      final s = container.read(parentHotlineControllerProvider);
      expect(s.stage, HotlineStage.summary);
      expect(s.outreachId, 'o-a');
      expect(s.summaryOutcome, HotlineSummaryOutcome.summary);
      expect(
        hotline.pollCount,
        0,
        reason: 'a settled summary needs no polling',
      );
      // Nothing should ever poll from here.
      async.elapse(const Duration(seconds: 30));
      expect(hotline.pollCount, 0);
    });
  });

  test('resume (b): initiated → resume calling and re-bind polling', () {
    fakeAsync((async) {
      final hotline = FakeParentHotlineRepository(
        latest: LatestOutreach(outreachId: 'o-b', result: initiated()),
      );
      final container = makeContainer(hotline: hotline);
      final ctrl = container.read(parentHotlineControllerProvider.notifier);

      unawaited(ctrl.init(studentId: 's1', parentLanguage: 'Kannada'));
      async.flushMicrotasks();

      final s = container.read(parentHotlineControllerProvider);
      expect(s.stage, HotlineStage.calling);
      expect(s.outreachId, 'o-b');
      expect(
        hotline.createRequests,
        isEmpty,
        reason: 'resume never re-creates',
      );
      expect(hotline.placeCalls, isEmpty, reason: 'resume never re-dials');

      async.elapse(const Duration(seconds: 3));
      expect(hotline.pollCount, 1, reason: 'polling re-bound to o-b');
    });
  });

  test(
    'resume (c): nothing → fresh flow (reason w/ student, else pickStudent)',
    () {
      fakeAsync((async) {
        final hotline = FakeParentHotlineRepository(latest: null);
        final container = makeContainer(hotline: hotline);
        final ctrl = container.read(parentHotlineControllerProvider.notifier);

        unawaited(ctrl.init(studentId: 's1', parentLanguage: 'Kannada'));
        async.flushMicrotasks();
        expect(
          container.read(parentHotlineControllerProvider).stage,
          HotlineStage.reason,
        );

        unawaited(ctrl.init()); // no student → the picker
        async.flushMicrotasks();
        expect(
          container.read(parentHotlineControllerProvider).stage,
          HotlineStage.pickStudent,
        );
      });
    },
  );

  // ── 6. Dedup countdown blocks callAgain until elapsed ──

  test('dedup 429 → 120s countdown; callAgain blocked until it elapses', () {
    fakeAsync((async) {
      final hotline = FakeParentHotlineRepository(
        pollResults: [initiated()],
        createError: const OutreachDedupException(
          ApiException(
            ApiErrorKind.rateLimited,
            'Slow down',
            statusCode: 429,
            retryAfterSeconds: 120,
          ),
          retryAfterSeconds: 120,
        ),
      );
      final container = makeContainer(hotline: hotline);
      final ctrl = container.read(parentHotlineControllerProvider.notifier);

      driveToReview(async, container);
      unawaited(ctrl.createAndCall()); // createOutreach throws dedup
      async.flushMicrotasks();

      expect(hotline.createRequests, hasLength(1));
      expect(
        container.read(parentHotlineControllerProvider).dedupRetryAfterSeconds,
        120,
      );
      expect(
        container.read(parentHotlineControllerProvider).isDedupBlocked,
        isTrue,
      );

      // Blocked: callAgain is a no-op while the countdown runs.
      unawaited(ctrl.callAgain());
      async.flushMicrotasks();
      expect(
        hotline.createRequests,
        hasLength(1),
        reason: 'callAgain must not re-create while the countdown runs',
      );

      // The countdown ticks down.
      async.elapse(const Duration(seconds: 119));
      expect(
        container.read(parentHotlineControllerProvider).dedupRetryAfterSeconds,
        1,
      );
      expect(
        container.read(parentHotlineControllerProvider).isDedupBlocked,
        isTrue,
      );

      async.elapse(const Duration(seconds: 1)); // total 120s → cleared
      expect(
        container.read(parentHotlineControllerProvider).dedupRetryAfterSeconds,
        isNull,
      );
      expect(
        container.read(parentHotlineControllerProvider).isDedupBlocked,
        isFalse,
      );

      // Now callAgain proceeds (the outreach succeeds this time).
      hotline.createError = null;
      unawaited(ctrl.callAgain());
      async.flushMicrotasks();
      expect(
        hotline.createRequests,
        hasLength(2),
        reason: 'callAgain is allowed once the countdown clears',
      );
    });
  });

  // ── 6b. Dedup is per-student — a switch clears it (BLOCKER 1 regression) ──

  test('dedup armed for student A does not block a switched-to student B', () {
    fakeAsync((async) {
      final hotline = FakeParentHotlineRepository(
        pollResults: [initiated()],
        createError: const OutreachDedupException(
          ApiException(
            ApiErrorKind.rateLimited,
            'Slow down',
            statusCode: 429,
            retryAfterSeconds: 300,
          ),
          retryAfterSeconds: 300,
        ),
      );
      final container = makeContainer(hotline: hotline);
      final ctrl = container.read(parentHotlineControllerProvider.notifier);

      // Student A hits the dedup wall.
      ctrl.selectStudent(
        studentId: 'sA',
        studentName: 'Asha',
        classId: 'c1',
        className: 'Class 6A',
        parentLanguage: 'Kannada',
        subject: 'Mathematics',
      );
      ctrl.selectReason(OutreachReason.poorPerformance);
      unawaited(ctrl.draftMessage());
      async.flushMicrotasks();
      unawaited(ctrl.createAndCall());
      async.flushMicrotasks();
      expect(
        container.read(parentHotlineControllerProvider).isDedupBlocked,
        isTrue,
      );

      // Switch to a never-contacted student B — the cool-down must NOT carry
      // over (the server dedups per (teacher, student)).
      hotline.createError = null; // B's outreach will succeed
      ctrl.selectStudent(
        studentId: 'sB',
        studentName: 'Bhavya',
        classId: 'c1',
        className: 'Class 6A',
        parentLanguage: 'Kannada',
        subject: 'Mathematics',
      );
      expect(
        container.read(parentHotlineControllerProvider).isDedupBlocked,
        isFalse,
        reason: 'dedup is per-student and is cleared on switch',
      );
      expect(
        container.read(parentHotlineControllerProvider).dedupRetryAfterSeconds,
        isNull,
      );

      // B can actually be called (not a silent no-op).
      ctrl.selectReason(OutreachReason.behavioralConcern);
      unawaited(ctrl.draftMessage());
      async.flushMicrotasks();
      unawaited(ctrl.createAndCall());
      async.flushMicrotasks();
      expect(
        container.read(parentHotlineControllerProvider).stage,
        HotlineStage.calling,
        reason: 'B was never contacted — the call proceeds',
      );
      expect(hotline.placeCalls, hasLength(1));
    });
  });

  test(
    'copyForWhatsApp is never dedup-gated (always available, SPEC §B.5.2)',
    () {
      fakeAsync((async) {
        final hotline = FakeParentHotlineRepository(
          createError: const OutreachDedupException(
            ApiException(
              ApiErrorKind.rateLimited,
              'Slow down',
              statusCode: 429,
              retryAfterSeconds: 300,
            ),
            retryAfterSeconds: 300,
          ),
        );
        final container = makeContainer(hotline: hotline);
        final ctrl = container.read(parentHotlineControllerProvider.notifier);

        driveToReview(async, container);
        unawaited(ctrl.createAndCall()); // arm the dedup countdown
        async.flushMicrotasks();
        expect(
          container.read(parentHotlineControllerProvider).isDedupBlocked,
          isTrue,
        );
        expect(hotline.createRequests, hasLength(1));

        // While the cool-down is live, createAndCall is blocked (client no-op)...
        unawaited(ctrl.createAndCall());
        async.flushMicrotasks();
        expect(
          hotline.createRequests,
          hasLength(1),
          reason: 'createAndCall stays dedup-gated',
        );

        // ...but WhatsApp copy is NOT: it issues its request regardless.
        hotline.createError = null; // the copy outreach succeeds
        unawaited(ctrl.copyForWhatsApp());
        async.flushMicrotasks();
        expect(
          hotline.createRequests,
          hasLength(2),
          reason: 'copyForWhatsApp must not be blocked by the dedup countdown',
        );
        final s = container.read(parentHotlineControllerProvider);
        expect(s.stage, HotlineStage.summary);
        expect(s.summaryOutcome, HotlineSummaryOutcome.manual);
        expect(hotline.placeCalls, isEmpty);
      });
    },
  );

  // ── 7. Unsupported language flips callability + WhatsApp fallback ──

  test('422 unsupported-language → canAutoCall false + review fallback', () {
    fakeAsync((async) {
      final hotline = FakeParentHotlineRepository(
        placeCallError: const UnsupportedCallLanguageException(
          ApiException(
            ApiErrorKind.badResponse,
            'Auto-call not supported for Odia. Use WhatsApp copy instead.',
            statusCode: 422,
          ),
          language: 'Odia',
        ),
      );
      final container = makeContainer(hotline: hotline);
      final ctrl = container.read(parentHotlineControllerProvider.notifier);

      driveToReview(async, container, parentLanguage: 'Odia');
      expect(
        container.read(parentHotlineControllerProvider).canAutoCall,
        isTrue,
        reason: 'optimistically callable before the server says otherwise',
      );

      unawaited(ctrl.createAndCall());
      async.flushMicrotasks();

      final s = container.read(parentHotlineControllerProvider);
      expect(hotline.createRequests, hasLength(1));
      expect(hotline.placeCalls, hasLength(1), reason: 'we tried to dial');
      expect(
        s.canAutoCall,
        isFalse,
        reason: 'the 422 flipped it off at runtime',
      );
      expect(s.error, HotlineError.unsupportedLanguage);
      expect(
        s.stage,
        HotlineStage.review,
        reason: 'back to review so the teacher can copy for WhatsApp',
      );
    });
  });

  // ── 8. Premium gate — no call placed ──

  test('403 PREMIUM_REQUIRED → premium gate, no call placed', () {
    fakeAsync((async) {
      final hotline = FakeParentHotlineRepository(
        createError: const PremiumRequiredException(
          ApiException(
            ApiErrorKind.forbidden,
            'PREMIUM_REQUIRED',
            statusCode: 403,
            errorCode: 'PREMIUM_REQUIRED',
          ),
        ),
      );
      final container = makeContainer(hotline: hotline);
      final ctrl = container.read(parentHotlineControllerProvider.notifier);

      driveToReview(async, container);
      unawaited(ctrl.createAndCall());
      async.flushMicrotasks();

      final s = container.read(parentHotlineControllerProvider);
      expect(s.isPremiumGated, isTrue);
      expect(s.error, HotlineError.premiumRequired);
      expect(hotline.placeCalls, isEmpty, reason: 'no dialling behind a gate');
    });
  });

  // ── 9. Auth 401 → signed-out facet ──

  test('a plain 401 on create → signed-out facet (identity never faked)', () {
    fakeAsync((async) {
      final hotline = FakeParentHotlineRepository(
        createError: const ApiException(
          ApiErrorKind.unauthorized,
          'Please sign in again.',
          statusCode: 401,
        ),
      );
      final container = makeContainer(hotline: hotline);
      final ctrl = container.read(parentHotlineControllerProvider.notifier);

      driveToReview(async, container);
      unawaited(ctrl.createAndCall());
      async.flushMicrotasks();

      final s = container.read(parentHotlineControllerProvider);
      expect(s.isSignedOut, isTrue);
      expect(s.error, HotlineError.signedOut);
      expect(hotline.placeCalls, isEmpty);
    });
  });

  // ── 10. WhatsApp copy — manual terminal, placeCall never called ──

  test('copyForWhatsApp → manual terminal, placeCall never called', () {
    fakeAsync((async) {
      final hotline = FakeParentHotlineRepository();
      final container = makeContainer(hotline: hotline);
      final ctrl = container.read(parentHotlineControllerProvider.notifier);

      driveToReview(async, container);
      unawaited(ctrl.copyForWhatsApp());
      async.flushMicrotasks();

      final s = container.read(parentHotlineControllerProvider);
      expect(s.stage, HotlineStage.summary);
      expect(s.summaryOutcome, HotlineSummaryOutcome.manual);
      expect(hotline.placeCalls, isEmpty, reason: 'WhatsApp copy never dials');
      expect(
        hotline.createRequests.single.toJson()['deliveryMethod'],
        'whatsapp_copy',
      );
    });
  });

  // ── 11. F9-001 — no parent phone anywhere ──

  test(
    'F9-001: no parentPhone in the create body; placeCall sends only 2 keys',
    () {
      fakeAsync((async) {
        final hotline = FakeParentHotlineRepository(pollResults: [initiated()]);
        final container = makeContainer(hotline: hotline);
        final ctrl = container.read(parentHotlineControllerProvider.notifier);

        driveToReview(async, container);
        unawaited(ctrl.createAndCall());
        async.flushMicrotasks();

        final body = hotline.createRequests.single.toJson();
        expect(
          body.containsKey('parentPhone'),
          isFalse,
          reason: 'F9-001: the client never sends the phone',
        );
        expect(hotline.placeCalls.single.outreachId, isNotEmpty);
        expect(hotline.placeCalls.single.parentLanguage, 'Kannada');
        // placeCall carries ONLY {outreachId, parentLanguage} — proven at the
        // repository layer; here we prove the controller passes nothing else.
      });
    },
  );

  // ── extra: an injected callability policy hides Call up front ──

  test('a policy that excludes the language starts with canAutoCall false', () {
    fakeAsync((async) {
      final hotline = FakeParentHotlineRepository();
      final container = makeContainer(
        hotline: hotline,
        policy: const CallabilityPolicy({'english'}), // only English callable
      );
      final ctrl = container.read(parentHotlineControllerProvider.notifier);

      ctrl.selectStudent(
        studentId: 's1',
        studentName: 'Asha',
        classId: 'c1',
        className: 'Class 6A',
        parentLanguage: 'Kannada',
      );
      expect(
        container.read(parentHotlineControllerProvider).canAutoCall,
        isFalse,
        reason: 'Kannada is not in the injected callable set',
      );
    });
  });
}
