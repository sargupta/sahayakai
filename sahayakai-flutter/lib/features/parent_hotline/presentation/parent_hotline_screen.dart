import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/platform/clock.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/widgets/ai_text.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_segmented.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/glass_app_bar.dart';
import '../../../shared/widgets/icon_well.dart';
import '../../../shared/widgets/inline_error.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/note_banner.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../../shared/widgets/secondary_button.dart';
import '../../attendance/data/attendance_errors.dart';
import '../../notifications/data/notifications_store.dart';
import '../../notifications/domain/teacher_notification.dart';
import '../../vidya/presentation/vidya_sheet.dart';
import '../domain/hotline_student.dart';
import '../domain/parent_outreach.dart';
import 'hotline_roster_provider.dart';
import 'parent_hotline_controller.dart';
import 'widgets/calling_stage.dart';
import 'widgets/evidence_panel.dart';
import 'widgets/reason_card.dart';
import 'widgets/summary_sheet.dart';

/// The Parent Hotline screen (SPEC §B.0 / §B.1), stages 1–5:
/// `pickStudent → reason → compose → review → calling`, plus the decision bar.
/// The `calling` stage is U-PH4 ([CallingStage], the honest breathing waiting
/// state); the `summary` stage is U-PH5 and still renders a placeholder here.
///
/// **Resumability (SPEC §B.5.5).** Leaving the `calling` stage must stop polling
/// but never cancel the server-side call. The controller is `keepAlive`, so a
/// screen dispose alone would NOT stop its poll loop; a [PopScope] therefore
/// calls `leaveCalling()` on every pop so the standard back affordance is the
/// leave path. Re-opening resumes via `latestForStudent` (`init`).
///
/// One staged flow inside one [ToolScaffold] (max reading width 640, back). It
/// watches the U-PH2 [ParentHotlineController] and renders the current `stage`;
/// every stage transition uses the sanctioned `AppMotion.small` reveal (fade +
/// slideY 12→0), degrading to the final frame under reduce-motion.
///
/// **No faked identity (SPEC §B.1 / §B.5).** The `pickStudent` roster comes from
/// [hotlineRosterProvider], which reads the MASKED `?projection=roster` shape
/// and fails closed if anything else comes back. Every outcome of that read
/// degrades on its own cause: signed out → the sign-in `EmptyView` (checked
/// before the request, so no pointless 401); the fail-closed
/// `RosterProjectionUnavailableException` → the "class list isn't available yet"
/// `EmptyView`, which is the state on production today and is a server gap, not
/// the teacher's problem; anything else → a retryable error with a Try-again.
/// None of them is a silent empty list, which would read as "this teacher has no
/// students", and none invents students. The controller's own terminal facets —
/// `isSignedOut` (401) and `isPremiumGated` (403) — replace the whole body with
/// a dignified gate.
///
/// **F9-001.** The screen never renders or chooses a full parent phone. The
/// review meta line shows only a pre-masked last-4 fragment (from the roster
/// entry); the call is placed with `{outreachId, parentLanguage}` alone.
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
  });

  /// Optional launch context (the U12 attendance "Call parent" hand-off). All
  /// null for the standalone Dashboard entry, which opens on `pickStudent`.
  final String? studentId;
  final String? studentName;
  final String? classId;
  final String? className;
  final String? parentLanguage;
  final String? subject;
  final OutreachReason? suggestedReason;

  @override
  ConsumerState<ParentHotlineScreen> createState() =>
      _ParentHotlineScreenState();
}

class _ParentHotlineScreenState extends ConsumerState<ParentHotlineScreen> {
  final _noteController = TextEditingController();

  /// The roster entry the teacher picked. Held here (not in the controller) so
  /// the review meta line can show the pre-masked last-4 without the controller
  /// ever carrying a phone (F9-001). Null when launched from a student row
  /// (no roster tap) — the meta line then omits the phone fragment.
  HotlineStudent? _selectedStudent;

  /// The class filter on the picker; defaults to the first class in the roster.
  String? _selectedClassId;

