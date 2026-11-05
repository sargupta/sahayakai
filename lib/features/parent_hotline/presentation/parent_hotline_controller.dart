import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/platform/clock.dart';
import '../../parent_message/data/parent_message_repository.dart';
import '../../parent_message/domain/parent_message.dart';
import '../../profile/data/usage_repository.dart';
import '../data/dto/outreach_dtos.dart';
import '../data/hotline_evidence_repository.dart';
import '../data/parent_hotline_errors.dart';
import '../data/parent_hotline_repository.dart';
import '../domain/calling_window.dart';
import '../domain/hotline_evidence.dart';
import '../domain/parent_outreach.dart';

part 'parent_hotline_controller.g.dart';

// ─── Poll discipline (SPEC §B.3, ported EXACTLY from the web modal) ───────────

/// The first `call-summary` poll fires this long after the call is placed.
const Duration kFirstPollDelay = Duration(seconds: 3);

/// After the first poll, an in-flight (`initiated`) call is re-polled at this
/// cadence.
const Duration kPollInterval = Duration(seconds: 5);

/// Ceiling on the `initiated` phase — 3s + 59×5s ≈ 5min, matching the web
/// modal's "~5 min" cap. Past it the call is reported as still in progress
/// ("check back"), never as over.
const int kMaxPolls = 60;

/// Once the status is terminal but the AI `callSummary` has not landed yet, the
/// poll tightens to this cadence while it waits for the summary to generate.
const Duration kSummaryWaitInterval = Duration(seconds: 3);

/// Max polls in the summary-wait phase — 8 × 3s ≈ 24s, matching the web modal's
/// "poll every 3s for ~24s then give up gracefully".
const int kMaxSummaryWaits = 8;

/// Consecutive failed polls (offline, 5xx, timeout) after which the screen
/// says it could not check the call. Below it, the calling stage keeps going
/// and says it is having trouble checking.
const int kMaxPollFailures = 4;

/// Consecutive failed polls after which the calling stage shows its
/// "having trouble checking" line.
const int kPollTroubleAfter = 2;

/// The dedup window the outreach route enforces when a 429 arrives with no
/// numeric `retryAfterSeconds` hint (it always should carry one).
const int kDefaultDedupSeconds = 5 * 60;

/// The subject sent with a draft when the class record has none. `General` is
/// a member of the backend's own `Subject` list meaning "not subject-specific";
/// it is NOT a guess at the class's subject, and a class name is never sent in
/// its place.
const String kFallbackSubject = 'General';

// ─── Callability (SPEC §B.5.2, F9-001) ───────────────────────────────────────

/// The default set of parent languages the app OPTIMISTICALLY treats as
/// auto-callable, by full English name (matching `AppLocale.aiName`).
///
/// The app cannot see the server's `TWILIO_LANGUAGE_MAP`, so **the server stays
/// the source of truth** (SPEC §A.5 / §B.5.2): this set is only the opening
/// guess. A `422 UnsupportedCallLanguageException` from `placeCall` flips the
/// offending language off at runtime (belt-and-suspenders).
const Set<String> kDefaultCallableLanguages = {
  'english',
  'hindi',
  'kannada',
  'tamil',
  'telugu',
  'marathi',
  'bengali',
  'gujarati',
  'punjabi',
  'malayalam',
  'odia',
};

/// A small injectable predicate deciding whether a parent language can be
/// auto-called. The server remains authoritative; this is the client's
/// optimistic mirror.
@immutable
class CallabilityPolicy {
  const CallabilityPolicy(this.callableLanguages);

  /// Lowercased full English language names that are callable.
  final Set<String> callableLanguages;

  /// The standard policy, seeded from [kDefaultCallableLanguages].
  static const CallabilityPolicy standard = CallabilityPolicy(
    kDefaultCallableLanguages,
  );

  bool canCall(String? language) {
    final key = language?.trim().toLowerCase();
    if (key == null || key.isEmpty) return false;
    return callableLanguages.contains(key);
  }
}

@riverpod
CallabilityPolicy callabilityPolicy(Ref ref) => CallabilityPolicy.standard;

/// Whether the teacher's plan can use parent messaging at all, read cheaply
/// from `GET /api/usage` (`canUseParentMessaging`) when the screen opens.
///
/// Only a definite `false` is acted on: a plan without parent messaging can
/// neither draft (the draft route is plan-checked) nor call, so showing the
/// plan card up front saves the teacher a wasted walk through the flow. A
/// `true` proves nothing about calling — the outreach route additionally
/// requires an advanced plan — and a failed read proves nothing at all, so
/// both leave the server to decide as before. Injectable so tests never reach
/// the network.
final hotlinePlanCheckProvider = Provider<Future<bool?> Function()>((ref) {
  return () async {
    if (!ref.read(isSignedInProvider)) return null;
    try {
      final usage = await ref.read(usageRepositoryProvider).fetchUsage();
      return usage.canUseParentMessaging;
    } catch (_) {
      return null;
    }
  };
});

// ─── Stages & terminal-outcome model ─────────────────────────────────────────

/// The staged flow inside the one Parent Hotline screen (SPEC §B.1). The happy
/// path is `pickStudent → reason → compose → review → calling → summary`; the
/// terminal branches all resolve INSIDE [HotlineStage.summary] via
/// [ParentHotlineState.summaryOutcome], never as extra stages.
enum HotlineStage {
  /// Choose the student (skipped when launched from a student row).
  pickStudent,

  /// Step 1 of 3 — choose why the teacher is calling.
  reason,

  /// Step 2 of 3 — the evidence + teacher note; drafts the message.
  compose,

  /// Step 3 of 3 — read the drafted message; decide Call vs WhatsApp copy.
  review,

  /// The waiting state while the call is polled.
  calling,

  /// The payoff — or one of the terminal branches.
  summary,
}

/// How the `summary` stage renders, resolved from the polled [CallResult] and
/// the poll's own outcome.
enum HotlineSummaryOutcome {
  /// The AI `callSummary` landed.
  summary,

  /// WhatsApp-copy path (`callStatus == manual`). No call was placed.
  manual,

  /// `failed / no_answer / busy` — retryable.
  callFailed,

  /// The call completed with fewer than two turns.
  endedNoConversation,

  /// A conversation happened but its summary never generated.
  summaryUnavailable,

  /// The poll ceiling passed while the call still read `initiated`: it may
  /// well still be going. "Check back", never "it ended".
  stillInProgress,

  /// The app could not find out how the call is going (repeated failed polls,
  /// or a record with no known status). Nothing is claimed about the call.
  checkFailed,
}

/// Why polling stopped short of a known outcome.
enum HotlinePollOutcome { none, stillInProgress, checkFailed }

