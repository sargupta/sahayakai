import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_exception.dart';
import '../../parent_message/data/parent_message_repository.dart';
import '../../parent_message/domain/parent_message.dart';
import '../data/dto/outreach_dtos.dart';
import '../data/parent_hotline_errors.dart';
import '../data/parent_hotline_repository.dart';
import '../domain/parent_outreach.dart';

part 'parent_hotline_controller.g.dart';

// ─── Poll discipline (SPEC §B.3, ported EXACTLY from the web modal) ───────────

/// The first `call-summary` poll fires this long after the call is placed.
const Duration kFirstPollDelay = Duration(seconds: 3);

/// After the first poll, an in-flight (`initiated`) call is re-polled at this
/// cadence.
const Duration kPollInterval = Duration(seconds: 5);

/// Ceiling on the `initiated` phase — 3s + 59×5s ≈ 5min, matching the web
/// modal's "~5 min" cap. Past it, the call is treated as exhausted.
const int kMaxPolls = 60;

/// Once the status is terminal but the AI `callSummary` has not landed yet, the
/// poll tightens to this cadence while it waits for the summary to generate.
const Duration kSummaryWaitInterval = Duration(seconds: 3);

/// Max polls in the summary-wait phase — 8 × 3s ≈ 24s, matching the web modal's
/// "poll every 3s for ~24s then give up gracefully".
const int kMaxSummaryWaits = 8;

/// The dedup window the outreach route enforces when a 429 arrives with no
/// numeric `retryAfterSeconds` hint (it always should carry one).
const int kDefaultDedupSeconds = 5 * 60;

// ─── Callability (SPEC §B.5.2, F9-001) ───────────────────────────────────────

/// The default set of parent languages the app OPTIMISTICALLY treats as
/// auto-callable, by full English name (matching `AppLocale.aiName`).
///
/// The app cannot see the server's `TWILIO_LANGUAGE_MAP`, so **the server stays
/// the source of truth** (SPEC §A.5 / §B.5.2): this set is only the opening
/// guess. A `422 UnsupportedCallLanguageException` from `placeCall` flips the
/// offending language off at runtime (belt-and-suspenders). All 11 supported
/// languages are seeded callable here — including Odia, which the SPEC notes is
/// voiced via a Hindi fallback server-side and IS callable — so the UI never
/// wrongly hides "Call parent" for a language the server can in fact dial.
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
/// auto-called. Injected (via [callabilityPolicyProvider]) rather than hardcoded
/// so a test can pin the callable set and so the runtime 422 override composes
/// cleanly on top of it. The server remains authoritative; this is the client's
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

// ─── Stages & terminal-outcome model ─────────────────────────────────────────

/// The staged flow inside the one Parent Hotline screen (SPEC §B.1). The happy
/// path is `pickStudent → reason → compose → review → calling → summary`; the
/// terminal branches all resolve INSIDE [HotlineStage.summary] via
/// [ParentHotlineState.summaryOutcome] (see below), never as extra stages.
enum HotlineStage {
  /// Choose the student (skipped when launched from a student row).
  pickStudent,

  /// Choose why the teacher is calling.
  reason,

  /// The evidence panel + teacher note; drafts the message.
  compose,

  /// Read the drafted message; decide Call vs WhatsApp copy.
  review,

  /// The signature waiting state while the call is polled.
  calling,

  /// The payoff: the summary DocumentSheet — or one of the terminal branches
  /// resolved by [ParentHotlineState.summaryOutcome].
  summary,
}

/// How the `summary` stage renders. Terminal call outcomes are modelled here —
/// as *data* on the one `summary` stage — rather than as separate [HotlineStage]
/// members. Rationale: every one of these is "the call flow has concluded, show
/// the teacher the outcome", they share the same masthead/footer scaffolding
/// (SPEC §B.1 stage 6), and the discriminator is a pure function of the polled
/// [CallResult]. Folding them into the stage keeps the stage machine small and
/// the branch exhaustively switchable off a single derived enum, which the
/// U-PH5 screen consumes directly. Keeping them as stages would duplicate the
/// masthead per branch and make "did the flow finish?" ambiguous.
enum HotlineSummaryOutcome {
  /// The AI `callSummary` landed — the full DocumentSheet (the money shot).
  summary,

