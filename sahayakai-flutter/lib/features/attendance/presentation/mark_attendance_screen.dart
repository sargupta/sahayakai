import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_segmented.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/inline_error.dart';
import '../../../shared/widgets/note_banner.dart';
import '../../../shared/widgets/secondary_button.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../data/attendance_repository.dart';
import '../domain/attendance_class.dart';
import '../domain/attendance_date.dart';
import '../domain/attendance_record.dart';
import '../domain/attendance_write_result.dart';
import 'attendance_failure.dart';
import 'attendance_providers.dart';
import 'widgets/attendance_failure_view.dart';
import 'widgets/attendance_premium_card.dart';

/// The daily register: one day, one class, one mark per student.
///
/// THE DATE PICKER IS CLAMPED, NOT VALIDATED
///
/// `saveAttendance` refuses anything outside `[today - 7, today]` computed in
/// **IST** (forensic fix F9-004, because Cloud Run runs in UTC and between
/// 18:30Z and 24:00Z the server's own "today" is a day behind the teacher's
/// calendar). The picker here is built from `AttendanceWindow.markableDates`,
/// the same eight days the repository's pre-flight guard reads, so a day the
/// teacher can tap is a day the server accepts. Offering a full calendar and
/// then explaining a 400 would be the same information delivered after a round
/// trip on a rural connection, and after the teacher had already decided.
///
/// WHERE THE STUDENT LIST COMES FROM
///
/// From the monthly summaries, not the roster. The roster route cannot be read
/// yet (the masked projection is unmerged), but a summary carries exactly the
/// `studentId` / `studentName` / `rollNumber` a register row needs and carries
/// no contact detail at all. The server includes every student in the class,
/// marked or not, so the register is complete. See `monthlySummariesProvider`.
///
/// UNMARKED IS A STATE, NOT A DEFAULT
///
/// The register is sparse until the teacher finishes it, and the stored
/// document only holds the students who were marked. So the status picker has
/// four options, the fourth being "Not marked", and a student the teacher has
/// not touched is not silently sent as present. Only non-null marks are
/// posted.
class MarkAttendanceScreen extends ConsumerStatefulWidget {
  const MarkAttendanceScreen({
    super.key,
    required this.classId,
    this.attendanceClass,
  });

  final String classId;

  /// The class handed through `extra`, for the title.
  final AttendanceClass? attendanceClass;

  @override
  ConsumerState<MarkAttendanceScreen> createState() =>
      _MarkAttendanceScreenState();
}

class _MarkAttendanceScreenState extends ConsumerState<MarkAttendanceScreen> {
  late AttendanceDate _date;

  /// The teacher's UNSAVED changes, per day.
  ///
  /// Deliberately an overlay rather than a copy of the loaded register. A copy
  /// would have to be seeded when the read lands, which means a `setState`
  /// driven by an async value arriving mid-build, and a race between the seed
  /// and the first tap. An overlay has neither: what a row shows is the edit
  /// if there is one, and the saved mark otherwise. A `null` VALUE is a real
  /// entry meaning "the teacher cleared this", which is why the lookup tests
  /// `containsKey` rather than nullability.
  final Map<AttendanceDate, Map<String, AttendanceStatus?>> _edits = {};