/// The controller's error / gate facet. Dedup is NOT modelled here — it is a
/// countdown ([ParentHotlineState.dedupRetryAfterSeconds]).
enum HotlineError {
  none,
  premiumRequired,
  noParentPhone,
  unsupportedLanguage,
  callFailed,
  telephonyUnavailable,

  /// Outside 09:00–21:00 IST; see [ParentHotlineState.nextCallAllowedAt].
  outsideCallingHours,
  notFound,
  signedOut,
  generic,
}

// ─── State ───────────────────────────────────────────────────────────────────

const Object _unset = Object();

/// The single immutable store for the Parent Hotline flow.
@immutable
class ParentHotlineState {
  const ParentHotlineState({
    this.stage = HotlineStage.pickStudent,
    this.studentId,
    this.studentName,
    this.classId,
    this.className,
    this.parentLanguage = '',
    this.subject,
    this.suggestedReason,
    this.selectedReason,
    this.teacherNote = '',
    this.consecutiveAbsentDays,
    this.performanceContext,
    this.evidence,
    this.draftedMessage,
    this.spokenScript,
    this.canAutoCall = true,
    this.outreachId,
    this.deliveryMethod = DeliveryMethod.twilioCall,
    this.callResult,
    this.callStartedAt,
    this.pollOutcome = HotlinePollOutcome.none,
    this.pollTrouble = false,
    this.dedupRetryAfterSeconds,
    this.nextCallAllowedAt,
    this.error = HotlineError.none,
    this.errorMessage,
    this.errorCause,
    this.isBusy = false,
    this.launchedWithStudent = false,
  });

  final HotlineStage stage;

  // ── Selected student / class context ──
  final String? studentId;
  final String? studentName;
  final String? classId;
  final String? className;

  /// The parent's language as a full English name (e.g. `"Kannada"`).
  final String parentLanguage;

  /// The class's subject token, or null when unknown.
  final String? subject;

  /// A reason passed in from the launch context, pre-selected on the reason
  /// stage.
  final OutreachReason? suggestedReason;

  /// The teacher's chosen reason.
  final OutreachReason? selectedReason;

  /// Free-text note the teacher added on the compose stage.
  final String teacherNote;

  /// The server's current absence run for this student; feeds the draft.
  final int? consecutiveAbsentDays;

  /// The recent-marks snapshot built from real results; feeds the draft and
  /// the outreach.
  final Map<String, dynamic>? performanceContext;

  /// The evidence read for the current student, or null before it starts.
  final HotlineEvidence? evidence;

  /// The AI-drafted written message (the review-stage payload).
  final String? draftedMessage;

  /// The phone-call rendition the AI voice speaks instead of the letter.
  final String? spokenScript;

  /// Whether "Call parent" is offered for [parentLanguage].
  final bool canAutoCall;

  /// The outreach for the CURRENT draft or call, once one exists. While no
  /// call has been placed from it (a failed placement, or a WhatsApp copy),
  /// "Call parent" re-dials THIS record instead of creating another — a second
  /// create within five minutes is refused by the server's dedup.
  final String? outreachId;

  final DeliveryMethod deliveryMethod;

  /// The latest polled projection.
  final CallResult? callResult;

  /// When this session placed the call, for the elapsed timer. Null for a call
  /// resumed from the server (its start time is not known, so none is shown).
  final DateTime? callStartedAt;

  /// Why polling stopped short of a known outcome.
  final HotlinePollOutcome pollOutcome;

  /// Recent polls have failed; the call may still be going.
  final bool pollTrouble;

  /// Seconds remaining on the 5-min dedup cool-down after a `429`.
  final int? dedupRetryAfterSeconds;

  /// When calling next opens (UTC), while [error] is
  /// [HotlineError.outsideCallingHours]. Null when not known.
  final DateTime? nextCallAllowedAt;

  final HotlineError error;

  /// The server's own text for [error]. Diagnostic only — NEVER rendered: the
  /// screen maps [errorCause] / [error] to translated copy.
  final String? errorMessage;

  /// The exception behind a [HotlineError.generic] / [HotlineError.notFound],
  /// for the screen to map to translated copy by kind and status.
  final Object? errorCause;

  /// True while a draft / create / call placement is in flight. Every action
  /// method returns early while it is set, and every action button is
  /// disabled.
  final bool isBusy;

  /// The flow was opened for one student (no picker to step back to).
  final bool launchedWithStudent;

  bool get isPremiumGated => error == HotlineError.premiumRequired;
  bool get isSignedOut => error == HotlineError.signedOut;
  bool get isDedupBlocked => (dedupRetryAfterSeconds ?? 0) > 0;
  bool get isOutsideCallingHours => error == HotlineError.outsideCallingHours;
  bool get hasDraft => draftedMessage?.trim().isNotEmpty ?? false;

  HotlineSummaryOutcome? get summaryOutcome {
    if (stage != HotlineStage.summary) return null;
    final r = callResult;
    if (r?.callSummary != null) return HotlineSummaryOutcome.summary;
    switch (pollOutcome) {
      case HotlinePollOutcome.stillInProgress:
        return HotlineSummaryOutcome.stillInProgress;
      case HotlinePollOutcome.checkFailed:
        return HotlineSummaryOutcome.checkFailed;
      case HotlinePollOutcome.none:
        break;
    }
    if (r == null) return HotlineSummaryOutcome.checkFailed;
    switch (r.callStatus) {
      case CallStatus.manual:
        return HotlineSummaryOutcome.manual;
      case CallStatus.failed:
      case CallStatus.noAnswer:
      case CallStatus.busy:
        return HotlineSummaryOutcome.callFailed;
      case CallStatus.unknown:
        return HotlineSummaryOutcome.checkFailed;
      case CallStatus.initiated:
        return HotlineSummaryOutcome.stillInProgress;
      case CallStatus.completed:
        // SPEC §B.1 ordering: turnCount<2 reads "no conversation" before the
        // transcript-present rule.
        return r.hadConversation
            ? HotlineSummaryOutcome.summaryUnavailable
            : HotlineSummaryOutcome.endedNoConversation;
    }
  }

