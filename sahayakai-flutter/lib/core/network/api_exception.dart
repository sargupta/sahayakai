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
  const ApiException(
    this.kind,
    this.message, {
    this.statusCode,
    this.errorCode,
    this.retryAfterSeconds,
    this.raw,
  });

  final ApiErrorKind kind;
  final String message; // user-safe text or a localizable key
  final int? statusCode;

  /// The backend's machine-readable `error` code from the body (e.g.
  /// `PLAN_UPGRADE_REQUIRED`, `exam_paper_unstructured`,
  /// `generation_in_progress`). Distinct from [message], which is the
  /// human/user-safe line. Lets a screen branch on WHY a 4xx came back — the
  /// exam-paper screen needs 422 `exam_paper_unstructured` to read as
  /// "try fewer chapters", not a generic failure. Null when the body carried
  /// no `error` string (network/timeout/parse failures).
  final String? errorCode;

  /// The retry cool-down, in seconds, parsed from a rate-limited (429)
  /// response. The attendance-outreach route returns a structured
  /// `{ error, retryAfterSeconds }` body **and** a `Retry-After` header for its
  /// 5-minute per-(teacher,student) dedup window; this field decodes that
  /// number (body `retryAfterSeconds` first, then the header) so a caller can
  /// render an exact countdown instead of a generic "try later". Null for any
  /// non-429 error or a 429 that carried no retry hint.
  final int? retryAfterSeconds;
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
        final errorCode = _extractErrorCode(e.response?.data);
        return switch (code) {
          401 => ApiException(ApiErrorKind.unauthorized, 'Please sign in again.',
              statusCode: 401, errorCode: errorCode, raw: e),
          403 => ApiException(
              ApiErrorKind.forbidden,
              serverMsg ?? 'You do not have access to this.',
              statusCode: 403,
              errorCode: errorCode,
              raw: e,
            ),
          404 => ApiException(ApiErrorKind.notFound, 'Not found.',
              statusCode: 404, errorCode: errorCode, raw: e),
          429 => ApiException(
              ApiErrorKind.rateLimited,
              serverMsg ?? 'You have reached your usage limit.',
              statusCode: 429,
              errorCode: errorCode,
              retryAfterSeconds: _extractRetryAfter(e.response),
              raw: e,
            ),
          _ when code >= 500 => ApiException(
              ApiErrorKind.server,
              'Something went wrong on our side.',
              statusCode: code,
              errorCode: errorCode,
              raw: e,
            ),
          _ => ApiException(
              ApiErrorKind.badResponse,
              serverMsg ?? 'Unexpected response.',
              statusCode: code,
              errorCode: errorCode,
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

  /// The body's machine-readable `error` code (same field `_extractMessage`
  /// reads), kept separate so a caller can branch on it without coupling to the
  /// user-facing [message]. A JSON parse failure or a non-object body yields
  /// null.
  static String? _extractErrorCode(dynamic data) {
    if (data is Map && data['error'] is String) return data['error'] as String;
    return null;
  }

  /// Parses the retry cool-down from a 429 response. Prefers the structured
  /// body field `retryAfterSeconds` (a `number` server-side — tolerated as
  /// `int`, `num`, or a numeric string) and falls back to the standard
  /// `Retry-After` header. Returns null when neither is present or parseable.
  static int? _extractRetryAfter(Response<dynamic>? response) {
    final data = response?.data;
    if (data is Map) {
      final v = data['retryAfterSeconds'];
      if (v is int) return v;
      if (v is num) return v.ceil();
      if (v is String) {
        final parsed = num.tryParse(v);
        if (parsed != null) return parsed.ceil();
      }
    }
    final header = response?.headers.value('retry-after');
    if (header != null) {
      final parsed = num.tryParse(header.trim());
      if (parsed != null) return parsed.ceil();
    }
    return null;
  }

  @override
  String toString() => 'ApiException($kind, $statusCode): $message';
}
