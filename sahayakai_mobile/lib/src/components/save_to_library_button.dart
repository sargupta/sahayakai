import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/content/data/content_repository.dart';
import '../core/services/plan_gate_handler.dart';

/// A reusable button that saves generated content to the user's library.
///
/// Shows a checkmark after successful save. Handles 403/429 plan errors.
///
/// Usage:
/// ```dart
/// SaveToLibraryButton(
///   type: 'lesson-plan',
///   title: plan.title,
///   data: plan.toJson(),
///   gradeLevel: plan.gradeLevel,
///   subject: plan.subject,
/// )
/// ```
class SaveToLibraryButton extends ConsumerStatefulWidget {
  final String type;
  final String title;
  final Map<String, dynamic> data;
  final String? gradeLevel;
  final String? subject;
  final String? topic;
  final String? language;

  const SaveToLibraryButton({
    super.key,
    required this.type,
    required this.title,
    required this.data,
    this.gradeLevel,
    this.subject,
    this.topic,
    this.language,
  });

  @override
  ConsumerState<SaveToLibraryButton> createState() =>
      _SaveToLibraryButtonState();
}

class _SaveToLibraryButtonState extends ConsumerState<SaveToLibraryButton> {
  bool _isSaving = false;
  bool _isSaved = false;

  Future<void> _save() async {
    if (_isSaving || _isSaved) return;
    setState(() => _isSaving = true);

    try {
      await ref.read(contentRepositoryProvider).saveContent(
            type: widget.type,
            title: widget.title,
            data: widget.data,
            gradeLevel: widget.gradeLevel,
            subject: widget.subject,
            topic: widget.topic,
            language: widget.language,
          );

      if (mounted) {
        setState(() {
          _isSaving = false;
          _isSaved = true;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Saved to library')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        if (!PlanGateHandler.handleApiError(context, e)) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Save failed: $e')),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isSaved) {
      return const IconButton(
        onPressed: null,
        icon: Icon(Icons.check_circle_rounded, color: Colors.green),
        tooltip: 'Saved',
      );
    }

    if (_isSaving) {
      return const SizedBox(
        width: 40,
        height: 40,
        child: Padding(
          padding: EdgeInsets.all(10),
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      );
    }

    return IconButton(
      onPressed: _save,
      icon: const Icon(Icons.bookmark_add_rounded),
      tooltip: 'Save to Library',
    );
  }
}
