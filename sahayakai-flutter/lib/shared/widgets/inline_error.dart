import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/theme/app_theme.dart';

/// An inline error banner: an alert glyph beside a message (and an optional
/// title), in a soft error-tinted card.
///
/// The one in-form error surface. Settings, Profile and Onboarding each kept a
/// private `_InlineError`; Settings' carried an optional title and the other
/// two were byte-identical, so this is their union.
class InlineError extends StatelessWidget {
  const InlineError({super.key, required this.message, this.title});

  final String message;
  final String? title;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.error.withValues(alpha: 0.08),
        borderRadius: AppRadius.rMd,
        border: Border.all(color: scheme.error.withValues(alpha: 0.4)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.space3),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              LucideIcons.alertTriangle,
              size: AppIconSize.inline,
              color: scheme.error,
            ),
            const SizedBox(width: AppSpacing.space3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (title != null) ...[
                    Text(
                      title!,
                      style: text.titleSmall?.copyWith(color: scheme.error),
                    ),
                    const SizedBox(height: AppSpacing.space1),
                  ],
                  Text(message, style: text.bodyMedium),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
