import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_badge.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/icon_well.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../domain/attendance_class.dart';
import 'attendance_providers.dart';
import 'widgets/attendance_failure_view.dart';

/// The Attendance landing: the teacher's classes, and the way into each of the
/// three things they can do with one.
///
/// Reads are ungated, so this screen renders for every teacher; only the three
/// writes behind it are premium (see `AttendancePremiumCard`). The sticky
/// footer action is "New class", which is a write, so it opens the form and
/// the form is where the plan gate surfaces — not here, where it would gate a
/// list the teacher is allowed to read.
class AttendanceClassesScreen extends ConsumerWidget {
  const AttendanceClassesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final classes = ref.watch(attendanceClassesProvider);

    return ToolScaffold(
      title: l10n.attendanceTitle,
      onSubmit: () => context.push(Routes.attendanceNewClass),
      submitLabel: l10n.attendanceNewClass,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          EditorialSectionHeader(l10n.attendanceClassesEyebrow),
          const SizedBox(height: AppSpacing.space4),
          Text(
            l10n.attendanceClassesIntro,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: AppSpacing.space6),
          classes.when(
            loading: () => const AppSkeleton(lines: 5),
            error: (error, _) => AppCard(
              child: AttendanceFailureView(
                error: error,
                message: l10n.attendanceClassesError,
                onRetry: () => ref.invalidate(attendanceClassesProvider),
              ),
            ),
            data: (items) => items.isEmpty
                ? AppCard(
                    child: EmptyView(
                      icon: LucideIcons.users,
                      title: l10n.attendanceClassesEmptyTitle,
                      message: l10n.attendanceClassesEmptyBody,
                    ),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (final (index, item) in items.indexed) ...[
                        if (index > 0)
                          const SizedBox(height: AppSpacing.space3),
                        _ClassCard(item: item),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

/// One class: its identity, how full it is, and the three destinations.
///
/// The card itself opens the register — that is the daily job, and making the
/// whole card the primary target means a teacher marking attendance never has
/// to aim at a small control. Roster and month are secondary text actions
/// under it, in a [Wrap] so they reflow rather than clip at a large text
/// scale.
class _ClassCard extends StatelessWidget {
  const _ClassCard({required this.item});

  final AttendanceClass item;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return AppCard(
      onTap: () =>
          context.push(Routes.attendanceMarkPath(item.id), extra: item),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const IconWell(icon: LucideIcons.users),
              const SizedBox(width: AppSpacing.space4),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(item.name, style: text.titleMedium),
                    const SizedBox(height: AppSpacing.space1),
                    Text(
                      _meta(item),
                      style: text.bodyMedium?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.space3),
          Wrap(
            spacing: AppSpacing.space2,
            runSpacing: AppSpacing.space2,
            children: [
              // A bare count against the cap needs no sentence in eleven
              // languages: the glyph says "students" and the denominator says
              // where the 40-student ceiling is.
              AppBadge(
                label: '${item.studentCount} / ${ClassCapacity.maxStudents}',
                icon: LucideIcons.user,
                size: AppBadgeSize.small,
              ),
              if (item.isFull)
                AppBadge(
                  label: l10n.attendanceClassFullBadge,
                  icon: LucideIcons.userX,
                  tone: AppBadgeTone.accent,
                  size: AppBadgeSize.small,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.space3),
          Wrap(
            spacing: AppSpacing.space2,
            runSpacing: AppSpacing.space2,
            children: [
              _CardAction(
                icon: LucideIcons.clipboardCheck,
                label: l10n.attendanceOpenRegister,
                onPressed: () => context.push(
                  Routes.attendanceMarkPath(item.id),
                  extra: item,
                ),
              ),
              _CardAction(
                icon: LucideIcons.userPlus,
                label: l10n.attendanceOpenRoster,
                onPressed: () => context.push(
                  Routes.attendanceRosterPath(item.id),
                  extra: item,
                ),
              ),
              _CardAction(
                icon: LucideIcons.calendarDays,
                label: l10n.attendanceOpenMonth,
                onPressed: () => context.push(
                  Routes.attendanceMonthPath(item.id),
                  extra: item,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// `Science · Class 6 · A · 2026-27`, skipping the parts a class does not
  /// carry. The separator is the app's existing meta dot, not new copy.
  String _meta(AttendanceClass item) {
    final parts = <String>[
      if (item.subject.isNotEmpty) item.subject,
      if (item.gradeLevel.isNotEmpty) item.gradeLevel,
      if (item.section != null) item.section!,
      if (item.academicYear.isNotEmpty) item.academicYear,
    ];
    return parts.join(' · ');
  }
}

/// A secondary destination on a class card. A [TextButton] rather than a
/// `SecondaryButton` because three full-width 52dp buttons on every card would
/// bury the class itself.
class _CardAction extends StatelessWidget {
  const _CardAction({
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return TextButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: AppIconSize.inline),
      label: Text(label),
    );
  }
}