  /// WhatsApp-copy path (`callStatus == manual`): "Message copied — paste in
  /// WhatsApp to send." No call was placed.
  manual,

  /// `failed / no_answer / busy` — a warm retryable "line was busy / no answer /
  /// couldn't connect" with Try-again + WhatsApp copy.
  callFailed,

  /// Poll exhausted with `turnCount < 2` and no transcript — "Call ended before
  /// a conversation could happen."
  endedNoConversation,

  /// Poll exhausted, summary absent but a transcript exists — show the
  /// transcript with "Summary isn't available for this call."
  summaryUnavailable,
}

/// The controller's error / gate facet. A single enum the U-PH screen switches
/// on: gates ([premiumRequired], [signedOut]) block the whole feature; the
/// call-time facets ([noParentPhone], [unsupportedLanguage], [callFailed],
/// [telephonyUnavailable]) steer toward retry / WhatsApp; [notFound] restarts;
/// [generic] is the safe catch-all. Dedup is NOT modelled here — it is a
/// countdown ([ParentHotlineState.dedupRetryAfterSeconds]), not a blocking
/// error.
enum HotlineError {
  none,
  premiumRequired,
  noParentPhone,
  unsupportedLanguage,
  callFailed,
  telephonyUnavailable,
  notFound,
  signedOut,
  generic,
}

// ─── State ───────────────────────────────────────────────────────────────────

const Object _unset = Object();

