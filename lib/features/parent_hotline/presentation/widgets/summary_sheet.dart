import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/map_card.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../../../shared/widgets/secondary_button.dart';
import '../../domain/call_summary.dart';
import '../../domain/parent_outreach.dart';
import '../parent_hotline_controller.dart';

/// U-PH5 — the Parent Hotline `summary` stage (SPEC §B.1 stage 6): the pillar's
/// HERO payoff. When the AI `callSummary` has landed it is a full
/// [DocumentSheet] assembled with the **Ink-settle** reveal (the reference
/// mechanism from `LessonPlanResultView`); otherwise it resolves to one of the
/// terminal [EmptyView] panels — never a spinner (SPEC §B.1 "Terminal
/// non-summary states").
///
/// A dumb, prop-driven widget (no Riverpod), mirroring the sibling
/// [CallingStage]: it renders deterministically from a [HotlineSummaryOutcome] +
/// the polled [CallResult], and routes every intent through the callbacks the
/// screen wires to the controller ([onDone] / [onCallAgain] / [onRetry] /
/// [onCopyForWhatsApp]). This keeps the hero unit-testable from fixtures — the
/// real summary needs a real call (Firebase-gated 401), so it is verified by
/// widget test, never live.
///
/// **Prose (SPEC §B.5.7).** Every model-authored field — [CallSummary.parentResponse],
/// the concern / commitment / action / guidance lists, the follow-up, and each
/// transcript turn — arrives ALREADY localized to the teacher's language from
/// the server and is rendered as-is through [AiText] (matra-safe metrics). Only
/// the UI *chrome* (headers, badge labels, terminal copy) is localized here.
class SummarySheet extends StatelessWidget {
  const SummarySheet({
    super.key,
    required this.outcome,
    required this.studentName,
    required this.callResult,
    this.reason,
    this.isDedupBlocked = false,
    this.dedupRetryAfterSeconds,
    required this.onDone,
    required this.onCallAgain,
    required this.onRetry,
    required this.onCopyForWhatsApp,
    required this.onStartNew,
    required this.onCheckAgain,
    this.isBusy = false,
    this.hasDraft = true,
  });

  /// Which terminal branch to render (the controller's derived discriminator).
  final HotlineSummaryOutcome outcome;

  /// The student whose parent was called — the masthead title reads
  /// "{studentName}'s parent". Sourced from the controller's `studentName`.
  final String studentName;

  /// The latest polled projection (summary, transcript, status, duration,
  /// turnCount). Null only in the degenerate no-result case.
  final CallResult? callResult;

  /// The outreach reason, for the masthead eyebrow "PARENT CALL · {REASON}".
  /// Null → the eyebrow shows just the doc-type.
  final OutreachReason? reason;

  /// "Call again later" is inside the 5-minute dedup cool-down (SPEC §B.5.3).
  final bool isDedupBlocked;

  /// Seconds left on the dedup cool-down, surfaced as a countdown on the
  /// disabled "Call again later" ghost — never an error loop.
  final int? dedupRetryAfterSeconds;

  /// Footer "Done" — pops the screen.
  final VoidCallback onDone;

  /// Footer ghost "Call again later" — a genuinely new (dedup-gated) outreach.
  final VoidCallback onCallAgain;

  /// Terminal "Try again" — re-dials the existing outreach (avoids the dedup).
  final VoidCallback onRetry;

  /// Terminal / footer "Copy for WhatsApp" — the universal fallback.
  final VoidCallback onCopyForWhatsApp;

  /// "Start a new message" — back to step 1 for the same student. The way
  /// out of a resumed outreach that has no message left to send.
  final VoidCallback onStartNew;

  /// "Check again" — re-polls an outreach whose outcome is not known yet.
  final VoidCallback onCheckAgain;

  /// A call is being placed: every action that could place another waits.
  final bool isBusy;

  /// Whether a message is in hand to copy for WhatsApp. A resumed outreach
  /// may have none.
  final bool hasDraft;

