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
import '../../../shared/widgets/note_banner.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../domain/attendance_class.dart';
import '../domain/roster_student.dart';
import 'attendance_providers.dart';
import 'widgets/attendance_failure_view.dart';

/// One class's students, in the masked projection, plus the way to add one.
///
/// **The list is expected to be unavailable today, and that is not a bug.**
/// `listRoster` refuses to decode an unmasked reply, so until the masked
/// `?projection=roster` endpoint (draft PR #124) merges this screen renders
/// [RosterUnavailableView] — a specific, calm notice that names what is
/// happening, says nothing is wrong with the class, and points out that the
/// register and the monthly view are unaffected. It is emphatically NOT an
/// error panel: see that widget for the whole argument.
///
/// The ADD path is unaffected by any of that. It is a write, it travels
/// upwards, and a parent phone number entered here never comes back down (see
/// `AddStudentScreen`), so "Add student" stays live even while the list cannot
/// be shown.
class AttendanceRosterScreen extends ConsumerWidget {
  const AttendanceRosterScreen({
    super.key,
    required this.classId,
    this.attendanceClass,
  });

  final String classId;

  /// The class the row that opened this screen already had, handed through
  /// `extra` so the title and the 40-cap check paint without a second read.
  /// Null on a cold deep link, in which case the cap check falls back to the
  /// server's own transactional refusal.
  final AttendanceClass? attendanceClass;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final roster = ref.watch(attendanceRosterProvider(classId));
    final isFull = attendanceClass?.isFull ?? false;

    return ToolScaffold(
      title: attendanceClass?.name ?? l10n.attendanceOpenRoster,
      // Disabled at the cap rather than allowed to fail: the count is the same
      // denormalized counter the server's transaction guards, so the UI can
      // say no before the round trip instead of apologising after it.
      onSubmit: isFull
          ? null
          : () => context.push(
              Routes.attendanceAddStudentPath(classId),
              extra: attendanceClass,
            ),
      submitLabel: l10n.attendanceAddStudent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          EditorialSectionHeader(l10n.attendanceRosterEyebrow),
          const SizedBox(height: AppSpacing.space4),
          if (isFull) ...[
            NoteBanner(
              icon: LucideIcons.userX,
              label: l10n.attendanceClassFullTitle,
              body: l10n.attendanceClassFullBody(ClassCapacity.maxStudents),
            ),
            const SizedBox(height: AppSpacing.space4),
          ],
          roster.when(
            loading: () => const AppSkeleton(lines: 5),
            error: (error, _) => AppCard(
              child: AttendanceFailureView(
                error: error,
                message: l10n.attendanceRosterError,
                onRetry: () =>
                    ref.invalidate(attendanceRosterProvider(classId)),
              ),
            ),
            data: (students) => students.isEmpty
                ? AppCard(
                    child: EmptyView(
                      icon: LucideIcons.userPlus,
                      title: l10n.attendanceRosterEmptyTitle,
                      message: l10n.attendanceRosterEmptyBody,
                    ),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (final (index, student) in students.indexed) ...[
                        if (index > 0)
                          const SizedBox(height: AppSpacing.space3),
                        _RosterRow(student: student),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

/// One student, showing only what the masked projection carries.
///
/// F9-001: there is no full phone number to show and no way to ask for one.
/// The most this row can say about a contact is its last four digits, which is
/// exactly enough for a teacher to recognise which number is on file.
class _RosterRow extends StatelessWidget {
  const _RosterRow({required this.student});

  final RosterStudent student;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final last4 = student.parentPhoneLast4;

    return AppCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
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
                  '${l10n.attendanceRollLabel(student.rollNumber)} · '
                  '${student.parentLanguage}',
                  style: text.bodyMedium?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: AppSpacing.space2),
                if (student.hasParentPhone && last4 != null)
                  AppBadge(
                    label: l10n.attendanceParentPhoneMask(last4),
                    icon: LucideIcons.phone,
                    size: AppBadgeSize.small,
                  )
                else
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
                          l10n.attendanceNoParentPhone,
                          style: text.bodySmall?.copyWith(
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