/// The single immutable store for the Parent Hotline flow.
///
/// Modelled as a rich [Notifier] state (mirroring `VidyaController`, the
/// codebase's state-machine exemplar) rather than an `AsyncValue`: the flow is a
/// staged machine whose errors are *facets of a stage* (a premium gate on the
/// review step, a dedup countdown on the summary step) rather than a single
/// scalar load, so an `AsyncValue<T>` would flatten distinctions the screen
/// needs. `parent_message`'s trivial one-shot `AsyncValue` is the wrong shape
/// here; Vidya's enum-status + error-facet state is the right one.
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
    this.draftedMessage,
    this.canAutoCall = true,
    this.outreachId,
    this.deliveryMethod = DeliveryMethod.twilioCall,
    this.callResult,
    this.dedupRetryAfterSeconds,
    this.error = HotlineError.none,
    this.errorMessage,
    this.isBusy = false,
  });

  /// The current stage of the flow.
  final HotlineStage stage;

  // ── Selected student / class context ──
  final String? studentId;
  final String? studentName;
  final String? classId;
  final String? className;

  /// The parent's language as a full English name (e.g. `"Kannada"`) — drives
  /// callability + the (server-side) TTS/STT/agent language. Empty until known.
  final String parentLanguage;

  /// Subject for the message-draft + greeting personalization (optional).
  final String? subject;

  /// A reason passed in from the launch context, pre-selected on the reason
  /// stage.
  final OutreachReason? suggestedReason;

  /// The teacher's chosen reason.
  final OutreachReason? selectedReason;

  /// Free-text note the teacher added on the compose stage.
  final String teacherNote;

  /// Consecutive absent days (only meaningful for an absence reason); feeds the
  /// message draft.
  final int? consecutiveAbsentDays;

  /// Opaque recent-marks snapshot, passed through to `createOutreach`.
  final Map<String, dynamic>? performanceContext;

  /// The AI-drafted opening message (the review-stage payload).
  final String? draftedMessage;

  /// Whether "Call parent" is offered. Derived from [CallabilityPolicy] for
  /// [parentLanguage], and flipped false at runtime by a `422` unsupported
  /// language. WhatsApp copy is ALWAYS available regardless.
  final bool canAutoCall;

  /// The created outreach's id — the join key every call route needs.
  final String? outreachId;

  /// How this outreach was delivered (`twilio_call` vs `whatsapp_copy`).
  final DeliveryMethod deliveryMethod;

  /// The latest polled projection: live transcript, turnCount, status, and the
  /// summary once it lands.
  final CallResult? callResult;

  /// Seconds remaining on the 5-min dedup cool-down after a `429`. Null when not
  /// blocked. Renders as a disabled "Call again" countdown, never an error loop.
  final int? dedupRetryAfterSeconds;

  /// The current error / gate facet.
  final HotlineError error;

  /// User-safe message for the current [error].
  final String? errorMessage;

  /// True while an outreach create / call placement / message draft is in
  /// flight (drives skeletons + disables the CTA).
  final bool isBusy;

  /// The whole feature is premium-gated and the teacher is not on an advanced
  /// plan.
  bool get isPremiumGated => error == HotlineError.premiumRequired;

  /// The routes 401'd — show the signed-out `EmptyView`, never a faked identity.
  bool get isSignedOut => error == HotlineError.signedOut;

  /// "Call again" is currently blocked by the dedup cool-down.
  bool get isDedupBlocked => (dedupRetryAfterSeconds ?? 0) > 0;

  /// How the `summary` stage should render, resolved purely from [callResult].
  /// Null when not on the summary stage. Precedence: a real summary wins; then
  /// the manual (WhatsApp) terminal; then a retryable call failure; then the two
  /// poll-exhausted variants (no-conversation vs summary-absent-transcript).
  HotlineSummaryOutcome? get summaryOutcome {
    if (stage != HotlineStage.summary) return null;
    final r = callResult;
    if (r == null) return HotlineSummaryOutcome.endedNoConversation;
    if (r.callSummary != null) return HotlineSummaryOutcome.summary;
    if (r.callStatus == CallStatus.manual) return HotlineSummaryOutcome.manual;
    if (r.callStatus == CallStatus.failed ||
        r.callStatus == CallStatus.noAnswer ||
        r.callStatus == CallStatus.busy) {
      return HotlineSummaryOutcome.callFailed;
    }
    // SPEC §B.1 ordering: the turnCount<2 "no conversation" rule fires BEFORE
    // the transcript-present rule, so a completed call with only the lone agent
    // greeting (turnCount==1, transcript non-empty) reads as "ended before a
    // conversation could happen", not "summary unavailable". Use the domain
    // discriminator (`hadConversation` ⇒ turnCount >= 2).
    if (!r.hadConversation) return HotlineSummaryOutcome.endedNoConversation;
    return HotlineSummaryOutcome.summaryUnavailable;
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
    Object? draftedMessage = _unset,
    bool? canAutoCall,
    Object? outreachId = _unset,
    DeliveryMethod? deliveryMethod,
    Object? callResult = _unset,
    Object? dedupRetryAfterSeconds = _unset,
    HotlineError? error,
    Object? errorMessage = _unset,
    bool? isBusy,
  }) {
    return ParentHotlineState(
      stage: stage ?? this.stage,
      studentId: identical(studentId, _unset)
          ? this.studentId
          : studentId as String?,
      studentName: identical(studentName, _unset)
          ? this.studentName
          : studentName as String?,
      classId: identical(classId, _unset) ? this.classId : classId as String?,
      className: identical(className, _unset)
          ? this.className
          : className as String?,
      parentLanguage: parentLanguage ?? this.parentLanguage,
      subject: identical(subject, _unset) ? this.subject : subject as String?,
      suggestedReason: identical(suggestedReason, _unset)
          ? this.suggestedReason
          : suggestedReason as OutreachReason?,
      selectedReason: identical(selectedReason, _unset)
          ? this.selectedReason
          : selectedReason as OutreachReason?,
      teacherNote: teacherNote ?? this.teacherNote,
      consecutiveAbsentDays: identical(consecutiveAbsentDays, _unset)
          ? this.consecutiveAbsentDays
          : consecutiveAbsentDays as int?,
      performanceContext: identical(performanceContext, _unset)
          ? this.performanceContext
          : performanceContext as Map<String, dynamic>?,
      draftedMessage: identical(draftedMessage, _unset)
          ? this.draftedMessage
          : draftedMessage as String?,
      canAutoCall: canAutoCall ?? this.canAutoCall,
      outreachId: identical(outreachId, _unset)
          ? this.outreachId
          : outreachId as String?,
      deliveryMethod: deliveryMethod ?? this.deliveryMethod,
      callResult: identical(callResult, _unset)
          ? this.callResult
          : callResult as CallResult?,
      dedupRetryAfterSeconds: identical(dedupRetryAfterSeconds, _unset)
          ? this.dedupRetryAfterSeconds
          : dedupRetryAfterSeconds as int?,
      error: error ?? this.error,
      errorMessage: identical(errorMessage, _unset)
          ? this.errorMessage
          : errorMessage as String?,
      isBusy: isBusy ?? this.isBusy,
    );
  }
}

