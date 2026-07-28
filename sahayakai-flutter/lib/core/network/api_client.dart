import 'dart:typed_data';

import 'package:dio/dio.dart';

import 'api_exception.dart';
import 'auth_interceptor.dart';
import 'dio_config.dart';

/// A raw (non-JSON-assumed) HTTP response: the response bytes plus the
/// `Content-Type` header. Some endpoints hand back a different BODY SHAPE
/// under the same 200 depending on server-side branching — `POST
/// /api/export` is the first: an individual teacher's export returns the
/// actual ZIP archive (`application/zip`) inline, but a large or school-wide
/// export returns a small JSON status body instead. [ApiClient.post] cannot
/// model that (it always JSON-decodes), so [ApiClient.postRaw] hands the
/// caller the bytes + content type and lets it decide.
class RawResponse {
  const RawResponse({
    required this.bytes,
    required this.contentType,
    this.filename,
  });

  final Uint8List bytes;
  final String? contentType;

  /// The `filename` parameter out of a `Content-Disposition: attachment;
  /// filename="..."` header, when the server sent one (the export ZIP always
  /// does). Null for a JSON body, which carries no such header.
  final String? filename;
}

/// Pulls `filename="..."` (or an unquoted `filename=...`) out of a
/// `Content-Disposition` header value. Returns null for anything else —
/// callers must supply their own fallback name.
String? _filenameFromContentDisposition(String? header) {
  if (header == null) return null;
  final match = RegExp(r'filename\*?=("?)([^";]+)\1').firstMatch(header);
  return match?.group(2)?.trim();
}

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

  /// POST that returns raw bytes instead of an assumed JSON body — see
  /// [RawResponse]. `responseType: bytes` makes Dio hand back the body
  /// untouched (no JSON parse attempt) whether the server actually sent a
  /// binary payload or a small JSON status object; the caller inspects
  /// [RawResponse.contentType] to know which one it got.
  Future<RawResponse> postRaw(String path, {Object? data}) async {
    try {
      final res = await _dio.post<List<int>>(
        path,
        data: data,
        options: Options(responseType: ResponseType.bytes),
      );
      return RawResponse(
        bytes: Uint8List.fromList(res.data ?? const <int>[]),
        contentType: res.headers.value('content-type'),
        filename: _filenameFromContentDisposition(
          res.headers.value('content-disposition'),
        ),
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// Multipart upload — the STT audio POST (`/api/ai/voice-to-text`). Separate
  /// from [post] because the body is a `FormData` (an audio file + text
  /// fields), not JSON: Dio must send `multipart/form-data` with its own
  /// boundary, overriding the client's default `application/json` content type.
  /// Same typed [ApiException] mapping as every other verb.
  Future<T> postMultipart<T>(
    String path, {
    required FormData data,
    required T Function(Map<String, dynamic> json) decode,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        path,
        data: data,
        options: Options(contentType: 'multipart/form-data'),
      );
      return decode(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
