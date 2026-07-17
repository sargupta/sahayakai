import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/i18n/l10n_ext.dart';
import '../../core/theme/app_theme.dart';

/// Left-aligned error state with a human message and an optional retry.
/// No raw exception strings, no centered-hero slop. See DESIGN_RUBRIC §6.
///
/// Owns NO outer padding — the container does. See [EmptyView].
class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(LucideIcons.alertTriangle,
            color: scheme.error, size: AppIconSize.standalone),
        const SizedBox(height: AppSpacing.space3),
        Text(message, style: text.bodyLarge),
        if (onRetry != null) ...[
          const SizedBox(height: AppSpacing.space4),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(LucideIcons.refreshCw, size: AppIconSize.inline),
            label: Text(context.l10n.actionRetry),
          ),
        ],
      ],
    );
  }
}
