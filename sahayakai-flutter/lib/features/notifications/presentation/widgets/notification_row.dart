import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/icon_well.dart';
import '../../../inbox/presentation/inbox_time.dart';
import '../../domain/teacher_notification.dart';

/// One **Updates** row: an [AppCard] register row in the same grammar as the
/// hub's sibling `ConversationRow` (48dp leading well, title + relative time on
/// the baseline, a muted second line), so the third tab reads as part of the
/// Network hub rather than as a bolted-on screen.
///
/// Unread is carried by weight plus a small saffron dot, never a coloured row
/// fill. The dot uses the saffron **text** token (`#AC4815` light /
/// `#EB9447` dark), not `scheme.primary`: the brand fill `#E0924D` on the
/// card's white ground is ~2.26:1, under the 3:1 floor a meaningful non-text
/// indicator has to clear. Same reasoning, same tokens, as AppBadge's accent
/// tone.
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
    final scheme = theme.colorScheme;
    final text = theme.textTheme;
    final extras = AppTextExtras.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final unread = !notification.isRead;
    final timestamp = inboxRelativeTime(
      notification.at.toIso8601String(),
      now ?? DateTime.now(),
      l10n,
    );

    return AppCard(
      onTap: onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IconWell(icon: _glyph(notification.kind)),
          const SizedBox(width: AppSpacing.space3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Expanded(
                      child: Text(
                        notificationTitle(notification, l10n),
                        style: text.titleMedium?.copyWith(
                          fontWeight: unread ? FontWeight.w700 : null,
                        ),
                      ),
                    ),
                    if (timestamp.isNotEmpty) ...[
                      const SizedBox(width: AppSpacing.space2),
                      Text(
                        timestamp,
                        style: extras.dataMedium.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: AppSpacing.space1),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        notificationBody(notification, l10n),
                        style: text.bodyMedium?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                    if (unread) ...[
                      const SizedBox(width: AppSpacing.space2),
                      Semantics(
                        label: l10n.inboxUnreadLabel(1),
                        child: Padding(
                          // Optically centre the dot against the body line.
                          padding: const EdgeInsets.only(
                            top: AppSpacing.space1,
                          ),
                          child: SizedBox(
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
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static IconData _glyph(TeacherNotificationKind kind) => switch (kind) {
    TeacherNotificationKind.callCompleted => LucideIcons.phoneCall,
    TeacherNotificationKind.callFailed => LucideIcons.phoneMissed,
    TeacherNotificationKind.absenceRun => LucideIcons.calendarX,
    TeacherNotificationKind.examPaperQueued => LucideIcons.fileText,
  };
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
    };
