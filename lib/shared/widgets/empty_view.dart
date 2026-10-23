import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/theme/app_theme.dart';

/// EmptyView v2 (PREMIUM_DESIGN_SPEC.md A5). Left-aligned (never a centered
/// hero stack): a 96dp haloed Lucide glyph (`primary@0.06` outer / `primary@0.12`
/// inner, 36dp glyph in `primary`), an optional `titleMedium` title, a
/// full-ink `bodyLarge` message, and an optional next-step action.
///
/// The body message is `onSurface` (full ink), NOT the muted `onSurfaceVariant`.
///
/// Owns NO outer padding �?" it is always mounted inside something that already
/// pads (an [AppCard], or a page's `pagePadding`). API preserved
/// ({message, title, icon, action}).
class EmptyView extends StatelessWidget {
  const EmptyView({
    super.key,
    required this.message,
    this.title,
    this.icon = LucideIcons.inbox,
    this.action,
  });

  final String message;

  /// An optional heading above the message.
  final String? title;
  final IconData icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _HaloGlyph(icon: icon),
        const SizedBox(height: AppSpacing.space5),
        if (title != null) ...[
          Text(title!, style: text.titleMedium),
          const SizedBox(height: AppSpacing.space1),
        ],
        Text(
          message,
          style: text.bodyLarge?.copyWith(color: scheme.onSurface),
        ),
        if (action != null) ...[
          const SizedBox(height: AppSpacing.space5),
          action!,
        ],
      ],
    );
  }
}

class _HaloGlyph extends StatelessWidget {
  const _HaloGlyph({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: 96,
      height: 96,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: [
            scheme.primary.withValues(alpha: 0.12),
            scheme.primary.withValues(alpha: 0.04),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: scheme.primary.withValues(alpha: 0.12),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Container(
        width: 64,
        height: 64,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: scheme.primary.withValues(alpha: 0.10),
          border: Border.all(
            color: scheme.primary.withValues(alpha: 0.18),
            width: 1,
          ),
        ),
        child: Icon(icon, size: 32, color: scheme.primary),
      ),
    );
  }
}