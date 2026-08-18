import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/auth_interceptor.dart';

/// A `Dio` transport that answers every request from memory and keeps the
/// [RequestOptions] it was handed.
///
/// THIS IS NOT CEREMONY — the same reason `FakeApiClient` exists. Without an
/// adapter, exercising an interceptor means letting Dio open a real socket, and
/// the base URL of this app's client is `https://sahayakai.com`. A test that
/// asserts on a header would be reaching production to do it. Here the request
/// stops at [requests] and the assertions read what the interceptor built.
class _RecordingAdapter implements HttpClientAdapter {
  final List<RequestOptions> requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      '{"ok":true}',
      200,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>[Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

/// Signed in, so every case below also proves App Check behaviour never costs
/// the bearer token.
Future<String?> _signedIn({bool forceRefresh = false}) async => 'id-token';

/// Builds a Dio wired exactly the way `ApiClient` wires one — the interceptor
/// under test, on a transport that cannot leave the machine.
({Dio dio, _RecordingAdapter adapter}) _harness({
  AppCheckTokenProvider? appCheckTokenProvider,
  Duration appCheckTimeout = kAppCheckTimeout,
  TokenProvider tokenProvider = _signedIn,
}) {
  final adapter = _RecordingAdapter();
  final dio = Dio(BaseOptions(baseUrl: 'https://sahayakai.test'))
    ..httpClientAdapter = adapter
    ..interceptors.add(
      AuthInterceptor(
        tokenProvider,
        appCheckTokenProvider: appCheckTokenProvider,
        appCheckTimeout: appCheckTimeout,
      ),
    );
  return (dio: dio, adapter: adapter);
}

void main() {
  group('X-Firebase-AppCheck — attachment', () {
    test('attaches the token when the provider resolves', () async {
      final h = _harness(appCheckTokenProvider: () async => 'attestation-abc');

      final res = await h.dio.post<dynamic>('/api/ai/lesson-plan');

      expect(res.statusCode, 200);
      expect(
        h.adapter.requests.single.headers['X-Firebase-AppCheck'],
        'attestation-abc',
      );
      expect(
        h.adapter.requests.single.headers['Authorization'],
        'Bearer id-token',
      );
    });

    test('omits the header when no provider is wired at all', () async {
      // The default `ApiClient()` construction, and every test double built on
      // it: App Check absent must not mean App Check broken.
      final h = _harness();

      await h.dio.post<dynamic>('/api/ai/lesson-plan');

      expect(
        h.adapter.requests.single.headers.containsKey('X-Firebase-AppCheck'),
        isFalse,
      );
    });

    test('omits the header when the provider resolves null', () async {
      // What the real provider returns before `Firebase.initializeApp()` has
      // completed (FirebaseInit.isConfigured == false).
      final h = _harness(appCheckTokenProvider: () async => null);

      await h.dio.post<dynamic>('/api/ai/lesson-plan');

      expect(
        h.adapter.requests.single.headers.containsKey('X-Firebase-AppCheck'),
        isFalse,
      );
    });
  });

  group('X-Firebase-AppCheck — best effort, never a gate', () {
    // The rule this whole group defends: the teachers on the other end of this
    // client are on 2G in rural schools. A Play Integrity handshake that fails
    // or hangs must cost them a header, never their request.

    test('the request still goes out, unchanged, when the provider throws',
        () async {
      final h = _harness(
        appCheckTokenProvider: () async =>
            throw StateError('Play Integrity unavailable'),
      );

      final res = await h.dio.post<dynamic>(
        '/api/ai/lesson-plan',
        data: <String, String>{'topic': 'photosynthesis'},
      );

      // It went out, it succeeded, and nothing about it changed except the
      // header that could not be produced.
      expect(res.statusCode, 200);
      final sent = h.adapter.requests.single;
      expect(sent.path, '/api/ai/lesson-plan');
      expect(sent.method, 'POST');
      expect(sent.data, <String, String>{'topic': 'photosynthesis'});
      expect(sent.headers['Authorization'], 'Bearer id-token');
      expect(sent.headers.containsKey('X-Firebase-AppCheck'), isFalse);
    });

    test('the request still goes out when the provider never completes',
        () async {
      // A hung attestation call — the 2G case. The timeout is injected short so
      // the suite does not sleep for the real ceiling; that the production
      // ceiling IS 3s is asserted separately below.
      final h = _harness(
        appCheckTokenProvider: () => Completer<String?>().future,
        appCheckTimeout: const Duration(milliseconds: 50),
      );

      final stopwatch = Stopwatch()..start();
      final res = await h.dio.post<dynamic>('/api/ai/lesson-plan');
      stopwatch.stop();

      expect(res.statusCode, 200);
      expect(
        h.adapter.requests.single.headers.containsKey('X-Firebase-AppCheck'),
        isFalse,
      );
      // Bounded by the timeout, not by the provider — a regression that awaited
      // the provider without `.timeout` would hang here forever.
      expect(stopwatch.elapsed, lessThan(const Duration(seconds: 2)));
    });

    test('a failed attestation does not poison the next request', () async {
      // AuthInterceptor is a QueuedInterceptor: requests are serialized through
      // this async work. A throw that escaped `_appCheckToken` would not just
      // fail one request, it would leave the queue behind it broken.
      var call = 0;
      final h = _harness(
        appCheckTokenProvider: () async {
          call++;
          if (call == 1) throw StateError('first attestation failed');
          return 'attestation-$call';
        },
      );

      await h.dio.post<dynamic>('/api/ai/first');
      await h.dio.post<dynamic>('/api/ai/second');

      expect(h.adapter.requests, hasLength(2));
      expect(
        h.adapter.requests[0].headers.containsKey('X-Firebase-AppCheck'),
        isFalse,
      );
      expect(
        h.adapter.requests[1].headers['X-Firebase-AppCheck'],
        'attestation-2',
      );
    });

    test('the production timeout ceiling is 3 seconds', () {
      // The tests above inject a short timeout; this is the one assertion that
      // pins what a real build actually waits before giving up.
      expect(kAppCheckTimeout, const Duration(seconds: 3));
    });
  });
}
