import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/theme/app_theme.dart';

/// Left-aligned empty/idle state: a functional Lucide glyph, a dignified
/// one-line explanation, and an optional action. See DESIGN_RUBRIC §6.
///
/// Owns NO outer padding — the container does. It is only ever mounted inside
/// something that already pads (an [AppCard]'s `space4`, or a page's
/// `AppSpacing.pagePadding`), so padding here would stack on top of that and
/// inset the state card further than its own siblings.
class EmptyView extends StatelessWidget {
  const EmptyView({
    super.key,
    required this.message,
    this.title,
    this.icon = LucideIcons.inbox,
    this.action,
  });

  final String message;

  /// An optional heading above the message, for states that read better with a
  /// short title line before the explanation (e.g. an empty profile).
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
        Icon(icon, color: scheme.onSurfaceVariant, size: AppIconSize.standalone),
        const SizedBox(height: AppSpacing.space3),
        if (title != null) ...[
          Text(title!, style: text.titleMedium),
          const SizedBox(height: AppSpacing.space1),
        ],
        Text(message, style: text.bodyLarge),
        if (action != null) ...[
          const SizedBox(height: AppSpacing.space4),
          action!,
        ],
      ],
    );
  }
}