  ParentHotlineState copyWith({
    HotlineStage? stage,
    Object? studentId = _unset,
    Object? studentName = _unset,
    Object? classId = _unset,
    Object? className = _unset,
    String? parentLanguage,
    Object? subject = _unset,
    Object? suggestedReason = _unset,
    Object? selectedReason = _unset,
    String? teacherNote,
    Object? consecutiveAbsentDays = _unset,
    Object? performanceContext = _unset,
    Object? evidence = _unset,
    Object? draftedMessage = _unset,
    Object? spokenScript = _unset,
    bool? canAutoCall,
    Object? outreachId = _unset,
    DeliveryMethod? deliveryMethod,
    Object? callResult = _unset,
    Object? callStartedAt = _unset,
    HotlinePollOutcome? pollOutcome,
    bool? pollTrouble,
    Object? dedupRetryAfterSeconds = _unset,
    Object? nextCallAllowedAt = _unset,
    HotlineError? error,
    Object? errorMessage = _unset,
    Object? errorCause = _unset,
    bool? isBusy,
    bool? launchedWithStudent,
  }) {
    T pick<T>(Object? v, T current) => identical(v, _unset) ? current : v as T;
    return ParentHotlineState(
      stage: stage ?? this.stage,
      studentId: pick<String?>(studentId, this.studentId),
      studentName: pick<String?>(studentName, this.studentName),
      classId: pick<String?>(classId, this.classId),
      className: pick<String?>(className, this.className),
      parentLanguage: parentLanguage ?? this.parentLanguage,
      subject: pick<String?>(subject, this.subject),
      suggestedReason: pick<OutreachReason?>(
        suggestedReason,
        this.suggestedReason,
      ),
      selectedReason: pick<OutreachReason?>(
        selectedReason,
        this.selectedReason,
      ),
      teacherNote: teacherNote ?? this.teacherNote,
      consecutiveAbsentDays: pick<int?>(
        consecutiveAbsentDays,
        this.consecutiveAbsentDays,
      ),
      performanceContext: pick<Map<String, dynamic>?>(
        performanceContext,
        this.performanceContext,
      ),
      evidence: pick<HotlineEvidence?>(evidence, this.evidence),
      draftedMessage: pick<String?>(draftedMessage, this.draftedMessage),
      spokenScript: pick<String?>(spokenScript, this.spokenScript),
      canAutoCall: canAutoCall ?? this.canAutoCall,
      outreachId: pick<String?>(outreachId, this.outreachId),
      deliveryMethod: deliveryMethod ?? this.deliveryMethod,
      callResult: pick<CallResult?>(callResult, this.callResult),
      callStartedAt: pick<DateTime?>(callStartedAt, this.callStartedAt),
      pollOutcome: pollOutcome ?? this.pollOutcome,
      pollTrouble: pollTrouble ?? this.pollTrouble,
      dedupRetryAfterSeconds: pick<int?>(
        dedupRetryAfterSeconds,
        this.dedupRetryAfterSeconds,
      ),
      nextCallAllowedAt: pick<DateTime?>(
        nextCallAllowedAt,
        this.nextCallAllowedAt,
      ),
      error: error ?? this.error,
      errorMessage: pick<String?>(errorMessage, this.errorMessage),
      errorCause: pick<Object?>(errorCause, this.errorCause),
      isBusy: isBusy ?? this.isBusy,
      launchedWithStudent: launchedWithStudent ?? this.launchedWithStudent,
    );
  }
}

/// What this session remembers about an outreach it created, so a resume can
/// restore the draft (and, for one whose call never went out, re-dial it
/// rather than pretend a call is ringing).
@immutable
class _OutreachMemo {
  const _OutreachMemo({
    required this.message,
    required this.spokenScript,
    required this.reason,
    required this.callPlaced,
  });

  final String message;
  final String? spokenScript;
  final OutreachReason? reason;

  /// A call was successfully placed from this outreach.
  final bool callPlaced;

  _OutreachMemo placed() => _OutreachMemo(
    message: message,
    spokenScript: spokenScript,
    reason: reason,
    callPlaced: true,
  );
}

// ─── Controller ──────────────────────────────────────────────────────────────

/// The Parent Hotline brain (SPEC §B.3): the staged flow + the exact web poll
/// discipline + resume.
///
/// **Poll safety.** Polling is a self-rescheduling [Timer] guarded by a
/// generation counter ([_pollGen]) and a [_disposed] flag, both checked after
/// every `await`. Leaving `calling` stops polling ONLY — it never cancels the
/// server-side call (SPEC §B.5.5); re-opening resumes via `latestForStudent`.
///
/// **One action at a time.** Every action method returns early while
/// [ParentHotlineState.isBusy] is set; the flag is raised synchronously, before
/// the first `await`, so a double-tap in one frame places one call.
///
/// **Per-student state.** The controller is keepAlive, so every student
/// switch (an [init], a [selectStudent]) resets EVERY per-student field — the
/// note, evidence, draft, spoken script, outreach, call result — and bumps
/// [_flowGen], which orphans any in-flight draft/create/call continuation.
@Riverpod(keepAlive: true)
class ParentHotlineController extends _$ParentHotlineController {
  bool _disposed = false;

  Timer? _pollTimer;
  int _pollGen = 0;
  String? _pollOutreachId;
  int _pollCount = 0;
  int _summaryWaitCount = 0;
  int _pollFailures = 0;
  CallStatus? _lastPolledStatus;

  Timer? _dedupTimer;
  Timer? _callingWindowTimer;

  /// Bumped on every student re-target; a resume lookup abandons its
  /// continuation if it changed.
  int _contextGen = 0;

  /// Bumped on every re-target AND every step back; an in-flight draft /
  /// create / call abandons its continuation if it changed.
  int _flowGen = 0;

  /// Languages a runtime `422` proved uncallable this session.
  final Set<String> _runtimeUncallable = <String>{};

  /// Outreaches this session created, by id.
  final Map<String, _OutreachMemo> _memos = <String, _OutreachMemo>{};

  @override
  ParentHotlineState build() {
    ref.onDispose(() {
      _disposed = true;
      _pollTimer?.cancel();
      _pollTimer = null;
      _pollGen++;
      _dedupTimer?.cancel();
      _dedupTimer = null;
      _callingWindowTimer?.cancel();
      _callingWindowTimer = null;
    });
    return const ParentHotlineState();
  }

  ParentHotlineRepository get _repo =>
      ref.read(parentHotlineRepositoryProvider);
  ParentMessageRepository get _messages =>
      ref.read(parentMessageRepositoryProvider);
  HotlineEvidenceRepository get _evidenceRepo =>
      ref.read(hotlineEvidenceRepositoryProvider);
  CallabilityPolicy get _policy => ref.read(callabilityPolicyProvider);
  DateTime _now() => ref.read(nowProvider)();

  // ── Open / resume (SPEC §B.3 cases a/b/c) ──────────────────────────────────

