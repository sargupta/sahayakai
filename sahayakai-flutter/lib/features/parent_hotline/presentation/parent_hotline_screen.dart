import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
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
/// [hotlineStudentRosterProvider], which is empty in foundation-v1 (no student
/// API — the routes 401); an empty roster shows the signed-out `EmptyView`, not
/// invented students. The controller's own terminal facets — `isSignedOut` (401)
/// and `isPremiumGated` (403) — replace the whole body with a dignified gate.
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
        ref.read(parentHotlineControllerProvider.notifier).init(
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

    // Terminal gates outrank the stage: the whole feature is blocked.
    final (Widget body, String revealKey) = switch (state) {
      _ when state.isSignedOut => (_signedOut(l10n), 'gate-signed-out'),
      _ when state.isPremiumGated => (_premiumGate(state, l10n), 'gate-premium'),
      _ => (_stageBody(context, state, l10n), 'stage-${state.stage.name}'),
    };

    // The decision bar is a STICKY footer, pinned only on the review stage, so
    // the Call / WhatsApp CTAs never fall below the fold on a long message. It
    // lives in the Scaffold's bottomNavigationBar slot (which reserves its own
    // space above the scrolling body) rather than scrolling with the content.
    final showDecisionBar = !state.isSignedOut &&
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
        footer:
            showDecisionBar ? _stickyDecisionBar(context, state, l10n) : null,
        child: KeyedSubtree(
          key: ValueKey(revealKey),
          child: staggeredItem(context, body),
        ),
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
    final roster = ref.watch(hotlineStudentRosterProvider);
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    // No roster → the signed-out EmptyView (foundation-v1 has no student API;
    // never invent students / a signed-in identity).
    if (roster.isEmpty) return _signedOut(l10n);

    final classes = _distinctClasses(roster);
    final selectedClassId = (_selectedClassId != null &&
            classes.any((c) => c.id == _selectedClassId))
        ? _selectedClassId!
        : classes.first.id;
    final students =
        roster.where((s) => s.classId == selectedClassId).toList(growable: false);

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
          IconWell(icon: LucideIcons.user),
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
                  style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
                ),
                if (!enabled) ...[
                  const SizedBox(height: AppSpacing.space2),
                  // A NoteBanner-style inline hint mirroring the server's 422
                  // "no parent phone on record" so the teacher never hits a dead
                  // call (SPEC §B.1 stage 1).
                  Row(
                    children: [
                      Icon(LucideIcons.phoneOff,
                          size: AppIconSize.inline, color: scheme.onSurfaceVariant),
                      const SizedBox(width: AppSpacing.space2),
                      Flexible(
                        child: Text(
                          l10n.parentHotlineNoPhone,
                          style: text.bodySmall
                              ?.copyWith(color: scheme.onSurfaceVariant),
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
              child: Icon(LucideIcons.chevronRight,
                  size: AppIconSize.inline, color: scheme.onSurfaceVariant),
            ),
          ],
        ],
      ),
    );
  }

  void _pickStudent(HotlineStudent student) {
    setState(() => _selectedStudent = student);
    _noteController.clear();
    _controller.selectStudent(
      studentId: student.id,
      studentName: student.name,
      classId: student.classId,
      className: student.className,
      parentLanguage: student.parentLanguage,
      subject: student.subject,
      suggestedReason: student.suggestedReason,
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
            decoration:
                InputDecoration(hintText: _noteHint(l10n, reason)),
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
            onPressed: () => unawaited(_controller.draftMessage(
              consecutiveAbsentDays: state.consecutiveAbsentDays,
              performanceContext: state.performanceContext,
            )),
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
              : () => unawaited(_controller.draftMessage(
                    consecutiveAbsentDays: state.consecutiveAbsentDays,
                    performanceContext: state.performanceContext,
                  )),
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
    final canCall = state.canAutoCall;
    final blocked = state.isDedupBlocked;
    final errorBanner = _reviewErrorBanner(state, l10n);

    final children = <Widget>[
      _metaLine(context, state, l10n),
      const SizedBox(height: AppSpacing.space4),
    ];

    if (!canCall) {
      // Mirrors the server 422: auto-call unavailable for this language.
      children
        ..add(NoteBanner(
          icon: LucideIcons.phoneOff,
          body: l10n.parentHotlineUnsupportedLanguage(state.parentLanguage),
        ))
        ..add(const SizedBox(height: AppSpacing.space3));
    } else if (errorBanner != null) {
      children
        ..add(errorBanner)
        ..add(const SizedBox(height: AppSpacing.space3));
    }

    if (canCall) {
      children
        ..add(PrimaryButton(
          label: blocked
              ? l10n.parentHotlineCallAgainIn(_formatCountdown(
                  state.dedupRetryAfterSeconds ?? 0))
              : l10n.parentHotlineCall,
          icon: blocked ? null : LucideIcons.phoneCall,
          isBusy: state.isBusy && !blocked,
          // Disabled while the dedup countdown runs (SPEC §B.5.3) — never a
          // retry-loop toast — and while a create/place is in flight.
          onPressed: (blocked || state.isBusy)
              ? null
              : () => unawaited(_controller.createAndCall()),
        ))
        ..add(const SizedBox(height: AppSpacing.space3));
    }

    // Copy for WhatsApp — the universal fallback, never dedup-gated (SPEC
    // §B.5.2). Disabled only while a request is already in flight.
    children.add(SecondaryButton(
      label: l10n.parentHotlineWhatsApp,
      icon: LucideIcons.messageCircle,
      onPressed: state.isBusy ? null : _onWhatsApp,
    ));

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
            Icon(LucideIcons.shieldCheck,
                size: AppIconSize.inline, color: scheme.onSurfaceVariant),
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

  /// The in-review error banner for the retryable / configuration facets. The
  /// signed-out and premium facets are handled at the page level, and the
  /// unsupported-language facet is the NoteBanner above, so those are excluded
  /// here.
  Widget? _reviewErrorBanner(ParentHotlineState state, AppLocalizations l10n) {
    switch (state.error) {
      case HotlineError.callFailed:
      case HotlineError.telephonyUnavailable:
      case HotlineError.noParentPhone:
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
    final message = ref.read(parentHotlineControllerProvider).draftedMessage;
    if (message != null && message.trim().isNotEmpty) {
      // The clipboard write is best-effort: a copy failure must never stop the
      // outreach from being logged, so it is guarded and the persist always
      // runs below.
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
    unawaited(_controller.copyForWhatsApp());
  }

  // ── Gates ───────────────────────────────────────────────────────────────────

  Widget _signedOut(AppLocalizations l10n) => EmptyView(
        icon: LucideIcons.logIn,
        title: l10n.parentHotlineSignedOutTitle,
        message: l10n.parentHotlineSignedOutBody,
      );

  Widget _premiumGate(ParentHotlineState state, AppLocalizations l10n) {
    final text = Theme.of(context).textTheme;
    return AppCard(
      accentBar: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          IconWell(icon: LucideIcons.sparkles, feature: true),
          const SizedBox(height: AppSpacing.space4),
          Text(l10n.parentHotlinePremiumTitle, style: text.titleLarge),
          const SizedBox(height: AppSpacing.space2),
          Text(l10n.parentHotlinePremiumBody, style: text.bodyMedium),
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
