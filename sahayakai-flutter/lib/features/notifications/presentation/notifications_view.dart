import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/note_banner.dart';
import '../../../shared/widgets/secondary_button.dart';
import '../data/notifications_store.dart';
import '../domain/teacher_notification.dart';
import 'widgets/notification_row.dart';

/// The Network hub's third tab: what happened while the teacher was working.
///
/// Body only — no app bar, no scaffold — because it is mounted inside
/// `NetworkHubScreen`'s pane stack beside the Staffroom feed and the Pro Inbox,
/// exactly as those two are.
///
/// Three states, and no fourth: rows, the empty state, and (folded into both)
/// the note that says where these come from. There is no loading state and no
/// error state, and that is not an omission — the source is a local store, so
/// there is nothing to be in flight and nothing that can fail. Rendering a
/// skeleton over a synchronous read would be theatre.
///
/// Every row leads somewhere it can actually keep its promise:
///   • a call outcome opens the Parent Hotline, where the summary sheet and the
///     retry / WhatsApp-copy paths live;
///   • an absence run opens that class's month view, which is where the missed
///     days are listed;
///   • a queued exam paper opens the Library, which is where the 202 said the
///     paper would be saved.
class NotificationsView extends ConsumerWidget {
  const NotificationsView({super.key, this.now});

  /// Injectable clock, forwarded to the rows' relative timestamps.
  final DateTime? now;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final notifications = ref.watch(notificationsProvider);
    final unread = ref.watch(unreadNotificationCountProvider);

    if (notifications.isEmpty) {
      return SingleChildScrollView(
        padding: AppSpacing.pagePadding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            EmptyView(
              icon: LucideIcons.bell,
              title: l10n.notificationsEmptyTitle,
              message: l10n.notificationsEmptyBody,
            ),
            const SizedBox(height: AppSpacing.space4),
            _localNote(context),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: AppSpacing.pagePadding,
      // +1 leading slot for the note (and the mark-all action when it applies).
      itemCount: notifications.length + 1,
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.space3),
      itemBuilder: (context, index) {
        if (index == 0) return _header(context, ref, unread: unread);
        final notification = notifications[index - 1];
        return NotificationRow(
          key: ValueKey<String>('notification-${notification.id}'),
          notification: notification,
          now: now,
          onTap: () {
            ref.read(notificationsProvider.notifier).markRead(notification.id);
            context.push(_destination(notification));
          },
        );
      },
    );
  }

  Widget _header(BuildContext context, WidgetRef ref, {required int unread}) {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        _localNote(context),
        if (unread > 0) ...[
          const SizedBox(height: AppSpacing.space3),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: SecondaryButton(
              label: l10n.notificationsMarkAllRead,
              icon: LucideIcons.checkCheck,
              onPressed: () =>
                  ref.read(notificationsProvider.notifier).markAllRead(),
            ),
          ),
        ],
      ],
    );
  }

  /// The honesty line. It is on screen, not only in a handoff note, because the
  /// misunderstanding it prevents is one a teacher would act on: seeing an
  /// "Updates" list, they would reasonably assume the phone will tell them when
  /// a call comes back. It will not — there is no push in this build.
  Widget _localNote(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    return NoteBanner.custom(
      icon: LucideIcons.info,
      child: Text(
        l10n.notificationsLocalNote,
        style: theme.textTheme.bodyMedium?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }

  /// Where a row leads. The absence row needs the class it belongs to; if that
  /// id is somehow absent the row falls back to the class list rather than
  /// pushing a malformed path.
  static String _destination(TeacherNotification n) => switch (n.kind) {
    TeacherNotificationKind.callCompleted ||
    TeacherNotificationKind.callFailed => Routes.parentHotline,
    TeacherNotificationKind.absenceRun =>
      n.classId == null || n.classId!.isEmpty
          ? Routes.attendance
          : Routes.attendanceMonthPath(n.classId!),
    TeacherNotificationKind.examPaperQueued => Routes.library,
  };
}