  /// Called when the screen opens. Resets the whole flow to the launch
  /// context, checks the plan cheaply, and — if a student is already known —
  /// resumes or starts their flow.
  Future<void> init({
    String? studentId,
    String? studentName,
    String? classId,
    String? className,
    String? parentLanguage,
    String? subject,
    OutreachReason? suggestedReason,
  }) async {
    final lang = parentLanguage?.trim() ?? '';
    final hasStudent = studentId != null && studentId.isNotEmpty;

    // A call the teacher left running carries on server-side; opening the
    // hotline without naming a student returns to it (polling picks up where
    // it stopped) rather than dropping it for the picker. Naming a student
    // goes through the resume lookup below, which reads the server's state.
    final running = state.outreachId;
    if (state.stage == HotlineStage.calling &&
        running != null &&
        running.isNotEmpty &&
        !hasStudent) {
      _set(pollTrouble: false, pollOutcome: HotlinePollOutcome.none);
      _beginPolling(running);
      return;
    }

    _runtimeUncallable.clear();
    _resetForStudent();
    _set(
      stage: HotlineStage.pickStudent,
      studentId: studentId,
      studentName: studentName,
      classId: classId,
      className: className,
      parentLanguage: lang,
      subject: _cleanSubject(subject),
      suggestedReason: suggestedReason,
      selectedReason: suggestedReason,
      canAutoCall: _deriveCallable(lang),
      launchedWithStudent: hasStudent,
    );
    final gen = ++_contextGen;

    unawaited(_checkPlan(gen));

    if (!hasStudent) return;
    await _resumeOrStart(
      studentId,
      gen: gen,
      fallbackStage: HotlineStage.reason,
    );
  }

  Future<void> _checkPlan(int gen) async {
    final allowed = await ref.read(hotlinePlanCheckProvider)();
    if (_disposed || gen != _contextGen) return;
    if (allowed == false && state.error == HotlineError.none) {
      _set(error: HotlineError.premiumRequired);
    }
  }

  // ── Stage intents ──────────────────────────────────────────────────────────

  /// Pick a student (from the picker) → the reason stage, then resume exactly
  /// as [init] does.
  Future<void> selectStudent({
    required String studentId,
    required String studentName,
    required String classId,
    required String className,
    required String parentLanguage,
    String? subject,
    OutreachReason? suggestedReason,
  }) async {
    final lang = parentLanguage.trim();
    _runtimeUncallable.clear();
    _resetForStudent();
    _set(
      stage: HotlineStage.reason,
      studentId: studentId,
      studentName: studentName,
      classId: classId,
      className: className,
      parentLanguage: lang,
      subject: _cleanSubject(subject),
      suggestedReason: suggestedReason,
      selectedReason: suggestedReason,
      canAutoCall: _deriveCallable(lang),
    );
    await _resumeOrStart(studentId, gen: ++_contextGen);
  }

  /// Clears EVERY per-student field, stops polling and the per-student timers,
  /// and orphans in-flight work. Keeps the premium gate (it is about the
  /// teacher, not the student).
  void _resetForStudent() {
    _stopPolling();
    _clearDedup();
    _callingWindowTimer?.cancel();
    _callingWindowTimer = null;
    _flowGen++;
    _set(
      teacherNote: '',
      consecutiveAbsentDays: null,
      performanceContext: null,
      evidence: null,
      draftedMessage: null,
      spokenScript: null,
      outreachId: null,
      deliveryMethod: DeliveryMethod.twilioCall,
      callResult: null,
      callStartedAt: null,
      pollOutcome: HotlinePollOutcome.none,
      pollTrouble: false,
      nextCallAllowedAt: null,
      error: state.isPremiumGated
          ? HotlineError.premiumRequired
          : HotlineError.none,
      errorMessage: null,
      errorCause: null,
      isBusy: false,
    );
  }

  /// Resume lookup (SPEC §B.3): (a) summary → summary; (b) a call in flight →
  /// calling; (c) nothing → the fallback stage. An outreach this session knows
  /// was never dialled lands back on review (Call re-dials it) instead of on a
  /// "calling" screen for a call that does not exist.
  Future<void> _resumeOrStart(
    String studentId, {
    required int gen,
    HotlineStage? fallbackStage,
  }) async {
    LatestOutreach? latest;
    try {
      latest = await _repo.latestForStudent(studentId);
    } on ApiException catch (e) {
      if (_disposed || gen != _contextGen) return;
      if (e.isAuth) {
        _set(error: HotlineError.signedOut, errorMessage: e.message);
        return;
      }
      latest = null;
    } catch (_) {
      if (_disposed || gen != _contextGen) return;
      latest = null;
    }
    if (_disposed || gen != _contextGen) return;

    if (latest == null) {
      if (fallbackStage != null) _set(stage: fallbackStage);
      return;
    }

    final result = latest.result;
    final memo = _memos[latest.outreachId];
    if (memo != null) {
      _set(
        draftedMessage: memo.message,
        spokenScript: memo.spokenScript,
        selectedReason: memo.reason ?? state.selectedReason,
      );
    }

    if (result.callSummary == null &&
        result.callStatus == CallStatus.initiated &&
        memo != null &&
        !memo.callPlaced) {
      // Created here, never dialled (the placement failed). Not a call.
      _set(stage: HotlineStage.review, outreachId: latest.outreachId);
      _checkCallingWindow();
      return;
    }
    if (result.callSummary == null &&
        result.callStatus == CallStatus.initiated) {
      _set(
        stage: HotlineStage.calling,
        outreachId: latest.outreachId,
        callResult: result,
        callStartedAt: null,
      );
      _beginPolling(latest.outreachId);
      return;
    }
    _set(
      stage: HotlineStage.summary,
      outreachId: latest.outreachId,
      callResult: result,
      deliveryMethod: result.callStatus == CallStatus.manual
          ? DeliveryMethod.whatsappCopy
          : DeliveryMethod.twilioCall,
      pollOutcome: HotlinePollOutcome.none,
    );
  }

  /// Choose a reason on step 1 WITHOUT advancing (the teacher confirms with
  /// Next).
  void pickReason(OutreachReason reason) {
    if (state.selectedReason != reason) {
      // The evidence shown and the draft depend on the reason.
      _set(draftedMessage: null, spokenScript: null, outreachId: null);
    }
    _set(selectedReason: reason, error: _clearedError(), errorCause: null);
  }

  /// Step 1 "Next": advance to the evidence stage with the picked reason.
  void confirmReason() {
    if (state.selectedReason == null) return;
    _set(stage: HotlineStage.compose, error: _clearedError(), errorCause: null);
    unawaited(loadEvidence());
  }

  /// Choose AND confirm a reason in one step.
  void selectReason(OutreachReason reason) {
    pickReason(reason);
    confirmReason();
  }

  /// Update the teacher note on the compose stage.
  void updateNote(String note) => _set(teacherNote: note);

