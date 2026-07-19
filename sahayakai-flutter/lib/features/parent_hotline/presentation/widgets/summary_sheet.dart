import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/document_sheet.dart';
import '../../../../shared/widgets/empty_view.dart';
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
          onCallAgain: onCallAgain,
        );
      case HotlineSummaryOutcome.manual:
        return _ManualTerminal(onCopyForWhatsApp: onCopyForWhatsApp);
      case HotlineSummaryOutcome.callFailed:
        return _CallFailedTerminal(
          status: callResult?.callStatus ?? CallStatus.failed,
          onRetry: onRetry,
          onCopyForWhatsApp: onCopyForWhatsApp,
        );
      case HotlineSummaryOutcome.endedNoConversation:
        return _NoConversationTerminal(
          onRetry: onRetry,
          onCopyForWhatsApp: onCopyForWhatsApp,
        );
      case HotlineSummaryOutcome.summaryUnavailable:
        return _SummaryUnavailableTerminal(
          transcript: callResult?.transcript ?? const [],
        );
    }
  }
}

// ─── The full summary — the DocumentSheet payoff ─────────────────────────────

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
  final VoidCallback onCallAgain;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final summary = result?.callSummary;
    // `outcome == summary` guarantees a non-null callSummary, but stay defensive
    // so a malformed projection degrades rather than throwing.
    if (summary == null) {
      return _NoConversationTerminal(
        onRetry: onDone,
        onCopyForWhatsApp: onDone,
      );
    }

    // The document blocks, in reading order (SPEC §B.1 stage 6). Empty
    // concern / commitment / guidance sections are omitted entirely, and
    // follow-up appears only when the AI flagged it.
    final blocks = <Widget>[
      DocumentSheetSection(
        title: l10n.parentHotlineSummarySaidHeader,
        child: AiText(summary.parentResponse),
      ),
      if (summary.parentConcerns.isNotEmpty)
        DocumentSheetSection(
          title: l10n.parentHotlineSummaryConcernsHeader,
          child: _ConcernList(items: summary.parentConcerns),
        ),
      if (summary.parentCommitments.isNotEmpty)
        DocumentSheetSection(
          title: l10n.parentHotlineSummaryCommitmentsHeader,
          child: _GlyphList(
            items: summary.parentCommitments,
            icon: LucideIcons.check,
          ),
        ),
      if (summary.actionItemsForTeacher.isNotEmpty)
        DocumentSheetSection(
          title: l10n.parentHotlineSummaryActionsHeader,
          child: _ActionItems(items: summary.actionItemsForTeacher),
        ),
      if (summary.guidanceGiven.isNotEmpty)
        DocumentSheetSection(
          title: l10n.parentHotlineSummaryGuidanceHeader,
          child: _GlyphList(
            items: summary.guidanceGiven,
            icon: LucideIcons.lightbulb,
          ),
        ),
      if (summary.followUpNeeded && (summary.followUpSuggestion?.isNotEmpty ?? false))
        DocumentSheetSection(
          title: l10n.parentHotlineSummaryFollowUpHeader,
          child: _FollowUpInset(text: summary.followUpSuggestion!),
        ),
      if ((result?.transcript ?? const []).isNotEmpty)
        _TranscriptTile(turns: result!.transcript),
    ];

    // Ink-settle: each block fades + rises in turn so the document assembles
    // itself; degrades to the composed frame under reduce-motion. Identical
    // mechanism to LessonPlanResultView.
    final revealed = <Widget>[
      for (var i = 0; i < blocks.length; i++)
        inkSettle(context, blocks[i], index: i),
    ];

    return DocumentSheet(
      docType: _eyebrow(l10n, reason),
      title: l10n.parentHotlineSummaryTitle(studentName),
      meta: _meta(context, summary, result),
      footer: _SummaryFooter(
        isDedupBlocked: isDedupBlocked,
        dedupRetryAfterSeconds: dedupRetryAfterSeconds,
        onDone: onDone,
        onCallAgain: onCallAgain,
      ),
      children: revealed,
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

  /// The masthead meta badges: a toned sentiment pill, then (when known) the
  /// duration and the exchange count — all AppBadge-grammar stadium pills.
  List<Widget> _meta(
    BuildContext context,
    CallSummary summary,
    CallResult? result,
  ) {
    final l10n = context.l10n;
    final minutes = _durationMinutes(result?.callDurationSeconds);
    final turns = result?.turnCount ?? 0;
    return [
      _SentimentBadge(sentiment: summary.parentSentiment),
      if (minutes != null)
        AppBadge(
          icon: LucideIcons.clock,
          label: l10n.parentHotlineSummaryDurationMin(minutes),
        ),
      if (turns > 1)
        AppBadge(
          icon: LucideIcons.messagesSquare,
          label: l10n.parentHotlineCallingExchanges(turns),
        ),
    ];
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
              style: text.labelMedium
                  ?.copyWith(color: ink, fontWeight: FontWeight.w600),
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

/// Concerns raised — an `AppCard(inset)` list of AiText lines (SPEC §B.1).
class _ConcernList extends StatelessWidget {
  const _ConcernList({required this.items});

  final List<String> items;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AppCard(
      variant: AppCardVariant.inset,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.space3),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Icon(
                    LucideIcons.alertCircle,
                    size: AppIconSize.inline,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(width: AppSpacing.space3),
                Expanded(child: AiText(items[i])),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// A list of AiText lines, each led by a shared [icon] glyph — commitments
/// (`check`) and guidance (`arrow-right`).
class _GlyphList extends StatelessWidget {
  const _GlyphList({required this.items, required this.icon});

  final List<String> items;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.space3),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Icon(
                  icon,
                  size: AppIconSize.inline,
                  color: scheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(width: AppSpacing.space3),
              Expanded(child: AiText(items[i])),
            ],
          ),
        ],
      ],
    );
  }
}

