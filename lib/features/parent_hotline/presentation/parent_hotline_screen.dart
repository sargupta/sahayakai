import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/platform/clock.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/widgets/ai_text.dart';
import '../../../shared/widgets/app_segmented.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/icon_well.dart';
import '../../../shared/widgets/inline_error.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/map_card.dart';
import '../../../shared/widgets/map_chip.dart';
import '../../../shared/widgets/map_page_header.dart';
import '../../../shared/widgets/note_banner.dart';
import '../../../shared/widgets/press_scale.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/secondary_button.dart';
import '../../attendance/data/attendance_errors.dart';
import '../../attendance/domain/attendance_date.dart';
import '../../notifications/data/notifications_store.dart';
import '../../notifications/domain/teacher_notification.dart';
import '../../vidya/presentation/vidya_cta_clearance.dart';
import '../domain/hotline_evidence.dart';
import '../domain/hotline_launch.dart';
import '../domain/hotline_roster.dart';
import '../domain/hotline_student.dart';
import '../domain/parent_outreach.dart';
import 'hotline_copy.dart';
import 'hotline_roster_provider.dart';
import 'parent_hotline_controller.dart';
import 'widgets/call_plan_card.dart';
import 'widgets/calling_stage.dart';
import 'widgets/reason_card.dart';
import 'widgets/summary_sheet.dart';

/// The Parent Hotline: pick a student, say why, look at the evidence, review
/// the message, then an AI voice agent calls the parent in their language and
/// a summary comes back. Laid out as the UX map's "Parent outreach" flow:
///
///   • **Parent outreach** — the class's students, each with a Contact chip;
///     the ones just marked absent first, flagged; "Add student" in the header.
///   • **Step 1 of 3 · Reason** — four reasons, the chosen one checked; Next.
///   • **Step 2 of 3 · Evidence** — the student's real recent absences and
///     marks (the AI is told to cite these and invent nothing), a note; Back
///     and "Draft the message".
///   • **Step 3 of 3 · Review** — the message, Regenerate, then Call parent /
///     Copy for WhatsApp pinned at the bottom.
///   • **Calling** — a ticking call timer and the live transcript; "Leave —
///     the call continues" (the server-side call never stops when the teacher
///     leaves; re-opening resumes it).
///   • **Summary** — the AI summary, or an honest terminal panel.
///
/// The flow itself lives in [ParentHotlineController]; this screen only shows
/// its state and forwards intents. Back steps back one stage before it ever
/// leaves the screen. Nothing on these pages is invented: no counts, marks or
/// outcomes the server did not return.
class ParentHotlineScreen extends ConsumerStatefulWidget {
  const ParentHotlineScreen({
    super.key,
    this.studentId,
    this.studentName,
    this.classId,
    this.className,
    this.parentLanguage,
    this.subject,
    this.suggestedReason,
    this.taskId,
    this.absentStudentIds = const <String>{},
    this.outreachId,
  });

  /// Opens with everything a [HotlineLaunch] carries (the route's `extra`).
  ParentHotlineScreen.fromLaunch(HotlineLaunch launch, {Key? key})
    : this(
        key: key,
        studentId: launch.studentId,
        studentName: launch.studentName,
        classId: launch.classId,
        className: launch.className,
        parentLanguage: launch.parentLanguage,
        subject: launch.subject,
        suggestedReason: launch.suggestedReason,
        taskId: launch.taskId,
        absentStudentIds: launch.absentStudentIds,
        outreachId: launch.outreachId,
      );

  final String? taskId;
  final String? studentId;
  final String? studentName;

  /// The class to show first in the picker.
  final String? classId;
  final String? className;
  final String? parentLanguage;
  final String? subject;
  final OutreachReason? suggestedReason;

  /// Students just marked absent on the register that opened this screen:
  /// listed first in their class, each flagged "Marked absent".
  final Set<String> absentStudentIds;

  /// One call to open directly (a call row in Updates); [studentName] is its
  /// student.
  final String? outreachId;

  @override
  ConsumerState<ParentHotlineScreen> createState() =>
      _ParentHotlineScreenState();
}

class _ParentHotlineScreenState extends ConsumerState<ParentHotlineScreen> {
  final _noteController = TextEditingController();

  /// Read once, so dispose can still stop the poll after `ref` is gone.
  late final ParentHotlineController _controller;

  /// The roster entry the teacher picked: its masked last-4 shows in the
  /// header. The controller never carries a phone number (F9-001).
  HotlineStudent? _selectedStudent;

  /// The class shown in the picker; null → the launch class, else the first.
  String? _selectedClassId;