  /// Reads the student's recent absences, current absence run and recent marks.
  /// Each read settles independently; a failure shows as "could not load".
  /// Already-loaded evidence for the same student is kept unless [force].
  Future<void> loadEvidence({bool force = false}) async {
    final studentId = state.studentId;
    final classId = state.classId;
    if (studentId == null || classId == null || classId.isEmpty) return;
    final current = state.evidence;
    if (!force &&
        current != null &&
        current.studentId == studentId &&
        current.absences != EvidenceStatus.failed &&
        current.marks != EvidenceStatus.failed) {
      return;
    }
    final gen = _contextGen;
    _set(evidence: HotlineEvidence(studentId: studentId));

    bool stale() =>
        _disposed ||
        gen != _contextGen ||
        state.evidence?.studentId != studentId;

    Future<void> absences() async {
      try {
        final dates = await _evidenceRepo.absenceDates(classId, studentId);
        int? streak;
        try {
          streak = await _evidenceRepo.currentAbsenceStreak(classId, studentId);
        } catch (_) {
          streak = null; // the dates still stand without the run length
        }
        if (stale()) return;
        _set(
          evidence: state.evidence!.copyWith(
            absences: EvidenceStatus.loaded,
            absenceDates: dates,
            currentAbsenceStreak: streak,
          ),
          consecutiveAbsentDays: (streak != null && streak > 0) ? streak : null,
        );
      } catch (_) {
        if (stale()) return;
        _set(
          evidence: state.evidence!.copyWith(absences: EvidenceStatus.failed),
        );
      }
    }

    Future<void> marks() async {
      try {
        final recent = await _evidenceRepo.recentAssessments(
          classId,
          studentId,
        );
        if (stale()) return;
        final next = state.evidence!.copyWith(
          marks: EvidenceStatus.loaded,
          recentAssessments: recent,
        );
        _set(evidence: next, performanceContext: next.performanceContext);
      } catch (_) {
        if (stale()) return;
        _set(evidence: state.evidence!.copyWith(marks: EvidenceStatus.failed));
      }
    }

    await Future.wait([absences(), marks()]);
  }

  /// Draft the opening message (step 2 → 3) through the `parent_message`
  /// repository. On success advances to review.
  Future<void> draftMessage({
    int? consecutiveAbsentDays,
    Map<String, dynamic>? performanceContext,
  }) async {
    if (state.isBusy) return;
    final reason = state.selectedReason;
    if (reason == null) return;

    final gen = _flowGen;
    final absentDays = consecutiveAbsentDays ?? state.consecutiveAbsentDays;
    final perf = performanceContext ?? state.performanceContext;
    _set(
      isBusy: true,
      error: _clearedError(),
      errorMessage: null,
      errorCause: null,
      consecutiveAbsentDays: absentDays,
      performanceContext: perf,
    );

    final note = state.teacherNote.trim();
    final request = ParentMessageRequest(
      studentName: state.studentName ?? '',
      className: state.className ?? '',
      subject: state.subject ?? kFallbackSubject,
      reason: _toMessageReason(reason),
      parentLanguage: state.parentLanguage,
      teacherNote: note.isEmpty ? null : note,
      consecutiveAbsentDays: absentDays,
      performanceContext: perf,
    );

    final ParentMessage message;
    try {
      message = await _messages.draft(request);
    } catch (e) {
      if (_disposed || gen != _flowGen) return;
      _setFailure(e);
      _set(isBusy: false);
      return;
    }
    if (_disposed || gen != _flowGen) return;

    if (message.isEmpty) {
      _set(isBusy: false, error: HotlineError.generic, errorCause: null);
      return;
    }
    _set(
      isBusy: false,
      draftedMessage: message.message,
      spokenScript: message.spokenScript,
      // New words → a new outreach; an older one carries the old message.
      outreachId: null,
      deliveryMethod: DeliveryMethod.twilioCall,
      stage: HotlineStage.review,
    );
    _checkCallingWindow();
  }

  // ── Call ──────────────────────────────────────────────────────────────────

  /// Review's "Call parent". Re-dials the outreach that already exists for
  /// this draft (a failed placement, or a WhatsApp copy) — creating a second
  /// one inside five minutes would be refused by the server's dedup. Creates
  /// one otherwise.
  Future<void> callParent() async {
    if (state.isBusy) return;
    final existing = state.outreachId;
    if (existing != null && existing.isNotEmpty) {
      if (!_checkCallingWindow()) return;
      await _placeAndPoll(existing);
    } else {
      await createAndCall();
    }
  }

  /// Persist the outreach then place the call. Blocked while busy, while a
  /// dedup countdown is live, and outside calling hours. Never sends the
  /// parent phone (F9-001).
  Future<void> createAndCall() async {
    if (state.isBusy || state.isDedupBlocked) return;
    final drafted = state.draftedMessage;
    if (drafted == null || drafted.trim().isEmpty) return;
    if (!_checkCallingWindow()) return;

    final gen = _flowGen;
    _set(
      isBusy: true,
      error: HotlineError.none,
      errorMessage: null,
      errorCause: null,
    );

    final String outreachId;
    try {
      outreachId = await _repo.createOutreach(
        _buildCreateDto(DeliveryMethod.twilioCall),
      );
    } on ParentHotlineException catch (e) {
      if (_disposed || gen != _flowGen) return;
      _mapCreateError(e);
      _set(isBusy: false);
      return;
    } catch (e) {
      if (_disposed || gen != _flowGen) return;
      _setFailure(e);
      _set(isBusy: false);
      return;
    }
    if (_disposed || gen != _flowGen) return;

    _remember(outreachId, callPlaced: false);
    _set(outreachId: outreachId, deliveryMethod: DeliveryMethod.twilioCall);
    await _placeAndPoll(outreachId, gen: gen);
  }

  /// Places the call for an existing [outreachId] and, on success, enters
  /// `calling` + starts polling. On failure the flow returns to review when a
  /// draft exists, else stays where it is with the error showing.
  Future<void> _placeAndPoll(String outreachId, {int? gen}) async {
    final flow = gen ?? _flowGen;
    _set(
      isBusy: true,
      error: HotlineError.none,
      errorMessage: null,
      errorCause: null,
    );
    final failStage = state.hasDraft ? HotlineStage.review : state.stage;
    try {
      await _repo.placeCall(
        outreachId: outreachId,
        parentLanguage: state.parentLanguage,
      );
    } on ParentHotlineException catch (e) {
      if (_disposed || flow != _flowGen) return;
      _mapPlaceCallError(e);
      _set(isBusy: false, stage: failStage);
      return;
    } catch (e) {
      if (_disposed || flow != _flowGen) return;
      _setFailure(e);
      _set(isBusy: false, stage: failStage);
      return;
    }
    if (_disposed || flow != _flowGen) return;

    final memo = _memos[outreachId];
    if (memo != null) _memos[outreachId] = memo.placed();
    _set(
      isBusy: false,
      stage: HotlineStage.calling,
      outreachId: outreachId,
      deliveryMethod: DeliveryMethod.twilioCall,
      callResult: const CallResult(callStatus: CallStatus.initiated),
      callStartedAt: _now(),
      pollOutcome: HotlinePollOutcome.none,
      pollTrouble: false,
      error: HotlineError.none,
      errorMessage: null,
      errorCause: null,
    );
    _beginPolling(outreachId);
  }

