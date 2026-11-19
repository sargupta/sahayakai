import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/map_icon_tile.dart';
import '../../../inbox/presentation/inbox_time.dart';
import '../../domain/teacher_notification.dart';

/// One **Updates** row, built to sit in a [MapCard] list with hairline
/// dividers (the view draws the card and the dividers): a 40px tinted icon
/// tile, a bold title, a muted detail line with the relative time under it,
/// and the row's own action — "Open" — as a small accent-tinted pill.
///
/// The whole row is the one tap target (≥76dp tall) and reads as one
/// sentence; the pill shows what the tap does rather than being a second
/// button that does the same thing.
///
/// Unread is carried by weight plus a small saffron dot (and "1 unread" in
/// the spoken label), never a coloured row fill. The dot uses the saffron
/// **text** token, not the brand fill: `#E0924D` on the card's white ground is
/// ~2.26:1, under the 3:1 floor a meaningful non-text indicator has to clear.
class NotificationRow extends StatelessWidget {
  const NotificationRow({
    super.key,
    required this.notification,
    required this.onTap,
    this.now,
  });

  final TeacherNotification notification;
  final VoidCallback onTap;

  /// Injectable clock so a widget test renders a deterministic relative time.
  final DateTime? now;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final text = theme.textTheme;
    final isDark = theme.brightness == Brightness.dark;

    final unread = !notification.isRead;
    final timestamp = inboxRelativeTime(
      notification.at.toIso8601String(),
      now ?? DateTime.now(),
      l10n,
    );
    final title = notificationTitle(notification, l10n);
    final body = notificationBody(notification, l10n);
    final tint = _tint(notification.kind);

    final spoken = [
      title,
      body,
      if (timestamp.isNotEmpty) timestamp,
      if (unread) l10n.inboxUnreadLabel(1),
    ].join(', ');

    return Semantics(
      button: true,
      label: spoken,
      hint: l10n.actionOpen,
      excludeSemantics: true,
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 76),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: AppSpacing.space3,
              ),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: tint.fill,
                      borderRadius: AppRadius.rRow,
                    ),
                    child: Icon(
                      _glyph(notification.kind),
                      size: 18,
                      color: tint.ink,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.space3),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          title,
                          style: text.bodyLarge?.copyWith(
                            fontWeight: unread
                                ? FontWeight.w700
                                : FontWeight.w600,
                            color: AppColors.textStrong,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          body,
                          style: text.bodyMedium?.copyWith(
                            color: AppColors.textMuted,
                          ),
                        ),
                        if (timestamp.isNotEmpty)
                          Text(
                            timestamp,
                            style: text.bodySmall?.copyWith(
                              color: AppColors.textMuted,
                              fontFeatures: const [
                                FontFeature.tabularFigures(),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.space2),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      _ActionPill(l10n.actionOpen),
                      if (unread) ...[
                        const SizedBox(height: AppSpacing.space2),
                        SizedBox(
                          width: 8,
                          height: 8,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isDark
                                  ? AppColors.dPrimaryText
                                  : AppColors.lPrimaryText,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// The kind → tile mapping the Updates rows have always used.
  static MapTint _tint(TeacherNotificationKind kind) => switch (kind) {
    TeacherNotificationKind.callCompleted ||
    TeacherNotificationKind.callFailed => MapTint.leaf,
    TeacherNotificationKind.absenceRun => MapTint.amber,
    TeacherNotificationKind.examPaperQueued => MapTint.indigo,
    TeacherNotificationKind.followUp => MapTint.saffron,
  };

  static IconData _glyph(TeacherNotificationKind kind) => switch (kind) {
    TeacherNotificationKind.callCompleted => LucideIcons.phoneCall,
    TeacherNotificationKind.callFailed => LucideIcons.phoneMissed,
    TeacherNotificationKind.absenceRun => LucideIcons.calendarX,
    TeacherNotificationKind.examPaperQueued => LucideIcons.fileText,
    TeacherNotificationKind.followUp => LucideIcons.calendarClock,
  };
}

/// What a tap on the row does, shown as the map's small accent-tinted pill:
/// saffron-700 on the saffron tile tint, ≥ 4.5:1.
class _ActionPill extends StatelessWidget {
  const _ActionPill(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.tileSaffronBg,
        borderRadius: AppRadius.rPill,
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: AppSpacing.space2,
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: AppColors.saffron700,
          ),
        ),
      ),
    );
  }
}

/// The row's headline. Public so the view's accessibility ordering and the
/// tests can read the same string the row renders.
String notificationTitle(TeacherNotification n, AppLocalizations l10n) =>
    switch (n.kind) {
      TeacherNotificationKind.callCompleted =>
        l10n.notificationCallCompletedTitle(n.label),
      TeacherNotificationKind.callFailed => l10n.notificationCallFailedTitle(
        n.label,
      ),
      TeacherNotificationKind.absenceRun => l10n.notificationAbsenceTitle(
        n.label,
        n.count,
      ),
      TeacherNotificationKind.examPaperQueued =>
        l10n.notificationExamPaperTitle(n.label),
      TeacherNotificationKind.followUp => l10n.notificationFollowUpTitle(
        n.label,
      ),
    };

/// The row's second line.
String notificationBody(TeacherNotification n, AppLocalizations l10n) =>
    switch (n.kind) {
      TeacherNotificationKind.callCompleted =>
        l10n.notificationCallCompletedBody,
      TeacherNotificationKind.callFailed => l10n.notificationCallFailedBody,
      // A row recorded from a deep link may not know the class's own name (the
      // month screen is reachable without the class object). Falling back to
      // the localized feature word keeps the sentence whole; storing that word
      // instead would freeze it in whatever language was active at the time.
      TeacherNotificationKind.absenceRun => l10n.notificationAbsenceBody(
        n.className?.trim().isNotEmpty == true
            ? n.className!.trim()
            : l10n.attendanceTitle,
      ),
      TeacherNotificationKind.examPaperQueued => l10n.notificationExamPaperBody,
      TeacherNotificationKind.followUp => l10n.notificationFollowUpBody,
    };