  @override
  Widget build(BuildContext context) {
    switch (outcome) {
      case HotlineSummaryOutcome.summary:
        return _FullSummary(
          studentName: studentName,
          reason: reason,
          result: callResult,
          isDedupBlocked: isDedupBlocked,
          dedupRetryAfterSeconds: dedupRetryAfterSeconds,
          onDone: onDone,
          onCallAgain: isBusy ? null : onCallAgain,
        );
      case HotlineSummaryOutcome.manual:
        return _ManualTerminal(
          onCopyForWhatsApp: hasDraft && !isBusy ? onCopyForWhatsApp : null,
          onStartNew: isBusy ? null : onStartNew,
        );
      case HotlineSummaryOutcome.callFailed:
        return _CallFailedTerminal(
          status: callResult?.callStatus,
          onRetry: isBusy ? null : onRetry,
          onCopyForWhatsApp: hasDraft && !isBusy ? onCopyForWhatsApp : null,
          onStartNew: isBusy ? null : onStartNew,
        );
      case HotlineSummaryOutcome.endedNoConversation:
        return _NoConversationTerminal(
          onRetry: isBusy ? null : onRetry,
          onCopyForWhatsApp: hasDraft && !isBusy ? onCopyForWhatsApp : null,
          onStartNew: isBusy ? null : onStartNew,
        );
      case HotlineSummaryOutcome.summaryUnavailable:
        return _SummaryUnavailableTerminal(
          transcript: callResult?.transcript ?? const [],
          onDone: onDone,
          onStartNew: isBusy ? null : onStartNew,
        );
      case HotlineSummaryOutcome.stillInProgress:
        return _UnknownOutcomeTerminal(
          icon: LucideIcons.phoneCall,
          title: context.l10n.parentHotlineStillInProgressTitle,
          body: context.l10n.parentHotlineStillInProgressBody,
          onCheckAgain: isBusy ? null : onCheckAgain,
          onDone: onDone,
        );
      case HotlineSummaryOutcome.checkFailed:
        return _UnknownOutcomeTerminal(
          icon: LucideIcons.wifiOff,
          title: context.l10n.parentHotlineCheckFailedTitle,
          body: context.l10n.parentHotlineCheckFailedBody,
          onCheckAgain: isBusy ? null : onCheckAgain,
          onDone: onDone,
        );
    }
  }
}

// ─── The full summary — the map's tinted cards ────────────────────────────────

class _FullSummary extends StatelessWidget {
  const _FullSummary({
    required this.studentName,
    required this.reason,
    required this.result,
    required this.isDedupBlocked,
    required this.dedupRetryAfterSeconds,
    required this.onDone,
    required this.onCallAgain,
  });

  final String studentName;
  final OutreachReason? reason;
  final CallResult? result;
  final bool isDedupBlocked;
  final int? dedupRetryAfterSeconds;
  final VoidCallback onDone;
  final VoidCallback? onCallAgain;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final summary = result?.callSummary;
    // `outcome == summary` guarantees a non-null callSummary, but stay defensive
    // so a malformed projection degrades rather than throwing.
    if (summary == null) {
      return _NoConversationTerminal(
        onRetry: onDone,
        onCopyForWhatsApp: null,
        onStartNew: onDone,
      );
    }

    final text = Theme.of(context).textTheme;
    final minutes = _durationMinutes(result?.callDurationSeconds);
    final turns = result?.turnCount ?? 0;
    final facts = [
      if (minutes != null) l10n.parentHotlineSummaryDurationMin(minutes),
      if (turns > 1) l10n.parentHotlineCallingExchanges(turns),
    ].join(' · ');

