import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../data/performance_repository.dart';

class MarksEntryScreen extends ConsumerStatefulWidget {
  const MarksEntryScreen({super.key});

  @override
  ConsumerState<MarksEntryScreen> createState() => _MarksEntryScreenState();
}

class _MarksEntryScreenState extends ConsumerState<MarksEntryScreen> {
  final _assessmentController = TextEditingController();
  final List<_StudentRow> _students = [];
  bool _isSaving = false;

  void _addStudent() {
    setState(() {
      _students.add(_StudentRow(
        nameController: TextEditingController(),
        marksController: TextEditingController(),
      ));
    });
  }

  Future<void> _saveBatch() async {
    if (_assessmentController.text.trim().isEmpty || _students.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add assessment name and at least one student')),
      );
      return;
    }

    setState(() => _isSaving = true);

    try {
      final repo = ref.read(performanceRepositoryProvider);
      await repo.saveBatch(
        classId: 'default', // TODO: class selector
        assessmentName: _assessmentController.text.trim(),
        marks: _students
            .where((s) => s.nameController.text.isNotEmpty)
            .map((s) => StudentMark(
                  studentId: s.nameController.text.hashCode.toString(),
                  studentName: s.nameController.text.trim(),
                  marks: int.tryParse(s.marksController.text) ?? 0,
                ))
            .toList(),
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Marks saved successfully')),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Save failed: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      title: 'Enter Marks',
      showBackButton: true,
      floatingActionButton: GlassFloatingButton(
        label: 'Add Student',
        icon: Icons.person_add_rounded,
        onPressed: _addStudent,
      ),
      body: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.all(GlassSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            GlassTextField(
              controller: _assessmentController,
              labelText: 'ASSESSMENT NAME',
              hintText: 'e.g. Unit Test 1 - Science',
            ),
            const SizedBox(height: GlassSpacing.xl),

            if (_students.isEmpty)
              const GlassEmptyState(
                icon: Icons.people_rounded,
                title: 'No Students Added',
                message: 'Tap + to add students and their marks.',
              )
            else
              ..._students.asMap().entries.map((entry) {
                final i = entry.key;
                final s = entry.value;
                return Padding(
                  padding: const EdgeInsets.only(bottom: GlassSpacing.md),
                  child: GlassCard(
                    child: Row(
                      children: [
                        CircleAvatar(
                          backgroundColor: GlassColors.primary.withOpacity(0.1),
                          child: Text('${i + 1}',
                              style: TextStyle(color: GlassColors.primary)),
                        ),
                        const SizedBox(width: GlassSpacing.md),
                        Expanded(
                          flex: 3,
                          child: TextField(
                            controller: s.nameController,
                            decoration: const InputDecoration(
                              hintText: 'Student name',
                              border: InputBorder.none,
                            ),
                          ),
                        ),
                        const SizedBox(width: GlassSpacing.md),
                        SizedBox(
                          width: 60,
                          child: TextField(
                            controller: s.marksController,
                            keyboardType: TextInputType.number,
                            textAlign: TextAlign.center,
                            decoration: const InputDecoration(
                              hintText: 'Marks',
                              border: InputBorder.none,
                            ),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          onPressed: () =>
                              setState(() => _students.removeAt(i)),
                        ),
                      ],
                    ),
                  ),
                );
              }),

            if (_students.isNotEmpty) ...[
              const SizedBox(height: GlassSpacing.xl),
              GlassPrimaryButton(
                label: 'Save All Marks',
                icon: Icons.save_rounded,
                isLoading: _isSaving,
                onPressed: _isSaving ? null : _saveBatch,
              ),
            ],
            const SizedBox(height: 100), // Space for FAB
          ],
        ),
      ),
    );
  }
}

class _StudentRow {
  final TextEditingController nameController;
  final TextEditingController marksController;

  _StudentRow({required this.nameController, required this.marksController});
}
