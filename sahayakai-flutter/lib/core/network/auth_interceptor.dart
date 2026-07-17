import 'package:dio/dio.dart';

/// Returns the current bearer token (Firebase ID token), or null when signed
/// out. [forceRefresh] asks for a freshly minted token (used on 401 retry).
///
/// foundation-v1 wires a STUB that always returns null (no Firebase yet).
typedef TokenProvider = Future<String?> Function({bool forceRefresh});

/// Attaches `Authorization: Bearer <token>` to every request and does one
/// forced-refresh retry on a 401. `QueuedInterceptor` serializes concurrent
/// requests through the async token fetch, so N parallel calls trigger exactly
/// one refresh — not N.
///
/// The production middleware verifies the ID token and injects `x-user-id`
/// downstream; it strips any client-set `x-user-*` headers, so we never send
/// those. See ARCHITECTURE.md §4.2.
class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor(this._tokenProvider);

  final TokenProvider _tokenProvider;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _tokenProvider();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    // TODO(P0.2): attach `X-Firebase-AppCheck` (Play Integrity on Android)
    // once App Check is wired — best-effort, tolerated until the server flips
    // APP_CHECK_REQUIRED=true for /api/ai/*.
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final res = err.response;
    final alreadyRetried = err.requestOptions.extra['__retried__'] == true;
    if (res?.statusCode == 401 && !alreadyRetried) {
      // TODO(P0.2): force-refresh the Firebase ID token here. The stub token
      // provider returns null, so no retry happens until auth is wired.
      final fresh = await _tokenProvider(forceRefresh: true);
      if (fresh != null) {
        final opts = err.requestOptions
          ..extra['__retried__'] = true
          ..headers['Authorization'] = 'Bearer $fresh';
        try {
          final retryDio = Dio(BaseOptions(baseUrl: opts.baseUrl));
          final clone = await retryDio.fetch<dynamic>(opts);
          return handler.resolve(clone);
        } catch (_) {
          // fall through to the error mapper
        }
      }
    }
    handler.next(err);
  }
}