    // The map's call summary, in reading order: the green "Call completed"
    // banner, what the parent said, then each section in its own tint.
    // Empty sections are left out, and follow-up appears only when the AI
    // flagged it — nothing is shown that the summary did not say.
    final blocks = <Widget>[
      _TintCard(
        fill: AppColors.tileLeafBg,
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(
                color: AppColors.leaf500,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                LucideIcons.check,
                size: 20,
                color: AppColors.textOnAccent,
              ),
            ),
            const SizedBox(width: AppSpacing.space3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    l10n.parentHotlineCallCompleted,
                    style: text.titleSmall?.copyWith(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.leaf700,
                    ),
                  ),
                  if (facts.isNotEmpty)
                    Text(
                      facts,
                      style: text.bodySmall?.copyWith(
                        color: AppColors.textBody,
                      ),
                    ),
                  // A sentiment the server did not give is not shown.
                  if (summary.parentSentiment case final sentiment?) ...[
                    const SizedBox(height: AppSpacing.space2),
                    _SentimentBadge(sentiment: sentiment),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
      MapCard(
        child: _Section(
          title: l10n.parentHotlineSummarySaidHeader,
          ink: AppColors.textMuted,
          child: AiText(summary.parentResponse),
        ),
      ),
      if (summary.parentConcerns.isNotEmpty)
        _TintCard(
          fill: AppColors.mapStrategyBg,
          child: _Section(
            title: l10n.parentHotlineSummaryConcernsHeader,
            ink: AppColors.saffron700,
            child: _Lines(
              items: summary.parentConcerns,
              icon: LucideIcons.alertCircle,
              ink: AppColors.saffron700,
            ),
          ),
        ),
      if (summary.parentCommitments.isNotEmpty)
        _TintCard(
          fill: AppColors.tileIndigoBg,
          child: _Section(
            title: l10n.parentHotlineSummaryCommitmentsHeader,
            ink: AppColors.tileIndigoInk,
            child: _Lines(
              items: summary.parentCommitments,
              icon: LucideIcons.check,
              ink: AppColors.tileIndigoInk,
            ),
          ),
        ),
      if (summary.actionItemsForTeacher.isNotEmpty)
        _TintCard(
          fill: AppColors.surfaceCard,
          ring: AppColors.mapOptOnRing,
          child: _Section(
            title: l10n.parentHotlineSummaryActionsHeader,
            ink: AppColors.saffron600,
            child: _Lines(
              items: summary.actionItemsForTeacher,
              icon: LucideIcons.arrowRight,
              ink: AppColors.saffron600,
            ),
          ),
        ),
      if (summary.guidanceGiven.isNotEmpty)
        MapCard(
          child: _Section(
            title: l10n.parentHotlineSummaryGuidanceHeader,
            ink: AppColors.textMuted,
            child: _Lines(
              items: summary.guidanceGiven,
              icon: LucideIcons.lightbulb,
              ink: AppColors.textMuted,
            ),
          ),
        ),
      if (summary.followUpNeeded &&
          (summary.followUpSuggestion?.isNotEmpty ?? false))
        _TintCard(
          fill: AppColors.mapRequiredBg,
          child: _Section(
            title: l10n.parentHotlineSummaryFollowUpHeader,
            ink: AppColors.red700,
            child: _Lines(
              items: [summary.followUpSuggestion!],
              icon: LucideIcons.calendarClock,
              ink: AppColors.red700,
            ),
          ),
        ),
      if ((result?.transcript ?? const []).isNotEmpty)
        _TranscriptTile(turns: result!.transcript),
    ];

    // Ink-settle: each block fades + rises in turn; degrades to the composed
    // frame under reduce-motion.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        MapOverline(_eyebrow(l10n, reason), color: AppColors.textEyebrow),
        const SizedBox(height: AppSpacing.space1),
        Text(
          l10n.parentHotlineSummaryTitle(studentName),
          style: text.displayLarge?.copyWith(
            fontSize: 22,
            color: AppColors.textStrong,
          ),
        ),
        const SizedBox(height: AppSpacing.space4),
        for (var i = 0; i < blocks.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space3),
          inkSettle(context, blocks[i], index: i),
        ],
        const SizedBox(height: AppSpacing.space5),
        _SummaryFooter(
          isDedupBlocked: isDedupBlocked,
          dedupRetryAfterSeconds: dedupRetryAfterSeconds,
          onDone: onDone,
          onCallAgain: onCallAgain,
        ),
      ],
    );
  }

  /// "Parent call · {reason}" — DocumentSheet applies the saffron eyebrow style
  /// and (Latin-only) UPPERCASE.
  String _eyebrow(AppLocalizations l10n, OutreachReason? reason) {
    final docType = l10n.parentHotlineSummaryDocType;
    if (reason == null) return docType;
    return '$docType · ${_reasonWord(l10n, reason)}';
  }

  String _reasonWord(AppLocalizations l10n, OutreachReason reason) {
    switch (reason) {
      case OutreachReason.consecutiveAbsences:
        return l10n.parentHotlineSummaryReasonAbsences;
      case OutreachReason.poorPerformance:
        return l10n.parentHotlineSummaryReasonPerformance;
      case OutreachReason.behavioralConcern:
        return l10n.parentHotlineSummaryReasonBehaviour;
      case OutreachReason.positiveFeedback:
        return l10n.parentHotlineSummaryReasonPositive;
    }
  }

  /// Whole minutes, floored at 1 for any non-zero call so a 40-second call never
  /// reads "0 min". Null (badge hidden) when the duration is unknown / zero.
  int? _durationMinutes(int? seconds) {
    if (seconds == null || seconds <= 0) return null;
    return math.max(1, (seconds / 60).round());
  }
}