// ─── Controller ──────────────────────────────────────────────────────────────

/// The Parent Hotline brain (SPEC §B.3): the staged flow + the exact web poll
/// discipline + resume.
///
/// **Poll safety (the #1 correctness requirement).** Polling is a self-
/// rescheduling [Timer] (not `Timer.periodic`) so the cadence can vary (3s → 5s
/// → 3s). Two mechanisms guarantee no state is ever emitted after the flow moved
/// on or the screen died:
///   1. a generation counter [_pollGen] captured when a poll session starts and
///      compared after every `await` — a `_stopPolling` / leave / re-bind bumps
///      it, orphaning any in-flight poll continuation;
///   2. a [_disposed] flag set in `ref.onDispose`, checked before every state
///      write ([_set] is a no-op once disposed) and after every `await`.
/// The timer is cancelled in `ref.onDispose` AND whenever the flow leaves
/// `calling`. Leaving `calling` stops polling ONLY — it never cancels the
/// server-side call (SPEC §B.5.5); re-opening resumes via `latestForStudent`.
@Riverpod(keepAlive: true)
class ParentHotlineController extends _$ParentHotlineController {
  bool _disposed = false;

  Timer? _pollTimer;
  int _pollGen = 0;
  String? _pollOutreachId;
  int _pollCount = 0;
  int _summaryWaitCount = 0;

  Timer? _dedupTimer;

  /// Bumped every time the flow re-targets a student (an [init], a
  /// [selectStudent]). A resume lookup captures it and abandons its continuation
  /// if it changed — the same discipline [_pollGen] gives the poll loop. Without
  /// it, a teacher who taps student A then quickly taps student B could have A's
  /// in-flight `outreach-latest` reply land afterwards and drag the flow onto
  /// A's call while B's name is on screen.
  int _contextGen = 0;

  /// Languages a runtime `422` proved uncallable this session (belt-and-
  /// suspenders on top of [CallabilityPolicy]).
  final Set<String> _runtimeUncallable = <String>{};

  @override
  ParentHotlineState build() {
    ref.onDispose(() {
      _disposed = true;
      _pollTimer?.cancel();
      _pollTimer = null;
      _pollGen++; // orphan any in-flight poll continuation (belt on _disposed)
      _dedupTimer?.cancel();
      _dedupTimer = null;
    });
    return const ParentHotlineState();
  }

  ParentHotlineRepository get _repo =>
      ref.read(parentHotlineRepositoryProvider);
  ParentMessageRepository get _messages =>
      ref.read(parentMessageRepositoryProvider);
  CallabilityPolicy get _policy => ref.read(callabilityPolicyProvider);

  // ── Open / resume (SPEC §B.3 cases a/b/c) ──────────────────────────────────

  /// Called when the screen opens. Seeds the launch context, then — if a student
  /// is already known (the attendance "Call parent" hand-off) — hands off to
  /// [_resumeOrStart], which decides between resuming an outreach and starting a
  /// fresh one. With no student the flow opens on `pickStudent`, and the resume
  /// happens on the tap instead (see [selectStudent]).
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
    _runtimeUncallable.clear();
    // A different student is a fresh dedup scope (the server dedups per
    // (teacher, student)); never let student A's cool-down block student B.
    if ((studentId ?? '') != (state.studentId ?? '')) _clearDedup();
    _set(
      studentId: studentId,
      studentName: studentName,
      classId: classId,
      className: className,
      parentLanguage: lang,
      subject: subject,
      suggestedReason: suggestedReason,
      selectedReason: suggestedReason,
      canAutoCall: _deriveCallable(lang),
      error: HotlineError.none,
      errorMessage: null,
    );

    if (studentId == null || studentId.isEmpty) {
      _set(stage: HotlineStage.pickStudent);
      return;
    }

