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
  FakeApiClient({this.getResponse, this.error, this.delay});

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

  /// Every GET this client received, in order, with its query.
  final List<({String path, Map<String, dynamic>? query})> gets =
      <({String path, Map<String, dynamic>? query})>[];

  /// Every PATCH this client received, in order.
  final List<({String path, Object? data})> patches =
      <({String path, Object? data})>[];

  @override
  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? query,
    required T Function(dynamic json) decode,
  }) async {
    gets.add((path: path, query: query));
    if (delay != null) await Future<void>.delayed(delay!);
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
  }) {
    throw StateError(
      'POST $path escaped the fake. Tests must never reach the network: '
      'stub this call before asserting on it.',
    );
  }
}