  /// "Try again" after a failed / no-answer / busy call or a failed
  /// placement: re-dials the EXISTING outreach (no new record, no dedup).
  Future<void> retryCall() async {
    if (state.isBusy) return;
    final existing = state.outreachId;
    if (existing != null && existing.isNotEmpty) {
      if (!_checkCallingWindow()) return;
      await _placeAndPoll(existing);
    } else {
      await createAndCall();
    }
  }

  /// "Call again later" from a finished call — a genuinely NEW outreach with
  /// the same draft, subject to the 5-min dedup. With no draft in hand (a
  /// resumed call), it starts a new message instead of landing on a review
  /// stage with nothing to send.
  Future<void> callAgain() async {
    if (state.isBusy || state.isDedupBlocked) return;
    if (!state.hasDraft) {
      startNewMessage();
      return;
    }
    _stopPolling();
    _set(
      outreachId: null,
      callResult: null,
      callStartedAt: null,
      pollOutcome: HotlinePollOutcome.none,
      stage: HotlineStage.review,
      error: HotlineError.none,
      errorMessage: null,
      errorCause: null,
    );
    await createAndCall();
  }

  /// Opens one known call by its [outreachId] — what tapping a call row in
  /// Updates does. Reads its current status once: a call still running goes
  /// to the calling stage and polls; anything else lands on its summary or
  /// honest terminal panel. A failed read is "we couldn't check this call",
  /// with Check again — never an invented ending.
  Future<void> openOutreach({
    required String outreachId,
    required String studentName,
  }) async {
    _runtimeUncallable.clear();
    _resetForStudent();
    _set(
      stage: HotlineStage.calling,
      studentId: null,
      studentName: studentName,
      classId: null,
      className: null,
      parentLanguage: '',
      subject: null,
      suggestedReason: null,
      selectedReason: null,
      canAutoCall: false,
      launchedWithStudent: true,
      outreachId: outreachId,
    );
    final gen = ++_contextGen;
    CallResult result;
    try {
      result = await _repo.pollSummary(outreachId);
    } on ApiException catch (e) {
      if (_disposed || gen != _contextGen) return;
      if (e.isAuth) {
        _set(error: HotlineError.signedOut, errorMessage: e.message);
        return;
      }
      _set(
        stage: HotlineStage.summary,
        pollOutcome: HotlinePollOutcome.checkFailed,
      );
      return;
    } catch (_) {
      if (_disposed || gen != _contextGen) return;
      _set(
        stage: HotlineStage.summary,
        pollOutcome: HotlinePollOutcome.checkFailed,
      );
      return;
    }
    if (_disposed || gen != _contextGen) return;
    if (result.callSummary == null &&
        result.callStatus == CallStatus.initiated) {
      _set(callResult: result, callStartedAt: null);
      _beginPolling(outreachId);
      return;
    }
    _set(
      stage: HotlineStage.summary,
      callResult: result,
      deliveryMethod: result.callStatus == CallStatus.manual
          ? DeliveryMethod.whatsappCopy
          : DeliveryMethod.twilioCall,
      pollOutcome: HotlinePollOutcome.none,
    );
  }

  /// Start over for the same student: back to step 1 with no draft and no
  /// outreach. The way out of every terminal panel.
  void startNewMessage() {
    if (state.isBusy) return;
    _stopPolling();
    _flowGen++;
    final hasStudent = state.studentId?.isNotEmpty ?? false;
    _set(
      // A call opened from Updates (by its id) has no student to start over
      // for: choose one.
      stage: hasStudent ? HotlineStage.reason : HotlineStage.pickStudent,
      selectedReason: state.suggestedReason,
      teacherNote: '',
      draftedMessage: null,
      spokenScript: null,
      outreachId: null,
      deliveryMethod: DeliveryMethod.twilioCall,
      callResult: null,
      callStartedAt: null,
      pollOutcome: HotlinePollOutcome.none,
      pollTrouble: false,
      error: _clearedError(),
      errorMessage: null,
      errorCause: null,
    );
  }

  /// WhatsApp-copy fallback (SPEC §A.2): record the outreach once with
  /// `deliveryMethod: whatsapp_copy` and land on the manual panel. If an
  /// outreach already exists for this draft it is reused, never duplicated —
  /// a second record would block "Call parent" through the dedup. No call is
  /// ever placed.
  Future<void> copyForWhatsApp() async {
    if (state.isBusy) return;
    final drafted = state.draftedMessage;
    if (drafted == null || drafted.trim().isEmpty) return;

    void landManual(String outreachId) => _set(
      isBusy: false,
      outreachId: outreachId,
      deliveryMethod: DeliveryMethod.whatsappCopy,
      callResult: const CallResult(callStatus: CallStatus.manual),
      pollOutcome: HotlinePollOutcome.none,
      stage: HotlineStage.summary,
      error: HotlineError.none,
      errorMessage: null,
      errorCause: null,
    );

    final existing = state.outreachId;
    if (existing != null && existing.isNotEmpty) {
      landManual(existing);
      return;
    }

    final gen = _flowGen;
    _set(
      isBusy: true,
      error: HotlineError.none,
      errorMessage: null,
      errorCause: null,
    );
    final String outreachId;
    try {
      outreachId = await _repo.createOutreach(
        _buildCreateDto(DeliveryMethod.whatsappCopy),
      );
    } on ParentHotlineException catch (e) {
      if (_disposed || gen != _flowGen) return;
      _mapCreateError(e);
      _set(isBusy: false);
      return;
    } catch (e) {
      if (_disposed || gen != _flowGen) return;
      _setFailure(e);
      _set(isBusy: false);
      return;
    }
    if (_disposed || gen != _flowGen) return;
    _remember(outreachId, callPlaced: false);
    landManual(outreachId);
  }

  /// "Check again" on the still-in-progress / could-not-check panels: re-poll
  /// the same outreach.
  void recheckCall() {
    if (state.isBusy) return;
    final id = state.outreachId;
    if (id == null || id.isEmpty) return;
    _set(
      stage: HotlineStage.calling,
      pollOutcome: HotlinePollOutcome.none,
      pollTrouble: false,
      error: _clearedError(),
    );
    _beginPolling(id);
  }

