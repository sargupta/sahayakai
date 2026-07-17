import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/theme/app_theme.dart';

/// Left-aligned empty/idle state: a functional Lucide glyph, a dignified
/// one-line explanation, and an optional action. See DESIGN_RUBRIC §6.
class EmptyView extends StatelessWidget {
  const EmptyView({
    super.key,
    required this.message,
    this.icon = LucideIcons.inbox,
    this.action,
  });

  final String message;
  final IconData icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.space6),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: scheme.onSurfaceVariant, size: 28),
          const SizedBox(height: AppSpacing.space3),
          Text(message, style: text.bodyLarge),
          if (action != null) ...[
            const SizedBox(height: AppSpacing.space4),
            action!,
          ],
        ],
      ),
    );
  }
}