// ─── Sentiment badge (toned, WCAG-AA verified) ───────────────────────────────

/// The color-toned sentiment pill (SPEC §B.1 stage 6). AppBadge only ships
/// `neutral` / `accent` tones, so this local pill mirrors its stadium grammar
/// (`space3`/`space2` padding, `labelMedium`, [StadiumBorder]) while toning the
/// fill per [ParentSentiment] via **scheme roles only** — never a raw hex.
///
/// **WCAG AA (verified — the U-PH4 3.86:1 pill must not recur).** Every label
/// clears 4.5:1 on its own fill. Tones and their measured ratios:
///   • grateful / cooperative → `secondaryContainer` fill + `onSecondaryContainer`
///     label (pine): 8.65:1 light / 8.61:1 dark.
///   • concerned / confused → `primaryContainer` fill + `onPrimaryContainer`
///     label (saffron tint): 6.93:1 light / 9.46:1 dark.
///   • upset → an `error`-tint fill (`error@0.12` light / `error@0.22` dark) with
///     a FULL-INK `onSurface` label: 15.2:1 light / 13.2:1 dark. (`errorContainer`
///     falls back to bare `error`, whose white `onError` label is only ~3.9:1 in
///     light — so the sanctioned full-ink-on-tint pairing is used instead.)
///   • indifferent → neutral `surfaceContainerHigh` fill + `onSurface` label:
///     14.7:1 light / 12.1:1 dark. (Never the muted `onSurfaceVariant`, which is
///     the 3.86:1 trap.)
/// The leading glyph shares the label's ink, so it clears the 3:1 non-text bar
/// by the same margin.
class _SentimentBadge extends StatelessWidget {
  const _SentimentBadge({required this.sentiment});

  final ParentSentiment sentiment;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final (Color fill, Color ink, IconData icon) = switch (sentiment) {
      ParentSentiment.grateful || ParentSentiment.cooperative => (
        scheme.secondaryContainer,
        scheme.onSecondaryContainer,
        sentiment == ParentSentiment.grateful
            ? LucideIcons.heartHandshake
            : LucideIcons.smile,
      ),
      ParentSentiment.concerned || ParentSentiment.confused => (
        scheme.primaryContainer,
        scheme.onPrimaryContainer,
        sentiment == ParentSentiment.confused
            ? LucideIcons.helpCircle
            : LucideIcons.alertCircle,
      ),
      ParentSentiment.upset => (
        scheme.error.withValues(alpha: isDark ? 0.22 : 0.12),
        scheme.onSurface,
        LucideIcons.frown,
      ),
      ParentSentiment.indifferent => (
        scheme.surfaceContainerHigh,
        scheme.onSurface,
        LucideIcons.meh,
      ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.space3,
        vertical: AppSpacing.space2,
      ),
      decoration: ShapeDecoration(color: fill, shape: const StadiumBorder()),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: AppIconSize.inline, color: ink),
          const SizedBox(width: AppSpacing.space2),
          Flexible(
            child: Text(
              _label(context.l10n, sentiment),
              style: text.labelMedium?.copyWith(
                color: ink,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _label(AppLocalizations l10n, ParentSentiment s) {
    switch (s) {
      case ParentSentiment.cooperative:
        return l10n.parentHotlineSentimentCooperative;
      case ParentSentiment.concerned:
        return l10n.parentHotlineSentimentConcerned;
      case ParentSentiment.grateful:
        return l10n.parentHotlineSentimentGrateful;
      case ParentSentiment.upset:
        return l10n.parentHotlineSentimentUpset;
      case ParentSentiment.indifferent:
        return l10n.parentHotlineSentimentIndifferent;
      case ParentSentiment.confused:
        return l10n.parentHotlineSentimentConfused;
    }
  }
}

// ─── Section bodies ──────────────────────────────────────────────────────────

/// A rounded section card in one of the map's tints, with an optional ring.
class _TintCard extends StatelessWidget {
  const _TintCard({required this.fill, required this.child, this.ring});

  final Color fill;
  final Color? ring;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: fill,
        borderRadius: AppRadius.rCard,
        border: ring == null ? null : Border.all(color: ring!, width: 1.5),
      ),
      child: child,
    );
  }
}

