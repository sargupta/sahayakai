import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/offline_view.dart';

/// Maps a failed generation to the *right* recovery UI, not a single generic
/// error. The network layer produces the typed [ApiException]; this widget
/// decides whether the teacher should retry, rephrase, upgrade or wait.
///
///   - network            -> offline card + retry
///   - 401 unauthorized   -> sign-in prompt (no retry; the token is stale)
///   - 403 forbidden      -> upgrade prompt (no retry)
///   - 429 rateLimited    -> limit-reached prompt (no retry)
///   - 400 badResponse    -> rephrase hint + retry
///   - 503 / 5xx server   -> busy message + retry
///   - timeout            -> timeout message + retry
class LessonPlanErrorView extends StatelessWidget {
  const LessonPlanErrorView({super.key, required this.error, this.onRetry});

  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    if (error is! ApiException) {
      return ErrorView(message: l10n.errorGeneric, onRetry: onRetry);
    }

    final api = error as ApiException;
    switch (api.kind) {
      case ApiErrorKind.network:
        return OfflineView(onRetry: onRetry);
      case ApiErrorKind.unauthorized:
        return ErrorView(message: l10n.lessonPlanSignIn);
      case ApiErrorKind.forbidden:
        return _PromptView(
          icon: LucideIcons.arrowUpCircle,
          title: l10n.lessonPlanUpgradeTitle,
          body: l10n.lessonPlanUpgradeBody,
        );
      case ApiErrorKind.rateLimited:
        return _PromptView(
          icon: LucideIcons.hourglass,
          title: l10n.lessonPlanLimitTitle,
          body: l10n.lessonPlanLimitBody,
        );
      case ApiErrorKind.timeout:
        return ErrorView(message: l10n.lessonPlanTimeout, onRetry: onRetry);
      case ApiErrorKind.server:
        return ErrorView(message: l10n.lessonPlanBusy, onRetry: onRetry);
      case ApiErrorKind.badResponse:
        final message = api.statusCode == 400
            ? l10n.lessonPlanRephrase
            : l10n.errorGeneric;
        return ErrorView(message: message, onRetry: onRetry);
      case ApiErrorKind.notFound:
      case ApiErrorKind.cancelled:
      case ApiErrorKind.unknown:
        return ErrorView(message: l10n.errorGeneric, onRetry: onRetry);
    }
  }
}

/// A dignified, left-aligned prompt for the states where retrying will not
/// help (upgrade / limit). Same grammar as the shared ErrorView/EmptyView.
class _PromptView extends StatelessWidget {
  const _PromptView({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

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
          Icon(icon, color: scheme.primary, size: AppIconSize.standalone),
          const SizedBox(height: AppSpacing.space3),
          Text(title, style: text.titleMedium),
          const SizedBox(height: AppSpacing.space2),
          Text(
            body,
            style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}