  bool _isBusy = false;
  bool _blockedByPlan = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _date = ref.read(attendanceWindowProvider).today;
  }

  ({String classId, AttendanceDate date}) _registerKey(AttendanceDate date) =>
      (classId: widget.classId, date: date);

  ({String classId, int year, int month}) _monthKey(AttendanceDate date) =>
      (classId: widget.classId, year: date.year, month: date.month);

  AttendanceStatus? _statusFor(String studentId, DailyAttendance? record) {
    final edits = _edits[_date];
    if (edits != null && edits.containsKey(studentId)) return edits[studentId];
    return record?.statusFor(studentId);
  }

  void _setStatus(String studentId, AttendanceStatus? status) {
    setState(
      () =>
          (_edits[_date] ??= <String, AttendanceStatus?>{})[studentId] = status,
    );
  }

  void _markAllPresent(List<StudentAttendanceSummary> students) {
    setState(() {
      final edits = _edits[_date] ??= <String, AttendanceStatus?>{};
      for (final student in students) {
        edits[student.studentId] = AttendanceStatus.present;
      }
    });
  }

  Future<void> _save(
    List<StudentAttendanceSummary> students,
    DailyAttendance? record,
  ) async {
    final l10n = context.l10n;
    final statuses = <String, AttendanceStatus>{};
    for (final student in students) {
      final status = _statusFor(student.studentId, record);
      if (status != null) statuses[student.studentId] = status;
    }

    setState(() {
      _isBusy = true;
      _errorMessage = null;
    });
    try {
      final result = await ref
          .read(attendanceRepositoryProvider)
          .saveAttendance(widget.classId, date: _date, statuses: statuses);
      if (!mounted) return;

      switch (result) {
        case AttendanceWriteAccepted<AttendanceDate>():
          setState(() => _edits.remove(_date));
          ref
            ..invalidate(dailyRegisterProvider(_registerKey(_date)))
            // The month's rollups are derived from the day just written.
            ..invalidate(monthlySummariesProvider(_monthKey(_date)));
          ScaffoldMessenger.of(context)
            ..clearSnackBars()
            ..showSnackBar(
              SnackBar(content: Text(l10n.attendanceRegisterSaved)),
            );
        case AttendanceWriteBlockedByPlan<AttendanceDate>():
          setState(() => _blockedByPlan = true);
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _errorMessage = attendanceFailureMessage(
          l10n,
          error,
          fallback: l10n.attendanceSaveRegisterFailed,
        );
      });
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final window = ref.watch(attendanceWindowProvider);
    // The window moves at IST midnight. If the app was left open across it,
    // the held date can fall outside; snap to today rather than offering a day
    // the guard would now refuse.
    if (!window.contains(_date)) _date = window.today;

    final title = widget.attendanceClass?.name ?? l10n.attendanceTitle;
    if (_blockedByPlan) {
      return ToolScaffold(title: title, child: const AttendancePremiumCard());
    }

    final students = ref.watch(monthlySummariesProvider(_monthKey(_date)));
    final register = ref.watch(dailyRegisterProvider(_registerKey(_date)));

    return ToolScaffold(
      title: title,
      onSubmit: _canSubmit(students, register)
          ? () => unawaited(_save(students.requireValue, register.requireValue))
          : null,
      submitLabel: l10n.attendanceSaveRegister,
      isBusy: _isBusy,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          EditorialSectionHeader(l10n.attendanceMarkEyebrow),
          const SizedBox(height: AppSpacing.space4),
          Text(
            l10n.attendanceMarkIntro,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: AppSpacing.space4),
          _datePicker(context, l10n, window),
          const SizedBox(height: AppSpacing.space3),
          NoteBanner(
            icon: LucideIcons.calendarClock,
            body: l10n.attendanceWindowNote,
          ),
          const SizedBox(height: AppSpacing.space6),
          _body(context, l10n, students, register),
          if (_errorMessage != null) ...[
            const SizedBox(height: AppSpacing.space4),
            InlineError(
              title: l10n.attendanceSaveRegisterFailed,
              message: _errorMessage!,
            ),
          ],
        ],
      ),
    );
  }

  /// Saving needs both reads to have landed: the student list decides who is
  /// posted, and the saved register decides what an untouched row already
  /// says. Posting without the second would overwrite marks the teacher never
  /// saw.
  bool _canSubmit(
    AsyncValue<List<StudentAttendanceSummary>> students,
    AsyncValue<DailyAttendance?> register,
  ) {
    return !_isBusy &&
        students.hasValue &&
        students.requireValue.isNotEmpty &&
        register.hasValue;
  }

  /// The clamped picker: exactly the eight days `AttendanceWindow` allows,
  /// newest first. [AppSegmented] falls back to a wrapping chip row past three
  /// options, which is what eight dates want anyway.
  Widget _datePicker(
    BuildContext context,
    AppLocalizations l10n,
    AttendanceWindow window,
  ) {
    return AppSegmented<AttendanceDate>(
      segments: [
        for (final date in window.markableDates)
          AppSegment<AttendanceDate>(
            value: date,
            label: _dateLabel(context, l10n, date, window),
          ),
      ],
      value: _date,
      onChanged: (date) => setState(() => _date = date),
    );
  }

  /// "Today" / "Yesterday" for the two days a teacher actually names, and the
  /// platform's own medium date for the rest — localized by
  /// [MaterialLocalizations], so no month names are invented in eleven
  /// languages.
  String _dateLabel(
    BuildContext context,
    AppLocalizations l10n,
    AttendanceDate date,
    AttendanceWindow window,
  ) {
    if (date == window.today) return l10n.attendanceDateToday;
    if (date == window.today.addDays(-1)) return l10n.attendanceDateYesterday;
    return MaterialLocalizations.of(
      context,
    ).formatMediumDate(DateTime(date.year, date.month, date.day));
  }

  Widget _body(
    BuildContext context,
    AppLocalizations l10n,
    AsyncValue<List<StudentAttendanceSummary>> students,
    AsyncValue<DailyAttendance?> register,
  ) {
    if (students.hasError) {
      return AppCard(
        child: AttendanceFailureView(
          error: students.error!,
          message: l10n.attendanceMonthError,
          onRetry: () =>
              ref.invalidate(monthlySummariesProvider(_monthKey(_date))),
        ),
      );
    }
    if (register.hasError) {
      return AppCard(
        child: AttendanceFailureView(
          error: register.error!,
          message: l10n.attendanceRegisterError,
          onRetry: () =>
              ref.invalidate(dailyRegisterProvider(_registerKey(_date))),
        ),
      );
    }
    if (!students.hasValue || !register.hasValue) {
      return const AppSkeleton(lines: 6);
    }

    final roll = students.requireValue;
    if (roll.isEmpty) {
      return AppCard(
        child: EmptyView(
          icon: LucideIcons.userPlus,
          title: l10n.attendanceNoStudentsTitle,
          message: l10n.attendanceNoStudentsBody,
        ),
      );
    }

    final record = register.requireValue;
    final marked = roll
        .where((s) => _statusFor(s.studentId, record) != null)
        .length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          l10n.attendanceMarkProgress(marked, roll.length),
          style: Theme.of(context).textTheme.titleSmall,
        ),
        const SizedBox(height: AppSpacing.space3),
        SecondaryButton(
          label: l10n.attendanceMarkAllPresent,
          icon: LucideIcons.checkCheck,
          onPressed: _isBusy ? null : () => _markAllPresent(roll),
        ),
        const SizedBox(height: AppSpacing.space4),
        for (final (index, student) in roll.indexed) ...[
          if (index > 0) const SizedBox(height: AppSpacing.space3),
          _RegisterRow(
            student: student,
            status: _statusFor(student.studentId, record),
            onChanged: (status) => _setStatus(student.studentId, status),
          ),
        ],
      ],
    );
  }
}

