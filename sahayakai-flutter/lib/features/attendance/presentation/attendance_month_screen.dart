import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/platform/clock.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_badge.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/note_banner.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../../notifications/data/notifications_store.dart';
import '../../notifications/domain/teacher_notification.dart';
import '../domain/attendance_class.dart';
import '../domain/attendance_date.dart';
import '../domain/attendance_record.dart';
import 'attendance_providers.dart';
import 'widgets/attendance_failure_view.dart';

/// One class's month: every student's rollup, and the days each of them
/// missed.
///
/// THE ARITHMETIC STAYS ON THE SERVER
///
/// The rollups are read, never recomputed. The same numbers appear in the web
/// app, and recomputing them here from a partial month would produce a second,
/// quietly different figure for the same class. An empty month reads as 100%,
/// which is the server's own default and is why an unmarked month never looks
/// like nobody attended.
///
/// THE ABSENCE LIST IS FETCHED LAZILY, AND ITS REACH IS DERIVED
///
/// `GET .../absences` counts back `limitDays` from TODAY, not from the month
/// on screen, so a month the teacher has scrolled back to needs a longer reach
/// than the route's 30-day default. [_limitDaysFor] computes that reach from
/// the month, and the reply is filtered down to the month it was asked about.
/// It only runs for a student whose card the teacher opened: forty students
/// would otherwise mean forty requests for a panel nobody looked at.
class AttendanceMonthScreen extends ConsumerStatefulWidget {
  const AttendanceMonthScreen({
    super.key,
    required this.classId,
    this.attendanceClass,
  });

  final String classId;

  /// The class handed through `extra`, for the title.
  final AttendanceClass? attendanceClass;

  @override
  ConsumerState<AttendanceMonthScreen> createState() =>
      _AttendanceMonthScreenState();
}

class _AttendanceMonthScreenState extends ConsumerState<AttendanceMonthScreen> {
  late int _year;
  late int _month;

  /// The one student whose absence list is open, if any.
  String? _openStudentId;

  @override
  void initState() {
    super.initState();
    // From the IST window, never the device clock: at 00:30 IST on the 1st,
    // the device's UTC month is still the previous one.
    final today = ref.read(attendanceWindowProvider).today;
    _year = today.year;
    _month = today.month;
  }

  ({String classId, int year, int month}) get _key =>
      (classId: widget.classId, year: _year, month: _month);

  /// Steps the displayed month by [months], carrying across the year.
  ///
  /// Computed in absolute months rather than by adjusting the month and then
  /// patching the year: Dart's `%` is non-negative for a positive divisor, so
  /// the obvious "if it went below 1, add 12 and drop a year" form silently
  /// leaves December sitting in the wrong year when stepping back from
  /// January.
  void _step(int months) {
    setState(() {
      final absolute = _year * 12 + (_month - 1) + months;
      _year = absolute ~/ 12;
      _month = absolute % 12 + 1;
      _openStudentId = null;
    });
  }