  @override
  void initState() {
    super.initState();
    _controller = ref.read(parentHotlineControllerProvider.notifier);
    _selectedClassId = widget.classId;
    // Seed the flow once the first frame is up. With no student this lands on
    // the picker; with one it checks whether there is a call to resume.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final outreach = widget.outreachId;
      if (outreach != null && outreach.isNotEmpty) {
        unawaited(
          _controller.openOutreach(
            outreachId: outreach,
            studentName: widget.studentName ?? '',
          ),
        );
        return;
      }
      unawaited(
        _controller.init(
          studentId: widget.studentId,
          studentName: widget.studentName,
          classId: widget.classId,
          className: widget.className,
          parentLanguage: widget.parentLanguage,
          subject: widget.subject,
          suggestedReason: widget.suggestedReason,
        ),
      );
    });
  }

  @override
  void dispose() {
    // Stops the local status poll only; the call itself carries on and
    // re-opening the screen resumes it.
    _controller.leaveCalling();
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = ref.watch(parentHotlineControllerProvider);

    // Record a finished call in Community → Updates (see _recordCallOutcome).
    ref.listen<ParentHotlineState>(parentHotlineControllerProvider, (
      prev,
      next,
    ) {
      if (prev?.summaryOutcome != next.summaryOutcome) {
        _recordCallOutcome(next);
      }
      // A new student (or "Start a new message") clears the note in the
      // controller; the text field follows, so one student's note can never
      // be sent about another.
      if (next.teacherNote.isEmpty && _noteController.text.isNotEmpty) {
        _noteController.clear();
      }
    });

    final gated = state.isSignedOut || state.isPremiumGated;
    final (Widget body, String revealKey) = switch (state) {
      _ when state.isSignedOut => (_signedOut(l10n), 'gate-signed-out'),
      _ when state.isPremiumGated => (
        _premiumGate(state, l10n),
        'gate-premium',
      ),
      _ => (_stageBody(context, state, l10n), 'stage-${state.stage.name}'),
    };

    final (title, subtitle) = _heading(state, l10n);

    return PopScope(
      key: const Key('parentHotlinePopScope'),
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        // Back walks the flow one stage at a time before it leaves.
        if (!gated && _controller.stepBack()) return;
        _leave();
      },
      child: _HotlineFrame(
        title: title,
        subtitle: subtitle,
        headerTrailing: gated ? null : _headerAction(state, l10n),
        footer: gated ? null : _footer(context, state, l10n),
        child: KeyedSubtree(
          key: ValueKey(revealKey),
          child: staggeredItem(context, body),
        ),
      ),
    );
  }

  /// Leaves the screen. The call (if any) carries on server-side; only the
  /// local status poll stops. Opened as the first page (a deep link), there
  /// is nothing to pop back to, so it goes home instead of popping the stack
  /// empty.
  void _leave() {
    // Leaving a live call: say it carries on, and where to find it again.
    if (ref.read(parentHotlineControllerProvider).stage ==
        HotlineStage.calling) {
      ScaffoldMessenger.maybeOf(context)
        ?..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(content: Text(context.l10n.parentHotlineCallContinuesNote)),
        );
    }
    _controller.leaveCalling();
    final navigator = Navigator.of(context);
    if (navigator.canPop()) {
      navigator.pop();
    } else {
      GoRouter.maybeOf(context)?.go(Routes.home);
    }
  }

  // ── Heading ──────────────────────────────────────────────────────────────────

  /// The page title and its muted line, per stage: "Parent outreach" with the
  /// count of reachable parents on the picker; "Contact {name}'s parent" with
  /// the masked phone and the language (in its own script) once a student is
  /// chosen.
  (String, String?) _heading(ParentHotlineState state, AppLocalizations l10n) {
    final name = state.studentName?.trim() ?? '';
    if (state.stage == HotlineStage.pickStudent || name.isEmpty) {
      final roster = ref.watch(hotlineRosterProvider).valueOrNull;
      final loaded = [
        for (final r in roster ?? const <HotlineClassRoster>[])
          if (!r.failed) r,
      ];
      final total = loaded.fold<int>(0, (n, r) => n + r.students.length);
      final reachable = loaded.fold<int>(0, (n, r) => n + r.reachableCount);
      return (
        l10n.parentHotlineOutreachTitle,
        total == 0
            ? null
            : l10n.parentHotlineOutreachSubtitle(reachable, total),
      );
    }
    final last4 = _studentFor(state)?.parentPhoneLast4;
    final meta = [
      if (last4 != null && last4.isNotEmpty) l10n.parentHotlinePhoneMask(last4),
      if (state.parentLanguage.isNotEmpty)
        nativeLanguageLabel(state.parentLanguage),
    ].join(' · ');
    return (
      l10n.parentHotlineContactTitle(firstName(name)),
      meta.isEmpty ? null : meta,
    );
  }

  /// The roster entry for the student on screen: the one tapped, or — when
  /// the screen opened on a student (a resumed call, a hand-off) — the same
  /// id looked up in the roster. Null when the roster has not loaded.
  HotlineStudent? _studentFor(ParentHotlineState state) {
    final id = state.studentId;
    if (id == null) return null;
    final picked = _selectedStudent;
    if (picked != null && picked.id == id) return picked;
    for (final klass
        in ref.watch(hotlineRosterProvider).valueOrNull ??
            const <HotlineClassRoster>[]) {
      for (final s in klass.students) {
        if (s.id == id) return s;
      }
    }
    return null;
  }

  /// "Add student" on the picker, for the class on screen.
  Widget? _headerAction(ParentHotlineState state, AppLocalizations l10n) {
    if (state.stage != HotlineStage.pickStudent) return null;
    final classId = _currentClassId();
    if (classId == null) return null;
    return MapChip(
      label: l10n.attendanceAddStudent,
      selected: false,
      idleInk: AppColors.textLink,
      onTap: () async {
        await context.push(Routes.attendanceAddStudentPath(classId));
        // Back from the form: re-read, so a student just added is listed.
        if (mounted) ref.invalidate(hotlineRosterProvider);
      },
    );
  }

  /// The class the picker shows: the chosen one if it is in the roster, else
  /// the first class.
  String? _currentClassId() {
    final roster = ref.read(hotlineRosterProvider).valueOrNull;
    if (roster == null || roster.isEmpty) return null;
    final wanted = _selectedClassId;
    if (wanted != null && roster.any((r) => r.classId == wanted)) return wanted;
    return roster.first.classId;
  }

  // ── Stages ───────────────────────────────────────────────────────────────────

  Widget _stageBody(
    BuildContext context,
    ParentHotlineState state,
    AppLocalizations l10n,
  ) {
    switch (state.stage) {
      case HotlineStage.pickStudent:
        return _pickStudentStage(context, l10n);
      case HotlineStage.reason:
        return _reasonStage(state, l10n);
      case HotlineStage.compose:
        return _composeStage(context, state, l10n);
      case HotlineStage.review:
        return _reviewStage(state, l10n);
      case HotlineStage.calling:
        return CallingStage(
          parentName: state.studentName ?? '',
          callResult: state.callResult,
          className: state.className,
          parentLanguage: state.parentLanguage,
          callStartedAt: state.callStartedAt,
          pollTrouble: state.pollTrouble,
          now: ref.read(nowProvider),
        );
      case HotlineStage.summary:
        return SummarySheet(
          outcome:
              state.summaryOutcome ?? HotlineSummaryOutcome.endedNoConversation,
          studentName: state.studentName ?? '',
          reason: state.selectedReason ?? state.suggestedReason,
          callResult: state.callResult,
          isDedupBlocked: state.isDedupBlocked,
          dedupRetryAfterSeconds: state.dedupRetryAfterSeconds,
          isBusy: state.isBusy,
          hasDraft: state.hasDraft,
          onDone: () => Navigator.of(context).maybePop(),
          onCallAgain: () => unawaited(_controller.callAgain()),
          onRetry: () => unawaited(_controller.retryCall()),
          onCopyForWhatsApp: _onWhatsApp,
          onStartNew: _controller.startNewMessage,
          onCheckAgain: _controller.recheckCall,
        );
    }
  }

  // ── Parent outreach (pick a student) ────────────────────────────────────────

  Widget _pickStudentStage(BuildContext context, AppLocalizations l10n) {
    return ref
        .watch(hotlineRosterProvider)
        .when(
          loading: () => const AppSkeleton(lines: 5),
          error: (error, _) => _rosterError(error, l10n),
          data: (roster) => _rosterList(context, roster, l10n),
        );
  }

  /// Why the roster could not be read. Each cause asks something different of
  /// the teacher, so each gets its own answer.
  Widget _rosterError(Object error, AppLocalizations l10n) {
    // The parent-phone privacy guard: the masked roster shape did not come
    // back, so the read was abandoned rather than decoding full numbers.
    // Nothing the teacher can fix, so no retry that would fail again.
    if (error is RosterProjectionUnavailableException) {
      return _rosterUnavailable(l10n);
    }
    if (error is ApiException && error.isAuth) return _signedOut(l10n);
    return EmptyView(
      icon: LucideIcons.alertTriangle,
      title: l10n.parentHotlineErrorTitle,
      message: hotlineErrorText(l10n, error),
      action: SecondaryButton(
        label: l10n.actionRetry,
        icon: LucideIcons.refreshCw,
        onPressed: () => ref.invalidate(hotlineRosterProvider),
      ),
    );
  }

  Widget _rosterList(
    BuildContext context,
    List<HotlineClassRoster> roster,
    AppLocalizations l10n,
  ) {
    if (roster.isEmpty) return _rosterEmpty(l10n);
    final classId = _currentClassId() ?? roster.first.classId;
    final klass = roster.firstWhere(
      (r) => r.classId == classId,
      orElse: () => roster.first,
    );
    // The students just marked absent come first, in roster order.
    final absent = widget.absentStudentIds;
    final students = [
      ...klass.students.where((s) => absent.contains(s.id)),
      ...klass.students.where((s) => !absent.contains(s.id)),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (roster.length > 1) ...[
          AppSegmented<String>(
            segments: [
              for (final r in roster)
                AppSegment(value: r.classId, label: r.className),
            ],
            value: klass.classId,
            onChanged: (id) => setState(() => _selectedClassId = id),
          ),
          const SizedBox(height: AppSpacing.space4),
        ],
        if (klass.error is RosterProjectionUnavailableException)
          // The privacy guard refused this class's roster: nothing the
          // teacher can fix, so no retry that would only fail again.
          MapCard(
            child: MapEmptyNote(
              icon: LucideIcons.shieldAlert,
              title: l10n.parentHotlineClassLoadFailed,
              message: l10n.parentHotlineRosterUnavailableBody,
            ),
          )
        else if (klass.failed)
          MapCard(
            child: MapEmptyNote(
              icon: LucideIcons.alertTriangle,
              title: l10n.parentHotlineClassLoadFailed,
              message: hotlineErrorText(l10n, klass.error),
              action: SecondaryButton(
                label: l10n.actionRetry,
                icon: LucideIcons.refreshCw,
                onPressed: () => ref.invalidate(hotlineRosterProvider),
              ),
            ),
          )
        else if (students.isEmpty)
          _rosterEmpty(l10n)
        else
          for (final (index, student) in students.indexed) ...[
            if (index > 0) const SizedBox(height: AppSpacing.space2),
            staggeredItem(
              context,
              _StudentCard(
                student: student,
                markedAbsent: absent.contains(student.id),
                onContact: () => _pickStudent(student),
              ),
              index: index,
            ),
          ],
      ],
    );
  }

  void _pickStudent(HotlineStudent student) {
    setState(() => _selectedStudent = student);
    _noteController.clear();
    unawaited(
      _controller.selectStudent(
        studentId: student.id,
        studentName: student.name,
        classId: student.classId,
        className: student.className,
        parentLanguage: student.parentLanguage,
        subject: student.subject,
        suggestedReason: student.suggestedReason,
      ),
    );
  }

  // ── Step 1 · Reason ─────────────────────────────────────────────────────────

  Widget _reasonStage(ParentHotlineState state, AppLocalizations l10n) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        MapOverline(l10n.parentHotlineStepReason, color: AppColors.textEyebrow),
        const SizedBox(height: AppSpacing.space3),
        for (final (index, reason) in OutreachReason.values.indexed) ...[
          if (index > 0) const SizedBox(height: AppSpacing.space2),
          Builder(
            builder: (context) {
              final (icon, label, desc) = reasonMeta(l10n, reason);
              return ReasonCard(
                icon: icon,
                label: label,
                description: desc,
                selected: state.selectedReason == reason,
                // Chooses without advancing; Next confirms.
                onTap: () => _controller.pickReason(reason),
              );
            },
          ),
        ],
      ],
    );
  }

  // ── Step 2 · Evidence ───────────────────────────────────────────────────────

  Widget _composeStage(
    BuildContext context,
    ParentHotlineState state,
    AppLocalizations l10n,
  ) {
    final reason = state.selectedReason ?? OutreachReason.consecutiveAbsences;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        MapOverline(
          l10n.parentHotlineStepEvidence,
          color: AppColors.textEyebrow,
        ),
        const SizedBox(height: AppSpacing.space3),
        // No evidence was requested (no class to read it from): show none,
        // rather than a skeleton that never resolves.
        if (state.evidence case final evidence?) ...[
          _EvidenceCard(
            evidence: evidence,
            onRetry: () => unawaited(_controller.loadEvidence(force: true)),
          ),
          const SizedBox(height: AppSpacing.space2),
          Text(
            l10n.parentHotlineEvidenceCiteNote,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: AppColors.leaf700),
          ),
          const SizedBox(height: AppSpacing.space5),
        ],
        LabeledField(
          label: l10n.parentHotlineNoteOptional,
          child: TextFormField(
            controller: _noteController,
            maxLines: 4,
            minLines: 3,
            textCapitalization: TextCapitalization.sentences,
            keyboardType: TextInputType.multiline,
            onChanged: _controller.updateNote,
            decoration: InputDecoration(
              hintText: _noteHint(l10n, reason),
              fillColor: AppColors.surfaceAskBar,
            ),
          ),
        ),
        if (state.error == HotlineError.generic &&
            state.errorCause != null) ...[
          const SizedBox(height: AppSpacing.space4),
          InlineError(
            title: l10n.parentHotlineErrorTitle,
            message: hotlineErrorText(l10n, state.errorCause, drafting: true),
          ),
        ],
      ],
    );
  }

  // ── Step 3 · Review ─────────────────────────────────────────────────────────

  Widget _reviewStage(ParentHotlineState state, AppLocalizations l10n) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        MapOverline(l10n.parentHotlineStepReview, color: AppColors.textEyebrow),
        const SizedBox(height: AppSpacing.space3),
        if (state.isBusy && !state.hasDraft)
          const AppSkeleton(lines: 4)
        else
          MapCard(child: AiText(state.draftedMessage ?? '')),
        const SizedBox(height: AppSpacing.space3),
        SecondaryButton(
          label: l10n.actionRegenerate,
          icon: LucideIcons.refreshCw,
          onPressed: state.isBusy
              ? null
              : () => unawaited(
                  _controller.draftMessage(
                    consecutiveAbsentDays: state.consecutiveAbsentDays,
                    performanceContext: state.performanceContext,
                  ),
                ),
        ),
        if (!state.isBusy) ...[
          const SizedBox(height: AppSpacing.space5),
          // An honest "what this call covers": how the AI call goes and what
          // happens after. Not an in-call script.
          const CallPlanCard(),
        ],
      ],
    );
  }

  // ── The pinned footer ───────────────────────────────────────────────────────

  Widget? _footer(
    BuildContext context,
    ParentHotlineState state,
    AppLocalizations l10n,
  ) {
    switch (state.stage) {
      case HotlineStage.pickStudent:
      case HotlineStage.summary:
        return null;
      case HotlineStage.reason:
        return _FooterBar(
          children: [
            PrimaryButton(
              label: l10n.parentHotlineNext,
              onPressed: state.selectedReason == null
                  ? null
                  : _controller.confirmReason,
            ),
          ],
        );
      case HotlineStage.compose:
        return _FooterBar(
          children: [
            Row(
              children: [
                Expanded(
                  child: SecondaryButton(
                    label: l10n.parentHotlineBack,
                    onPressed: state.isBusy
                        ? null
                        : () => _controller.stepBack(),
                  ),
                ),
                const SizedBox(width: AppSpacing.gridGap),
                Expanded(
                  flex: 2,
                  child: PrimaryButton(
                    label: l10n.parentHotlineDraftAction,
                    isBusy: state.isBusy,
                    // Waits for the evidence (loaded or failed), so the
                    // draft can cite the record the teacher is looking at.
                    onPressed: state.isBusy || _evidenceLoading(state)
                        ? null
                        : () => unawaited(
                            _controller.draftMessage(
                              consecutiveAbsentDays:
                                  state.consecutiveAbsentDays,
                              performanceContext: state.performanceContext,
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ],
        );
      case HotlineStage.review:
        return _decisionBar(context, state, l10n);
      case HotlineStage.calling:
        return _FooterBar(
          children: [
            SecondaryButton(
              label: l10n.parentHotlineLeaveCall,
              icon: LucideIcons.logOut,
              onPressed: _leave,
            ),
          ],
        );
    }
  }

  /// Either half of the evidence is still on its way.
  bool _evidenceLoading(ParentHotlineState state) {
    final ev = state.evidence;
    if (ev == null) return false; // nothing requested (no class to read)
    return ev.absences == EvidenceStatus.loading ||
        ev.marks == EvidenceStatus.loading;
  }

  /// Review's decision bar: the AI notice, any banner for the attempt just
  /// made, then Call parent and Copy for WhatsApp side by side. Call is
  /// withdrawn when this parent cannot be called (no number, language not
  /// supported, telephony off), and disabled while a call is being placed,
  /// during the 5-minute repeat-call cool-down, and outside calling hours.
  Widget _decisionBar(
    BuildContext context,
    ParentHotlineState state,
    AppLocalizations l10n,
  ) {
    final text = Theme.of(context).textTheme;
    final callOffered =
        state.canAutoCall &&
        state.error != HotlineError.noParentPhone &&
        state.error != HotlineError.telephonyUnavailable;
    final blocked = state.isDedupBlocked;
    final banner = _reviewBanner(context, state, l10n);

    final whatsApp = SecondaryButton(
      label: l10n.parentHotlineWhatsApp,
      onPressed: state.isBusy || !state.hasDraft ? null : _onWhatsApp,
    );

    return _FooterBar(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(
              LucideIcons.shieldCheck,
              size: AppIconSize.inline,
              color: AppColors.textMuted,
            ),
            const SizedBox(width: AppSpacing.space2),
            Expanded(
              child: Text(
                l10n.parentHotlineAiNotice,
                style: text.bodySmall?.copyWith(color: AppColors.textMuted),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.space3),
        if (banner != null) ...[
          banner,
          const SizedBox(height: AppSpacing.space3),
        ] else if (!state.canAutoCall) ...[
          NoteBanner(
            icon: LucideIcons.phoneOff,
            body: l10n.parentHotlineUnsupportedLanguage(state.parentLanguage),
          ),
          const SizedBox(height: AppSpacing.space3),
        ],
        if (callOffered)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: whatsApp),
              const SizedBox(width: AppSpacing.gridGap),
              Expanded(
                child: _CallButton(
                  key: const Key('parentHotlineCallButton'),
                  label: blocked
                      ? l10n.parentHotlineCallAgainIn(
                          _formatCountdown(state.dedupRetryAfterSeconds ?? 0),
                        )
                      : l10n.parentHotlineCall,
                  busy: state.isBusy && !blocked,
                  onPressed:
                      (blocked ||
                          state.isBusy ||
                          !state.hasDraft ||
                          state.isOutsideCallingHours)
                      ? null
                      : () => unawaited(_controller.callParent()),
                ),
              ),
            ],
          )
        else
          whatsApp,
      ],
    );
  }

  /// The banner for whichever attempt just failed: one answer per cause, since
  /// each came from a different route with a different remedy.
  Widget? _reviewBanner(
    BuildContext context,
    ParentHotlineState state,
    AppLocalizations l10n,
  ) {
    switch (state.error) {
      case HotlineError.noParentPhone:
        return NoteBanner(
          icon: LucideIcons.phoneOff,
          body: l10n.parentHotlineNoPhone,
        );
      case HotlineError.telephonyUnavailable:
        return InlineError(
          title: l10n.parentHotlineErrorTitle,
          message: l10n.parentHotlineTelephonyUnavailable,
        );
      case HotlineError.callFailed:
        return InlineError(
          title: l10n.parentHotlineErrorTitle,
          message: l10n.parentHotlineSummaryFailedBody,
        );
      case HotlineError.outsideCallingHours:
        final next = state.nextCallAllowedAt;
        return NoteBanner(
          icon: LucideIcons.clock,
          body: next == null
              ? l10n.parentHotlineCallingHoursNoTime
              : l10n.parentHotlineCallingHours(
                  MaterialLocalizations.of(
                    context,
                  ).formatTimeOfDay(TimeOfDay.fromDateTime(next.toLocal())),
                ),
        );
      case HotlineError.notFound:
      case HotlineError.generic:
        return InlineError(
          title: l10n.parentHotlineErrorTitle,
          message: hotlineErrorText(l10n, state.errorCause),
        );
      case HotlineError.none:
      case HotlineError.unsupportedLanguage:
      case HotlineError.premiumRequired:
      case HotlineError.signedOut:
        return null;
    }
  }

  // ── Updates row ─────────────────────────────────────────────────────────────

  /// Records a finished call in Community → Updates, only for the outcomes it
  /// has honest copy for: a completed call with a summary, and a call that did
  /// not reach a conversation. A WhatsApp copy (no call), a missing summary,
  /// and a call whose outcome is not known yet are not recorded.
  void _recordCallOutcome(ParentHotlineState state) {
    final outreachId = state.outreachId;
    final student = state.studentName?.trim();
    if (outreachId == null || student == null || student.isEmpty) return;

    final kind = switch (state.summaryOutcome) {
      HotlineSummaryOutcome.summary => TeacherNotificationKind.callCompleted,
      HotlineSummaryOutcome.callFailed ||
      HotlineSummaryOutcome.endedNoConversation =>
        TeacherNotificationKind.callFailed,
      HotlineSummaryOutcome.manual ||
      HotlineSummaryOutcome.summaryUnavailable ||
      HotlineSummaryOutcome.stillInProgress ||
      HotlineSummaryOutcome.checkFailed ||
      null => null,
    };
    if (kind == null) return;

    ref
        .read(notificationsProvider.notifier)
        .record(
          TeacherNotification(
            // One row per call and outcome, however often the poll re-lands.
            id: 'hotline:$outreachId:${kind.wire}',
            kind: kind,
            at: ref.read(nowProvider)(),
            label: student,
          ),
        );
  }

  // ── WhatsApp ────────────────────────────────────────────────────────────────

  Future<void> _onWhatsApp() async {
    await _copyDraftToClipboard();
    unawaited(_controller.copyForWhatsApp());
  }

  /// The clipboard half of the WhatsApp path. Best-effort: a copy failure must
  /// never stop the outreach being logged.
  Future<void> _copyDraftToClipboard() async {
    final message = ref.read(parentHotlineControllerProvider).draftedMessage;
    if (message == null || message.trim().isEmpty) return;
    try {
      await Clipboard.setData(ClipboardData(text: message));
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..clearSnackBars()
          ..showSnackBar(
            SnackBar(content: Text(context.l10n.parentHotlineCopied)),
          );
      }
    } catch (_) {
      // A missing or refused clipboard is non-fatal.
    }
  }

  // ── Gates and empty states ──────────────────────────────────────────────────

  Widget _signedOut(AppLocalizations l10n) => EmptyView(
    icon: LucideIcons.logIn,
    title: l10n.parentHotlineSignedOutTitle,
    message: l10n.parentHotlineSignedOutBody,
  );

  Widget _rosterUnavailable(AppLocalizations l10n) => EmptyView(
    icon: LucideIcons.users,
    title: l10n.parentHotlineRosterUnavailableTitle,
    message: l10n.parentHotlineRosterUnavailableBody,
  );

  Widget _rosterEmpty(AppLocalizations l10n) => EmptyView(
    icon: LucideIcons.userPlus,
    title: l10n.parentHotlineRosterEmptyTitle,
    message: l10n.parentHotlineRosterEmptyBody,
  );

  /// The plan gate: an upsell, not an error. When a message was already
  /// drafted, it can still be copied for WhatsApp (clipboard only: the
  /// outreach route is what refused).
  Widget _premiumGate(ParentHotlineState state, AppLocalizations l10n) {
    final text = Theme.of(context).textTheme;
    return MapCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const IconWell(icon: LucideIcons.sparkles, feature: true),
          const SizedBox(height: AppSpacing.space4),
          Text(l10n.parentHotlinePremiumTitle, style: text.titleLarge),
          const SizedBox(height: AppSpacing.space2),
          Text(l10n.parentHotlinePremiumBody, style: text.bodyMedium),
          if (state.hasDraft) ...[
            const SizedBox(height: AppSpacing.space4),
            SecondaryButton(
              label: l10n.parentHotlineWhatsApp,
              icon: LucideIcons.messageCircle,
              onPressed: () => unawaited(_copyDraftToClipboard()),
            ),
          ],
        ],
      ),
    );
  }

  String _noteHint(AppLocalizations l10n, OutreachReason reason) {
    switch (reason) {
      case OutreachReason.consecutiveAbsences:
        return l10n.parentHotlineNoteHintAbsences;
      case OutreachReason.poorPerformance:
        return l10n.parentHotlineNoteHintPerformance;
      case OutreachReason.behavioralConcern:
        return l10n.parentHotlineNoteHintBehaviour;
      case OutreachReason.positiveFeedback:
        return l10n.parentHotlineNoteHintPositive;
    }
  }

  /// m:ss for the repeat-call cool-down.
  String _formatCountdown(int seconds) {
    final s = seconds < 0 ? 0 : seconds;
    return '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
  }
}

