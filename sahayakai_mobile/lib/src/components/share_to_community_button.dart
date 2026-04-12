import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/content/data/content_repository.dart';
import '../core/services/plan_gate_handler.dart';
import '../core/theme/glassmorphic/glass_components.dart';

/// A button that saves content and publishes it to the community library.
///
/// This button first saves the content (if not already saved), then publishes
/// it as a public resource. Shows a confirmation dialog before publishing.
///
/// Usage:
/// ```dart
/// ShareToCommunityButton(
///   type: 'lesson-plan',
///   title: plan.title,
///   data: plan.toJson(),
///   gradeLevel: plan.gradeLevel,
///   subject: plan.subject,
/// )
/// ```
class ShareToCommunityButton extends ConsumerStatefulWidget {
  final String type;
  final String title;
  final Map<String, dynamic> data;
  final String? gradeLevel;
  final String? subject;
  final String? topic;
  final String? language;
  final String? contentId; // If already saved, pass the ID

  const ShareToCommunityButton({
    super.key,
    required this.type,
    required this.title,
    required this.data,
    this.gradeLevel,
    this.subject,
    this.topic,
    this.language,
    this.contentId,
  });

  @override
  ConsumerState<ShareToCommunityButton> createState() =>
      _ShareToCommunityButtonState();
}

class _ShareToCommunityButtonState
    extends ConsumerState<ShareToCommunityButton> {
  bool _isSharing = false;
  bool _isShared = false;

  Future<void> _share() async {
    // Confirm
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Share to Community?'),
        content: Text(
          'This will make "${widget.title}" visible to all teachers '
          'in the SahayakAI community. You can unpublish it later.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Share'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _isSharing = true);

    try {
      final repo = ref.read(contentRepositoryProvider);
      String id = widget.contentId ?? '';

      // Save first if not already saved
      if (id.isEmpty) {
        id = await repo.saveContent(
          type: widget.type,
          title: widget.title,
          data: widget.data,
          gradeLevel: widget.gradeLevel,
          subject: widget.subject,
          topic: widget.topic,
          language: widget.language,
          isPublic: true,
        );
      } else {
        await repo.publishToLibrary(id);
      }

      if (mounted) {
        setState(() {
          _isSharing = false;
          _isShared = true;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Shared to community!'),
            backgroundColor: Color(0xFF16A34A),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSharing = false);
        if (!PlanGateHandler.handleApiError(context, e)) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Share failed: $e')),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isShared) {
      return TextButton.icon(
        onPressed: null,
        icon: const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A)),
        label: Text(
          'Shared',
          style: GlassTypography.labelMedium(color: const Color(0xFF16A34A)),
        ),
      );
    }

    if (_isSharing) {
      return const SizedBox(
        width: 40,
        height: 40,
        child: Padding(
          padding: EdgeInsets.all(10),
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      );
    }

    return TextButton.icon(
      onPressed: _share,
      icon: const Icon(Icons.people_rounded, color: GlassColors.primary),
      label: Text(
        'Share to Community',
        style: GlassTypography.labelMedium(color: GlassColors.primary),
      ),
    );
  }
}
