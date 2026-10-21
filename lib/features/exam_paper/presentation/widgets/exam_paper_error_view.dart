import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/offline_view.dart';

/// Maps a failed generation to the *right* recovery UI, not a single generic
/// error. The network layer produces the typed [ApiException]; this widget
/// decides whether the teacher should retry, edit-and-retry, rephrase, upgrade,
/// wait or sign in.
///
///   - **422 exam_paper_unstructured** -> "we couldn't structure that — try
///     fewer chapters" guidance + retry (the distinct state this screen exists
///     for; checked BEFORE the generic kind switch)
///   - network            -> offline card + retry
///   - 401 unauthorized   -> sign-in prompt (no retry; the token is stale)
///   - 403 forbidden      -> upgrade prompt (no retry)
///   - 429 rateLimited    -> limit-reached prompt (no retry)
///   - 400 badResponse    -> rephrase hint + retry
///   - 503 / 5xx server   -> busy message + retry
///   - timeout            -> timeout message + retry
class ExamPaperErrorView extends StatelessWidget {
  const ExamPaperErrorView({super.key, required this.error, this.onRetry});

  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    if (error is! ApiException) {
      return ErrorView(message: l10n.errorGeneric, onRetry: onRetry);
    }

    final api = error as ApiException;

    // 422 is its own state, not a generic failure: the paper came back but
    // could not be structured into sections/questions. The recovery is to trim
    // the chapter list and generate again, so this keeps the retry AND names the
    // fix. Branched on the status (and confirmed by the machine `errorCode`)
    // before the kind switch, since 422 otherwise reads as a plain badResponse.
    if (api.statusCode == 422 ||
        api.errorCode == 'exam_paper_unstructured') {
      return _FewerChaptersGuidance(onRetry: onRetry);
    }

    switch (api.kind) {
      case ApiErrorKind.network:
        return OfflineView(onRetry: onRetry);
      case ApiErrorKind.unauthorized:
        return ErrorView(message: l10n.examPaperSignIn);
      case ApiErrorKind.forbidden:
        return _PromptView(
          icon: LucideIcons.arrowUpCircle,
          title: l10n.examPaperUpgradeTitle,
          body: l10n.examPaperUpgradeBody,
        );
      case ApiErrorKind.rateLimited:
        return _PromptView(
          icon: LucideIcons.hourglass,
          title: l10n.examPaperLimitTitle,
          body: l10n.examPaperLimitBody,
        );
      case ApiErrorKind.timeout:
        return ErrorView(message: l10n.examPaperTimeout, onRetry: onRetry);
      case ApiErrorKind.server:
        return ErrorView(message: l10n.examPaperBusy, onRetry: onRetry);
      case ApiErrorKind.badResponse:
        final message =
            api.statusCode == 400 ? l10n.examPaperRephrase : l10n.errorGeneric;
        return ErrorView(message: message, onRetry: onRetry);
      case ApiErrorKind.notFound:
      case ApiErrorKind.cancelled:
      case ApiErrorKind.unknown:
        return ErrorView(message: l10n.errorGeneric, onRetry: onRetry);
    }
  }
}

/// The 422 guidance: names the fix (fewer chapters) and keeps a retry, so the
/// teacher can trim the chapter chips above and generate again. Left-aligned,
/// same grammar as the shared ErrorView.
class _FewerChaptersGuidance extends StatelessWidget {
  const _FewerChaptersGuidance({this.onRetry});

  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          LucideIcons.fileQuestion,
          color: scheme.primary,
          size: AppIconSize.standalone,
        ),
        const SizedBox(height: AppSpacing.space3),
        Text(l10n.examPaperUnstructuredTitle, style: text.titleMedium),
        const SizedBox(height: AppSpacing.space2),
        Text(
          l10n.examPaperUnstructuredBody,
          style: text.bodyMedium?.copyWith(
            color: scheme.onSurfaceVariant,
            height: 1.5,
          ),
        ),
        if (onRetry != null) ...[
          const SizedBox(height: AppSpacing.space4),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(LucideIcons.refreshCw, size: AppIconSize.inline),
            label: Text(l10n.actionRetry),
          ),
        ],
      ],
    );
  }
}

/// A dignified, left-aligned prompt for the states where retrying will not help
/// (upgrade / limit). Same grammar as the shared ErrorView/EmptyView.
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
    return Column(
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
    );
  }
}