/// The page frame on the parent call's sage wash: the map's round Back
/// button and large title, the scrolling body capped at 640, and an optional
/// pinned footer the floating VIDYA orb parks above.
class _HotlineFrame extends StatelessWidget {
  const _HotlineFrame({
    required this.title,
    required this.child,
    this.subtitle,
    this.headerTrailing,
    this.footer,
  });

  final String title;
  final String? subtitle;
  final Widget? headerTrailing;
  final Widget child;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final footer = this.footer;
    return DecoratedBox(
      decoration: const BoxDecoration(gradient: AppGradients.washParentCall),
      child: Scaffold(
        resizeToAvoidBottomInset: true,
        backgroundColor: Colors.transparent,
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.mapGutter,
              AppSpacing.space2,
              AppSpacing.mapGutter,
              AppSpacing.space6,
            ),
            child: Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 640),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    MapPageHeader(trailing: headerTrailing),
                    const SizedBox(height: AppSpacing.space2),
                    MapPageTitle(title: title, subtitle: subtitle),
                    const SizedBox(height: AppSpacing.space4),
                    child,
                  ],
                ),
              ),
            ),
          ),
        ),
        bottomNavigationBar: footer == null
            ? null
            : VidyaCtaClearance(child: footer),
      ),
    );
  }
}

