import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../data/feedback_repository.dart';

class FeedbackScreen extends ConsumerStatefulWidget {
  const FeedbackScreen({super.key});

  @override
  ConsumerState<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends ConsumerState<FeedbackScreen> {
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  String _category = 'general';
  bool _isSubmitting = false;
  bool _isSubmitted = false;

  static const _categories = [
    ('bug', 'Bug Report', Icons.bug_report_rounded, Color(0xFFEF4444)),
    ('feature', 'Feature Request', Icons.lightbulb_rounded, Color(0xFFF59E0B)),
    ('general', 'General Feedback', Icons.chat_bubble_rounded, Color(0xFF2563EB)),
  ];

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final title = _titleController.text.trim();
    final description = _descriptionController.text.trim();

    if (title.isEmpty || description.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill in both title and description')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      await ref.read(feedbackRepositoryProvider).submitAppFeedback(
            title: title,
            description: description,
            category: _category,
          );
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _isSubmitted = true;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Submission failed: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      title: 'Send Feedback',
      showBackButton: true,
      body: _isSubmitted ? _buildSuccessView() : _buildFormView(),
    );
  }

  Widget _buildSuccessView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(GlassSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF16A34A).withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_circle_rounded,
                color: Color(0xFF16A34A),
                size: 64,
              ),
            ),
            const SizedBox(height: GlassSpacing.xl),
            Text('Thank You!', style: GlassTypography.headline1()),
            const SizedBox(height: GlassSpacing.md),
            Text(
              'Your feedback has been submitted successfully. '
              'We appreciate you helping us improve SahayakAI.',
              textAlign: TextAlign.center,
              style: GlassTypography.bodyMedium(
                color: GlassColors.textSecondary,
              ),
            ),
            const SizedBox(height: GlassSpacing.xxl),
            GlassPrimaryButton(
              label: 'Submit Another',
              icon: Icons.edit_rounded,
              onPressed: () {
                setState(() {
                  _isSubmitted = false;
                  _titleController.clear();
                  _descriptionController.clear();
                  _category = 'general';
                });
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFormView() {
    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.all(GlassSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Text('We value your input', style: GlassTypography.decorativeLabel()),
          const SizedBox(height: GlassSpacing.xs),
          Text('Help Us Improve', style: GlassTypography.headline1()),
          const SizedBox(height: GlassSpacing.sm),
          Container(
            width: 60,
            height: 2,
            color: GlassColors.textTertiary.withOpacity(0.3),
          ),
          const SizedBox(height: GlassSpacing.xxl),

          // Category selection
          Text('CATEGORY', style: GlassTypography.sectionHeader()),
          const SizedBox(height: GlassSpacing.md),
          Row(
            children: _categories.map((cat) {
              final isSelected = _category == cat.$1;
              return Expanded(
                child: Padding(
                  padding: EdgeInsets.only(
                    right: cat.$1 != _categories.last.$1 ? GlassSpacing.sm : 0,
                  ),
                  child: GlassCard(
                    onTap: () => setState(() => _category = cat.$1),
                    padding: const EdgeInsets.symmetric(
                      vertical: GlassSpacing.lg,
                      horizontal: GlassSpacing.sm,
                    ),
                    child: Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? cat.$4.withOpacity(0.15)
                                : GlassColors.inputBackground,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            cat.$3,
                            color: isSelected ? cat.$4 : GlassColors.textTertiary,
                            size: 22,
                          ),
                        ),
                        const SizedBox(height: GlassSpacing.sm),
                        Text(
                          cat.$2,
                          textAlign: TextAlign.center,
                          style: GlassTypography.labelSmall(
                            color: isSelected ? cat.$4 : GlassColors.textSecondary,
                          ),
                        ),
                        if (isSelected) ...[
                          const SizedBox(height: 4),
                          Container(
                            width: 20,
                            height: 2,
                            decoration: BoxDecoration(
                              color: cat.$4,
                              borderRadius: BorderRadius.circular(1),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: GlassSpacing.xxl),

          // Title
          GlassTextField(
            controller: _titleController,
            labelText: 'TITLE',
            hintText: _category == 'bug'
                ? 'e.g. Quiz generation fails on large topics'
                : _category == 'feature'
                    ? 'e.g. Add dark mode support'
                    : 'e.g. Love the lesson plan feature!',
          ),
          const SizedBox(height: GlassSpacing.xl),

          // Description
          GlassTextField(
            controller: _descriptionController,
            labelText: 'DESCRIPTION',
            hintText: _category == 'bug'
                ? 'Describe the issue: what happened, what you expected, steps to reproduce...'
                : _category == 'feature'
                    ? 'Describe the feature you would like to see and how it would help you...'
                    : 'Share your thoughts, suggestions, or compliments...',
            maxLines: 5,
          ),
          const SizedBox(height: GlassSpacing.xxl),

          // Submit
          GlassPrimaryButton(
            label: 'Submit Feedback',
            icon: Icons.send_rounded,
            isLoading: _isSubmitting,
            onPressed: _isSubmitting ? null : _submit,
          ),
          const SizedBox(height: GlassSpacing.xxxl),
        ],
      ),
    );
  }
}
