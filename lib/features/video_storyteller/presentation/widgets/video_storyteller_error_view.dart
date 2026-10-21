import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/offline_view.dart';

/// Maps a failed video search to the *right* recovery UI, not a single generic
/// error. The network layer produces the typed [ApiException]; this widget
/// decides whether the teacher should retry, rephrase, wait, or sign in.
///
///   - network                   -> offline card + retry
///   - 401 unauthorized          -> sign-in prompt (no retry; the token is stale)
///   - 429 rate limited          -> "searched a lot, try later" + retry
///   - 503 AI_SERVICE_BUSY / 5xx -> busy message, Retry-After aware, + retry
///   - 504 timeout               -> retryable message + retry
///   - 400 / 422 badResponse     -> "try a different topic" rephrase + retry
///   - any other 4xx / unknown   -> generic retryable message + retry
///
/// Video content is public and personalization degrades gracefully, so this
/// tool has no plan/upgrade or pricing prompt — a browse never gates behind a
/// paywall the way the image tools do.
class VideoStorytellerErrorView extends StatelessWidget {
  const VideoStorytellerErrorView({super.key, required this.error, this.onRetry});

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
        return ErrorView(message: l10n.videoStorytellerSignIn);

      case ApiErrorKind.rateLimited:
        return ErrorView(message: l10n.videoStorytellerLimit, onRetry: onRetry);

      case ApiErrorKind.timeout:
        return ErrorView(message: l10n.videoStorytellerTimeout, onRetry: onRetry);

      case ApiErrorKind.server:
        // 503 can carry Retry-After; telling the teacher how long beats a bare
        // "try again". 504 (slow-curation timeout) also lands here.
        final seconds = _retryAfterSeconds(api);
        return ErrorView(
          message: seconds == null
              ? l10n.videoStorytellerBusy
              : l10n.videoStorytellerBusyRetryAfter(seconds),
          onRetry: onRetry,
        );

      case ApiErrorKind.badResponse:
        // 400/422: the request could not be served (safety / no candidates). The
        // fix is a different topic, not the same search again — but retry is
        // still offered.
        return ErrorView(
          message: l10n.videoStorytellerRephrase,
          onRetry: onRetry,
        );

      case ApiErrorKind.forbidden:
      case ApiErrorKind.notFound:
      case ApiErrorKind.cancelled:
      case ApiErrorKind.unknown:
        return ErrorView(message: l10n.errorGeneric, onRetry: onRetry);
    }
  }
}

/// `retryAfterSeconds` from the 503 body, falling back to the `Retry-After`
/// header. Bounded so a nonsense value cannot produce nonsense copy. (The client
/// only auto-parses this for 429; the server branch reads it here.)
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