/// A pinned footer: a hairline on top, the page gutter, the bottom safe area.
class _FooterBar extends StatelessWidget {
  const _FooterBar({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.surfaceCard,
        border: Border(top: BorderSide(color: AppColors.borderHairline)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.mapGutter,
            AppSpacing.space3,
            AppSpacing.mapGutter,
            AppSpacing.space3,
          ),
          // heightFactor 1: centred across, but only as tall as its content.
          // (A plain Center in the Scaffold's bottom slot would expand to the
          // whole screen and sit on top of the page.)
          child: Align(
            heightFactor: 1,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 640),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: children,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The map's green "Call parent" pill.
class _CallButton extends StatelessWidget {
  const _CallButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !busy;
    return PressableScale(
      pressedScale: 0.97,
      enabled: enabled,
      child: ConstrainedBox(
        // A minimum, so "Call again in m:ss" wraps at large text instead of
        // clipping.
        constraints: const BoxConstraints(
          minWidth: double.infinity,
          minHeight: 52,
        ),
        child: FilledButton(
          onPressed: busy ? null : onPressed,
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.leaf500,
            foregroundColor: AppColors.textOnAccent,
            // Busy keeps the green (the call is being placed); disabled is
            // the pale pill with a dark green label that stays readable
            // (it carries the cool-down countdown).
            disabledBackgroundColor: busy
                ? AppColors.leaf500
                : AppColors.mapOptLeafRing,
            disabledForegroundColor: busy
                ? AppColors.textOnAccent
                : AppColors.leaf700,
            shape: const StadiumBorder(),
            // The theme's label style, so the app font carries through.
            textStyle: Theme.of(context).textTheme.labelLarge?.copyWith(
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          child: busy
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.textOnAccent,
                  ),
                )
              : Text(label, textAlign: TextAlign.center),
        ),
      ),
    );
  }
}

/// One student on the outreach list: the name, the class and the parent's
/// language in its own script, "Marked absent" when they were, and the
/// Contact chip. A student with no parent number says so and cannot be
/// contacted.
class _StudentCard extends StatelessWidget {
  const _StudentCard({
    required this.student,
    required this.markedAbsent,
    required this.onContact,
  });

