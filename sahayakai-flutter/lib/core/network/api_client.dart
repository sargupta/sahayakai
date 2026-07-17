import 'package:dio/dio.dart';

import 'api_exception.dart';
import 'auth_interceptor.dart';
import 'dio_config.dart';

/// The single configured `Dio` instance. UI never calls dio directly:
/// presentation -> controller -> repository -> [ApiClient].
class ApiClient {
  ApiClient({TokenProvider? tokenProvider})
      : _dio = Dio(
          BaseOptions(
            baseUrl: kApiBaseUrl,
            connectTimeout: kConnectTimeout,
            receiveTimeout: kReceiveTimeout,
            sendTimeout: kSendTimeout,
            responseType: ResponseType.json,
            headers: const {'Content-Type': 'application/json'},
            validateStatus: (s) => s != null && s < 400,
          ),
        ) {
    _dio.interceptors.add(AuthInterceptor(tokenProvider ?? _noToken));
    assert(() {
      _dio.interceptors
          .add(LogInterceptor(requestBody: true, responseBody: true));
      return true;
    }());
  }

  final Dio _dio;

  /// Stub token source for foundation-v1 (always signed-out).
  static Future<String?> _noToken({bool forceRefresh = false}) async => null;

  Future<T> post<T>(
    String path, {
    Object? data,
    required T Function(Map<String, dynamic> json) decode,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(path, data: data);
      return decode(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// Partial update. Mirrors [post] exactly (same decode contract, same typed
  /// `ApiException` mapping); the profile endpoint uses PATCH semantics because
  /// it writes only the keys it receives.
  Future<T> patch<T>(
    String path, {
    Object? data,
    required T Function(Map<String, dynamic> json) decode,
  }) async {
    try {
      final res = await _dio.patch<Map<String, dynamic>>(path, data: data);
      return decode(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// Full-object write. Mirrors [post] exactly (same decode contract, same
  /// typed `ApiException` mapping). The exam-paper save endpoint uses PUT to
  /// persist a previously generated paper to the user's library.
  Future<T> put<T>(
    String path, {
    Object? data,
    required T Function(Map<String, dynamic> json) decode,
  }) async {
    try {
      final res = await _dio.put<Map<String, dynamic>>(path, data: data);
      return decode(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? query,
    required T Function(dynamic json) decode,
  }) async {
    try {
      final res = await _dio.get<dynamic>(path, queryParameters: query);
      return decode(res.data);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