  /// How far back the absences route must reach to cover the displayed month.
  ///
  /// From the first day of that month to today, inclusive, floored at 1 (a
  /// future month cannot have absences) and capped at a year so a teacher
  /// paging back through an archive can never ask the server for an unbounded
  /// scan.
  int _limitDaysFor(AttendanceDate today) {
    final firstOfMonth = AttendanceDate(_year, _month, 1);
    final span = today.differenceInDays(firstOfMonth) + 1;
    return span.clamp(1, 366);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final today = ref.watch(attendanceWindowProvider).today;
    final summaries = ref.watch(monthlySummariesProvider(_key));

    // The one attendance signal worth carrying to the Network hub's Updates
    // tab: a run of consecutive absences at or past the Parent Hotline's own
    // threshold. It comes off the rollup THIS SCREEN just read — the arithmetic
    // stays on the server (see the class doc) and nothing extra is fetched.
    ref.listen<AsyncValue<List<StudentAttendanceSummary>>>(
      monthlySummariesProvider(_key),
      (_, next) => _recordAbsenceRuns(next.valueOrNull),
    );

    // There is nothing to show past the current month, and the route would
    // only answer with an empty rollup.
    final canStepForward =
        _year < today.year || (_year == today.year && _month < today.month);

    return ToolScaffold(
      title: widget.attendanceClass?.name ?? l10n.attendanceTitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          EditorialSectionHeader(l10n.attendanceMonthEyebrow),
          const SizedBox(height: AppSpacing.space4),
          _monthStepper(context, l10n, canStepForward),
          const SizedBox(height: AppSpacing.space6),
          summaries.when(
            loading: () => const AppSkeleton(lines: 6),
            error: (error, _) => AppCard(
              child: AttendanceFailureView(
                error: error,
                message: l10n.attendanceMonthError,
                onRetry: () => ref.invalidate(monthlySummariesProvider(_key)),
              ),
            ),
            data: (items) => items.isEmpty
                ? AppCard(
                    child: EmptyView(
                      icon: LucideIcons.calendarDays,
                      title: l10n.attendanceMonthEmptyTitle,
                      message: l10n.attendanceMonthEmptyBody,
                    ),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (final (index, item) in items.indexed) ...[
                        if (index > 0)
                          const SizedBox(height: AppSpacing.space3),
                        _SummaryCard(
                          summary: item,
                          expanded: _openStudentId == item.studentId,
                          onToggle: () => setState(
                            () => _openStudentId =
                                _openStudentId == item.studentId
                                ? null
                                : item.studentId,
                          ),
                          absences: _openStudentId == item.studentId
                              ? _absencesPanel(
                                  context,
                                  l10n,
                                  item.studentId,
                                  today,
                                )
                              : null,
                        ),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  /// Writes one Updates row per student whose consecutive-absence run has
  /// reached [kAbsenceRunThreshold] in the month on screen.
  ///
  /// The row's id carries the class, the month, the student AND the run length,
  /// which is what makes this idempotent without being deaf: re-opening the
  /// same month writes nothing new, while a run that grows from three days to
  /// five is a genuinely new signal and earns its own row.
  ///
  /// Only what the teacher has actually looked at is recorded. That is the
  /// honest limit of a local surface — there is no background sweep of every
  /// class, and there is no server-side attendance notification to subscribe
  /// to. A teacher who never opens a month gets no row for it.
  void _recordAbsenceRuns(List<StudentAttendanceSummary>? items) {
    if (items == null || items.isEmpty) return;
    final store = ref.read(notificationsProvider.notifier);
    final at = ref.read(nowProvider)();
    final className = widget.attendanceClass?.name;
    for (final item in items) {
      if (item.consecutiveAbsences < kAbsenceRunThreshold) continue;
      store.record(
        TeacherNotification(
          id:
              'absence:${widget.classId}:$_year-$_month:${item.studentId}'
              ':${item.consecutiveAbsences}',
          kind: TeacherNotificationKind.absenceRun,
          at: at,
          label: item.studentName,
          className: className,
          classId: widget.classId,
          count: item.consecutiveAbsences,
        ),
      );
    }
  }

  /// Previous / next month, with the month name coming from
  /// [MaterialLocalizations] so no month names are invented in eleven
  /// languages.
  Widget _monthStepper(
    BuildContext context,
    AppLocalizations l10n,
    bool canStepForward,
  ) {
    final label = MaterialLocalizations.of(
      context,
    ).formatMonthYear(DateTime(_year, _month));
    return Row(
      children: [
        IconButton(
          onPressed: () => _step(-1),
          tooltip: l10n.attendanceMonthPrevious,
          icon: const Icon(LucideIcons.chevronLeft),
        ),
        Expanded(
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
        IconButton(
          onPressed: canStepForward ? () => _step(1) : null,
          tooltip: l10n.attendanceMonthNext,
          icon: const Icon(LucideIcons.chevronRight),
        ),
      ],
    );
  }

  Widget _absencesPanel(
    BuildContext context,
    AppLocalizations l10n,
    String studentId,
    AttendanceDate today,
  ) {
    final absences = ref.watch(
      studentAbsencesProvider(
        AbsenceQuery(
          classId: widget.classId,
          studentId: studentId,
          limitDays: _limitDaysFor(today),
        ),
      ),
    );

    return absences.when(
      loading: () => const AppSkeleton(lines: 2),
      error: (_, _) => NoteBanner(
        icon: LucideIcons.alertCircle,
        body: l10n.attendanceAbsencesError,
      ),
      data: (dates) {
        // The route reaches back from today, so trim it to the month the
        // teacher is actually looking at.
        final inMonth = dates
            .where((d) => d.year == _year && d.month == _month)
            .toList(growable: false);
        if (inMonth.isEmpty) {
          return NoteBanner(
            icon: LucideIcons.checkCircle2,
            body: l10n.attendanceAbsencesEmpty,
          );
        }
        final material = MaterialLocalizations.of(context);
        return NoteBanner.custom(
          icon: LucideIcons.calendarX2,
          label: l10n.attendanceAbsencesTitle,
          child: Wrap(
            spacing: AppSpacing.space2,
            runSpacing: AppSpacing.space2,
            children: [
              for (final date in inMonth)
                AppBadge(
                  label: material.formatMediumDate(
                    DateTime(date.year, date.month, date.day),
                  ),
                  size: AppBadgeSize.small,
                ),
            ],
          ),
        );
      },
    );
  }
}

/// One student's month: the rate, the three day counts, and the absence panel
/// when the teacher opens it.
class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.summary,
    required this.expanded,
    required this.onToggle,
    this.absences,
  });

  final StudentAttendanceSummary summary;
  final bool expanded;
  final VoidCallback onToggle;

  /// The absence list, built by the screen only when this card is open.
  final Widget? absences;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return AppCard(
      onTap: onToggle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(summary.studentName, style: text.titleMedium),
                    const SizedBox(height: AppSpacing.space1),
                    Text(
                      l10n.attendanceRollLabel(summary.rollNumber),
                      style: text.bodySmall?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.space3),
              // Rounded server-side; rendered as a bare percentage so no
              // sentence has to be translated to say "attendance rate".
              AppBadge(
                label: '${summary.attendanceRate}%',
                tone: AppBadgeTone.accent,
              ),
              const SizedBox(width: AppSpacing.space2),
              Icon(
                expanded ? LucideIcons.chevronUp : LucideIcons.chevronDown,
                size: AppIconSize.inline,
                color: scheme.onSurfaceVariant,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.space3),
          Wrap(
            spacing: AppSpacing.space2,
            runSpacing: AppSpacing.space2,
            children: [
              AppBadge(
                label: '${l10n.attendanceStatusPresent} ${summary.presentDays}',
                icon: LucideIcons.check,
                size: AppBadgeSize.small,
              ),
              AppBadge(
                label: '${l10n.attendanceStatusAbsent} ${summary.absentDays}',
                icon: LucideIcons.x,
                size: AppBadgeSize.small,
              ),
              AppBadge(
                label: '${l10n.attendanceStatusLate} ${summary.lateDays}',
                icon: LucideIcons.clock,
                size: AppBadgeSize.small,
              ),
            ],
          ),
          if (summary.consecutiveAbsences > 1) ...[
            const SizedBox(height: AppSpacing.space3),
            // Deliberately the Parent Hotline's existing string, not a second
            // one of our own. It is the identical sentence, already translated
            // into eleven languages, and it names the exact signal the
            // `consecutive_absences` outreach reason is raised on — two
            // wordings for one number is how the two screens start disagreeing.
            NoteBanner(
              icon: LucideIcons.calendarX2,
              body: l10n.parentHotlineEvidenceAbsentDays(
                summary.consecutiveAbsences,
              ),
            ),
          ],
          if (expanded && absences != null) ...[
            const SizedBox(height: AppSpacing.space3),
            absences!,
          ],
        ],
      ),
    );
  }
}
