import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/map_card.dart';
import '../../parent_hotline/domain/hotline_launch.dart';
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

  /// The map's screen frame under the hub header.
  static const EdgeInsets _padding = EdgeInsets.fromLTRB(
    AppSpacing.mapGutter,
    AppSpacing.space3,
    AppSpacing.mapGutter,
    AppSpacing.mapBottomClearance,
  );

  /// Injectable clock, forwarded to the rows' relative timestamps.
  final DateTime? now;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final notifications = ref.watch(notificationsProvider);
    final unread = ref.watch(unreadNotificationCountProvider);

    if (notifications.isEmpty) {
      return SingleChildScrollView(
        padding: _padding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            _localNote(context),
            const SizedBox(height: AppSpacing.space3),
            MapCard(
              child: MapEmptyNote(
                icon: LucideIcons.bell,
                title: l10n.notificationsEmptyTitle,
                message: l10n.notificationsEmptyBody,
              ),
            ),
          ],
        ),
      );
    }

    // Split by the teacher's local day: what happened today, then the rest.
    // The store is newest-first, and each group keeps that order.
    final clock = (now ?? DateTime.now()).toLocal();
    final today = DateTime(clock.year, clock.month, clock.day);
    bool isToday(TeacherNotification n) {
      final at = n.at.toLocal();
      return DateTime(at.year, at.month, at.day) == today;
    }

    final todays = [
      for (final n in notifications)
        if (isToday(n)) n,
    ];
    final earlier = [
      for (final n in notifications)
        if (!isToday(n)) n,
    ];

    return ListView(
      padding: _padding,
      children: [
        _header(context, ref, unread: unread),
        if (todays.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.space5),
          MapOverline(l10n.libraryDayToday, color: AppColors.textEyebrow),
          const SizedBox(height: AppSpacing.space2),
          _group(context, ref, todays),
        ],
        if (earlier.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.space5),
          MapOverline(l10n.libraryDayEarlier),
          const SizedBox(height: AppSpacing.space2),
          _group(context, ref, earlier),
        ],
      ],
    );
  }

  /// One day-group: a [MapCard] list, its rows divided by hairlines.
  Widget _group(
    BuildContext context,
    WidgetRef ref,
    List<TeacherNotification> rows,
  ) {
    return MapCard(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, notification) in rows.indexed) ...[
            if (i > 0)
              const Divider(
                height: 1,
                thickness: 1,
                indent: 14,
                endIndent: 14,
                color: AppColors.borderHairline,
              ),
            NotificationRow(
              key: ValueKey<String>('notification-${notification.id}'),
              notification: notification,
              now: now,
              onTap: () => _open(context, ref, notification),
            ),
          ],
        ],
      ),
    );
  }

  void _open(
    BuildContext context,
    WidgetRef ref,
    TeacherNotification notification,
  ) {
    ref.read(notificationsProvider.notifier).markRead(notification.id);
    // A call row opens that exact call (its summary, or the call if it is
    // still running); everything else opens its screen.
    final outreach = notification.outreachId;
    if (outreach != null && outreach.isNotEmpty) {
      context.push(
        Routes.parentHotline,
        extra: HotlineLaunch(
          outreachId: outreach,
          studentName: notification.label,
        ),
      );
      return;
    }
    context.push(_destination(notification));
  }

  /// The map's Updates header: where these come from, and "Mark all as
  /// read" as a link under it while anything is unread (stacked, so a long
  /// translation of either never squeezes the other).
  Widget _header(BuildContext context, WidgetRef ref, {required int unread}) {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        SizedBox(width: double.infinity, child: _localNote(context)),
        if (unread > 0) ...[
          TextButton(
            onPressed: () =>
                ref.read(notificationsProvider.notifier).markAllRead(),
            style: TextButton.styleFrom(
              foregroundColor: AppColors.textLink,
              minimumSize: const Size(48, 48),
              textStyle: Theme.of(context).textTheme.bodyLarge?.copyWith(
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            child: Text(l10n.notificationsMarkAllRead),
          ),
        ],
      ],
    );
  }

  /// The honesty line. It is on screen, not only in a handoff note, because the
  /// misunderstanding it prevents is one a teacher would act on: seeing an
  /// "Updates" list, they would reasonably assume the phone will tell them when
  /// a call comes back. It will not: there is no push in this build.
  Widget _localNote(BuildContext context) {
    return Text(
      context.l10n.notificationsLocalNote,
      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
        fontSize: 13,
        color: AppColors.textMuted,
      ),
    );
  }

  /// Where a row leads. The absence row needs the class it belongs to; if that
  /// id is somehow absent the row falls back to the class list rather than
  /// pushing a malformed path.
  static String _destination(TeacherNotification n) => switch (n.kind) {
    TeacherNotificationKind.callCompleted ||
    TeacherNotificationKind.callFailed ||
    TeacherNotificationKind.followUp => Routes.parentHotline,
    TeacherNotificationKind.absenceRun =>
      n.classId == null || n.classId!.isEmpty
          ? Routes.attendance
          : Routes.attendanceMonthPath(n.classId!),
    TeacherNotificationKind.examPaperQueued => Routes.library,
  };
}