  final HotlineStudent student;
  final bool markedAbsent;
  final VoidCallback onContact;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final reachable = student.hasParentPhone;
    final meta = [
      student.className,
      nativeLanguageLabel(student.parentLanguage),
    ].where((p) => p.trim().isNotEmpty).join(' · ');
    return MapCard(
      onTap: reachable ? onContact : null,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  student.name,
                  style: text.bodyLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textStrong,
                  ),
                ),
                if (markedAbsent)
                  Text(
                    l10n.parentHotlineMarkedAbsent,
                    style: text.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.red700,
                    ),
                  ),
                Text(
                  reachable ? meta : l10n.parentHotlineNoPhone,
                  style: text.bodySmall?.copyWith(color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          if (reachable) ...[
            const SizedBox(width: AppSpacing.space2),
            MapChip(
              label: l10n.parentHotlineContact,
              selected: false,
              idleInk: AppColors.textLink,
              onTap: onContact,
            ),
          ],
        ],
      ),
    );
  }
}

/// The student's recent record, as the map's evidence card: the absences in
/// the last 30 days (dated), then the latest marks with an "At risk" pill
/// when the average is low. Each half loads on its own and says so if it
/// could not; nothing is shown that the server did not return.
class _EvidenceCard extends StatelessWidget {
  const _EvidenceCard({required this.evidence, required this.onRetry});

