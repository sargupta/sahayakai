import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// Dio interceptor that retries requests on 5xx errors and network failures.
///
/// - Max [maxRetries] attempts (default 2) with exponential backoff.
/// - Retries on 5xx status codes (500, 502, 503, 504).
/// - Retries on connection timeout, receive timeout, and connection errors.
/// - Does NOT retry on 4xx client errors.
class RetryInterceptor extends Interceptor {
  RetryInterceptor({
    required this.dio,
    this.maxRetries = 2,
    this.baseDelay = const Duration(seconds: 1),
  });

  final Dio dio;
  final int maxRetries;
  final Duration baseDelay;

  static const _retryCountKey = 'retry_count';
  static const _retryable5xx = {500, 502, 503, 504};

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final retryCount = err.requestOptions.extra[_retryCountKey] as int? ?? 0;

    if (retryCount >= maxRetries || !_shouldRetry(err)) {
      return handler.next(err);
    }

    final nextRetry = retryCount + 1;
    final delay = baseDelay * (1 << retryCount); // 1s, 2s, 4s …

    debugPrint(
      '[RetryInterceptor] Retry $nextRetry/$maxRetries '
      'after ${delay.inMilliseconds}ms — '
      '${_reason(err)}',
    );

    await Future<void>.delayed(delay);

    // Clone the request with an incremented retry counter.
    final options = err.requestOptions;
    options.extra[_retryCountKey] = nextRetry;

    try {
      final response = await dio.fetch(options);
      return handler.resolve(response);
    } on DioException catch (e) {
      // Let downstream interceptors (including this one on the next pass)
      // handle the new error.
      return handler.next(e);
    }
  }

  /// Returns `true` if the error is retryable.
  bool _shouldRetry(DioException err) {
    // 5xx server errors
    final statusCode = err.response?.statusCode;
    if (statusCode != null && _retryable5xx.contains(statusCode)) {
      return true;
    }

    // Network / timeout errors
    switch (err.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.connectionError:
        return true;
      default:
        return false;
    }
  }

  String _reason(DioException err) {
    final status = err.response?.statusCode;
    if (status != null) return 'HTTP $status';
    return err.type.name;
  }
}