/// Your action items — the ONE primary-toned block (SPEC §B.1). A saffron
/// `primaryContainer` panel with an `arrow-right` glyph per to-do; the AiText
/// prose stays full-ink `onSurface` (which clears AA on the light-saffron tint)
/// so the block reads as the teacher's call-to-act without a raw hex in sight.
class _ActionItems extends StatelessWidget {
  const _ActionItems({required this.items});

  final List<String> items;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.space4),
      decoration: BoxDecoration(
        color: scheme.primaryContainer,
        borderRadius: AppRadius.rMd,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.space3),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Icon(
                    LucideIcons.arrowRight,
                    size: AppIconSize.inline,
                    color: scheme.onPrimaryContainer,
                  ),
                ),
                const SizedBox(width: AppSpacing.space3),
                Expanded(child: AiText(items[i])),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// Follow-up — a pine/green-toned inset (SPEC §B.1), shown only when the AI
/// flagged `followUpNeeded`.
class _FollowUpInset extends StatelessWidget {
  const _FollowUpInset({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.space4),
      decoration: BoxDecoration(
        color: scheme.secondaryContainer,
        borderRadius: AppRadius.rMd,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Icon(
              LucideIcons.calendarClock,
              size: AppIconSize.inline,
              color: scheme.onSecondaryContainer,
            ),
          ),
          const SizedBox(width: AppSpacing.space3),
          Expanded(child: AiText(text)),
        ],
      ),
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
  final VoidCallback onCallAgain;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final text = Theme.of(context).textTheme;
    final saffron = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;
    final scheme = Theme.of(context).colorScheme;

    final callAgainLabel = isDedupBlocked
        ? l10n.parentHotlineCallAgainIn(
            _formatCountdown(dedupRetryAfterSeconds ?? 0))
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
        SizedBox(
          height: 48,
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
class _ManualTerminal extends StatelessWidget {
  const _ManualTerminal({required this.onCopyForWhatsApp});

  final VoidCallback onCopyForWhatsApp;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return EmptyView(
      icon: LucideIcons.messageCircle,
      title: l10n.parentHotlineSummaryManualTitle,
      message: l10n.parentHotlineSummaryManualBody,
      action: SecondaryButton(
        label: l10n.parentHotlineWhatsApp,
        icon: LucideIcons.copy,
        onPressed: onCopyForWhatsApp,
      ),
    );
  }
}

/// `failed / no_answer / busy` — a warm, retryable phone-off state. The line is
/// derived from the terminal [status] (SPEC §B.1).
class _CallFailedTerminal extends StatelessWidget {
  const _CallFailedTerminal({
    required this.status,
    required this.onRetry,
    required this.onCopyForWhatsApp,
  });

  final CallStatus status;
  final VoidCallback onRetry;
  final VoidCallback onCopyForWhatsApp;

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
      ),
    );
  }
}

/// Poll exhausted with no real conversation (turnCount < 2) — "Call ended before
/// a conversation could happen."
class _NoConversationTerminal extends StatelessWidget {
  const _NoConversationTerminal({
    required this.onRetry,
    required this.onCopyForWhatsApp,
  });

  final VoidCallback onRetry;
  final VoidCallback onCopyForWhatsApp;

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
      ),
    );
  }
}

/// Poll exhausted, summary absent but a transcript exists — show the transcript
/// under "Summary isn't available for this call."
class _SummaryUnavailableTerminal extends StatelessWidget {
  const _SummaryUnavailableTerminal({required this.transcript});

  final List<TranscriptTurn> transcript;

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
      ],
    );
  }
}

/// The shared retry / WhatsApp affordance pair used by the failed and
/// no-conversation terminals.
class _RetryOrWhatsApp extends StatelessWidget {
  const _RetryOrWhatsApp({
    required this.onRetry,
    required this.onCopyForWhatsApp,
  });

  final VoidCallback onRetry;
  final VoidCallback onCopyForWhatsApp;

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
        const SizedBox(height: AppSpacing.space2),
        SecondaryButton(
          label: l10n.parentHotlineWhatsApp,
          icon: LucideIcons.messageCircle,
          onPressed: onCopyForWhatsApp,
        ),
      ],
    );
  }
}
