import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_config.dart';
import 'error_mapping_interceptor.dart';
import 'retry_interceptor.dart';

/// Provides a singleton ApiClient via Riverpod.
final apiClientProvider = Provider((ref) => ApiClient());

/// HTTP client with automatic Firebase JWT injection and 401 retry.
///
/// Uses [FirebaseAuth.instance] directly for token access to avoid
/// circular dependency with AuthRepository.
class ApiClient {
  late final Dio _dio;

  ApiClient() {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConfig.baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30), // AI endpoints can be slow
        headers: {
          'Accept': 'application/json',
          // Content-Type intentionally NOT set here — it's set per-request
          // so that FormData (multipart) requests work correctly.
        },
      ),
    );

    // 1. Auth token injection + 401 refresh (runs first).
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: _onRequest,
        onError: _onAuthError,
      ),
    );

    // 2. Retry on 5xx / network failures (exponential backoff, max 2 retries).
    _dio.interceptors.add(RetryInterceptor(dio: _dio));

    // 3. Map final DioExceptions to typed AppExceptions (runs last).
    _dio.interceptors.add(ErrorMappingInterceptor());
  }

  Dio get client => _dio;

  /// Injects Firebase ID token and Content-Type header.
  Future<void> _onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Set Content-Type only for non-FormData requests.
    // FormData sets its own multipart/form-data boundary.
    if (options.data is! FormData) {
      options.headers['Content-Type'] = 'application/json';
    }

    // Inject Firebase ID token.
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        final token = await user.getIdToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
      }
    } catch (_) {
      // If token fetch fails, proceed without — middleware will reject if needed.
    }

    return handler.next(options);
  }

  /// Handles 401: force-refresh Firebase token and retry once.
  ///
  /// All other errors pass through to [RetryInterceptor] and then
  /// [ErrorMappingInterceptor].
  Future<void> _onAuthError(
    DioException e,
    ErrorInterceptorHandler handler,
  ) async {
    if (e.response?.statusCode == 401) {
      try {
        final user = FirebaseAuth.instance.currentUser;
        if (user != null) {
          final freshToken = await user.getIdToken(true); // forceRefresh
          if (freshToken != null) {
            final retryOptions = e.requestOptions;
            retryOptions.headers['Authorization'] = 'Bearer $freshToken';
            // Use a fresh Dio instance so we don't hit our own interceptor again.
            final retryResponse = await Dio().fetch(retryOptions);
            return handler.resolve(retryResponse);
          }
        }
      } catch (_) {
        // Refresh or retry failed — fall through to downstream interceptors.
      }
    }

    return handler.next(e);
  }
}