  final HotlineEvidence evidence;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final ev = evidence;
    final loc = MaterialLocalizations.of(context);
    String day(AttendanceDate d) =>
        loc.formatMediumDate(DateTime(d.year, d.month, d.day));

    Widget status(EvidenceStatus s, Widget Function() loaded) => switch (s) {
      EvidenceStatus.loading => const AppSkeleton(lines: 2),
      EvidenceStatus.failed => Row(
        children: [
          Expanded(
            child: Text(
              l10n.parentHotlineEvidenceLoadFailed,
              style: text.bodySmall?.copyWith(color: AppColors.textMuted),
            ),
          ),
          TextButton(
            onPressed: onRetry,
            style: TextButton.styleFrom(minimumSize: const Size(48, 48)),
            child: Text(l10n.actionRetry),
          ),
        ],
      ),
      EvidenceStatus.loaded => loaded(),
    };

    Widget row(String left, String right, {Color? rightInk}) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              left,
              style: text.bodySmall?.copyWith(color: AppColors.textBody),
            ),
          ),
          const SizedBox(width: AppSpacing.space2),
          Text(
            right,
            style: text.bodySmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: rightInk ?? AppColors.textStrong,
            ),
          ),
        ],
      ),
    );

    return MapCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          MapOverline(l10n.parentHotlineEvidenceRecentAttendance),
          const SizedBox(height: AppSpacing.space1),
          status(ev.absences, () {
            final dates = ev.absenceDates;
            if (dates.isEmpty) {
              return Text(
                l10n.parentHotlineEvidenceNoAbsences,
                style: text.bodySmall?.copyWith(color: AppColors.textMuted),
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final d in dates.take(5))
                  row(
                    day(d),
                    l10n.attendanceStatusAbsent,
                    rightInk: AppColors.red700,
                  ),
              ],
            );
          }),
          const SizedBox(height: AppSpacing.space4),
          Row(
            children: [
              Expanded(
                child: MapOverline(l10n.parentHotlineEvidenceRecentMarks),
              ),
              if (ev.marks == EvidenceStatus.loaded && ev.isAtRisk)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  decoration: const ShapeDecoration(
                    color: AppColors.mapRequiredBg,
                    shape: StadiumBorder(),
                  ),
                  child: Text(
                    l10n.parentHotlineEvidenceAtRisk,
                    style: text.labelSmall?.copyWith(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.red700,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.space1),
          status(ev.marks, () {
            final marks = ev.recentAssessments;
            if (marks.isEmpty) {
              return Text(
                l10n.parentHotlineEvidenceNoMarks,
                style: text.bodySmall?.copyWith(color: AppColors.textMuted),
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final a in marks)
                  row(
                    [a.subject, a.name].where((p) => p.isNotEmpty).join(' · '),
                    '${a.marksObtained}/${a.maxMarks} · '
                    '${a.percentage.round()}%',
                  ),
              ],
            );
          }),
        ],
      ),
    );
  }
}