    // The flow is still on `pickStudent` here, so the nothing-to-resume answer
    // has to place it.
    await _resumeOrStart(
      studentId,
      gen: ++_contextGen,
      fallbackStage: HotlineStage.reason,
    );
  }

  // ── Stage intents ──────────────────────────────────────────────────────────

  /// Pick a student (stage 1) → advances to the reason stage. Seeds the context
  /// and (re)derives callability from the parent language.
  ///
  /// **Then it resumes, exactly as [init] does.** The screen only carries a
  /// launch `studentId` when it was opened from an attendance row; the standalone
  /// Dashboard entry opens on `pickStudent` with no student at all, so the resume
  /// lookup in [init] never fires for it. A teacher whose call is in flight,
  /// who backs out and re-opens the hotline from the Dashboard, therefore lands
  /// on the picker — and without this, tapping the student they are already
  /// calling would drop them at `reason` and lose the run. `outreach-latest` is
  /// the same 24h (teacher, student) lookup either way; the entry point should
  /// not decide whether the teacher gets their call back.
  ///
  /// The stage moves to `reason` SYNCHRONOUSLY so the tap is answered on the
  /// frame it happened; the lookup only overrides it if there is genuinely
  /// something to resume.
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
    // Switching students resets the (teacher, student)-scoped dedup cool-down so
    // a never-contacted student is never silently blocked (SPEC §B.5.2/§B.5.3).
    _clearDedup();
    _set(
      stage: HotlineStage.reason,
      studentId: studentId,
      studentName: studentName,
      classId: classId,
      className: className,
      parentLanguage: lang,
      subject: subject,
      suggestedReason: suggestedReason,
      selectedReason: suggestedReason,
      canAutoCall: _deriveCallable(lang),
      draftedMessage: null,
      outreachId: null,
      callResult: null,
      error: HotlineError.none,
      errorMessage: null,
    );

    // No fallback stage: `reason` is already set above, and the teacher may well
    // have moved on to `compose` by the time the lookup answers. Re-asserting a
    // stage they have left would yank them backwards for no reason.
    await _resumeOrStart(studentId, gen: ++_contextGen);
  }

  /// Asks `GET /api/attendance/outreach-latest?studentId=…` whether this student
  /// has a resumable outreach in the server's 24h window, and lands the flow on
  /// the right stage (SPEC §B.3 cases a/b/c):
  ///   (a) a terminal call with a `callSummary` → jump straight to `summary`;
  ///   (b) an `initiated` call → resume `calling` and re-bind polling to it;
  ///   (c) nothing (or `{ outreachId: null }`) → a fresh flow at `reason`.
  /// A non-initiated, non-summary terminal (failed / no_answer / busy / manual,
  /// or a completed call whose summary never generated) resolves to the `summary`
  /// stage's matching terminal outcome.
  ///
  /// A `401` is the signed-out gate. Every other lookup failure degrades to a
  /// fresh flow rather than blocking the teacher: resume is a courtesy, and a
  /// flaky network must not stand between a teacher and a call they can still
  /// place. [gen] is the [_contextGen] captured by the caller — a newer target
  /// abandons this continuation.
  ///
  /// [fallbackStage] is where case (c) lands, and is null when the caller has
  /// already placed the flow itself. That distinction matters: a teacher who
  /// taps a student and picks a reason before a slow reply arrives must not be
  /// dragged back to the reason stage by a lookup that found nothing.
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
      latest = null; // non-auth lookup failure → fall through to a fresh flow
    } catch (_) {
      if (_disposed || gen != _contextGen) return;
      latest = null;
    }
    if (_disposed || gen != _contextGen) return;

    if (latest == null) {
      // Case (c): nothing to resume — a fresh flow, at the caller's fallback if
      // it asked for one.
      if (fallbackStage != null) _set(stage: fallbackStage);
      return;
    }

    final result = latest.result;
    if (result.isTerminal && result.callSummary != null) {
      // Case (a): completed with a summary — jump straight to the payoff.
      _set(
        stage: HotlineStage.summary,
        outreachId: latest.outreachId,
        callResult: result,
      );
      return;
    }
    if (result.callStatus == CallStatus.initiated) {
      // Case (b): still in flight — resume calling and re-bind polling.
      _set(
        stage: HotlineStage.calling,
        outreachId: latest.outreachId,
        callResult: result,
      );
      _beginPolling(latest.outreachId);
      return;
    }
    // Terminal without a summary → the summary stage resolves the right
    // terminal outcome.
    _set(
      stage: HotlineStage.summary,
      outreachId: latest.outreachId,
      callResult: result,
    );
  }

  /// Choose the reason (stage 2) → advances to the compose stage.
  void selectReason(OutreachReason reason) {
    _set(
      stage: HotlineStage.compose,
      selectedReason: reason,
      error: HotlineError.none,
      errorMessage: null,
    );
  }

  /// Update the teacher note on the compose stage.
  void updateNote(String note) => _set(teacherNote: note);

  /// Draft the opening message (stage 3) by delegating to the existing
  /// `parent_message` repository — the SPEC forbids re-implementing it. On
  /// success advances to the review stage. A `401` → signed-out; anything else →
  /// the generic failed facet (the compose stage stays put so the teacher can
  /// retry).
  Future<void> draftMessage({
    int? consecutiveAbsentDays,
    Map<String, dynamic>? performanceContext,
  }) async {
    final reason = state.selectedReason;
    if (reason == null) return; // guarded by the reason stage in practice

    _set(
      isBusy: true,
      error: HotlineError.none,
      errorMessage: null,
      consecutiveAbsentDays:
          consecutiveAbsentDays ?? state.consecutiveAbsentDays,
      performanceContext: performanceContext ?? state.performanceContext,
    );

    final request = ParentMessageRequest(
      studentName: state.studentName ?? '',
      className: state.className ?? '',
      subject: (state.subject?.trim().isNotEmpty ?? false)
          ? state.subject!.trim()
          : (state.className ?? ''),
      reason: _toMessageReason(reason),
      parentLanguage: state.parentLanguage,
      teacherNote: state.teacherNote.trim().isEmpty
          ? null
          : state.teacherNote.trim(),
      consecutiveAbsentDays:
          consecutiveAbsentDays ?? state.consecutiveAbsentDays,
    );

    final ParentMessage message;
    try {
      message = await _messages.draft(request);
    } on ApiException catch (e) {
      if (_disposed) return;
      _setAuthOrGeneric(e);
      _set(isBusy: false);
      return;
    } catch (_) {
      if (_disposed) return;
      _set(isBusy: false, error: HotlineError.generic);
      return;
    }
    if (_disposed) return;

    _set(
      isBusy: false,
      draftedMessage: message.message,
      stage: HotlineStage.review,
    );
  }

  // ── Create + call (stage 4 → 5) ────────────────────────────────────────────

  /// Persist the outreach then place the call, entering `calling` and starting
  /// the poll loop. Blocked while a dedup countdown is active. Never sends the
  /// parent phone (F9-001) — the DTO omits it and `placeCall` carries only
  /// `{ outreachId, parentLanguage }`.
  Future<void> createAndCall() async {
    if (state.isDedupBlocked) return;
    final drafted = state.draftedMessage;
    if (drafted == null || drafted.trim().isEmpty) return;

    _set(isBusy: true, error: HotlineError.none, errorMessage: null);

    final String outreachId;
    try {
      outreachId = await _repo.createOutreach(
        _buildCreateDto(DeliveryMethod.twilioCall),
      );
    } on ParentHotlineException catch (e) {
      if (_disposed) return;
      _mapCreateError(e);
      _set(isBusy: false);
      return;
    } on ApiException catch (e) {
      if (_disposed) return;
      _setAuthOrGeneric(e);
      _set(isBusy: false);
      return;
    } catch (_) {
      if (_disposed) return;
      _set(isBusy: false, error: HotlineError.generic);
      return;
    }
    if (_disposed) return;

    _set(outreachId: outreachId, deliveryMethod: DeliveryMethod.twilioCall);
    await _placeAndPoll(outreachId);
  }

  /// Places the call for an already-created [outreachId] and, on success, enters
  /// `calling` + starts polling. Factored out so [retryCall] can re-dial the
  /// same outreach without minting a new one (which would trip the dedup).
  Future<void> _placeAndPoll(String outreachId) async {
    _set(isBusy: true, error: HotlineError.none, errorMessage: null);
    try {
      await _repo.placeCall(
        outreachId: outreachId,
        parentLanguage: state.parentLanguage,
      );
    } on UnsupportedCallLanguageException catch (e) {
      if (_disposed) return;
      _runtimeUncallable.add(e.language.trim().toLowerCase());
      _set(
        isBusy: false,
        canAutoCall: false,
        stage: HotlineStage.review,
        error: HotlineError.unsupportedLanguage,
        errorMessage: e.message,
      );
      return;
    } on ParentHotlineException catch (e) {
      if (_disposed) return;
      _mapPlaceCallError(e);
      _set(isBusy: false, stage: HotlineStage.review);
      return;
    } on ApiException catch (e) {
      if (_disposed) return;
      _setAuthOrGeneric(e);
      _set(isBusy: false, stage: HotlineStage.review);
      return;
    } catch (_) {
      if (_disposed) return;
      _set(
        isBusy: false,
        stage: HotlineStage.review,
        error: HotlineError.generic,
      );
      return;
    }
    if (_disposed) return;

    _set(
      isBusy: false,
      stage: HotlineStage.calling,
      callResult: const CallResult(callStatus: CallStatus.initiated),
      error: HotlineError.none,
      errorMessage: null,
    );
    _beginPolling(outreachId);
  }

  /// Retry after a failed / no-answer / busy call, or a failed placement. Re-
  /// dials the EXISTING outreach when one exists (avoiding the create-side
  /// dedup); otherwise runs the full create+call.
  Future<void> retryCall() async {
    final existing = state.outreachId;
    if (existing != null && existing.isNotEmpty) {
      await _placeAndPoll(existing);
    } else {
      await createAndCall();
    }
  }

  /// "Call again later" from the summary stage — a genuinely NEW outreach,
  /// subject to the 5-min dedup. Blocked (no-op) while the countdown is live; a
  /// fresh `429` re-arms it.
  Future<void> callAgain() async {
    if (state.isDedupBlocked) return;
    _set(
      outreachId: null,
      callResult: null,
      stage: HotlineStage.review,
      error: HotlineError.none,
      errorMessage: null,
    );
    await createAndCall();
  }

  /// WhatsApp-copy fallback (SPEC §A.2): persist the outreach with
  /// `deliveryMethod: whatsapp_copy` and land on the manual terminal. **No call
  /// is ever placed.**
  Future<void> copyForWhatsApp() async {
    // NOT dedup-gated: WhatsApp copy is the universal fallback and must stay
    // available even inside the call cool-down (SPEC §B.5.2 "always available").
    final drafted = state.draftedMessage;
    if (drafted == null || drafted.trim().isEmpty) return;

    _set(isBusy: true, error: HotlineError.none, errorMessage: null);
    final String outreachId;
    try {
      outreachId = await _repo.createOutreach(
        _buildCreateDto(DeliveryMethod.whatsappCopy),
      );
    } on ParentHotlineException catch (e) {
      if (_disposed) return;
      _mapCreateError(e);
      _set(isBusy: false);
      return;
    } on ApiException catch (e) {
      if (_disposed) return;
      _setAuthOrGeneric(e);
      _set(isBusy: false);
      return;
    } catch (_) {
      if (_disposed) return;
      _set(isBusy: false, error: HotlineError.generic);
      return;
    }
    if (_disposed) return;

    _set(
      isBusy: false,
      outreachId: outreachId,
      deliveryMethod: DeliveryMethod.whatsappCopy,
      callResult: const CallResult(callStatus: CallStatus.manual),
      stage: HotlineStage.summary,
      error: HotlineError.none,
      errorMessage: null,
    );
  }

  /// The screen navigated away from `calling` (backgrounded / popped) — stop
  /// polling ONLY. The server-side call keeps running; re-opening the screen
  /// resumes it via [init] → `latestForStudent` (SPEC §B.5.5). State is left
  /// intact so a re-bind has everything it needs.
  void leaveCalling() {
    _pollTimer?.cancel();
    _pollTimer = null;
    _pollGen++; // orphan any in-flight poll continuation
    _pollOutreachId = null;
  }

  // ── Polling (SPEC §B.3) ────────────────────────────────────────────────────

  void _beginPolling(String outreachId) {
    _pollTimer?.cancel();
    final gen = ++_pollGen;
    _pollOutreachId = outreachId;
    _pollCount = 0;
    _summaryWaitCount = 0;
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
      // Transient — keep the waiting state and advance the cadence (counted
      // toward the ceiling so a persistent failure still exhausts gracefully).
      result = null;
    } catch (_) {
      if (_disposed || gen != _pollGen) return;
      result = null;
    }
    // Post-await guard (load-bearing — see the "poll in flight" dispose test):
    // a dispose or a fresher poll generation abandons this continuation before
    // it can touch state or schedule another poll.
    if (_disposed || gen != _pollGen) return;

    if (result != null) {
      _set(callResult: result);
      if (result.callSummary != null) {
        _stopPolling();
        _set(stage: HotlineStage.summary, error: HotlineError.none);
        return;
      }
      // A terminal FAILURE (failed / no_answer / busy) can never produce a
      // summary — the call never connected — so flip to the `summary` stage's
      // honest `callFailed` outcome the INSTANT it lands, rather than sitting on
      // the calling stage for the ~24s summary-wait window while it falsely reads
      // "Conversation in progress". This mirrors the web modal, which leaves the
      // calling view on any terminal status. A `completed` call (a real
      // conversation whose AI summary may still be settling) is NOT a failure and
      // keeps the short summary-wait below.
      if (result.callStatus.isTerminalFailure) {
        _stopPolling();
        _set(stage: HotlineStage.summary);
        return;
      }
    }

    // Terminal-without-summary tightens to the 3s summary-wait cadence; once in
    // that phase we stay in it.
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
        _stopPolling();
        _set(stage: HotlineStage.summary);
        return;
      }
      _schedulePoll(kPollInterval, gen);
    }
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
    _pollGen++; // invalidate any scheduled / in-flight poll continuation
    _pollOutreachId = null;
    _pollCount = 0;
    _summaryWaitCount = 0;
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

  /// Cancel the dedup cool-down and clear its countdown. Called on any student-
  /// context change so a dedup armed for one student never blocks another (the
  /// dedup is server-scoped per (teacher, student), not global).
  void _clearDedup() {
    _dedupTimer?.cancel();
    _dedupTimer = null;
    _set(dedupRetryAfterSeconds: null);
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
        _set(error: HotlineError.notFound, errorMessage: e.message);
      case UnsupportedCallLanguageException():
      case CallPlacementFailedException():
      case TwilioNotConfiguredException():
        // Not emitted by the create route; treat defensively as generic.
        _set(error: HotlineError.generic, errorMessage: e.message);
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
      case OutreachTargetNotFoundException():
        _set(error: HotlineError.notFound, errorMessage: e.message);
      case PremiumRequiredException():
      case OutreachDedupException():
        _set(error: HotlineError.generic, errorMessage: e.message);
    }
  }

  void _setAuthOrGeneric(ApiException e) {
    if (e.isAuth) {
      _set(error: HotlineError.signedOut, errorMessage: e.message);
    } else {
      _set(error: HotlineError.generic, errorMessage: e.message);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  bool _deriveCallable(String language) {
    if (_runtimeUncallable.contains(language.trim().toLowerCase())) {
      return false;
    }
    return _policy.canCall(language);
  }

  CreateOutreachRequestDto _buildCreateDto(DeliveryMethod delivery) {
    return CreateOutreachRequestDto.build(
      classId: state.classId ?? '',
      className: state.className ?? '',
      studentId: state.studentId ?? '',
      studentName: state.studentName ?? '',
      parentLanguage: state.parentLanguage,
      reason: state.selectedReason ?? OutreachReason.consecutiveAbsences,
      generatedMessage: state.draftedMessage ?? '',
      deliveryMethod: delivery,
      teacherNote: state.teacherNote.trim().isEmpty ? null : state.teacherNote,
      subject: state.subject,
      performanceContext: state.performanceContext,
    );
  }

  /// The reason enums are wire-identical; map by the shared wire token so the
  /// `parent_message` request carries the same reason the outreach will.
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
    Object? draftedMessage = _unset,
    bool? canAutoCall,
    Object? outreachId = _unset,
    DeliveryMethod? deliveryMethod,
    Object? callResult = _unset,
    Object? dedupRetryAfterSeconds = _unset,
    HotlineError? error,
    Object? errorMessage = _unset,
    bool? isBusy,
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
      draftedMessage: draftedMessage,
      canAutoCall: canAutoCall,
      outreachId: outreachId,
      deliveryMethod: deliveryMethod,
      callResult: callResult,
      dedupRetryAfterSeconds: dedupRetryAfterSeconds,
      error: error,
      errorMessage: errorMessage,
      isBusy: isBusy,
    );
  }
}
