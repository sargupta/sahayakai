import 'dart:async';

import 'package:dio/dio.dart';

/// Returns the current bearer token (Firebase ID token), or null when signed
/// out. [forceRefresh] asks for a freshly minted token (used on 401 retry).
///
/// foundation-v1 wires a STUB that always returns null (no Firebase yet).
typedef TokenProvider = Future<String?> Function({bool forceRefresh});

/// Returns a Firebase App Check attestation token for the
/// `X-Firebase-AppCheck` header, or null when there is none to be had.
///
/// Same seam shape as [TokenProvider] — a plain function injected from a
/// Riverpod provider (`appCheckTokenProvider`, core/network/api_providers.dart)
/// — so tests fake it and no test ever reaches the Play Integrity API.
///
/// **This provider is allowed to fail.** [AuthInterceptor] treats a throw, a
/// null, and a timeout identically: send the request without the header. See
/// [kAppCheckTimeout].
typedef AppCheckTokenProvider = Future<String?> Function();

/// Ceiling on how long a request waits for an App Check token before giving up
/// and going out unattested.
///
/// Three seconds, deliberately short. The teachers this app is for are on 2G in
/// rural schools, and a Play Integrity attestation is a network round trip that
/// can hang there. Blocking a teacher's lesson plan because an attestation
/// handshake stalled is a far worse outcome than a missing header on a request
/// the server does not currently require one for.
const Duration kAppCheckTimeout = Duration(seconds: 3);

/// Attaches `Authorization: Bearer <token>` to every request and does one
/// forced-refresh retry on a 401. `QueuedInterceptor` serializes concurrent
/// requests through the async token fetch, so N parallel calls trigger exactly
/// one refresh — not N.
///
/// The production middleware verifies the ID token and injects `x-user-id`
/// downstream; it strips any client-set `x-user-*` headers, so we never send
/// those. See ARCHITECTURE.md §4.2.
///
/// It also attaches `X-Firebase-AppCheck` when an [AppCheckTokenProvider] is
/// wired and hands one over in time — **best effort, never a gate**. The header
/// is what the middleware hard-requires on `/api/ai/*` once the server sets
/// `APP_CHECK_REQUIRED=true`; shipping it before that flip is the whole point,
/// so attestation is already flowing when the founder registers Play Integrity.
/// Until then, a request without it is a request the server still accepts, and
/// a request that never leaves is a teacher who cannot work.
class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor(
    this._tokenProvider, {
    AppCheckTokenProvider? appCheckTokenProvider,
    Duration appCheckTimeout = kAppCheckTimeout,
  }) : _appCheckTokenProvider = appCheckTokenProvider,
       _appCheckTimeout = appCheckTimeout;

  final TokenProvider _tokenProvider;

  /// Null when App Check is not wired (widget tests, and any build where
  /// `Firebase.initializeApp()` did not complete). Null means: no header, same
  /// as a provider that fails.
  final AppCheckTokenProvider? _appCheckTokenProvider;

  /// Injectable so tests can prove the timeout path in milliseconds instead of
  /// sleeping for the real [kAppCheckTimeout]. Production never passes it.
  final Duration _appCheckTimeout;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _tokenProvider();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    final appCheckToken = await _appCheckToken();
    if (appCheckToken != null) {
      options.headers['X-Firebase-AppCheck'] = appCheckToken;
    }
    handler.next(options);
  }

  /// Fetches an attestation token, or returns null for ANY reason it could not:
  /// no provider wired, the provider threw (Play Integrity unavailable, no
  /// Play services, a device Google cannot attest), it returned null, or it
  /// took longer than [_appCheckTimeout].
  ///
  /// The blanket `catch` is load-bearing, not lazy: every failure mode here has
  /// exactly one correct response — proceed unattested. Letting anything escape
  /// would abort `onRequest` and fail the teacher's request, which is the one
  /// outcome this whole path exists to prevent.
  Future<String?> _appCheckToken() async {
    final provider = _appCheckTokenProvider;
    if (provider == null) return null;
    try {
      return await provider().timeout(_appCheckTimeout);
    } catch (_) {
      return null;
    }
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