  /// System / header back: steps ONE stage back (review → compose → reason →
  /// picker). Returns false when the screen should pop instead (the picker,
  /// the calling stage — the call continues — and the summary). A draft in
  /// flight is abandoned; a call being placed is not, so back waits on it.
  bool stepBack() {
    switch (state.stage) {
      case HotlineStage.review:
        if (state.isBusy) return true; // a create/call is in flight
        _flowGen++;
        _set(
          stage: HotlineStage.compose,
          error: _clearedError(),
          errorCause: null,
        );
        return true;
      case HotlineStage.compose:
        _flowGen++;
        _set(
          stage: HotlineStage.reason,
          isBusy: false,
          error: _clearedError(),
          errorCause: null,
        );
        return true;
      case HotlineStage.reason:
        if (state.launchedWithStudent) return false;
        _flowGen++;
        _contextGen++; // orphan the resume lookup for the student left behind
        _set(
          stage: HotlineStage.pickStudent,
          error: _clearedError(),
          errorCause: null,
        );
        return true;
      case HotlineStage.pickStudent:
      case HotlineStage.calling:
      case HotlineStage.summary:
        return false;
    }
  }

  /// The screen left `calling` (popped / disposed) — stop polling ONLY. The
  /// server-side call keeps running; re-opening resumes it (SPEC §B.5.5).
  void leaveCalling() {
    _pollTimer?.cancel();
    _pollTimer = null;
    _pollGen++;
    _pollOutreachId = null;
  }

  // ── Polling (SPEC §B.3) ────────────────────────────────────────────────────

  void _beginPolling(String outreachId) {
    _pollTimer?.cancel();
    final gen = ++_pollGen;
    _pollOutreachId = outreachId;
    _pollCount = 0;
    _summaryWaitCount = 0;
    _pollFailures = 0;
    _lastPolledStatus = state.callResult?.callStatus;
    _schedulePoll(kFirstPollDelay, gen);
  }

  void _schedulePoll(Duration delay, int gen) {
    _pollTimer?.cancel();
    _pollTimer = Timer(delay, () => unawaited(_poll(gen)));
  }

  Future<void> _poll(int gen) async {
    if (_disposed || gen != _pollGen) return;
    final outreachId = _pollOutreachId;
    if (outreachId == null) return;

    CallResult? result;
    try {
      result = await _repo.pollSummary(outreachId);
    } on ApiException catch (e) {
      if (_disposed || gen != _pollGen) return;
      if (e.isAuth) {
        _stopPolling();
        _set(error: HotlineError.signedOut, errorMessage: e.message);
        return;
      }
      result = null;
    } catch (_) {
      if (_disposed || gen != _pollGen) return;
      result = null;
    }
    if (_disposed || gen != _pollGen) return;

    if (result == null) {
      // A failed check says nothing about the call. Count it; past the limit
      // say so honestly — never "the call ended".
      _pollFailures++;
      if (_pollFailures >= kMaxPollFailures) {
        _stopPolling();
        _set(
          stage: HotlineStage.summary,
          pollOutcome: HotlinePollOutcome.checkFailed,
          pollTrouble: false,
        );
        return;
      }
      if (_pollFailures >= kPollTroubleAfter) _set(pollTrouble: true);
    } else {
      _pollFailures = 0;
      _lastPolledStatus = result.callStatus;
      _set(callResult: result, pollTrouble: false);
      if (result.callSummary != null) {
        _stopPolling();
        _set(stage: HotlineStage.summary, error: HotlineError.none);
        return;
      }
      // A terminal FAILURE can never produce a summary — leave at once.
      if (result.callStatus.isTerminalFailure ||
          result.callStatus == CallStatus.manual) {
        _stopPolling();
        _set(stage: HotlineStage.summary);
        return;
      }
    }

    final inSummaryWait =
        _summaryWaitCount > 0 || (result != null && result.isTerminal);
    if (inSummaryWait) {
      _summaryWaitCount++;
      if (_summaryWaitCount >= kMaxSummaryWaits) {
        _stopPolling();
        _set(stage: HotlineStage.summary);
        return;
      }
      _schedulePoll(kSummaryWaitInterval, gen);
    } else {
      _pollCount++;
      if (_pollCount >= kMaxPolls) {
        final last = _lastPolledStatus;
        _stopPolling();
        _set(
          stage: HotlineStage.summary,
          pollOutcome: last == CallStatus.initiated
              ? HotlinePollOutcome.stillInProgress
              : HotlinePollOutcome.checkFailed,
          pollTrouble: false,
        );
        return;
      }
      _schedulePoll(kPollInterval, gen);
    }
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
    _pollGen++;
    _pollOutreachId = null;
    _pollCount = 0;
    _summaryWaitCount = 0;
    _pollFailures = 0;
  }

  // ── Dedup countdown ────────────────────────────────────────────────────────

