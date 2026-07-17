import 'package:dio/dio.dart';

/// Typed error kinds the UI can branch on (401 -> re-auth, 429 -> pricing…).
enum ApiErrorKind {
  network,
  timeout,
  unauthorized,
  forbidden,
  notFound,
  rateLimited,
  server,
  badResponse,
  cancelled,
  unknown,
}

/// A user-safe, typed exception mapped from a [DioException]. The backend
/// returns errors as `{ "error": "..." }`; that message is surfaced for
/// 403/429/4xx where it is meant for the user.
class ApiException implements Exception {
  const ApiException(this.kind, this.message, {this.statusCode, this.raw});

  final ApiErrorKind kind;
  final String message; // user-safe text or a localizable key
  final int? statusCode;
  final Object? raw;

  bool get isAuth => kind == ApiErrorKind.unauthorized;

  factory ApiException.fromDio(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return ApiException(
          ApiErrorKind.timeout,
          'The request took too long. Please try again.',
          raw: e,
        );
      case DioExceptionType.connectionError:
        return ApiException(ApiErrorKind.network, 'No internet connection.',
            raw: e);
      case DioExceptionType.cancel:
        return const ApiException(ApiErrorKind.cancelled, 'Cancelled.');
      case DioExceptionType.badResponse:
        final code = e.response?.statusCode ?? 0;
        final serverMsg = _extractMessage(e.response?.data);
        return switch (code) {
          401 => ApiException(ApiErrorKind.unauthorized, 'Please sign in again.',
              statusCode: 401, raw: e),
          403 => ApiException(
              ApiErrorKind.forbidden,
              serverMsg ?? 'You do not have access to this.',
              statusCode: 403,
              raw: e,
            ),
          404 => ApiException(ApiErrorKind.notFound, 'Not found.',
              statusCode: 404, raw: e),
          429 => ApiException(
              ApiErrorKind.rateLimited,
              serverMsg ?? 'You have reached your usage limit.',
              statusCode: 429,
              raw: e,
            ),
          _ when code >= 500 => ApiException(
              ApiErrorKind.server,
              'Something went wrong on our side.',
              statusCode: code,
              raw: e,
            ),
          _ => ApiException(
              ApiErrorKind.badResponse,
              serverMsg ?? 'Unexpected response.',
              statusCode: code,
              raw: e,
            ),
        };
      case DioExceptionType.badCertificate:
        return ApiException(ApiErrorKind.network, 'Secure connection failed.',
            raw: e);
      case DioExceptionType.unknown:
        return ApiException(ApiErrorKind.unknown, e.message ?? 'Unknown error.',
            raw: e);
    }
  }

  static String? _extractMessage(dynamic data) {
    if (data is Map && data['error'] is String) return data['error'] as String;
    return null;
  }

  @override
  String toString() => 'ApiException($kind, $statusCode): $message';
}