/// One student's row in the register.
///
/// The picker carries FOUR options, and the fourth ("Not marked") is not
/// padding: [AppSegmented] aligns its thumb to the selected segment, and a
/// value that matched none of them would park the thumb on the first — which
/// would read as "Present" for a student nobody has touched. A register that
/// invents a present day is exactly the failure `AttendanceStatus.fromWire`
/// refuses to make on the decode side.
class _RegisterRow extends StatelessWidget {
  const _RegisterRow({
    required this.student,
    required this.status,
    required this.onChanged,
  });

  final StudentAttendanceSummary student;
  final AttendanceStatus? status;
  final ValueChanged<AttendanceStatus?> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(student.studentName, style: text.titleMedium),
          const SizedBox(height: AppSpacing.space1),
          Text(
            l10n.attendanceRollLabel(student.rollNumber),
            style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
          ),
          const SizedBox(height: AppSpacing.space3),
          AppSegmented<AttendanceStatus?>(
            segments: [
              AppSegment<AttendanceStatus?>(
                value: AttendanceStatus.present,
                label: l10n.attendanceStatusPresent,
              ),
              AppSegment<AttendanceStatus?>(
                value: AttendanceStatus.absent,
                label: l10n.attendanceStatusAbsent,
              ),
              AppSegment<AttendanceStatus?>(
                value: AttendanceStatus.late,
                label: l10n.attendanceStatusLate,
              ),
              AppSegment<AttendanceStatus?>(
                value: null,
                label: l10n.attendanceStatusUnmarked,
              ),
            ],
            value: status,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}
