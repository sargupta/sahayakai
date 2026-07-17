import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/i18n/l10n_ext.dart';
import '../../core/theme/app_theme.dart';

/// Explicit offline state — rural connectivity is intermittent, so network
/// actions degrade gracefully with a clear hint and a retry. See DESIGN_RUBRIC §6.
class OfflineView extends StatelessWidget {
  const OfflineView({super.key, this.onRetry});

  final VoidCallback? onRetry;

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
          Icon(LucideIcons.wifiOff, color: scheme.onSurfaceVariant, size: 28),
          const SizedBox(height: AppSpacing.space3),
          Text(context.l10n.stateOfflineTitle, style: text.titleMedium),
          const SizedBox(height: AppSpacing.space1),
          Text(context.l10n.stateOfflineBody, style: text.bodyMedium),
          if (onRetry != null) ...[
            const SizedBox(height: AppSpacing.space4),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(LucideIcons.refreshCw, size: 18),
              label: Text(context.l10n.actionRetry),
            ),
          ],
        ],
      ),
    );
  }
}
