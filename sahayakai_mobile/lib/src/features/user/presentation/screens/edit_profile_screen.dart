import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../../auth/presentation/providers/user_profile_provider.dart';
import '../../data/user_repository.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _yearsController = TextEditingController();
  String? _selectedRole;
  final Set<String> _selectedQualifications = {};
  bool _isSaving = false;

  static const _roles = [
    'none', 'hod', 'coordinator', 'exam_controller',
    'vice_principal', 'principal',
  ];

  static const _roleLabels = {
    'none': 'Teacher',
    'hod': 'Head of Department',
    'coordinator': 'Coordinator',
    'exam_controller': 'Exam Controller',
    'vice_principal': 'Vice Principal',
    'principal': 'Principal',
  };

  static const _qualifications = [
    'D.El.Ed', 'B.Ed', 'M.Ed', 'NET', 'Ph.D',
    'CTET', 'STET', 'TET',
  ];

  Future<void> _save() async {
    setState(() => _isSaving = true);
    try {
      final repo = ref.read(userRepositoryProvider);
      await repo.updateProfile(
        yearsOfExperience: _yearsController.text.isNotEmpty
            ? int.tryParse(_yearsController.text)
            : null,
        administrativeRole: _selectedRole,
        qualifications: _selectedQualifications.isNotEmpty
            ? _selectedQualifications.toList()
            : null,
      );
      ref.invalidate(fullUserProfileProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile updated')),
        );
        context.pop();
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
      title: 'Edit Profile',
      showBackButton: true,
      body: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.all(GlassSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            GlassTextField(
              controller: _yearsController,
              labelText: 'YEARS OF EXPERIENCE',
              hintText: 'e.g. 5',
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: GlassSpacing.xl),

            GlassDropdown<String>(
              labelText: 'ADMINISTRATIVE ROLE',
              value: _selectedRole,
              hintText: 'Select role',
              items: _roles
                  .map((r) => DropdownMenuItem(
                        value: r,
                        child: Text(_roleLabels[r] ?? r),
                      ))
                  .toList(),
              onChanged: (v) => setState(() => _selectedRole = v),
            ),
            const SizedBox(height: GlassSpacing.xl),

            Text('QUALIFICATIONS', style: GlassTypography.sectionHeader()),
            const SizedBox(height: GlassSpacing.md),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _qualifications.map((q) {
                final selected = _selectedQualifications.contains(q);
                return ChoiceChip(
                  label: Text(q),
                  selected: selected,
                  selectedColor: GlassColors.primary.withOpacity(0.2),
                  onSelected: (_) {
                    setState(() {
                      if (selected) {
                        _selectedQualifications.remove(q);
                      } else {
                        _selectedQualifications.add(q);
                      }
                    });
                  },
                  side: BorderSide(
                    color: selected ? GlassColors.primary : GlassColors.border,
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: GlassSpacing.xxl),

            GlassPrimaryButton(
              label: 'Save Changes',
              icon: Icons.check_rounded,
              isLoading: _isSaving,
              onPressed: _isSaving ? null : _save,
            ),
          ],
        ),
      ),
    );
  }
}
