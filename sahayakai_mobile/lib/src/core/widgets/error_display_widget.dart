import 'package:flutter/material.dart';

/// A reusable error display widget for Riverpod error states.
///
/// Renders a human-readable message with an appropriate icon based on the
/// error content. Supports an optional Retry button.
///
/// Usage:
/// ```dart
/// ref.listen(xyzErrorProvider, (_, error) {
///   if (error != null) {
///     // Show inline or as SnackBar
///   }
/// });
///
/// // Or inline:
/// if (error != null)
///   ErrorDisplayWidget(error: error, onRetry: () => controller.retry())
/// ```
class ErrorDisplayWidget extends StatelessWidget {
  final String error;
  final VoidCallback? onRetry;

  const ErrorDisplayWidget({
    super.key,
    required this.error,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final config = _resolveConfig(error);
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: config.backgroundColor ?? colorScheme.errorContainer.withOpacity(0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: config.borderColor ?? colorScheme.error.withOpacity(0.3),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            config.icon,
            color: config.iconColor ?? colorScheme.error,
            size: 22,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  config.message,
                  style: TextStyle(
                    color: colorScheme.onSurface,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                if (config.hint != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    config.hint!,
                    style: TextStyle(
                      color: colorScheme.onSurface.withOpacity(0.6),
                      fontSize: 12,
                    ),
                  ),
                ],
                if (onRetry != null) ...[
                  const SizedBox(height: 10),
                  TextButton.icon(
                    onPressed: onRetry,
                    icon: const Icon(Icons.refresh, size: 16),
                    label: const Text('Try Again'),
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  _ErrorConfig _resolveConfig(String error) {
    final lower = error.toLowerCase();

    // No internet / network error
    if (lower.contains('no internet') ||
        lower.contains('network') ||
        lower.contains('socketexception') ||
        lower.contains('connection refused') ||
        lower.contains('failed host lookup')) {
      return _ErrorConfig(
        icon: Icons.wifi_off_rounded,
        iconColor: Colors.orange.shade700,
        backgroundColor: Colors.orange.shade50,
        borderColor: Colors.orange.shade200,
        message: 'No internet connection',
        hint: 'Check your connection and try again.',
      );
    }

    // Timeout
    if (lower.contains('timeout') || lower.contains('timed out')) {
      return _ErrorConfig(
        icon: Icons.hourglass_bottom_rounded,
        iconColor: Colors.amber.shade700,
        backgroundColor: Colors.amber.shade50,
        borderColor: Colors.amber.shade200,
        message: 'Request timed out',
        hint: 'The AI is taking too long. Please try again.',
      );
    }

    // Plan limit (429)
    if (lower.contains('limit') || lower.contains('quota') || lower.contains('429')) {
      return _ErrorConfig(
        icon: Icons.lock_outline_rounded,
        iconColor: Colors.purple.shade700,
        backgroundColor: Colors.purple.shade50,
        borderColor: Colors.purple.shade200,
        message: 'Usage limit reached',
        hint: 'Upgrade your plan for more access.',
      );
    }

    // Plan gate (403)
    if (lower.contains('upgrade') || lower.contains('403') || lower.contains('plan')) {
      return _ErrorConfig(
        icon: Icons.workspace_premium_rounded,
        iconColor: Colors.indigo.shade700,
        backgroundColor: Colors.indigo.shade50,
        borderColor: Colors.indigo.shade200,
        message: 'Feature requires a higher plan',
        hint: 'View Plans to unlock this feature.',
      );
    }

    // Server error (500+)
    if (lower.contains('server') || lower.contains('500') || lower.contains('503')) {
      return _ErrorConfig(
        icon: Icons.cloud_off_rounded,
        iconColor: Colors.blueGrey.shade700,
        backgroundColor: Colors.blueGrey.shade50,
        borderColor: Colors.blueGrey.shade200,
        message: 'Server is temporarily unavailable',
        hint: 'Please try again in a moment.',
      );
    }

    // No local history (offline fallback failed)
    if (lower.contains('no local') || lower.contains('no history')) {
      return _ErrorConfig(
        icon: Icons.inventory_2_outlined,
        message: 'No saved content available',
        hint: 'Connect to the internet to generate new content.',
      );
    }

    // Generic fallback
    return _ErrorConfig(
      icon: Icons.error_outline_rounded,
      message: 'Something went wrong',
      hint: error.length < 120 ? error : null,
    );
  }
}

class _ErrorConfig {
  final IconData icon;
  final Color? iconColor;
  final Color? backgroundColor;
  final Color? borderColor;
  final String message;
  final String? hint;

  const _ErrorConfig({
    required this.icon,
    this.iconColor,
    this.backgroundColor,
    this.borderColor,
    required this.message,
    this.hint,
  });
}
