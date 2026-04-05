import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../data/attendance_repository.dart';
import '../../domain/attendance_models.dart';

// ─────────────────── Providers (scoped by classId) ───────────────────

final _classDetailProvider =
    FutureProvider.autoDispose.family<ClassRecord, String>((ref, classId) {
  return ref.read(attendanceRepositoryProvider).getClass(classId);
});

final _studentsProvider =
    FutureProvider.autoDispose.family<List<Student>, String>((ref, classId) {
  return ref.read(attendanceRepositoryProvider).getStudents(classId);
});

final _dailyAttendanceProvider = FutureProvider.autoDispose
    .family<DailyAttendanceRecord?, ({String classId, String date})>(
        (ref, args) {
  return ref
      .read(attendanceRepositoryProvider)
      .getDailyAttendance(classId: args.classId, date: args.date);
});

final _monthlySummaryProvider = FutureProvider.autoDispose
    .family<List<AttendanceSummary>, ({String classId, String month})>(
        (ref, args) {
  return ref
      .read(attendanceRepositoryProvider)
      .getMonthlySummary(classId: args.classId, month: args.month);
});

// ─────────────────── Screen ───────────────────

class ClassDetailScreen extends ConsumerStatefulWidget {
  final String classId;

  const ClassDetailScreen({super.key, required this.classId});

  @override
  ConsumerState<ClassDetailScreen> createState() => _ClassDetailScreenState();
}

