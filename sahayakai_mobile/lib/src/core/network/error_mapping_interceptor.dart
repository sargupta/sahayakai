import 'package:dio/dio.dart';

import '../error/app_exceptions.dart';

/// Dio interceptor that converts [DioException] into typed [AppException]s.
///
/// Added AFTER [RetryInterceptor] so that only final (non-retried) errors
/// are mapped. Downstream consumers can catch [AppException] subtypes
/// instead of inspecting raw Dio errors.
class ErrorMappingInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final appException = _mapToAppException(err);

    // Wrap the AppException inside DioException.error so callers can extract
    // it via `(dioError.error as AppException)`.
    handler.next(
      DioException(
        requestOptions: err.requestOptions,
        response: err.response,
        type: err.type,
        error: appException,
      ),
    );
  }

  AppException _mapToAppException(DioException err) {
    // --- Network / timeout (no response) ---
    switch (err.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return const TimeoutException();
      case DioExceptionType.connectionError:
        return const NetworkException();
      default:
        break;
    }

    // --- HTTP status-based mapping ---
    final statusCode = err.response?.statusCode;
    if (statusCode == null) {
      // Unknown / no-response error (e.g. cancelled, bad certificate).
      return const NetworkException();
    }

    final serverMessage = _extractMessage(err);

    return switch (statusCode) {
      401 => const AuthException(),
      403 || 429 => PlanLimitException(message: serverMessage),
      404 => const NotFoundException(),
      400 || 422 => ValidationException(message: serverMessage),
      >= 500 => ServerException(statusCode, serverMessage),
      _ => ServerException(statusCode, serverMessage),
    };
  }

  /// Attempts to pull a human-readable message from the response body.
  String _extractMessage(DioException err) {
    final data = err.response?.data;
    if (data is Map) {
      final msg = data['error'] ?? data['message'] ?? data['detail'];
      if (msg != null) return msg.toString();
    }
    return 'Something went wrong. Please try again.';
  }
}