  void _startDedupCountdown(int seconds) {
    _dedupTimer?.cancel();
    var remaining = seconds > 0 ? seconds : kDefaultDedupSeconds;
    _set(dedupRetryAfterSeconds: remaining);
    _dedupTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_disposed) {
        timer.cancel();
        return;
      }
      remaining -= 1;
      if (remaining <= 0) {
        timer.cancel();
        _dedupTimer = null;
        _set(dedupRetryAfterSeconds: null);
      } else {
        _set(dedupRetryAfterSeconds: remaining);
      }
    });
  }

  void _clearDedup() {
    _dedupTimer?.cancel();
    _dedupTimer = null;
    _set(dedupRetryAfterSeconds: null);
  }

  // ── Calling hours ──────────────────────────────────────────────────────────

  /// True when a call may be placed now. Otherwise raises the calling-hours
  /// facet until the window opens and returns false.
  bool _checkCallingWindow() {
    final now = _now();
    final next = CallingWindow.nextOpening(now);
    if (next == null) {
      if (state.isOutsideCallingHours) {
        _set(error: HotlineError.none, nextCallAllowedAt: null);
      }
      return true;
    }
    _blockCallingUntil(next);
    return false;
  }

  void _blockCallingUntil(DateTime? next) {
    _callingWindowTimer?.cancel();
    _callingWindowTimer = null;
    _set(error: HotlineError.outsideCallingHours, nextCallAllowedAt: next);
    if (next == null) return;
    final wait = next.difference(_now());
    if (wait <= Duration.zero) return;
    _callingWindowTimer = Timer(wait, () {
      _callingWindowTimer = null;
      if (_disposed || !state.isOutsideCallingHours) return;
      _set(error: HotlineError.none, nextCallAllowedAt: null);
    });
  }

  // ── Error mapping ──────────────────────────────────────────────────────────

  void _mapCreateError(ParentHotlineException e) {
    switch (e) {
      case PremiumRequiredException():
        _set(error: HotlineError.premiumRequired, errorMessage: e.message);
      case NoParentPhoneException():
        _set(error: HotlineError.noParentPhone, errorMessage: e.message);
      case OutreachDedupException(:final retryAfterSeconds):
        _startDedupCountdown(retryAfterSeconds);
      case OutreachTargetNotFoundException():
        _set(
          error: HotlineError.notFound,
          errorMessage: e.message,
          errorCause: e.cause,
        );
      case UnsupportedCallLanguageException():
      case CallPlacementFailedException():
      case TwilioNotConfiguredException():
      case OutsideCallingHoursException():
        // Not emitted by the create route; treat defensively as generic.
        _set(
          error: HotlineError.generic,
          errorMessage: e.message,
          errorCause: e.cause,
        );
    }
  }

  void _mapPlaceCallError(ParentHotlineException e) {
    switch (e) {
      case UnsupportedCallLanguageException(:final language):
        _runtimeUncallable.add(language.trim().toLowerCase());
        _set(
          canAutoCall: false,
          error: HotlineError.unsupportedLanguage,
          errorMessage: e.message,
        );
      case NoParentPhoneException():
        _set(error: HotlineError.noParentPhone, errorMessage: e.message);
      case CallPlacementFailedException():
        _set(error: HotlineError.callFailed, errorMessage: e.message);
      case TwilioNotConfiguredException():
        _set(error: HotlineError.telephonyUnavailable, errorMessage: e.message);
      case OutsideCallingHoursException(:final nextAllowedAt):
        _blockCallingUntil(nextAllowedAt ?? CallingWindow.nextOpening(_now()));
        _set(errorMessage: e.message);
      case OutreachTargetNotFoundException():
        _set(
          error: HotlineError.notFound,
          errorMessage: e.message,
          errorCause: e.cause,
        );
      case PremiumRequiredException():
      case OutreachDedupException():
        _set(
          error: HotlineError.generic,
          errorMessage: e.message,
          errorCause: e.cause,
        );
    }
  }

  /// A failure that is not a typed hotline case: 401 → signed out; anything
  /// else → the generic facet carrying its cause for translated copy.
  void _setFailure(Object e) {
    if (e is ApiException && e.isAuth) {
      _set(error: HotlineError.signedOut, errorMessage: e.message);
      return;
    }
    _set(
      error: HotlineError.generic,
      errorMessage: e is ApiException ? e.message : null,
      errorCause: e,
    );
  }

  /// The facet to fall back to when an intent clears the error: the premium
  /// gate and the calling-hours block outlive a step.
  HotlineError _clearedError() {
    if (state.isPremiumGated) return HotlineError.premiumRequired;
    if (state.isOutsideCallingHours) return HotlineError.outsideCallingHours;
    if (state.error == HotlineError.unsupportedLanguage) {
      return HotlineError.unsupportedLanguage;
    }
    return HotlineError.none;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  void _remember(String outreachId, {required bool callPlaced}) {
    final message = state.draftedMessage;
    if (message == null) return;
    _memos[outreachId] = _OutreachMemo(
      message: message,
      spokenScript: state.spokenScript,
      reason: state.selectedReason,
      callPlaced: callPlaced,
    );
  }

  static String? _cleanSubject(String? subject) {
    final s = subject?.trim();
    return (s == null || s.isEmpty) ? null : s;
  }

  bool _deriveCallable(String language) {
    if (_runtimeUncallable.contains(language.trim().toLowerCase())) {
      return false;
    }
    return _policy.canCall(language);
  }

  CreateOutreachRequestDto _buildCreateDto(DeliveryMethod delivery) {
    final note = state.teacherNote.trim();
    return CreateOutreachRequestDto.build(
      classId: state.classId ?? '',
      className: state.className ?? '',
      studentId: state.studentId ?? '',
      studentName: state.studentName ?? '',
      parentLanguage: state.parentLanguage,
      reason: state.selectedReason ?? OutreachReason.consecutiveAbsences,
      generatedMessage: state.draftedMessage ?? '',
      deliveryMethod: delivery,
      teacherNote: note.isEmpty ? null : note,
      spokenScript: state.spokenScript,
      subject: state.subject,
      performanceContext: state.performanceContext,
    );
  }

  ParentMessageReason _toMessageReason(OutreachReason reason) {
    for (final r in ParentMessageReason.values) {
      if (r.wire == reason.wire) return r;
    }
    return ParentMessageReason.consecutiveAbsences;
  }

  void _set({
    HotlineStage? stage,
    Object? studentId = _unset,
    Object? studentName = _unset,
    Object? classId = _unset,
    Object? className = _unset,
    String? parentLanguage,
    Object? subject = _unset,
    Object? suggestedReason = _unset,
    Object? selectedReason = _unset,
    String? teacherNote,
    Object? consecutiveAbsentDays = _unset,
    Object? performanceContext = _unset,
    Object? evidence = _unset,
    Object? draftedMessage = _unset,
    Object? spokenScript = _unset,
    bool? canAutoCall,
    Object? outreachId = _unset,
    DeliveryMethod? deliveryMethod,
    Object? callResult = _unset,
    Object? callStartedAt = _unset,
    HotlinePollOutcome? pollOutcome,
    bool? pollTrouble,
    Object? dedupRetryAfterSeconds = _unset,
    Object? nextCallAllowedAt = _unset,
    HotlineError? error,
    Object? errorMessage = _unset,
    Object? errorCause = _unset,
    bool? isBusy,
    bool? launchedWithStudent,
  }) {
    if (_disposed) return; // never emit after dispose
    state = state.copyWith(
      stage: stage,
      studentId: studentId,
      studentName: studentName,
      classId: classId,
      className: className,
      parentLanguage: parentLanguage,
      subject: subject,
      suggestedReason: suggestedReason,
      selectedReason: selectedReason,
      teacherNote: teacherNote,
      consecutiveAbsentDays: consecutiveAbsentDays,
      performanceContext: performanceContext,
      evidence: evidence,
      draftedMessage: draftedMessage,
      spokenScript: spokenScript,
      canAutoCall: canAutoCall,
      outreachId: outreachId,
      deliveryMethod: deliveryMethod,
      callResult: callResult,
      callStartedAt: callStartedAt,
      pollOutcome: pollOutcome,
      pollTrouble: pollTrouble,
      dedupRetryAfterSeconds: dedupRetryAfterSeconds,
      nextCallAllowedAt: nextCallAllowedAt,
      error: error,
      errorMessage: errorMessage,
      errorCause: errorCause,
      isBusy: isBusy,
      launchedWithStudent: launchedWithStudent,
    );
  }
}