class _ClassDetailScreenState extends ConsumerState<ClassDetailScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  // Today tab state
  final Map<String, AttendanceStatus> _attendanceMap = {};
  bool _isSaving = false;
  bool _attendanceLoaded = false;

  // Student add form
  final _studentNameCtrl = TextEditingController();
  final _rollNumberCtrl = TextEditingController();
  final _parentPhoneCtrl = TextEditingController();
  String _parentLanguage = 'hi';

  String get _todayDate => DateFormat('yyyy-MM-dd').format(DateTime.now());

  String get _currentMonth => DateFormat('yyyy-MM').format(DateTime.now());

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _studentNameCtrl.dispose();
    _rollNumberCtrl.dispose();
    _parentPhoneCtrl.dispose();
    super.dispose();
  }

  // ── Helpers ──

  void _initAttendanceFromStudents(List<Student> students,
      DailyAttendanceRecord? existing) {
    if (_attendanceLoaded) return;
    _attendanceLoaded = true;
    for (final s in students) {
      _attendanceMap[s.id] =
          existing?.records[s.id] ?? AttendanceStatus.present;
    }
  }

  void _setStatus(String studentId, AttendanceStatus status) {
    setState(() => _attendanceMap[studentId] = status);
  }

  void _markAllPresent(List<Student> students) {
    setState(() {
      for (final s in students) {
        _attendanceMap[s.id] = AttendanceStatus.present;
      }
    });
  }

  Future<void> _saveAttendance() async {
    setState(() => _isSaving = true);
    try {
      final repo = ref.read(attendanceRepositoryProvider);
      await repo.saveDailyAttendance(DailyAttendanceRecord(
        classId: widget.classId,
        date: _todayDate,
        teacherUid: '', // Server fills from auth token
        records: Map.of(_attendanceMap),
        submittedAt: DateTime.now(),
      ));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Attendance saved successfully')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Save failed: $e'),
            backgroundColor: GlassColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _addStudent() async {
    final name = _studentNameCtrl.text.trim();
    final rollStr = _rollNumberCtrl.text.trim();
    final phone = _parentPhoneCtrl.text.trim();

    if (name.isEmpty || rollStr.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Name and roll number are required')),
      );
      return;
    }

    final roll = int.tryParse(rollStr);
    if (roll == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Roll number must be a number')),
      );
      return;
    }

    try {
      final repo = ref.read(attendanceRepositoryProvider);
      await repo.addStudent(
        classId: widget.classId,
        name: name,
        rollNumber: roll,
        parentPhone: phone.isNotEmpty ? '+91$phone' : '',
        parentLanguage: _parentLanguage,
      );
      _studentNameCtrl.clear();
      _rollNumberCtrl.clear();
      _parentPhoneCtrl.clear();
      ref.invalidate(_studentsProvider(widget.classId));
      ref.invalidate(_classDetailProvider(widget.classId));
      if (mounted) Navigator.of(context).pop(); // close bottom sheet
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to add student: $e'),
            backgroundColor: GlassColors.error,
          ),
        );
      }
    }
  }

  Future<void> _deleteStudent(Student student) async {
    try {
      final repo = ref.read(attendanceRepositoryProvider);
      await repo.deleteStudent(
          classId: widget.classId, studentId: student.id);
      ref.invalidate(_studentsProvider(widget.classId));
      ref.invalidate(_classDetailProvider(widget.classId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${student.name} removed')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Delete failed: $e'),
            backgroundColor: GlassColors.error,
          ),
        );
      }
    }
  }

  void _showAddStudentSheet() {
    _studentNameCtrl.clear();
    _rollNumberCtrl.clear();
    _parentPhoneCtrl.clear();
    _parentLanguage = 'hi';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: GlassColors.cardBackground,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(GlassRadius.xl)),
      ),
      builder: (ctx) => _AddStudentSheet(
        nameController: _studentNameCtrl,
        rollNumberController: _rollNumberCtrl,
        parentPhoneController: _parentPhoneCtrl,
        parentLanguage: _parentLanguage,
        onLanguageChanged: (lang) =>
            setState(() => _parentLanguage = lang ?? 'hi'),
        onAdd: _addStudent,
      ),
    );
  }

  // ── Build ──

  @override
  Widget build(BuildContext context) {
    final classAsync = ref.watch(_classDetailProvider(widget.classId));
    final className =
        classAsync.whenOrNull(data: (c) => c.name) ?? 'Class Details';

    return GlassScaffold(
      title: className,
      showBackButton: true,
      customAppBar: PreferredSize(
        preferredSize: const Size.fromHeight(kToolbarHeight + 48),
        child: Container(
          decoration: const BoxDecoration(
            gradient: GlassColors.warmBackgroundGradient,
          ),
          child: SafeArea(
            bottom: false,
            child: Column(
              children: [
                // Title row
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: GlassSpacing.lg,
                    vertical: GlassSpacing.sm,
                  ),
                  child: Row(
                    children: [
                      GlassBackButton(
                          onPressed: () => Navigator.of(context).pop()),
                      const SizedBox(width: GlassSpacing.md),
                      Expanded(
                        child: Text(
                          className,
                          style: GlassTypography.headline2(),
                          textAlign: TextAlign.center,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 40), // balance back button
                    ],
                  ),
                ),
                // Tabs
                TabBar(
                  controller: _tabController,
                  labelColor: GlassColors.primary,
                  unselectedLabelColor: GlassColors.textTertiary,
                  indicatorColor: GlassColors.primary,
                  indicatorWeight: 3,
                  labelStyle: GlassTypography.labelLarge(),
                  unselectedLabelStyle: GlassTypography.labelMedium(),
                  tabs: const [
                    Tab(text: 'Today'),
                    Tab(text: 'Students'),
                    Tab(text: 'Reports'),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _TodayTab(
            classId: widget.classId,
            todayDate: _todayDate,
            attendanceMap: _attendanceMap,
            isSaving: _isSaving,
            onStatusChanged: _setStatus,
            onMarkAllPresent: _markAllPresent,
            onSave: _saveAttendance,
            onInitAttendance: _initAttendanceFromStudents,
          ),
          _StudentsTab(
            classId: widget.classId,
            onAddPressed: _showAddStudentSheet,
            onDelete: _deleteStudent,
          ),
          _ReportsTab(
            classId: widget.classId,
            month: _currentMonth,
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// TODAY TAB
// ═══════════════════════════════════════════════════════════════

class _TodayTab extends ConsumerWidget {
  final String classId;
  final String todayDate;
  final Map<String, AttendanceStatus> attendanceMap;
  final bool isSaving;
  final void Function(String, AttendanceStatus) onStatusChanged;
  final void Function(List<Student>) onMarkAllPresent;
  final VoidCallback onSave;
  final void Function(List<Student>, DailyAttendanceRecord?) onInitAttendance;

  const _TodayTab({
    required this.classId,
    required this.todayDate,
    required this.attendanceMap,
    required this.isSaving,
    required this.onStatusChanged,
    required this.onMarkAllPresent,
    required this.onSave,
    required this.onInitAttendance,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studentsAsync = ref.watch(_studentsProvider(classId));
    final attendanceAsync = ref.watch(
        _dailyAttendanceProvider((classId: classId, date: todayDate)));

    return studentsAsync.when(
      loading: () =>
          const GlassLoadingIndicator(message: 'Loading students...'),
      error: (err, _) => GlassEmptyState(
        icon: Icons.error_outline,
        title: 'Error',
        message: err.toString(),
      ),
      data: (students) {
        if (students.isEmpty) {
          return const GlassEmptyState(
            icon: Icons.person_add_outlined,
            title: 'No Students',
            message:
                'Add students in the Students tab first, then come back to take attendance.',
          );
        }

        // Initialise attendance map once we have both students and existing
        // attendance data.
        final existing = attendanceAsync.valueOrNull;
        onInitAttendance(students, existing);

        final sortedStudents = List<Student>.from(students)
          ..sort((a, b) => a.rollNumber.compareTo(b.rollNumber));

        // Counts
        int presentCount = 0;
        int absentCount = 0;
        int lateCount = 0;
        for (final s in sortedStudents) {
          switch (attendanceMap[s.id] ?? AttendanceStatus.present) {
            case AttendanceStatus.present:
              presentCount++;
            case AttendanceStatus.absent:
              absentCount++;
            case AttendanceStatus.late_:
              lateCount++;
          }
        }

        return Column(
          children: [
            // Date + All Present
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  GlassSpacing.xl, GlassSpacing.lg, GlassSpacing.xl, 0),
              child: Row(
                children: [
                  Icon(Icons.calendar_today_rounded,
                      size: 18, color: GlassColors.textSecondary),
                  const SizedBox(width: GlassSpacing.sm),
                  Text(
                    DateFormat('EEEE, d MMMM yyyy').format(DateTime.now()),
                    style: GlassTypography.labelLarge(
                        color: GlassColors.textSecondary),
                  ),
                  const Spacer(),
                  GlassSecondaryButton(
                    label: 'All Present',
                    icon: Icons.done_all_rounded,
                    isExpanded: false,
                    height: 36,
                    onPressed: () => onMarkAllPresent(sortedStudents),
                  ),
                ],
              ),
            ),
            const SizedBox(height: GlassSpacing.md),
            // Summary bar
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: GlassSpacing.xl),
              child: GlassCard(
                padding: const EdgeInsets.symmetric(
                    vertical: GlassSpacing.md, horizontal: GlassSpacing.lg),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _SummaryChip(
                      label: 'Present',
                      count: presentCount,
                      color: GlassColors.success,
                    ),
                    _SummaryChip(
                      label: 'Absent',
                      count: absentCount,
                      color: GlassColors.error,
                    ),
                    _SummaryChip(
                      label: 'Late',
                      count: lateCount,
                      color: GlassColors.warning,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: GlassSpacing.md),
            // Student attendance list
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(
                    GlassSpacing.xl, 0, GlassSpacing.xl, GlassSpacing.lg),
                itemCount: sortedStudents.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(height: GlassSpacing.sm),
                itemBuilder: (_, index) {
                  final student = sortedStudents[index];
                  final status =
                      attendanceMap[student.id] ?? AttendanceStatus.present;
                  return _AttendanceRow(
                    student: student,
                    status: status,
                    onStatusChanged: (s) => onStatusChanged(student.id, s),
                  );
                },
              ),
            ),
            // Save button
            Padding(
              padding: const EdgeInsets.fromLTRB(GlassSpacing.xl,
                  GlassSpacing.sm, GlassSpacing.xl, GlassSpacing.xl),
              child: SafeArea(
                top: false,
                child: GlassPrimaryButton(
                  label: 'Save Attendance',
                  icon: Icons.check_circle_outline_rounded,
                  isLoading: isSaving,
                  onPressed: isSaving ? null : onSave,
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _SummaryChip extends StatelessWidget {
  final String label;
  final int count;
  final Color color;

  const _SummaryChip({
    required this.label,
    required this.count,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '$count',
          style: GlassTypography.headline2(color: color),
        ),
        const SizedBox(height: 2),
        Text(label, style: GlassTypography.labelSmall()),
      ],
    );
  }
}

class _AttendanceRow extends StatelessWidget {
  final Student student;
  final AttendanceStatus status;
  final ValueChanged<AttendanceStatus> onStatusChanged;

  const _AttendanceRow({
    required this.student,
    required this.status,
    required this.onStatusChanged,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.symmetric(
          horizontal: GlassSpacing.lg, vertical: GlassSpacing.md),
      child: Row(
        children: [
          // Roll number badge
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: GlassColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(GlassRadius.xs),
            ),
            alignment: Alignment.center,
            child: Text(
              '${student.rollNumber}',
              style: GlassTypography.labelMedium(color: GlassColors.primary),
            ),
          ),
          const SizedBox(width: GlassSpacing.md),
          Expanded(
            child: Text(student.name, style: GlassTypography.labelLarge()),
          ),
          // Toggle buttons
          _StatusToggle(
            status: AttendanceStatus.present,
            isSelected: status == AttendanceStatus.present,
            label: 'P',
            color: GlassColors.success,
            onTap: () => onStatusChanged(AttendanceStatus.present),
          ),
          const SizedBox(width: GlassSpacing.xs),
          _StatusToggle(
            status: AttendanceStatus.absent,
            isSelected: status == AttendanceStatus.absent,
            label: 'A',
            color: GlassColors.error,
            onTap: () => onStatusChanged(AttendanceStatus.absent),
          ),
          const SizedBox(width: GlassSpacing.xs),
          _StatusToggle(
            status: AttendanceStatus.late_,
            isSelected: status == AttendanceStatus.late_,
            label: 'L',
            color: GlassColors.warning,
            onTap: () => onStatusChanged(AttendanceStatus.late_),
          ),
        ],
      ),
    );
  }
}

class _StatusToggle extends StatelessWidget {
  final AttendanceStatus status;
  final bool isSelected;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _StatusToggle({
    required this.status,
    required this.isSelected,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: isSelected ? color : color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(GlassRadius.xs),
          border: Border.all(
            color: isSelected ? color : color.withOpacity(0.3),
            width: 1.5,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: GlassTypography.labelLarge(
            color: isSelected ? Colors.white : color,
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// STUDENTS TAB
// ═══════════════════════════════════════════════════════════════

class _StudentsTab extends ConsumerWidget {
  final String classId;
  final VoidCallback onAddPressed;
  final Future<void> Function(Student) onDelete;

  const _StudentsTab({
    required this.classId,
    required this.onAddPressed,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studentsAsync = ref.watch(_studentsProvider(classId));

    return studentsAsync.when(
      loading: () =>
          const GlassLoadingIndicator(message: 'Loading students...'),
      error: (err, _) => GlassEmptyState(
        icon: Icons.error_outline,
        title: 'Error',
        message: err.toString(),
      ),
      data: (students) {
        return Stack(
          children: [
            if (students.isEmpty)
              GlassEmptyState(
                icon: Icons.person_add_outlined,
                title: 'No Students Yet',
                message: 'Add students to this class to get started.',
                action: GlassPrimaryButton(
                  label: 'Add Student',
                  icon: Icons.add,
                  isExpanded: false,
                  onPressed: onAddPressed,
                ),
              )
            else
              ListView.separated(
                padding: const EdgeInsets.fromLTRB(
                  GlassSpacing.xl,
                  GlassSpacing.lg,
                  GlassSpacing.xl,
                  100, // space for FAB
                ),
                itemCount: students.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(height: GlassSpacing.sm),
                itemBuilder: (_, index) {
                  final student = students[index];
                  return Dismissible(
                    key: ValueKey(student.id),
                    direction: DismissDirection.endToStart,
                    background: Container(
                      alignment: Alignment.centerRight,
                      padding:
                          const EdgeInsets.only(right: GlassSpacing.xl),
                      decoration: BoxDecoration(
                        color: GlassColors.error.withOpacity(0.15),
                        borderRadius:
                            BorderRadius.circular(GlassRadius.lg),
                      ),
                      child: const Icon(Icons.delete_outline_rounded,
                          color: GlassColors.error),
                    ),
                    confirmDismiss: (_) async {
                      final confirmed = await showDialog<bool>(
                        context: context,
                        builder: (ctx) => AlertDialog(
                          backgroundColor: GlassColors.cardBackground,
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(GlassRadius.lg),
                          ),
                          title: Text('Remove Student',
                              style: GlassTypography.headline3()),
                          content: Text(
                            'Remove ${student.name} from this class?',
                            style: GlassTypography.bodyMedium(),
                          ),
                          actions: [
                            TextButton(
                              onPressed: () =>
                                  Navigator.of(ctx).pop(false),
                              child: Text('Cancel',
                                  style: GlassTypography.labelLarge(
                                      color:
                                          GlassColors.textSecondary)),
                            ),
                            TextButton(
                              onPressed: () =>
                                  Navigator.of(ctx).pop(true),
                              child: Text('Remove',
                                  style: GlassTypography.labelLarge(
                                      color: GlassColors.error)),
                            ),
                          ],
                        ),
                      );
                      if (confirmed == true) {
                        await onDelete(student);
                      }
                      return false; // We handle deletion ourselves
                    },
                    child: GlassCard(
                      padding: const EdgeInsets.all(GlassSpacing.lg),
                      child: Row(
                        children: [
                          // Roll number
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color:
                                  GlassColors.primary.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(
                                  GlassRadius.xs),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              '${student.rollNumber}',
                              style: GlassTypography.labelLarge(
                                  color: GlassColors.primary),
                            ),
                          ),
                          const SizedBox(width: GlassSpacing.lg),
                          Expanded(
                            child: Column(
                              crossAxisAlignment:
                                  CrossAxisAlignment.start,
                              children: [
                                Text(student.name,
                                    style:
                                        GlassTypography.labelLarge()),
                                if (student.parentPhone.isNotEmpty) ...[
                                  const SizedBox(height: 2),
                                  Row(
                                    children: [
                                      const Icon(
                                          Icons.phone_outlined,
                                          size: 12,
                                          color: GlassColors
                                              .textTertiary),
                                      const SizedBox(width: 4),
                                      Text(
                                        student.parentPhone,
                                        style:
                                            GlassTypography.bodySmall(),
                                      ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),
                          // Language badge
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: GlassSpacing.sm,
                              vertical: GlassSpacing.xs,
                            ),
                            decoration: BoxDecoration(
                              color: GlassColors.chipUnselected,
                              borderRadius: BorderRadius.circular(
                                  GlassRadius.pill),
                            ),
                            child: Text(
                              student.parentLanguage.toUpperCase(),
                              style: GlassTypography.labelSmall(),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            // FAB
            if (students.isNotEmpty)
              Positioned(
                right: GlassSpacing.xl,
                bottom: GlassSpacing.xl,
                child: FloatingActionButton.extended(
                  onPressed: onAddPressed,
                  backgroundColor: GlassColors.primary,
                  icon: const Icon(Icons.add, color: Colors.white),
                  label: Text('Add Student',
                      style: GlassTypography.buttonMedium()),
                ),
              ),
          ],
        );
      },
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// REPORTS TAB
// ═══════════════════════════════════════════════════════════════

class _ReportsTab extends ConsumerWidget {
  final String classId;
  final String month;

  const _ReportsTab({
    required this.classId,
    required this.month,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summaryAsync = ref.watch(
        _monthlySummaryProvider((classId: classId, month: month)));
    final studentsAsync = ref.watch(_studentsProvider(classId));

    return summaryAsync.when(
      loading: () =>
          const GlassLoadingIndicator(message: 'Loading reports...'),
      error: (err, _) => GlassEmptyState(
        icon: Icons.error_outline,
        title: 'Error',
        message: err.toString(),
      ),
      data: (summaries) {
        final students = studentsAsync.valueOrNull ?? [];

        if (summaries.isEmpty && students.isEmpty) {
          return const GlassEmptyState(
            icon: Icons.bar_chart_outlined,
            title: 'No Data Yet',
            message: 'Start taking attendance to see monthly reports here.',
          );
        }

        // Build a student name lookup
        final studentNameMap = <String, String>{};
        final studentRollMap = <String, int>{};
        for (final s in students) {
          studentNameMap[s.id] = s.name;
          studentRollMap[s.id] = s.rollNumber;
        }

        // Sort summaries by roll number
        final sorted = List<AttendanceSummary>.from(summaries)
          ..sort((a, b) => (studentRollMap[a.studentId] ?? 0)
              .compareTo(studentRollMap[b.studentId] ?? 0));

        return SingleChildScrollView(
          padding: const EdgeInsets.all(GlassSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Monthly Report - ${_formatMonth(month)}',
                style: GlassTypography.headline3(),
              ),
              const SizedBox(height: GlassSpacing.lg),
              GlassCard(
                padding: EdgeInsets.zero,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(GlassRadius.lg),
                  child: Table(
                    columnWidths: const {
                      0: FixedColumnWidth(44),
                      1: FlexColumnWidth(),
                      2: FixedColumnWidth(50),
                      3: FixedColumnWidth(50),
                      4: FixedColumnWidth(50),
                      5: FixedColumnWidth(64),
                    },
                    border: TableBorder(
                      horizontalInside: BorderSide(
                        color: GlassColors.divider.withOpacity(0.5),
                        width: 0.5,
                      ),
                    ),
                    children: [
                      // Header
                      TableRow(
                        decoration: BoxDecoration(
                          color: GlassColors.primary.withOpacity(0.08),
                        ),
                        children: [
                          _headerCell('Roll'),
                          _headerCell('Name'),
                          _headerCell('P'),
                          _headerCell('A'),
                          _headerCell('L'),
                          _headerCell('%'),
                        ],
                      ),
                      // Rows
                      ...sorted.map((summary) {
                        final pct = summary.attendancePercentage;
                        final pctColor = pct >= 90
                            ? GlassColors.success
                            : pct >= 75
                                ? GlassColors.warning
                                : GlassColors.error;

                        return TableRow(
                          children: [
                            _dataCell(
                                '${studentRollMap[summary.studentId] ?? '-'}'),
                            _dataCell(
                                studentNameMap[summary.studentId] ?? '—',
                                align: TextAlign.left),
                            _dataCell('${summary.present}'),
                            _dataCell('${summary.absent}'),
                            _dataCell('${summary.late_}'),
                            _dataCell(
                              '${pct.toStringAsFixed(0)}%',
                              color: pctColor,
                              bold: true,
                            ),
                          ],
                        );
                      }),
                    ],
                  ),
                ),
              ),
              if (sorted.isEmpty) ...[
                const SizedBox(height: GlassSpacing.xxl),
                const GlassEmptyState(
                  icon: Icons.bar_chart_outlined,
                  title: 'No Attendance Data',
                  message:
                      'Take attendance for students to generate reports.',
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  String _formatMonth(String yyyyMm) {
    try {
      final parts = yyyyMm.split('-');
      final dt = DateTime(int.parse(parts[0]), int.parse(parts[1]));
      return DateFormat('MMMM yyyy').format(dt);
    } catch (_) {
      return yyyyMm;
    }
  }

  Widget _headerCell(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(
          vertical: GlassSpacing.md, horizontal: GlassSpacing.sm),
      child: Text(
        text,
        style: GlassTypography.labelMedium(color: GlassColors.primary),
        textAlign: TextAlign.center,
      ),
    );
  }

  Widget _dataCell(String text,
      {TextAlign align = TextAlign.center,
      Color? color,
      bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(
          vertical: GlassSpacing.md, horizontal: GlassSpacing.sm),
      child: Text(
        text,
        style: bold
            ? GlassTypography.labelLarge(color: color)
            : GlassTypography.bodySmall(color: color),
        textAlign: align,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

// ─────────────────── Add Student Bottom Sheet ───────────────────

class _AddStudentSheet extends StatelessWidget {
  final TextEditingController nameController;
  final TextEditingController rollNumberController;
  final TextEditingController parentPhoneController;
  final String parentLanguage;
  final ValueChanged<String?> onLanguageChanged;
  final VoidCallback onAdd;

  const _AddStudentSheet({
    required this.nameController,
    required this.rollNumberController,
    required this.parentPhoneController,
    required this.parentLanguage,
    required this.onLanguageChanged,
    required this.onAdd,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        GlassSpacing.xl,
        GlassSpacing.xl,
        GlassSpacing.xl,
        MediaQuery.of(context).viewInsets.bottom + GlassSpacing.xl,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Drag handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: GlassColors.textTertiary.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: GlassSpacing.xl),
            Text('Add Student', style: GlassTypography.headline2()),
            const SizedBox(height: GlassSpacing.xxl),
            GlassTextField(
              controller: nameController,
              labelText: 'Student Name',
              hintText: 'e.g. Priya Sharma',
            ),
            const SizedBox(height: GlassSpacing.lg),
            Row(
              children: [
                Expanded(
                  child: GlassTextField(
                    controller: rollNumberController,
                    labelText: 'Roll Number',
                    hintText: 'e.g. 1',
                    keyboardType: TextInputType.number,
                  ),
                ),
                const SizedBox(width: GlassSpacing.lg),
                Expanded(
                  child: GlassDropdown<String>(
                    labelText: 'Parent Language',
                    value: parentLanguage,
                    onChanged: onLanguageChanged,
                    items: const [
                      DropdownMenuItem(value: 'hi', child: Text('Hindi')),
                      DropdownMenuItem(value: 'en', child: Text('English')),
                      DropdownMenuItem(value: 'ta', child: Text('Tamil')),
                      DropdownMenuItem(value: 'te', child: Text('Telugu')),
                      DropdownMenuItem(value: 'kn', child: Text('Kannada')),
                      DropdownMenuItem(value: 'mr', child: Text('Marathi')),
                      DropdownMenuItem(value: 'bn', child: Text('Bengali')),
                      DropdownMenuItem(value: 'gu', child: Text('Gujarati')),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: GlassSpacing.lg),
            GlassTextField(
              controller: parentPhoneController,
              labelText: 'Parent Phone (+91)',
              hintText: '9876543210',
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: GlassSpacing.xxl),
            GlassPrimaryButton(
              label: 'Add Student',
              icon: Icons.person_add_rounded,
              onPressed: onAdd,
            ),
            const SizedBox(height: GlassSpacing.md),
          ],
        ),
      ),
    );
  }
}
