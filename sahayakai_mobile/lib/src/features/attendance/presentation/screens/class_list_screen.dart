import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../data/attendance_repository.dart';
import '../../domain/attendance_models.dart';
import 'class_detail_screen.dart';

// ─────────────────── Providers ───────────────────

final _classListProvider =
    FutureProvider.autoDispose<List<ClassRecord>>((ref) async {
  final repo = ref.read(attendanceRepositoryProvider);
  return repo.getClasses();
});

// ─────────────────── Screen ───────────────────

class ClassListScreen extends ConsumerStatefulWidget {
  const ClassListScreen({super.key});

  @override
  ConsumerState<ClassListScreen> createState() => _ClassListScreenState();
}

class _ClassListScreenState extends ConsumerState<ClassListScreen> {
  // ── Create class form controllers ──
  final _nameController = TextEditingController();
  final _subjectController = TextEditingController();
  final _gradeLevelController = TextEditingController();
  final _sectionController = TextEditingController();

  bool _isCreating = false;

  @override
  void dispose() {
    _nameController.dispose();
    _subjectController.dispose();
    _gradeLevelController.dispose();
    _sectionController.dispose();
    super.dispose();
  }

  // ── Actions ──

  Future<void> _refresh() async {
    ref.invalidate(_classListProvider);
    // Wait for the provider to rebuild so the RefreshIndicator closes.
    await ref.read(_classListProvider.future);
  }