/// An overline title in the section's ink over its content.
class _Section extends StatelessWidget {
  const _Section({required this.title, required this.ink, required this.child});

  final String title;
  final Color ink;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        MapOverline(title, color: ink),
        const SizedBox(height: AppSpacing.space2),
        child,
      ],
    );
  }
}

/// AiText lines, each led by the section's glyph in its ink.
class _Lines extends StatelessWidget {
  const _Lines({required this.items, required this.icon, required this.ink});

  final List<String> items;
  final IconData icon;
  final Color ink;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space2),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Icon(icon, size: AppIconSize.inline, color: ink),
              ),
              const SizedBox(width: AppSpacing.space2),
              Expanded(child: AiText(items[i])),
            ],
          ),
        ],
      ],
    );
  }
}

// ─── Transcript ──────────────────────────────────────────────────────────────

/// The collapsible transcript (SPEC §B.1): a real [ExpansionTile], COLLAPSED by
/// default, titled "View conversation · {n} messages". Each turn is a row with a
/// `bot` (agent) or `user-circle` (parent) glyph and an AiText body — the agent
/// muted, the parent full-ink. The default Material expand caret is replaced by
/// a Lucide chevron (rotated on toggle) so the screen stays Lucide-only.
class _TranscriptTile extends StatefulWidget {
  const _TranscriptTile({required this.turns});

  final List<TranscriptTurn> turns;

  @override
  State<_TranscriptTile> createState() => _TranscriptTileState();
}

class _TranscriptTileState extends State<_TranscriptTile> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;

    return AppCard(
      // A FLAT card (surface / white fill), NOT inset. WCAG AA: the agent turns
      // render muted (onSurfaceVariant #65758B), which clears 4.5:1 only on the
      // white `surface` (4.70:1) — the inset's `surfaceContainerLow` #F8FAFC
      // drops it to 4.49:1, just under the floor (dark passes on either). White
      // is also production's real card colour, and a gently-raised panel reads
      // as the tappable disclosure it is (an inset reads recessed/read-only).
      child: Theme(
        // Strip the ambient ListTile divider so the tile reads as a quiet
        // "details" disclosure on the card.
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: EdgeInsets.zero,
          childrenPadding: const EdgeInsets.only(top: AppSpacing.space3),
          shape: const RoundedRectangleBorder(),
          collapsedShape: const RoundedRectangleBorder(),
          expandedAlignment: Alignment.centerLeft,
          expandedCrossAxisAlignment: CrossAxisAlignment.start,
          onExpansionChanged: (v) => setState(() => _expanded = v),
          trailing: AnimatedRotation(
            turns: _expanded ? 0.5 : 0,
            duration: AppMotion.small,
            child: Icon(
              LucideIcons.chevronDown,
              size: AppIconSize.inline,
              color: scheme.onSurfaceVariant,
            ),
          ),
          title: Text(
            l10n.parentHotlineSummaryTranscript(widget.turns.length),
            style: text.titleSmall,
          ),
          children: [
            for (var i = 0; i < widget.turns.length; i++) ...[
              if (i > 0) const SizedBox(height: AppSpacing.space3),
              _TranscriptRow(turn: widget.turns[i]),
            ],
          ],
        ),
      ),
    );
  }
}

class _TranscriptRow extends StatelessWidget {
  const _TranscriptRow({required this.turn});

  final TranscriptTurn turn;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isAgent = turn.role == TranscriptRole.agent;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Icon(
            isAgent ? LucideIcons.bot : LucideIcons.userCircle,
            size: AppIconSize.inline,
            color: scheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(width: AppSpacing.space3),
        // Agent muted, parent full-ink (SPEC §B.1) — the parent's words carry
        // the weight.
        Expanded(child: AiText(turn.text, muted: isAgent)),
      ],
    );
  }
}

// ─── Footer ──────────────────────────────────────────────────────────────────

