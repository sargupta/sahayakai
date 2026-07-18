import 'package:dio/dio.dart';
import 'package:sahayakai/core/network/api_client.dart';

/// An [ApiClient] that never opens a socket.
///
/// THIS IS NOT CEREMONY. The real client really does open one: the base
/// constructor builds a Dio pointed at `https://sahayakai.com`. A screen under
/// test that fires a request without this fake reaches PRODUCTION from a unit
/// test — which makes the suite depend on the network and on live
/// infrastructure, and has happened here before.
///
/// So [post] throws by default rather than returning a benign empty response: a
/// screen that starts making a request nobody stubbed fails loudly here instead
/// of quietly hitting the real backend.
class FakeApiClient extends ApiClient {
  FakeApiClient({
    this.getResponse,
    this.error,
    this.delay,
    this.postResponse,
    this.postError,
    this.putResponse,
    this.putError,
    this.multipartResponse,
    this.multipartError,
    this.postResponsesByPath,
    this.postErrorsByPath,
    this.getResponsesByPath,
    this.getErrorsByPath,
  });

  /// Per-path POST reply, checked BEFORE the single [postResponse]. Lets one
  /// fake serve a pipeline that posts to several routes (VIDYA: `/api/assistant`
  /// vs `/api/tts` vs `/api/vidya/session`), which a single [postResponse]
  /// cannot. Absent (the default) preserves the existing single-response
  /// behaviour for every current test.
  final Map<String, Object?>? postResponsesByPath;

  /// Per-path POST error, checked BEFORE [postResponsesByPath] — model a 401 on
  /// `/api/assistant` while `/api/tts` still succeeds.
  final Map<String, Object>? postErrorsByPath;

  /// Per-path GET reply, checked BEFORE the single [getResponse]. Lets one fake
  /// serve a restore that GETs several routes (VIDYA: `/api/vidya/session` vs
  /// `/api/vidya/profile`), which a single [getResponse] cannot. Absent (the
  /// default) preserves the existing single-response behaviour.
  final Map<String, Object?>? getResponsesByPath;

  /// Per-path GET error, checked BEFORE [getResponsesByPath] — model a 401 on
  /// the session/profile restore GETs.
  final Map<String, Object>? getErrorsByPath;

  /// The raw JSON [get] hands to its `decode`. `dynamic`, like the real
  /// client's decode contract, so a test can hand it a non-object and prove the
  /// repository copes.
  ///
  /// Mutable, so a test can model the connection coming back between a failed
  /// request and its retry.
  Object? getResponse;

  /// Thrown instead of returning, to model a 401 / 400 / offline. Mutable for
  /// the same reason as [getResponse].
  Object? error;

  /// Holds the request open so a loading state can be observed. Without it the
  /// future completes on the first microtask and the skeleton never renders,
  /// which says nothing about a real request over a rural connection.
  final Duration? delay;

  /// The JSON body a stubbed [post] hands to its `decode`. Null (the default)
  /// keeps the original safety contract: an un-stubbed POST throws loudly
  /// instead of quietly returning, so a screen that fires an unexpected request
  /// fails the test here rather than reaching production.
  Object? postResponse;

  /// Thrown from [post] instead of returning, to model a 202/400/422/401/etc.
  Object? postError;

  /// The JSON body a stubbed [put] hands to its `decode` (e.g. the exam-paper
  /// save reply `{ success: true, contentId }`).
  Object? putResponse;

  /// Thrown from [put] instead of returning, to model a failed save.
  Object? putError;

  /// The JSON body a stubbed [postMultipart] hands to its `decode` (e.g. the
  /// STT reply `{ text, language }`). Null keeps the loud-failure contract.
  Object? multipartResponse;

  /// Thrown from [postMultipart] instead of returning, to model a 401/413/500.
  Object? multipartError;

  /// Every GET this client received, in order, with its query.
  final List<({String path, Map<String, dynamic>? query})> gets =
      <({String path, Map<String, dynamic>? query})>[];

  /// Every PATCH this client received, in order.
  final List<({String path, Object? data})> patches =
      <({String path, Object? data})>[];

  /// Every POST this client received, in order.
  final List<({String path, Object? data})> posts =
      <({String path, Object? data})>[];

  /// Every PUT this client received, in order.
  final List<({String path, Object? data})> puts =
      <({String path, Object? data})>[];

  /// Every multipart POST this client received, in order, with its `FormData`
  /// (so a test can assert on the audio file's filename/contentType + fields).
  final List<({String path, FormData data})> multiparts =
      <({String path, FormData data})>[];

  @override
  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? query,
    required T Function(dynamic json) decode,
  }) async {
    gets.add((path: path, query: query));
    if (delay != null) await Future<void>.delayed(delay!);
    // Per-path stubs win, so one fake can drive a multi-route restore.
    final pathError = getErrorsByPath?[path];
    if (pathError != null) throw pathError;
    if (getResponsesByPath != null && getResponsesByPath!.containsKey(path)) {
      return decode(getResponsesByPath![path]);
    }
    if (error != null) throw error!;
    return decode(getResponse);
  }

  @override
  Future<T> patch<T>(
    String path, {
    Object? data,
    required T Function(Map<String, dynamic> json) decode,
  }) async {
    patches.add((path: path, data: data));
    if (error != null) throw error!;
    // `PATCH /api/user/profile` replies `{ success: true }`; callers decode
    // nothing from it.
    return decode(const <String, dynamic>{});
  }

  @override
  Future<T> post<T>(
    String path, {
    Object? data,
    required T Function(Map<String, dynamic> json) decode,
  }) async {
    posts.add((path: path, data: data));
    if (delay != null) await Future<void>.delayed(delay!);
    // Per-path stubs win, so one fake can drive a multi-route pipeline.
    final pathError = postErrorsByPath?[path];
    if (pathError != null) throw pathError;
    if (postResponsesByPath != null && postResponsesByPath!.containsKey(path)) {
      final byPath = postResponsesByPath![path];
      return decode((byPath as Map?)?.cast<String, dynamic>() ?? const {});
    }
    if (postError != null) throw postError!;
    final stub = postResponse;
    if (stub != null) return decode((stub as Map).cast<String, dynamic>());
    // Un-stubbed POST still fails loudly (the original safety contract): a
    // screen that fires an unexpected request must never reach production from
    // a unit test.
    throw StateError(
      'POST $path escaped the fake. Tests must never reach the network: '
      'stub postResponse / postError before asserting on it.',
    );
  }

  @override
  Future<T> put<T>(
    String path, {
    Object? data,
    required T Function(Map<String, dynamic> json) decode,
  }) async {
    puts.add((path: path, data: data));
    if (delay != null) await Future<void>.delayed(delay!);
    if (putError != null) throw putError!;
    final stub = putResponse;
    if (stub != null) return decode((stub as Map).cast<String, dynamic>());
    throw StateError(
      'PUT $path escaped the fake. Tests must never reach the network: '
      'stub putResponse / putError before asserting on it.',
    );
  }

  @override
  Future<T> postMultipart<T>(
    String path, {
    required FormData data,
    required T Function(Map<String, dynamic> json) decode,
  }) async {
    multiparts.add((path: path, data: data));
    if (delay != null) await Future<void>.delayed(delay!);
    if (multipartError != null) throw multipartError!;
    final stub = multipartResponse;
    if (stub != null) return decode((stub as Map).cast<String, dynamic>());
    throw StateError(
      'postMultipart $path escaped the fake. Tests must never reach the '
      'network: stub multipartResponse / multipartError before asserting.',
    );
  }
}
