import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_card.dart';

/// The **202 `generation_in_progress`** state, rendered as calm guidance — NOT
/// an error, and NOT a retry loop.
///
/// The paper is the most token-heavy generation we run and can overrun the
/// server's 75 s budget; when it does, the backend keeps generating in the
/// background and persists the finished paper to the teacher's library. So the
/// honest thing to show is "it's on its way, look in your Library", not a red
/// failure. There is no poll token in the 202 body (only budget/elapsed
/// millis), so this deliberately does not busy-poll: it points to the Library
/// tab and lets the teacher check when ready.
class ExamPaperInProgressView extends StatelessWidget {
  const ExamPaperInProgressView({super.key, this.message});

  /// The server's own human line, when present; otherwise the localized copy.
  final String? message;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return AppCard(
      accentBar: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                LucideIcons.fileClock,
                size: AppIconSize.standalone,
                color: scheme.primary,
              ),
              const SizedBox(width: AppSpacing.space3),
              Expanded(
                child: Text(
                  l10n.examPaperInProgressTitle,
                  style: text.titleMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.space3),
          Text(
            l10n.examPaperInProgressBody,
            style: text.bodyMedium?.copyWith(
              color: scheme.onSurfaceVariant,
              height: 1.5,
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.space3),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  LucideIcons.library,
                  size: AppIconSize.inline,
                  color: scheme.onSurfaceVariant,
                ),
                const SizedBox(width: AppSpacing.space2),
                Expanded(
                  child: Text(
                    l10n.examPaperInProgressLibraryHint,
                    style: text.bodySmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                      height: 1.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
