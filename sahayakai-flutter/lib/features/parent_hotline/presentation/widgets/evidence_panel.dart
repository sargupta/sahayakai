import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/app_skeleton.dart';
import '../../domain/parent_outreach.dart';

/// The reason-aware evidence panel on the Parent Hotline `compose` stage
/// (SPEC §B.1 stage 3, porting the web `ReasonContextPanel`). An
/// `AppCard(inset)` that grounds the call in what prompted it: absent-days for
/// attendance, recent marks for poor-performance, the win to celebrate for
/// positive feedback, and a what-happened prompt for a behavioural concern.
///
/// **Performance data (SPEC §B.1 / §B.2).** Recent marks come from
/// `GET /api/performance/student/{id}` which `401`s under the foundation-v1 stub
/// token, so [performance] is null here and the marks section degrades to a
/// dignified "no marks on record" prompt rather than a spinner. [isLoading]
/// exists for when that read lands: it swaps the body for an [AppSkeleton] that
/// mirrors the panel shape (never a bare spinner, DESIGN_RUBRIC §6).
class EvidencePanel extends StatelessWidget {
  const EvidencePanel({
    super.key,
    required this.reason,
    this.consecutiveAbsentDays,
    this.performance,
    this.isLoading = false,
  });

  final OutreachReason reason;

  /// Consecutive absent days (attendance reason); drives the absent-days badge.
  final int? consecutiveAbsentDays;

  /// Opaque recent-marks snapshot. Null in foundation-v1 (the read 401s).
  final Map<String, dynamic>? performance;

  /// While a performance read is in flight, show the shaped skeleton.
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    final (IconData icon, String header) = switch (reason) {
      OutreachReason.consecutiveAbsences => (
          LucideIcons.calendarX2,
          l10n.parentHotlineEvidenceAttendanceHeader,
        ),
      OutreachReason.poorPerformance => (
          LucideIcons.trendingDown,
          l10n.parentHotlineEvidenceMarksHeader,
        ),
      OutreachReason.behavioralConcern => (
          LucideIcons.alertTriangle,
          l10n.parentHotlineEvidenceBehaviourHeader,
        ),
      OutreachReason.positiveFeedback => (
          LucideIcons.star,
          l10n.parentHotlineEvidencePositiveHeader,
        ),
    };

    return AppCard(
      variant: AppCardVariant.inset,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(icon, size: AppIconSize.inline, color: scheme.onSurfaceVariant),
              const SizedBox(width: AppSpacing.space2),
              Flexible(
                child: Text(
                  header,
                  style: text.titleSmall?.copyWith(color: scheme.onSurface),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.space3),
          if (isLoading)
            const AppSkeleton(lines: 2)
          else
            ..._body(context, l10n),
        ],
      ),
    );
  }

  List<Widget> _body(BuildContext context, AppLocalizations l10n) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    Widget prompt(String s) => Text(
          s,
          style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
        );

    switch (reason) {
      case OutreachReason.consecutiveAbsences:
        final days = consecutiveAbsentDays;
        return [
          if (days != null && days > 0) ...[
            Wrap(
              spacing: AppSpacing.space2,
              runSpacing: AppSpacing.space2,
              children: [
                AppBadge(
                  icon: LucideIcons.calendarX2,
                  label: l10n.parentHotlineEvidenceAbsentDays(days),
                  tone: AppBadgeTone.accent,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.space3),
          ],
          prompt(l10n.parentHotlineEvidenceAbsencePrompt),
        ];
      case OutreachReason.poorPerformance:
        // foundation-v1: no performance snapshot (the read 401s) → the dignified
        // "no marks on record" prompt. When a snapshot lands, surface it here.
        final hasMarks = performance != null && performance!.isNotEmpty;
        return [
          prompt(hasMarks
              ? l10n.parentHotlineEvidenceMarksPrompt
              : l10n.parentHotlineEvidenceMarksEmpty),
        ];
      case OutreachReason.behavioralConcern:
        return [prompt(l10n.parentHotlineEvidenceBehaviourPrompt)];
      case OutreachReason.positiveFeedback:
        return [prompt(l10n.parentHotlineEvidencePositivePrompt)];
    }
  }
}
