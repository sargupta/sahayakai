import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/offline_view.dart';

/// Maps a failed plan request to the *right* recovery UI, not a single generic
/// error. The network layer produces the typed [ApiException]; this widget
/// decides whether the teacher should retry, rephrase, wait, sign in, or upgrade.
///
///   - network                   -> offline card + retry
///   - 401 unauthorized          -> sign-in prompt (no retry; the token is stale)
///   - 403 forbidden (plan gate) -> "not on your plan" (no retry; a re-run 403s)
///   - 429 rate limited          -> "planned a lot, try later" + retry
///   - 503 AI_SERVICE_BUSY / 5xx -> busy message, Retry-After aware, + retry
///   - 504 timeout               -> retryable message + retry
///   - 400 / 422 badResponse     -> "try a different topic" rephrase + retry
///   - any other 4xx / unknown   -> generic retryable message + retry
///
/// The benign 202 `still_generating` is NOT handled here — it is a success-path
/// DATA outcome ([FieldTripStillGenerating]) the screen renders as a calm panel,
/// never routed through this error view.
class VirtualFieldTripErrorView extends StatelessWidget {
  const VirtualFieldTripErrorView({
    super.key,
    required this.error,
    this.onRetry,
  });

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
        // The token is stale; retrying the same request will 401 again. The app
        // redirects to /login globally, so this is a dignified pointer, no retry.
        return ErrorView(message: l10n.virtualFieldTripSignIn);

      case ApiErrorKind.forbidden:
        // This tool is plan-gated (withPlanCheck('virtual-field-trip')): a 403
        // means the teacher's plan does not include it. A re-run 403s again, so
        // no retry — the message points at the upgrade path.
        return ErrorView(message: l10n.virtualFieldTripUnavailable);

      case ApiErrorKind.rateLimited:
        return ErrorView(message: l10n.virtualFieldTripLimit, onRetry: onRetry);

      case ApiErrorKind.timeout:
        return ErrorView(
          message: l10n.virtualFieldTripTimeout,
          onRetry: onRetry,
        );

      case ApiErrorKind.server:
        // 503 can carry Retry-After; telling the teacher how long beats a bare
        // "try again". 504 (slow-generation timeout) also lands here.
        final seconds = _retryAfterSeconds(api);
        return ErrorView(
          message: seconds == null
              ? l10n.virtualFieldTripBusy
              : l10n.virtualFieldTripBusyRetryAfter(seconds),
          onRetry: onRetry,
        );

      case ApiErrorKind.badResponse:
        // 400/422: the request could not be served (safety / no candidates). The
        // fix is a different topic, not the same one again — but retry is offered.
        return ErrorView(
          message: l10n.virtualFieldTripRephrase,
          onRetry: onRetry,
        );

      case ApiErrorKind.notFound:
      case ApiErrorKind.cancelled:
      case ApiErrorKind.unknown:
        return ErrorView(message: l10n.errorGeneric, onRetry: onRetry);
    }
  }
}

/// `retryAfterSeconds` from the 503 body, falling back to the `Retry-After`
/// header. Bounded so a nonsense value cannot produce nonsense copy.
int? _retryAfterSeconds(ApiException api) {
  if (api.retryAfterSeconds != null) return _bounded(api.retryAfterSeconds!);

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
