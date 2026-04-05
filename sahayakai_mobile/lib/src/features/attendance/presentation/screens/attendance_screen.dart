import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../data/attendance_repository.dart';
import '../../data/parent_message_repository.dart';

class AttendanceScreen extends ConsumerStatefulWidget {
  const AttendanceScreen({super.key});

  @override
  ConsumerState<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends ConsumerState<AttendanceScreen> {
  final _phoneController = TextEditingController();
  final _nameController = TextEditingController();
  final _messageController = TextEditingController();
  bool _isCalling = false;

  Future<void> _callParent() async {
    if (_phoneController.text.trim().isEmpty ||
        _messageController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill in all fields')),
      );
      return;
    }

    setState(() => _isCalling = true);

    try {
      final repo = ref.read(attendanceRepositoryProvider);

      // Step 1: Create outreach record
      final outreachId = await repo.createOutreach(
        studentName: _nameController.text.trim(),
        parentPhone: '+91${_phoneController.text.trim()}',
        message: _messageController.text.trim(),
      );

      // Step 2: Initiate call
      await repo.initiateCall(
        outreachId: outreachId,
        to: '+91${_phoneController.text.trim()}',
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Call initiated successfully')),
        );
        _phoneController.clear();
        _nameController.clear();
        _messageController.clear();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Call failed: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isCalling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      title: 'Parent Outreach',
      showBackButton: true,
      body: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.all(GlassSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Quick message button
            GlassSecondaryButton(
              label: 'Generate Message with AI',
              icon: Icons.auto_awesome,
              onPressed: () => context.push('/parent-message'),
            ),
            const SizedBox(height: GlassSpacing.xxl),

            GlassIconCard(
              icon: Icons.call_rounded,
              iconColor: GlassColors.primary,
              title: 'Call Parent',
              child: Column(
                children: [
                  GlassTextField(
                    controller: _nameController,
                    labelText: 'STUDENT NAME',
                    hintText: 'e.g. Rahul Sharma',
                  ),
                  const SizedBox(height: GlassSpacing.lg),
                  GlassTextField(
                    controller: _phoneController,
                    labelText: 'PARENT PHONE (+91)',
                    hintText: '9876543210',
                    keyboardType: TextInputType.phone,
                  ),
                  const SizedBox(height: GlassSpacing.lg),
                  GlassTextField(
                    controller: _messageController,
                    labelText: 'MESSAGE FOR PARENT',
                    hintText: 'e.g. Your child was absent today...',
                    maxLines: 3,
                  ),
                  const SizedBox(height: GlassSpacing.xl),
                  GlassPrimaryButton(
                    label: 'Call Now',
                    icon: Icons.phone_rounded,
                    isLoading: _isCalling,
                    onPressed: _isCalling ? null : _callParent,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