/// The summary action bar (SPEC §B.1 stage 6): "Done" over a ghost "Call again
/// later". Inside the dedup cool-down the ghost is disabled and shows the mm:ss
/// countdown instead of an error loop (SPEC §B.5.3).
class _SummaryFooter extends StatelessWidget {
  const _SummaryFooter({
    required this.isDedupBlocked,
    required this.dedupRetryAfterSeconds,
    required this.onDone,
    required this.onCallAgain,
  });

  final bool isDedupBlocked;
  final int? dedupRetryAfterSeconds;
  final VoidCallback onDone;
  final VoidCallback? onCallAgain;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final text = Theme.of(context).textTheme;
    final saffron = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;
    final scheme = Theme.of(context).colorScheme;

    final callAgainLabel = isDedupBlocked
        ? l10n.parentHotlineCallAgainIn(
            _formatCountdown(dedupRetryAfterSeconds ?? 0),
          )
        : l10n.parentHotlineSummaryCallAgain;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        SecondaryButton(
          label: l10n.parentHotlineSummaryDone,
          icon: LucideIcons.check,
          onPressed: onDone,
        ),
        const SizedBox(height: AppSpacing.space2),
        ConstrainedBox(
          // A minimum, not a fixed height: "Call again in m:ss" wraps at
          // large text rather than clipping.
          constraints: const BoxConstraints(minHeight: 48),
          child: TextButton.icon(
            onPressed: isDedupBlocked ? null : onCallAgain,
            icon: Icon(
              isDedupBlocked ? LucideIcons.clock : LucideIcons.phoneCall,
              size: AppIconSize.inline,
            ),
            label: Text(callAgainLabel),
            style: TextButton.styleFrom(
              foregroundColor: saffron,
              disabledForegroundColor: scheme.onSurfaceVariant,
              textStyle: text.labelLarge,
            ),
          ),
        ),
      ],
    );
  }

  /// mm:ss for the dedup countdown (mirrors the review decision bar).
  String _formatCountdown(int seconds) {
    final s = seconds < 0 ? 0 : seconds;
    final m = s ~/ 60;
    final rem = s % 60;
    return '$m:${rem.toString().padLeft(2, '0')}';
  }
}

// ─── Terminal panels (never a spinner) ───────────────────────────────────────

/// `manual` — the WhatsApp-copy path: the message was copied, no call placed.
/// Copy is offered only while a message is in hand; "Start a new message" is
/// always the way on.
class _ManualTerminal extends StatelessWidget {
  const _ManualTerminal({
    required this.onCopyForWhatsApp,
    required this.onStartNew,
  });

  final VoidCallback? onCopyForWhatsApp;
  final VoidCallback? onStartNew;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return EmptyView(
      icon: LucideIcons.messageCircle,
      title: l10n.parentHotlineSummaryManualTitle,
      message: l10n.parentHotlineSummaryManualBody,
      action: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (onCopyForWhatsApp != null) ...[
            SecondaryButton(
              label: l10n.parentHotlineWhatsApp,
              icon: LucideIcons.copy,
              onPressed: onCopyForWhatsApp,
            ),
            const SizedBox(height: AppSpacing.space2),
          ],
          _StartNewButton(onPressed: onStartNew),
        ],
      ),
    );
  }
}

/// `failed / no_answer / busy` — a warm, retryable phone-off state. The line is
/// derived from the terminal [status]; an unknown status reads as the plain
/// "couldn't connect", never as a guessed reason.
class _CallFailedTerminal extends StatelessWidget {
  const _CallFailedTerminal({
    required this.status,
    required this.onRetry,
    required this.onCopyForWhatsApp,
    required this.onStartNew,
  });

  final CallStatus? status;
  final VoidCallback? onRetry;
  final VoidCallback? onCopyForWhatsApp;
  final VoidCallback? onStartNew;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final title = switch (status) {
      CallStatus.busy => l10n.parentHotlineSummaryBusy,
      CallStatus.noAnswer => l10n.parentHotlineSummaryNoAnswer,
      _ => l10n.parentHotlineSummaryFailed,
    };
    return EmptyView(
      icon: LucideIcons.phoneOff,
      title: title,
      message: l10n.parentHotlineSummaryFailedBody,
      action: _RetryOrWhatsApp(
        onRetry: onRetry,
        onCopyForWhatsApp: onCopyForWhatsApp,
        onStartNew: onStartNew,
      ),
    );
  }
}