  @override
  void initState() {
    super.initState();
    // Seed the flow once the first frame is up. With no studentId this settles
    // synchronously on `pickStudent`; with one it asks `latestForStudent`
    // whether there is anything to resume (SPEC §B.3).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(
        ref
            .read(parentHotlineControllerProvider.notifier)
            .init(
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
    _noteController.dispose();
    super.dispose();
  }

  ParentHotlineController get _controller =>
      ref.read(parentHotlineControllerProvider.notifier);

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = ref.watch(parentHotlineControllerProvider);

    // Write the call's terminal outcome to the Network hub's Updates tab. The
    // listener sits here, on the screen, rather than inside the controller: the
    // controller is `@riverpod`-generated and the parent serialises codegen, so
    // touching its body would put the tree into codegen drift. It is also the
    // right seam either way — this is a presentation concern about where the
    // teacher will look for the outcome later, not part of the call machine.
    ref.listen<ParentHotlineState>(parentHotlineControllerProvider, (
      prev,
      next,
    ) {
      if (prev?.summaryOutcome == next.summaryOutcome) return;
      _recordCallOutcome(next);
    });

    // Terminal gates outrank the stage: the whole feature is blocked.
    final (Widget body, String revealKey) = switch (state) {
      _ when state.isSignedOut => (_signedOut(l10n), 'gate-signed-out'),
      _ when state.isPremiumGated => (
        _premiumGate(state, l10n),
        'gate-premium',
      ),
      _ => (_stageBody(context, state, l10n), 'stage-${state.stage.name}'),
    };

    // The decision bar is a STICKY footer, pinned only on the review stage, so
    // the Call / WhatsApp CTAs never fall below the fold on a long message. It
    // lives in the Scaffold's bottomNavigationBar slot (which reserves its own
    // space above the scrolling body) rather than scrolling with the content.
    final showDecisionBar =
        !state.isSignedOut &&
        !state.isPremiumGated &&
        state.stage == HotlineStage.review;

    // Any pop stops the poll loop (SPEC §B.5.5). `leaveCalling` cancels the
    // poll Timer only — it never cancels the server-side call, and is a safe
    // no-op on the stages that are not polling — so leaving `calling` (via the
    // app-bar back or the system gesture) resumes cleanly on re-open, while
    // review/summary pops cost nothing.
    return PopScope(
      key: const Key('parentHotlinePopScope'),
      canPop: true,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) _controller.leaveCalling();
      },
      child: _ToolFooterScaffold(
        title: l10n.parentHotlineTitle,
        footer: showDecisionBar
            ? _stickyDecisionBar(context, state, l10n)
            : null,
        child: KeyedSubtree(
          key: ValueKey(revealKey),
          child: staggeredItem(context, body),
        ),
      ),
    );
  }

  /// Records a terminal call outcome, and only the two the app has honest copy
  /// for.
  ///
  ///   • [HotlineSummaryOutcome.summary]  -> the call completed and a summary
  ///     exists, which is exactly what the row's body points at;
  ///   • [HotlineSummaryOutcome.callFailed] and
  ///     [HotlineSummaryOutcome.endedNoConversation] -> no conversation
  ///     happened, and both lead back to the same two ways forward (call again,
  ///     or send it on WhatsApp).
  ///
  /// Deliberately NOT recorded: [HotlineSummaryOutcome.manual], where no call
  /// was ever placed, so there is no outcome to report; and
  /// [HotlineSummaryOutcome.summaryUnavailable], where a conversation DID
  /// happen but the summary never generated — the completed row's body promises
  /// a summary that is not there, and a row that lies about what is waiting is
  /// worse than no row. Giving that branch its own honest line is a copy
  /// addition, noted in the handoff rather than faked here.
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
      null => null,
    };
    if (kind == null) return;

    ref
        .read(notificationsProvider.notifier)
        .record(
          TeacherNotification(
            // Keyed on the outreach AND the outcome: one call yields one row,
            // however many times the summary poll re-lands the same state.
            id: 'hotline:$outreachId:${kind.wire}',
            kind: kind,
            at: ref.read(nowProvider)(),
            label: student,
          ),
        );
  }

  Widget _stageBody(
    BuildContext context,
    ParentHotlineState state,
    AppLocalizations l10n,
  ) {
    switch (state.stage) {
      case HotlineStage.pickStudent:
        return _pickStudentStage(context, l10n);
      case HotlineStage.reason:
        return _reasonStage(context, state, l10n);
      case HotlineStage.compose:
        return _composeStage(context, state, l10n);
      case HotlineStage.review:
        return _reviewStage(context, state, l10n);
      case HotlineStage.calling:
        // U-PH4 — the honest breathing waiting state, driven by the polled
        // callResult (studentName identifies the parent; no separate field).
        return CallingStage(
          parentName: state.studentName ?? '',
          callResult: state.callResult,
        );
      case HotlineStage.summary:
        // U-PH5 — the payoff. A full DocumentSheet when the AI summary landed,
        // else one of the terminal panels; the outcome is the controller's
        // derived discriminator. Intents route back through the controller
        // (Done pops; the copy path reuses the review handler so the clipboard
        // write + snackbar are shared).
        return SummarySheet(
          outcome:
              state.summaryOutcome ?? HotlineSummaryOutcome.endedNoConversation,
          studentName: state.studentName ?? '',
          reason: state.selectedReason ?? state.suggestedReason,
          callResult: state.callResult,
          isDedupBlocked: state.isDedupBlocked,
          dedupRetryAfterSeconds: state.dedupRetryAfterSeconds,
          onDone: () => Navigator.of(context).maybePop(),
          onCallAgain: () => unawaited(_controller.callAgain()),
          onRetry: () => unawaited(_controller.retryCall()),
          onCopyForWhatsApp: _onWhatsApp,
        );
    }
  }

  // ── Stage 1 — pickStudent ──────────────────────────────────────────────────

  Widget _pickStudentStage(BuildContext context, AppLocalizations l10n) {
    return ref
        .watch(hotlineRosterProvider)
        .when(
          loading: () => const AppSkeleton(lines: 5),
          error: (error, _) => _rosterError(error, l10n),
          data: (roster) => _rosterList(context, roster, l10n),
        );
  }

  /// Why the roster could not be read. Each cause gets its own answer, because
  /// they ask completely different things of the teacher.
  Widget _rosterError(Object error, AppLocalizations l10n) {
    // The PII fail-closed guard: the masked `?projection=roster` shape was not
    // what came back, so the read was abandoned rather than decoding every
    // parent's full phone number onto the handset. The projection is draft PR
    // #124 and is not merged, so this is the state on production TODAY. It is a
    // server-side gap the teacher cannot act on and has not caused — hence the
    // "isn't available yet / nothing you need to fix" copy, and specifically NOT
    // a retry button that would fail identically every time.
    if (error is RosterProjectionUnavailableException) {
      return _rosterUnavailable(l10n);
    }
    // A 401 anywhere in the read is the sign-in gate, not a load failure.
    if (error is ApiException && error.isAuth) return _signedOut(l10n);
    // Anything else — offline, a 5xx, an ownership 403 — is genuinely retryable.
    return EmptyView(
      icon: LucideIcons.alertTriangle,
      title: l10n.parentHotlineErrorTitle,
      message: error is ApiException ? error.message : l10n.errorGeneric,
      action: SecondaryButton(
        label: l10n.actionRetry,
        icon: LucideIcons.refreshCw,
        onPressed: () => ref.invalidate(hotlineRosterProvider),
      ),
    );
  }

  Widget _rosterList(
    BuildContext context,
    List<HotlineStudent> roster,
    AppLocalizations l10n,
  ) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    // A genuinely empty roster — the read succeeded and the teacher has no
    // students yet. Distinct from the fail-closed case above, which never
    // reaches here, and it now says so in its own words.
    if (roster.isEmpty) return _rosterEmpty(l10n);

    final classes = _distinctClasses(roster);
    final selectedClassId =
        (_selectedClassId != null &&
            classes.any((c) => c.id == _selectedClassId))
        ? _selectedClassId!
        : classes.first.id;
    final students = roster
        .where((s) => s.classId == selectedClassId)
        .toList(growable: false);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        EditorialSectionHeader(l10n.parentHotlineEyebrow),
        const SizedBox(height: AppSpacing.space4),
        Text(
          l10n.parentHotlinePickStudentIntro,
          style: text.bodyLarge?.copyWith(color: scheme.onSurfaceVariant),
        ),
        const SizedBox(height: AppSpacing.space8),
        if (classes.length > 1) ...[
          LabeledField(
            label: l10n.parentHotlineClassLabel,
            leadingIcon: LucideIcons.users,
            child: _ClassPicker(
              classes: classes,
              value: selectedClassId,
              onChanged: (id) => setState(() => _selectedClassId = id),
            ),
          ),
          const SizedBox(height: AppSpacing.space6),
        ],
        for (final (index, student) in students.indexed) ...[
          if (index > 0) const SizedBox(height: AppSpacing.space3),
          _studentRow(context, student, l10n),
        ],
      ],
    );
  }

  Widget _studentRow(
    BuildContext context,
    HotlineStudent student,
    AppLocalizations l10n,
  ) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final enabled = student.hasParentPhone;

    return AppCard(
      onTap: enabled ? () => _pickStudent(student) : null,
      child: Row(
        children: [
          const IconWell(icon: LucideIcons.user),
          const SizedBox(width: AppSpacing.space4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(student.name, style: text.titleMedium),
                const SizedBox(height: AppSpacing.space1),
                Text(
                  '${student.className} · ${student.parentLanguage}',
                  style: text.bodyMedium?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
                if (!enabled) ...[
                  const SizedBox(height: AppSpacing.space2),
                  // A NoteBanner-style inline hint mirroring the server's 422
                  // "no parent phone on record" so the teacher never hits a dead
                  // call (SPEC §B.1 stage 1).
                  Row(
                    children: [
                      Icon(
                        LucideIcons.phoneOff,
                        size: AppIconSize.inline,
                        color: scheme.onSurfaceVariant,
                      ),
                      const SizedBox(width: AppSpacing.space2),
                      Flexible(
                        child: Text(
                          l10n.parentHotlineNoPhone,
                          style: text.bodySmall?.copyWith(
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          if (enabled) ...[
            const SizedBox(width: AppSpacing.space3),
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: scheme.surfaceContainerHigh,
              ),
              alignment: Alignment.center,
              child: Icon(
                LucideIcons.chevronRight,
                size: AppIconSize.inline,
                color: scheme.onSurfaceVariant,
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _pickStudent(HotlineStudent student) {
    setState(() => _selectedStudent = student);
    _noteController.clear();
    // Advances to `reason` synchronously; the awaited part is the
    // `outreach-latest` resume lookup, which may then land the flow on a call
    // that is still running (SPEC §B.5.5).
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

  // ── Stage 2 — reason ────────────────────────────────────────────────────────

  Widget _reasonStage(
    BuildContext context,
    ParentHotlineState state,
    AppLocalizations l10n,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        EditorialSectionHeader(l10n.parentHotlineReasonEyebrow),
        const SizedBox(height: AppSpacing.space6),
        for (final (index, reason) in OutreachReason.values.indexed) ...[
          if (index > 0) const SizedBox(height: AppSpacing.space3),
          Builder(
            builder: (context) {
              final (icon, label, desc) = _reasonMeta(l10n, reason);
              return ReasonCard(
                icon: icon,
                label: label,
                description: desc,
                selected: state.selectedReason == reason,
                onTap: () => _controller.selectReason(reason),
              );
            },
          ),
        ],
      ],
    );
  }

  // ── Stage 3 — compose ───────────────────────────────────────────────────────

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
        EditorialSectionHeader(l10n.parentHotlineComposeEyebrow),
        const SizedBox(height: AppSpacing.space4),
        EvidencePanel(
          reason: reason,
          consecutiveAbsentDays: state.consecutiveAbsentDays,
          performance: state.performanceContext,
        ),
        const SizedBox(height: AppSpacing.space6),
        LabeledField(
          label: l10n.parentHotlineNoteLabel,
          optionalLabel: l10n.parentMessageOptional,
          leadingIcon: LucideIcons.stickyNote,
          child: TextFormField(
            controller: _noteController,
            maxLines: 4,
            minLines: 3,
            textCapitalization: TextCapitalization.sentences,
            keyboardType: TextInputType.multiline,
            onChanged: _controller.updateNote,
            decoration: InputDecoration(hintText: _noteHint(l10n, reason)),
          ),
        ),
        const SizedBox(height: AppSpacing.space6),
        if (state.error == HotlineError.generic &&
            (state.errorMessage?.isNotEmpty ?? false)) ...[
          InlineError(
            title: l10n.parentHotlineErrorTitle,
            message: state.errorMessage!,
          ),
          const SizedBox(height: AppSpacing.space4),
        ],
        if (state.isBusy)
          const AppSkeleton(lines: 4)
        else
          PrimaryButton(
            label: l10n.parentHotlineDraftAction,
            icon: LucideIcons.sparkles,
            onPressed: () => unawaited(
              _controller.draftMessage(
                consecutiveAbsentDays: state.consecutiveAbsentDays,
                performanceContext: state.performanceContext,
              ),
            ),
          ),
      ],
    );
  }

  // ── Stage 4 — review + decision bar ─────────────────────────────────────────

  Widget _reviewStage(
    BuildContext context,
    ParentHotlineState state,
    AppLocalizations l10n,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        EditorialSectionHeader(l10n.parentHotlineReviewEyebrow),
        const SizedBox(height: AppSpacing.space4),
        if (state.isBusy)
          const AppSkeleton(lines: 4)
        else
          AppCard(
            variant: AppCardVariant.inset,
            child: AiText(state.draftedMessage ?? ''),
          ),
        const SizedBox(height: AppSpacing.space4),
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
        // The decision bar is NOT here — it is pinned as the Scaffold footer
        // (see `_stickyDecisionBar`) so it stays visible while this body scrolls.
      ],
    );
  }

  /// The sticky-footer decision bar (SPEC §B.1 stage 4). Pinned in the Scaffold's
  /// bottomNavigationBar slot (see `_ToolFooterScaffold`), floating at `e3` above
  /// a 1px top hairline so it separates from the scrolling body. Copy-for-
  /// WhatsApp is ALWAYS offered; Call parent is shown only when the language is
  /// callable and is disabled with a countdown while the 5-minute dedup is live.
  Widget _stickyDecisionBar(
    BuildContext context,
    ParentHotlineState state,
    AppLocalizations l10n,
  ) {
    final scheme = Theme.of(context).colorScheme;
    // "Call parent" is offered only when the language is callable AND nothing
    // has already told us this particular call cannot be placed. A 422 with no
    // number on record and a 503 with telephony switched off server-side are
    // both settled facts: leaving an enabled button on screen would invite the
    // teacher to spend a round trip discovering that again. WhatsApp copy is
    // always offered and is what remains in both cases.
    final callOffered =
        state.canAutoCall &&
        state.error != HotlineError.noParentPhone &&
        state.error != HotlineError.telephonyUnavailable;
    final blocked = state.isDedupBlocked;
    final errorBanner = _reviewErrorBanner(state, l10n);

    final children = <Widget>[
      _metaLine(context, state, l10n),
      const SizedBox(height: AppSpacing.space4),
    ];

    if (errorBanner != null) {
      children
        ..add(errorBanner)
        ..add(const SizedBox(height: AppSpacing.space3));
    } else if (!state.canAutoCall) {
      // Mirrors the server 422: auto-call unavailable for this language. Second
      // in the chain, not first: the language note is the standing explanation
      // for a hidden Call button, while a facet banner is news about the attempt
      // the teacher just made, and news wins.
      children
        ..add(
          NoteBanner(
            icon: LucideIcons.phoneOff,
            body: l10n.parentHotlineUnsupportedLanguage(state.parentLanguage),
          ),
        )
        ..add(const SizedBox(height: AppSpacing.space3));
    }

    if (callOffered) {
      children
        ..add(
          PrimaryButton(
            // The 429 treatment. The route returns `{ retryAfterSeconds }` plus
            // a `Retry-After` header and the controller counts it down, so the
            // button names the ACTUAL remaining wait — "Call again in 4:12" —
            // rather than a vague "try later" or a retry that would 429 again.
            label: blocked
                ? l10n.parentHotlineCallAgainIn(
                    _formatCountdown(state.dedupRetryAfterSeconds ?? 0),
                  )
                : l10n.parentHotlineCall,
            icon: blocked ? null : LucideIcons.phoneCall,
            isBusy: state.isBusy && !blocked,
            // Disabled while the dedup countdown runs (SPEC §B.5.3) — never a
            // retry-loop toast — and while a create/place is in flight.
            onPressed: (blocked || state.isBusy)
                ? null
                : () => unawaited(_controller.createAndCall()),
          ),
        )
        ..add(const SizedBox(height: AppSpacing.space3));
    }

    // Copy for WhatsApp — the universal fallback, never dedup-gated (SPEC
    // §B.5.2). Disabled only while a request is already in flight.
    children.add(
      SecondaryButton(
        label: l10n.parentHotlineWhatsApp,
        icon: LucideIcons.messageCircle,
        onPressed: state.isBusy ? null : _onWhatsApp,
      ),
    );

    // The footer surface: `e3` (the sanctioned floating-CTA-bar elevation — note
    // AppCard(elevated) rests at `e2`, so the token is applied directly here) +
    // a 1px top hairline, its own bottom SafeArea, capped to the 640 reading
    // column.
    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surface,
        border: Border(top: BorderSide(color: scheme.outline, width: 1)),
        boxShadow: AppShadows.e3,
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: AppSpacing.pagePadding,
          child: Center(
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

  /// The meta line: masked parent phone (last-4 only — F9-001), language, and
  /// the AI-notice honesty line (SPEC §B.1 stage 4 / §B.5.6).
  Widget _metaLine(
    BuildContext context,
    ParentHotlineState state,
    AppLocalizations l10n,
  ) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final last4 = _selectedStudent?.parentPhoneLast4;

    Widget chip(IconData icon, String label) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: AppIconSize.inline, color: scheme.onSurfaceVariant),
        const SizedBox(width: AppSpacing.space1),
        Flexible(
          child: Text(
            label,
            style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
          ),
        ),
      ],
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Wrap(
          spacing: AppSpacing.space4,
          runSpacing: AppSpacing.space2,
          children: [
            if (last4 != null && last4.isNotEmpty)
              chip(LucideIcons.phone, l10n.parentHotlinePhoneMask(last4)),
            if (state.parentLanguage.isNotEmpty)
              chip(LucideIcons.languages, state.parentLanguage),
          ],
        ),
        const SizedBox(height: AppSpacing.space2),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              LucideIcons.shieldCheck,
              size: AppIconSize.inline,
              color: scheme.onSurfaceVariant,
            ),
            const SizedBox(width: AppSpacing.space2),
            Expanded(
              child: Text(
                l10n.parentHotlineAiNotice,
                style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
              ),
            ),
          ],
        ),
      ],
    );
  }

  /// The in-review banner for whichever facet is live. One switch, one answer
  /// per facet — every one of these came back from a different route with a
  /// different remedy, and collapsing them into one red "something went wrong"
  /// tells the teacher nothing they can act on.
  ///
  /// Verified against the route handlers on `origin/main`:
  ///   • **403 `PREMIUM_REQUIRED`** (`attendance/outreach/route.ts`) is not an
  ///     error at all — it is handled a level up as the upsell card, so it
  ///     returns null here.
  ///   • **429** (`attendance/outreach/route.ts`, the 5-minute per-(teacher,
  ///     student) dedup) is a countdown on the Call button, not a banner —
  ///     nothing has gone wrong, the teacher simply called this parent minutes
  ///     ago. Also null here.
  ///   • **422 no phone** — `outreach` raises `Student has no parent phone on
  ///     record`; `call` raises `Outreach record has no valid parent phone`. A
  ///     calm note, not an alarm: nothing is broken, there is just no number,
  ///     and WhatsApp copy is the way through. The Call button is withdrawn.
  ///   • **422 unsupported language** (`call/route.ts`, no `TWILIO_LANGUAGE_MAP`
  ///     entry) keeps its own standing note below, which names the language.
  ///   • **502** (`call/route.ts`, the provider refused the call) is transient
  ///     and genuinely retryable, so it says so and the Call button stays.
  ///   • **503** (`Twilio not configured` / `Voice service not configured`)
  ///     is telephony being off server-side. The teacher cannot fix it and
  ///     retrying cannot help, so the Call button is withdrawn and WhatsApp
  ///     copy is left as the working path. `ApiException` deliberately does not
  ///     surface 5xx server text, so the message is the safe generic line.
  ///   • **404** is a stale class / student / outreach id; the server's line is
  ///     the useful one.
  Widget? _reviewErrorBanner(ParentHotlineState state, AppLocalizations l10n) {
    switch (state.error) {
      case HotlineError.noParentPhone:
        return NoteBanner(
          icon: LucideIcons.phoneOff,
          body: l10n.parentHotlineNoPhone,
        );
      case HotlineError.telephonyUnavailable:
        // The server-safe `errorMessage` for a 503 is ApiException's generic
        // "Something went wrong on our side", which is true but useless: the
        // teacher cannot fix it, retrying cannot help, and the Call button has
        // already been withdrawn. Own copy names the one path that still works.
        return InlineError(
          title: l10n.parentHotlineErrorTitle,
          message: l10n.parentHotlineTelephonyUnavailable,
        );
      case HotlineError.callFailed:
        return InlineError(
          title: l10n.parentHotlineErrorTitle,
          message: l10n.parentHotlineSummaryFailedBody,
        );
      case HotlineError.notFound:
      case HotlineError.generic:
        return InlineError(
          title: l10n.parentHotlineErrorTitle,
          message: state.errorMessage ?? l10n.parentHotlineGenericError,
        );
      case HotlineError.none:
      case HotlineError.unsupportedLanguage:
      case HotlineError.premiumRequired:
      case HotlineError.signedOut:
        return null;
    }
  }

  Future<void> _onWhatsApp() async {
    await _copyDraftToClipboard();
    unawaited(_controller.copyForWhatsApp());
  }

  /// The clipboard half of the WhatsApp path, without the persist.
  ///
  /// Best-effort: a copy failure must never stop the outreach from being logged,
  /// so it is guarded and the caller's persist still runs.
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
      // A missing clipboard channel (or a denied write) is non-fatal.
    }
  }

  // ── Gates ───────────────────────────────────────────────────────────────────

  Widget _signedOut(AppLocalizations l10n) => EmptyView(
    icon: LucideIcons.logIn,
    title: l10n.parentHotlineSignedOutTitle,
    message: l10n.parentHotlineSignedOutBody,
  );

  /// The signed-in-but-no-roster state: the teacher IS authenticated, but the
  /// student-roster API does not exist on the app yet (a future unit), so there
  /// is genuinely nothing to list. Honest copy that owns the gap instead of
  /// blaming the teacher's sign-in (and, like `_signedOut`, invents no students).
  Widget _rosterUnavailable(AppLocalizations l10n) => EmptyView(
    icon: LucideIcons.users,
    title: l10n.parentHotlineRosterUnavailableTitle,
    message: l10n.parentHotlineRosterUnavailableBody,
  );

  /// The read SUCCEEDED and returned nobody: this teacher has classes but no
  /// students on them (or no classes at all). Distinct from [_rosterUnavailable]
  /// above, which is a server gap the teacher cannot act on — here there IS
  /// something they can do, and the copy says what it is.
  Widget _rosterEmpty(AppLocalizations l10n) => EmptyView(
    icon: LucideIcons.userPlus,
    title: l10n.parentHotlineRosterEmptyTitle,
    message: l10n.parentHotlineRosterEmptyBody,
  );

  /// The 403 `PREMIUM_REQUIRED` treatment (`attendance/outreach/route.ts`).
  ///
  /// An upsell, not an error: a feature card with the accent bar and the feature
  /// glyph, no red, no alert triangle, and no implication the teacher did
  /// something wrong. The plan gate is the server working as designed.
  ///
  /// It also KEEPS ITS PROMISE. The body says a message can still be copied for
  /// WhatsApp for free, and until now the gate replaced the whole body and left
  /// no way to do that — the one sentence offering a way out led nowhere. When a
  /// draft exists it is offered here, as a clipboard copy only: `copyForWhatsApp`
  /// would POST the outreach, and that route is exactly what just returned 403.
  Widget _premiumGate(ParentHotlineState state, AppLocalizations l10n) {
    final text = Theme.of(context).textTheme;
    final drafted = state.draftedMessage?.trim() ?? '';
    return AppCard(
      accentBar: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const IconWell(icon: LucideIcons.sparkles, feature: true),
          const SizedBox(height: AppSpacing.space4),
          Text(l10n.parentHotlinePremiumTitle, style: text.titleLarge),
          const SizedBox(height: AppSpacing.space2),
          Text(l10n.parentHotlinePremiumBody, style: text.bodyMedium),
          if (drafted.isNotEmpty) ...[
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

  // ── Reason metadata ─────────────────────────────────────────────────────────

  (IconData, String, String) _reasonMeta(
    AppLocalizations l10n,
    OutreachReason reason,
  ) {
    switch (reason) {
      case OutreachReason.consecutiveAbsences:
        return (
          LucideIcons.calendarX2,
          l10n.parentHotlineReasonAbsencesLabel,
          l10n.parentHotlineReasonAbsencesDesc,
        );
      case OutreachReason.poorPerformance:
        return (
          LucideIcons.trendingDown,
          l10n.parentHotlineReasonPerformanceLabel,
          l10n.parentHotlineReasonPerformanceDesc,
        );
      case OutreachReason.behavioralConcern:
        return (
          LucideIcons.alertTriangle,
          l10n.parentHotlineReasonBehaviourLabel,
          l10n.parentHotlineReasonBehaviourDesc,
        );
      case OutreachReason.positiveFeedback:
        return (
          LucideIcons.star,
          l10n.parentHotlineReasonPositiveLabel,
          l10n.parentHotlineReasonPositiveDesc,
        );
    }
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

  /// Distinct (classId, className) pairs, in roster order.
  List<({String id, String name})> _distinctClasses(
    List<HotlineStudent> roster,
  ) {
    final seen = <String>{};
    final out = <({String id, String name})>[];
    for (final s in roster) {
      if (seen.add(s.classId)) out.add((id: s.classId, name: s.className));
    }
    return out;
  }

  /// mm:ss for the dedup countdown (a display string the ARB key interpolates).
  String _formatCountdown(int seconds) {
    final s = seconds < 0 ? 0 : seconds;
    final m = s ~/ 60;
    final rem = s % 60;
    return '$m:${rem.toString().padLeft(2, '0')}';
  }
}

/// The page frame — a [ToolScaffold]-parity shell (surface AppBar with the VIDYA
/// co-teacher action, a 640-capped scrolling body, top margins) that ADDS an
/// optional sticky [footer] slot. [ToolScaffold] only pins a single-button bar
/// via `onSubmit`, so the Parent Hotline's two-action decision bar (SPEC §B.1
/// stage 4) is pinned here via the Scaffold's `bottomNavigationBar`, which
/// reserves its own height above the scrolling body rather than scrolling with
/// it. Chrome is kept identical to [ToolScaffold] so the non-review stages read
/// exactly as every other tool.
class _ToolFooterScaffold extends StatelessWidget {
  const _ToolFooterScaffold({
    required this.title,
    required this.child,
    this.footer,
  });

  final String title;
  final Widget child;

  /// Pinned above the gesture inset, below the scrolling body. Null = no footer.
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: true,
      appBar: GlassAppBar(
        title: Text(title),
        actions: const [VidyaAppBarAction()],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: AppSpacing.pagePadding,
          child: Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 640),
              child: child,
            ),
          ),
        ),
      ),
      bottomNavigationBar: footer,
    );
  }
}

/// The class filter — an [AppSegmented] over the roster's classes (it falls back
/// to a chip Wrap past 3 classes or on long/Indic labels, per its own contract).
class _ClassPicker extends StatelessWidget {
  const _ClassPicker({
    required this.classes,
    required this.value,
    required this.onChanged,
  });

  final List<({String id, String name})> classes;
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return AppSegmented<String>(
      segments: [
        for (final c in classes) AppSegment(value: c.id, label: c.name),
      ],
      value: value,
      onChanged: onChanged,
    );
  }
}