  void _showCreateClassSheet() {
    _nameController.clear();
    _subjectController.clear();
    _gradeLevelController.clear();
    _sectionController.clear();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: GlassColors.cardBackground,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(GlassRadius.xl)),
      ),
      builder: (ctx) => _CreateClassSheet(
        nameController: _nameController,
        subjectController: _subjectController,
        gradeLevelController: _gradeLevelController,
        sectionController: _sectionController,
        isCreating: _isCreating,
        onCreate: () => _createClass(ctx),
      ),
    );
  }

  Future<void> _createClass(BuildContext sheetContext) async {
    final name = _nameController.text.trim();
    final subject = _subjectController.text.trim();
    final grade = _gradeLevelController.text.trim();
    final section = _sectionController.text.trim();

    if (name.isEmpty || subject.isEmpty || grade.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill in name, subject, and grade')),
      );
      return;
    }

    setState(() => _isCreating = true);
    try {
      final repo = ref.read(attendanceRepositoryProvider);
      final now = DateTime.now();
      await repo.createClass(
        name: name,
        subject: subject,
        gradeLevel: grade,
        section: section.isEmpty ? 'A' : section,
        academicYear: '${now.year}-${now.year + 1}',
      );
      ref.invalidate(_classListProvider);
      if (mounted) Navigator.of(sheetContext).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to create class: $e'),
            backgroundColor: GlassColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isCreating = false);
    }
  }

  Future<void> _confirmDelete(ClassRecord classRecord) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: GlassColors.cardBackground,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(GlassRadius.lg),
        ),
        title: Text('Delete Class', style: GlassTypography.headline3()),
        content: Text(
          'Are you sure you want to delete "${classRecord.name}"? '
          'This will remove all students and attendance records.',
          style: GlassTypography.bodyMedium(),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Cancel',
                style: GlassTypography.labelLarge(
                    color: GlassColors.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('Delete',
                style: GlassTypography.labelLarge(color: GlassColors.error)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        final repo = ref.read(attendanceRepositoryProvider);
        await repo.deleteClass(classRecord.id);
        ref.invalidate(_classListProvider);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('"${classRecord.name}" deleted')),
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
  }

  void _openClassDetail(ClassRecord record) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ClassDetailScreen(classId: record.id),
      ),
    );
  }

  // ── Build ──

  @override
  Widget build(BuildContext context) {
    final classListAsync = ref.watch(_classListProvider);

    return GlassScaffold(
      title: 'My Classes',
      showBackButton: true,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreateClassSheet,
        backgroundColor: GlassColors.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: Text('Create Class', style: GlassTypography.buttonMedium()),
      ),
      body: classListAsync.when(
        loading: () => const GlassLoadingIndicator(message: 'Loading classes...'),
        error: (err, _) => GlassEmptyState(
          icon: Icons.error_outline,
          title: 'Failed to load classes',
          message: err.toString(),
          action: GlassSecondaryButton(
            label: 'Retry',
            icon: Icons.refresh,
            isExpanded: false,
            onPressed: _refresh,
          ),
        ),
        data: (classes) {
          if (classes.isEmpty) {
            return GlassEmptyState(
              icon: Icons.school_outlined,
              title: 'No Classes Yet',
              message:
                  'Create your first class to start taking attendance.',
              action: GlassPrimaryButton(
                label: 'Create Class',
                icon: Icons.add,
                isExpanded: false,
                onPressed: _showCreateClassSheet,
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: _refresh,
            color: GlassColors.primary,
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(
                GlassSpacing.xl,
                GlassSpacing.lg,
                GlassSpacing.xl,
                100, // space for FAB
              ),
              itemCount: classes.length,
              separatorBuilder: (_, __) =>
                  const SizedBox(height: GlassSpacing.md),
              itemBuilder: (_, index) {
                final cls = classes[index];
                return _ClassCardTile(
                  classRecord: cls,
                  onTap: () => _openClassDetail(cls),
                  onLongPress: () => _confirmDelete(cls),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

// ─────────────────── Class Card ───────────────────

class _ClassCardTile extends StatelessWidget {
  final ClassRecord classRecord;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  const _ClassCardTile({
    required this.classRecord,
    required this.onTap,
    required this.onLongPress,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onLongPress: onLongPress,
      child: GlassCard(
        onTap: onTap,
        padding: const EdgeInsets.all(GlassSpacing.lg),
        child: Row(
          children: [
            // Icon
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: GlassColors.primary.withOpacity(0.12),
                borderRadius: BorderRadius.circular(GlassRadius.md),
              ),
              child: const Icon(Icons.class_rounded,
                  color: GlassColors.primary, size: 28),
            ),
            const SizedBox(width: GlassSpacing.lg),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(classRecord.name, style: GlassTypography.headline3()),
                  const SizedBox(height: 2),
                  Text(
                    '${classRecord.subject}  |  Grade ${classRecord.gradeLevel}  |  Sec ${classRecord.section}',
                    style: GlassTypography.bodySmall(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: GlassSpacing.sm),
            // Student count badge
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: GlassSpacing.md,
                vertical: GlassSpacing.xs,
              ),
              decoration: BoxDecoration(
                color: GlassColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(GlassRadius.pill),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.people_alt_outlined,
                      size: 14, color: GlassColors.primary),
                  const SizedBox(width: 4),
                  Text(
                    '${classRecord.studentCount}',
                    style: GlassTypography.labelMedium(
                        color: GlassColors.primary),
                  ),
                ],
              ),
            ),
            const SizedBox(width: GlassSpacing.xs),
            const Icon(Icons.chevron_right_rounded,
                color: GlassColors.textTertiary),
          ],
        ),
      ),
    );
  }
}

// ─────────────────── Create Class Bottom Sheet ───────────────────

class _CreateClassSheet extends StatelessWidget {
  final TextEditingController nameController;
  final TextEditingController subjectController;
  final TextEditingController gradeLevelController;
  final TextEditingController sectionController;
  final bool isCreating;
  final VoidCallback onCreate;

  const _CreateClassSheet({
    required this.nameController,
    required this.subjectController,
    required this.gradeLevelController,
    required this.sectionController,
    required this.isCreating,
    required this.onCreate,
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
            Text('Create New Class', style: GlassTypography.headline2()),
            const SizedBox(height: GlassSpacing.xxl),
            GlassTextField(
              controller: nameController,
              labelText: 'Class Name',
              hintText: 'e.g. Mathematics 10A',
            ),
            const SizedBox(height: GlassSpacing.lg),
            GlassTextField(
              controller: subjectController,
              labelText: 'Subject',
              hintText: 'e.g. Mathematics',
            ),
            const SizedBox(height: GlassSpacing.lg),
            Row(
              children: [
                Expanded(
                  child: GlassTextField(
                    controller: gradeLevelController,
                    labelText: 'Grade Level',
                    hintText: 'e.g. 10',
                    keyboardType: TextInputType.number,
                  ),
                ),
                const SizedBox(width: GlassSpacing.lg),
                Expanded(
                  child: GlassTextField(
                    controller: sectionController,
                    labelText: 'Section',
                    hintText: 'e.g. A',
                  ),
                ),
              ],
            ),
            const SizedBox(height: GlassSpacing.xxl),
            GlassPrimaryButton(
              label: 'Create Class',
              icon: Icons.add,
              isLoading: isCreating,
              onPressed: isCreating ? null : onCreate,
            ),
            const SizedBox(height: GlassSpacing.md),
          ],
        ),
      ),
    );
  }
}
