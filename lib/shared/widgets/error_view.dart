import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/i18n/l10n_ext.dart';
import '../../core/theme/app_theme.dart';

/// Left-aligned error state with a human message and an optional retry.
/// No raw exception strings, no centered-hero slop. See DESIGN_RUBRIC A6.
///
/// Owns NO outer padding �?" the container does. See [EmptyView].
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
        Container(
          width: 56,
          height: 56,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: scheme.error.withValues(alpha: 0.10),
            border: Border.all(
              color: scheme.error.withValues(alpha: 0.22),
              width: 1,
            ),
          ),
          child: Icon(
            LucideIcons.alertTriangle,
            color: scheme.error,
            size: AppIconSize.standalone,
          ),
        ),
        const SizedBox(height: AppSpacing.space3),
        Text(message, style: text.bodyLarge),
        if (onRetry != null) ...[
          const SizedBox(height: AppSpacing.space4),
          OutlinedButton.icon(
            onPressed: onRetry,
            style: OutlinedButton.styleFrom(
              foregroundColor: scheme.error,
              side: BorderSide(color: scheme.error.withValues(alpha: 0.4)),
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.space4,
                vertical: AppSpacing.space2,
              ),
              shape: const RoundedRectangleBorder(
                borderRadius: AppRadius.rRow,
              ),
            ),
            icon: const Icon(LucideIcons.refreshCw, size: AppIconSize.inline),
            label: Text(context.l10n.actionRetry),
          ),
        ],
      ],
    );
  }
}