/// The call ended with no real conversation (turnCount < 2).
class _NoConversationTerminal extends StatelessWidget {
  const _NoConversationTerminal({
    required this.onRetry,
    required this.onCopyForWhatsApp,
    required this.onStartNew,
  });

  final VoidCallback? onRetry;
  final VoidCallback? onCopyForWhatsApp;
  final VoidCallback? onStartNew;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return EmptyView(
      icon: LucideIcons.phoneOff,
      title: l10n.parentHotlineSummaryNoConversationTitle,
      message: l10n.parentHotlineSummaryNoConversationBody,
      action: _RetryOrWhatsApp(
        onRetry: onRetry,
        onCopyForWhatsApp: onCopyForWhatsApp,
        onStartNew: onStartNew,
      ),
    );
  }
}

/// A conversation happened but its summary never generated: the transcript,
/// then Done and "Start a new message", so the panel is never a dead end.
class _SummaryUnavailableTerminal extends StatelessWidget {
  const _SummaryUnavailableTerminal({
    required this.transcript,
    required this.onDone,
    required this.onStartNew,
  });

  final List<TranscriptTurn> transcript;
  final VoidCallback onDone;
  final VoidCallback? onStartNew;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        EmptyView(
          icon: LucideIcons.fileText,
          title: l10n.parentHotlineSummaryUnavailableTitle,
          message: l10n.parentHotlineSummaryUnavailableBody,
        ),
        if (transcript.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.space6),
          _TranscriptTile(turns: transcript),
        ],
        const SizedBox(height: AppSpacing.space6),
        PrimaryButton(label: l10n.parentHotlineSummaryDone, onPressed: onDone),
        const SizedBox(height: AppSpacing.space2),
        _StartNewButton(onPressed: onStartNew),
      ],
    );
  }
}

/// The outcome is not known: the call may still be running past the poll
/// window, or its status could not be read. Says only that, and offers a
/// fresh check — never an invented ending.
class _UnknownOutcomeTerminal extends StatelessWidget {
  const _UnknownOutcomeTerminal({
    required this.icon,
    required this.title,
    required this.body,
    required this.onCheckAgain,
    required this.onDone,
  });

  final IconData icon;
  final String title;
  final String body;
  final VoidCallback? onCheckAgain;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return EmptyView(
      icon: icon,
      title: title,
      message: body,
      action: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          PrimaryButton(
            label: l10n.parentHotlineCheckAgain,
            icon: LucideIcons.refreshCw,
            onPressed: onCheckAgain,
          ),
          const SizedBox(height: AppSpacing.space2),
          SecondaryButton(
            label: l10n.parentHotlineSummaryDone,
            onPressed: onDone,
          ),
        ],
      ),
    );
  }
}

/// The shared retry / WhatsApp / start-new set used by the failed and
/// no-conversation terminals. A null handler hides (WhatsApp, with no
/// message to copy) or disables (while a call is being placed) its button.
class _RetryOrWhatsApp extends StatelessWidget {
  const _RetryOrWhatsApp({
    required this.onRetry,
    required this.onCopyForWhatsApp,
    required this.onStartNew,
  });

  final VoidCallback? onRetry;
  final VoidCallback? onCopyForWhatsApp;
  final VoidCallback? onStartNew;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        PrimaryButton(
          label: l10n.parentHotlineSummaryTryAgain,
          icon: LucideIcons.refreshCw,
          onPressed: onRetry,
        ),
        if (onCopyForWhatsApp != null) ...[
          const SizedBox(height: AppSpacing.space2),
          SecondaryButton(
            label: l10n.parentHotlineWhatsApp,
            icon: LucideIcons.messageCircle,
            onPressed: onCopyForWhatsApp,
          ),
        ],
        const SizedBox(height: AppSpacing.space2),
        _StartNewButton(onPressed: onStartNew),
      ],
    );
  }
}

/// "Start a new message": back to step 1 for the same student.
class _StartNewButton extends StatelessWidget {
  const _StartNewButton({required this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: AppColors.textLink,
        minimumSize: const Size(48, 48),
      ),
      child: Text(context.l10n.parentHotlineStartNew),
    );
  }
}
