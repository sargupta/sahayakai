import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/network/dio_config.dart';
import '../../../../core/platform/link_opener.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/offline_view.dart';

/// Maps a failed assessment to the *right* recovery UI, not one generic error.
/// The network layer produces the typed [ApiException]; this widget decides
/// whether the teacher should retry, re-upload, upgrade, wait or stop.
///
///   - network                    -> offline card + retry
///   - 401 unauthorized           -> sign-in prompt (no retry; the token is stale)
///   - 403 PLAN_UPGRADE_REQUIRED  -> upgrade prompt + pricing (no retry)
///   - 429 DAILY_LIMIT_REACHED    -> "come back tomorrow" + pricing (NO retry:
///                                   the day budget resets on a clock)
///   - 429 USAGE_LIMIT_REACHED    -> monthly limit prompt + pricing (no retry)
///   - 503 AI_SERVICE_BUSY        -> busy message, Retry-After aware, + retry
///   - 400 badResponse            -> re-upload a clearer photo + retry
///   - timeout / 5xx              -> retryable message + retry
///
/// NOTE on the day budget (verified against `sahayakai-main`, recorded in
/// docs/flutter/HANDOFF.md): the route's expensive-model per-day guards
/// (`checkImageRateLimit` 10 imgs/day, `checkUsage('gemini_tokens')` 500k/day)
/// do NOT surface as a distinct 429 — they throw errors the shared
/// `handleAIError` classifier does not recognise, so they arrive as a generic
/// 500 and fall into the retryable "busy" branch. The DAILY_LIMIT_REACHED
/// branch below is kept for the plan-quota daily cap (used by other tools and
/// wired if assess-assignment is ever added to the daily-limit map); the only
/// 429 this route reliably returns today is the monthly USAGE_LIMIT_REACHED.
class AssessAssignmentErrorView extends ConsumerWidget {
  const AssessAssignmentErrorView({super.key, required this.error, this.onRetry});

  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;

    if (error is! ApiException) {
      return ErrorView(message: l10n.errorGeneric, onRetry: onRetry);
    }

    final api = error as ApiException;
    void openPricing() => ref.read(linkOpenerProvider).open(_pricingUri);

    switch (api.kind) {
      case ApiErrorKind.network:
        return OfflineView(onRetry: onRetry);

      case ApiErrorKind.unauthorized:
        return ErrorView(message: l10n.assessSignIn);

      case ApiErrorKind.forbidden:
        return _PromptView(
          icon: LucideIcons.arrowUpCircle,
          title: l10n.assessUpgradeTitle,
          body: l10n.assessUpgradeBody,
          actionLabel: l10n.assessSeePricing,
          onAction: openPricing,
        );

      case ApiErrorKind.rateLimited:
        // The day budget is the limit a free teacher hits first, so it gets its
        // own copy: it resets tomorrow, and pricing is the only way to lift it
        // today. The monthly cap resets next month.
        final isDaily = _serverCode(api) == _dailyLimitCode;
        return _PromptView(
          icon: isDaily ? LucideIcons.hourglass : LucideIcons.arrowUpCircle,
          title: isDaily ? l10n.assessDailyLimitTitle : l10n.assessLimitTitle,
          body: isDaily ? l10n.assessDailyLimitBody : l10n.assessLimitBody,
          actionLabel: l10n.assessSeePricing,
          onAction: openPricing,
        );

      case ApiErrorKind.timeout:
        return ErrorView(message: l10n.assessTimeout, onRetry: onRetry);

      case ApiErrorKind.server:
        // 503 carries Retry-After; telling the teacher how long beats a bare
        // "try again".
        final seconds = _retryAfterSeconds(api);
        return ErrorView(
          message: seconds == null
              ? l10n.assessBusy
              : l10n.assessBusyRetryAfter(seconds),
          onRetry: onRetry,
        );

      case ApiErrorKind.badResponse:
        final message =
            api.statusCode == 400 ? l10n.assessRephrase : l10n.errorGeneric;
        return ErrorView(message: message, onRetry: onRetry);

      case ApiErrorKind.notFound:
      case ApiErrorKind.cancelled:
      case ApiErrorKind.unknown:
        return ErrorView(message: l10n.errorGeneric, onRetry: onRetry);
    }
  }
}

const String _dailyLimitCode = 'DAILY_LIMIT_REACHED';

/// The web app's pricing page. The Flutter client is a native front-end over
/// the same backend, so the same page is the one place plans are explained.
final Uri _pricingUri = Uri.parse('$kApiBaseUrl/pricing');

/// The machine-readable `error` code from the plan guard's body
/// (`{ error: 'DAILY_LIMIT_REACHED', message: '...' }`). Read from the raw
/// response first; [ApiException.message] is the fallback because the client
/// copies the body's `error` into it for 403/429.
String? _serverCode(ApiException api) {
  final raw = api.raw;
  if (raw is DioException) {
    final data = raw.response?.data;
    if (data is Map && data['error'] is String) return data['error'] as String;
  }
  return api.message;
}

/// `retryAfterSeconds` from the 503 body, falling back to the `Retry-After`
/// header. Bounded so a nonsense value cannot produce nonsense copy.
int? _retryAfterSeconds(ApiException api) {
  final raw = api.raw;
  if (raw is! DioException) return null;

  final data = raw.response?.data;
  if (data is Map) {
    final value = data['retryAfterSeconds'];
    if (value is int) return _bounded(value);
    if (value is num) return _bounded(value.toInt());
  }

  final header = raw.response?.headers.value('retry-after');
  final parsed = header == null ? null : int.tryParse(header.trim());
  return parsed == null ? null : _bounded(parsed);
}

int? _bounded(int seconds) => (seconds > 0 && seconds <= 3600) ? seconds : null;

/// A dignified, left-aligned prompt for the states where retrying will not help
/// (upgrade / limit). Deliberately has no retry — its action points at pricing.
class _PromptView extends StatelessWidget {
  const _PromptView({
    required this.icon,
    required this.title,
    required this.body,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String body;
  final String? actionLabel;
  final VoidCallback? onAction;

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
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: AppSpacing.space4),
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                onPressed: onAction,
                icon: const Icon(LucideIcons.externalLink,
                    size: AppIconSize.inline),
                label: Text(actionLabel!),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
