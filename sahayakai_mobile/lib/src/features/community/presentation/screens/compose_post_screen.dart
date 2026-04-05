import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../data/community_repository.dart';

/// Post type options available when composing a new community post.
enum PostType {
  share('Share', Icons.share_rounded, Color(0xFF2563EB)),
  askHelp('Ask Help', Icons.help_rounded, Color(0xFFF59E0B)),
  celebrate('Celebrate', Icons.celebration_rounded, Color(0xFF16A34A)),
  resource('Resource', Icons.folder_rounded, Color(0xFF8B5CF6));

  const PostType(this.label, this.icon, this.color);

  final String label;
  final IconData icon;
  final Color color;

  /// Value sent to the API.
  String get apiValue => name;
}

class ComposePostScreen extends ConsumerStatefulWidget {
  const ComposePostScreen({super.key});

  @override
  ConsumerState<ComposePostScreen> createState() => _ComposePostScreenState();
}

class _ComposePostScreenState extends ConsumerState<ComposePostScreen> {
  final _contentController = TextEditingController();
  PostType _selectedType = PostType.share;
  bool _isSubmitting = false;

  static const int _minContentLength = 10;

  @override
  void dispose() {
    _contentController.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  Future<void> _submit() async {
    final content = _contentController.text.trim();

    if (content.length < _minContentLength) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please write at least $_minContentLength characters'),
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      await ref.read(communityRepositoryProvider).createPost(
            content: content,
            postType: _selectedType.apiValue,
          );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Post shared!')),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to post: $e')),
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      title: 'New Post',
      showBackButton: true,
      actions: [
        _buildPostAction(),
      ],
      body: SingleChildScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.all(GlassSpacing.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Text('Share with your community',
                style: GlassTypography.decorativeLabel()),
            const SizedBox(height: GlassSpacing.xs),
            Text('Create a Post', style: GlassTypography.headline1()),
            const SizedBox(height: GlassSpacing.sm),
            Container(
              width: 60,
              height: 2,
              color: GlassColors.textTertiary.withOpacity(0.3),
            ),
            const SizedBox(height: GlassSpacing.xxl),

            // Post type selector
            Text('POST TYPE', style: GlassTypography.sectionHeader()),
            const SizedBox(height: GlassSpacing.md),
            _buildPostTypeSelector(),
            const SizedBox(height: GlassSpacing.xxl),

            // Group selector
            Text('GROUP', style: GlassTypography.sectionHeader()),
            const SizedBox(height: GlassSpacing.md),
            _buildGroupSelector(),
            const SizedBox(height: GlassSpacing.xxl),

            // Content text area
            GlassTextField(
              controller: _contentController,
              labelText: 'CONTENT',
              hintText: "What's on your mind?",
              maxLines: 8,
            ),
            const SizedBox(height: GlassSpacing.xxxl),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Widgets
  // ---------------------------------------------------------------------------

  /// App-bar "Post" action button with loading state.
  Widget _buildPostAction() {
    if (_isSubmitting) {
      return const Padding(
        padding: EdgeInsets.only(right: GlassSpacing.lg),
        child: Center(
          child: SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(right: GlassSpacing.sm),
      child: TextButton(
        onPressed: _submit,
        child: Text(
          'Post',
          style: GlassTypography.labelMedium(
            color: GlassColors.primary,
          ),
        ),
      ),
    );
  }

  /// Row of 4 selectable post-type cards.
  Widget _buildPostTypeSelector() {
    return Row(
      children: PostType.values.map((type) {
        final isSelected = _selectedType == type;
        final isLast = type == PostType.values.last;

        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(right: isLast ? 0 : GlassSpacing.sm),
            child: GlassCard(
              onTap: () => setState(() => _selectedType = type),
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
                          ? type.color.withOpacity(0.15)
                          : GlassColors.inputBackground,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      type.icon,
                      color: isSelected ? type.color : GlassColors.textTertiary,
                      size: 22,
                    ),
                  ),
                  const SizedBox(height: GlassSpacing.sm),
                  Text(
                    type.label,
                    textAlign: TextAlign.center,
                    style: GlassTypography.labelSmall(
                      color:
                          isSelected ? type.color : GlassColors.textSecondary,
                    ),
                  ),
                  if (isSelected) ...[
                    const SizedBox(height: 4),
                    Container(
                      width: 20,
                      height: 2,
                      decoration: BoxDecoration(
                        color: type.color,
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
    );
  }

  /// Static group selector showing "General" as the default.
  Widget _buildGroupSelector() {
    return GlassCard(
      padding: const EdgeInsets.symmetric(
        vertical: GlassSpacing.lg,
        horizontal: GlassSpacing.xl,
      ),
      child: Row(
        children: [
          Icon(
            Icons.group_rounded,
            color: GlassColors.textSecondary,
            size: 20,
          ),
          const SizedBox(width: GlassSpacing.md),
          Expanded(
            child: Text(
              'General',
              style: GlassTypography.bodyMedium(),
            ),
          ),
          Icon(
            Icons.chevron_right_rounded,
            color: GlassColors.textTertiary,
            size: 20,
          ),
        ],
      ),
    );
  }
}
