import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/vidya/data/dto/vidya_action.dart';
import 'package:sahayakai/features/vidya/data/gemini_live_client.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../../../support/fake_api_client.dart';

/// Pins the VIDYA Live WIRE FORMAT and — more importantly — the FALLBACK
/// CONTRACT.
///
/// The client talks to the sidecar's Vertex Live proxy: `{"audio": …}` up,
/// `{"audio"|"toolCall"|"turnComplete"|"interrupted"|"error"}` down. The real
/// audio round-trip is only provable on-device, but the exact frames the client
/// emits and how it decodes what it receives ARE verifiable here.
///
/// The fallback contract is the higher-consequence half: `connect()` must return
/// false and NEVER throw for every failure shape, because a throw escapes
/// `_beginLive()` and the teacher is left with no voice at all — neither Live
/// nor the turn-based STT -> classifier -> TTS pipeline. Each failure shape gets
/// its own test below.
const String _startPath = '/api/vidya-voice/start-session';

/// The shape the web route returns today (`mode: "vertex-proxy"`).
Map<String, dynamic> _proxyJson({
  String mode = 'vertex-proxy',
  String? wsUrl = 'wss://agents.example.com/v1/vidya-voice/stream',
  String? streamToken = 'uid.9999999999.sig',
  String languageCode = 'bn',
}) => {
  'mode': mode,
  'wsUrl': ?wsUrl,
  'streamToken': ?streamToken,
  'expiresInSeconds': 120,
  'languageCode': languageCode,
};

/// The OLD Developer-API shape. Kept under test because a rolled-back deploy or
/// a stale Cloud Run revision can still serve it, and because it is the only
/// rollback target if Vertex Live has an outage.
Map<String, dynamic> _legacyJson({
  String token = 'ephemeral-abc',
  String wss = 'wss://generativelanguage.googleapis.com/ws/x',
  String model = 'gemini-2.0-flash-live-001',
  String voice = 'Aoede',
}) => {
  'sessionToken': token,
  'wssUrl': wss,
  'expiresInSeconds': 60,
  'sessionConfig': {
    'model': model,
    'voice': voice,
    'responseModalities': ['AUDIO'],
    'languageCode': 'bn-IN',
  },
  'tools': [
    {
      'name': 'lesson-plan',
      'description': 'Draft a lesson plan',
      'flow': 'lesson-plan',
    },
    {
      'name': 'quiz-generator',
      'description': 'Make a quiz',
      'flow': 'quiz-generator',
    },
  ],
  'sidecarVersion': 'phase-s.0.0-spike',
};

/// A single-subscription inbound stream + a sink that captures every JSON frame
/// the client sends, so a test can push server frames in and assert what went
/// out. `ready` completes immediately unless a test supplies a failing future.
class _FakeWebSocketSink implements WebSocketSink {
  final List<String> sent = [];
  @override
  void add(Object? data) => sent.add(data as String);
  @override
  Future<void> close([int? closeCode, String? closeReason]) async {}
  @override
  void addError(Object error, [StackTrace? stackTrace]) {}
  @override
  Future<void> addStream(Stream<Object?> stream) async {}
  @override
  Future<void> get done => Future.value();
}

class _FakeWebSocketChannel implements WebSocketChannel {
  _FakeWebSocketChannel(this._inbound, {Future<void>? ready})
    : _ready = ready ?? Future<void>.value();

  final Stream<dynamic> _inbound;
  final Future<void> _ready;
  // A test double, not a real sink: _FakeWebSocketSink holds a list and has no
  // resource to release. The rule stays on so a real unclosed sink in app code
  // is still caught.
  // ignore: close_sinks
  final _FakeWebSocketSink _sink = _FakeWebSocketSink();

  @override
  Stream<dynamic> get stream => _inbound;
  @override
  WebSocketSink get sink => _sink;
  @override
  Future<void> get ready => _ready;

  // Everything else on the WebSocketChannel surface is unused by the client.
  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

/// Decoded frames the sink captured, newest-last.
List<Map<String, dynamic>> _sentFrames(_FakeWebSocketChannel ch) => [
  for (final s in ch._sink.sent) (jsonDecode(s) as Map).cast<String, dynamic>(),
];

void main() {
  group('start-session parse (dual shape)', () {
    test('the proxy shape parses and is usable', () {
      final s = LiveStartSession.fromJson(_proxyJson());
      expect(s.mode, LiveTransportMode.vertexProxy);
      expect(s.wsUrl, 'wss://agents.example.com/v1/vidya-voice/stream');
      expect(s.streamToken, 'uid.9999999999.sig');
      expect(s.languageCode, 'bn');
      expect(s.expiresInSeconds, 120);
      expect(s.isUsable, isTrue);
    });

    test('the legacy Developer-API shape still parses and is usable', () {
      final s = LiveStartSession.fromJson(_legacyJson());
      expect(s.mode, LiveTransportMode.developerApi);
      expect(s.sessionToken, 'ephemeral-abc');
      expect(s.wssUrl, startsWith('wss://'));
      expect(s.sessionConfig?.model, 'gemini-2.0-flash-live-001');
      expect(s.sessionConfig?.voice, 'Aoede');
      expect(s.tools, hasLength(2));
      expect(s.isUsable, isTrue);
    });

    test('a body carrying BOTH shapes prefers the proxy (funded) path', () {
      final s = LiveStartSession.fromJson({..._legacyJson(), ..._proxyJson()});
      expect(s.mode, LiveTransportMode.vertexProxy);
      expect(s.isUsable, isTrue);
    });

    test('a mode-less body with only proxy fields infers the proxy', () {
      final json = _proxyJson()..remove('mode');
      final s = LiveStartSession.fromJson(json);
      expect(s.mode, LiveTransportMode.vertexProxy);
      expect(s.isUsable, isTrue);
    });

    test('missing wsUrl / streamToken / an unknown mode are all unusable', () {
      expect(
        LiveStartSession.fromJson(_proxyJson(wsUrl: null)).isUsable,
        isFalse,
      );
      expect(
        LiveStartSession.fromJson(_proxyJson(streamToken: null)).isUsable,
        isFalse,
      );
      final unknown = LiveStartSession.fromJson(_proxyJson(mode: 'quantum'));
      expect(unknown.mode, LiveTransportMode.unknown);
      expect(unknown.isUsable, isFalse);
      // An empty body is unknown too, not an accidental proxy session.
      final empty = LiveStartSession.fromJson(const {});
      expect(empty.mode, LiveTransportMode.unknown);
      expect(empty.isUsable, isFalse);
    });

    test(
      'proxySocketUri carries t/lang/screen and preserves existing query',
      () {
        final s = LiveStartSession.fromJson(
          _proxyJson(wsUrl: 'wss://agents.example.com/stream?v=2'),
        );
        final uri = s.proxySocketUri(screenPath: '/dashboard');
        expect(uri.queryParameters['t'], 'uid.9999999999.sig');
        expect(uri.queryParameters['lang'], 'bn');
        expect(uri.queryParameters['screen'], '/dashboard');
        expect(uri.queryParameters['v'], '2');

        // An explicitly detected language overrides the server's echo.
        final overridden = s.proxySocketUri(language: 'ne');
        expect(overridden.queryParameters['lang'], 'ne');
        expect(overridden.queryParameters.containsKey('screen'), isFalse);
      },
    );
  });

  group('wire encode (pure)', () {
    test('proxy mic frame: {"audio": base64}', () {
      final pcm = Uint8List.fromList([0, 1, 2, 3, 250, 255]);
      expect(GeminiLiveClient.encodeProxyAudio(pcm), {
        'audio': base64Encode(pcm),
      });
    });

    test('audio decode: base64 round-trips; garbage degrades to silence', () {
      final pcm = Uint8List.fromList([9, 8, 7, 6]);
      expect(GeminiLiveClient.decodeBase64Audio(base64Encode(pcm)), pcm);
      expect(GeminiLiveClient.decodeBase64Audio('!!!not-base64!!!'), isEmpty);
      expect(GeminiLiveClient.decodeBase64Audio(''), isEmpty);
    });

    test(
      'rollback setup frame: models/-prefixed, AUDIO, voice, tool names',
      () {
        final session = LiveStartSession.fromJson(_legacyJson());
        final setup =
            GeminiLiveClient.buildSetupFrame(session)['setup']
                as Map<String, dynamic>;

        expect(setup['model'], 'models/gemini-2.0-flash-live-001');
        final gen = setup['generationConfig'] as Map<String, dynamic>;
        expect(gen['responseModalities'], ['AUDIO']);
        final voiceName =
            (((gen['speechConfig'] as Map)['voiceConfig']
                    as Map)['prebuiltVoiceConfig']
                as Map)['voiceName'];
        expect(voiceName, 'Aoede');

        final decls =
            ((setup['tools'] as List).single as Map)['functionDeclarations']
                as List;
        expect(
          decls.map((d) => (d as Map)['name']),
          containsAll(<String>['lesson-plan', 'quiz-generator']),
        );
        expect(setup.containsKey('systemInstruction'), isFalse);
      },
    );

    test('rollback setup frame: an already models/-prefixed model is kept', () {
      final session = LiveStartSession.fromJson(
        _legacyJson()..['sessionConfig'] = {'model': 'models/foo-live'},
      );
      final setup =
          GeminiLiveClient.buildSetupFrame(session)['setup']
              as Map<String, dynamic>;
      expect(setup['model'], 'models/foo-live');
    });

    test('rollback mic frame: realtimeInput.mediaChunks, PCM16@16k mime', () {
      final pcm = Uint8List.fromList([1, 2, 3]);
      final chunk =
          ((GeminiLiveClient.encodeRealtimeAudio(pcm)['realtimeInput']
                          as Map)['mediaChunks']
                      as List)
                  .single
              as Map;
      expect(chunk['mimeType'], 'audio/pcm;rate=16000');
      expect(chunk['data'], base64Encode(pcm));
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // THE FALLBACK CONTRACT. Every one of these must return false WITHOUT
  // throwing, so `_beginLive()` returns false and `_begin()` (turn-based) runs.
  // ───────────────────────────────────────────────────────────────────────────
  group('connect() fallback contract', () {
    /// Builds a client whose socket, if it were ever opened, would be a fake —
    /// so a regression that opens one is caught by the assertions, never by a
    /// real network call.
    GeminiLiveClient clientFor(
      FakeApiClient api, {
      WebSocketConnector? connector,
    }) => GeminiLiveClient(
      api,
      connector:
          connector ??
          (_, {headers}) => _FakeWebSocketChannel(const Stream.empty()),
    );

    test('1. start-session returns non-200', () async {
      final client = clientFor(
        FakeApiClient(postErrorsByPath: {_startPath: Exception('503')}),
      );
      addTearDown(client.dispose);
      await expectLater(client.connect(screenPath: '/home'), completion(false));
      expect(client.isConnected, isFalse);
    });

    test('2. 200 but no wsUrl', () async {
      final client = clientFor(
        FakeApiClient(
          postResponsesByPath: {_startPath: _proxyJson(wsUrl: null)},
        ),
      );
      addTearDown(client.dispose);
      await expectLater(client.connect(screenPath: '/home'), completion(false));
      expect(client.isConnected, isFalse);
    });

    test('3. 200 but no streamToken', () async {
      final client = clientFor(
        FakeApiClient(
          postResponsesByPath: {_startPath: _proxyJson(streamToken: null)},
        ),
      );
      addTearDown(client.dispose);
      await expectLater(client.connect(screenPath: '/home'), completion(false));
      expect(client.isConnected, isFalse);
    });

    test('4. an unknown mode (a server newer than this build)', () async {
      final client = clientFor(
        FakeApiClient(
          postResponsesByPath: {_startPath: _proxyJson(mode: 'sarvam-relay')},
        ),
      );
      addTearDown(client.dispose);
      await expectLater(client.connect(screenPath: '/home'), completion(false));
      expect(client.isConnected, isFalse);
    });

    test('5a. the websocket handshake itself throws (ready fails)', () async {
      final client = clientFor(
        FakeApiClient(postResponsesByPath: {_startPath: _proxyJson()}),
        connector: (_, {headers}) => _FakeWebSocketChannel(
          const Stream.empty(),
          ready: Future<void>.error(StateError('handshake refused')),
        ),
      );
      addTearDown(client.dispose);
      await expectLater(client.connect(screenPath: '/home'), completion(false));
      expect(client.isConnected, isFalse);
    });

    test(
      '5b. the connector throws synchronously (bad host / bad URL)',
      () async {
        final client = clientFor(
          FakeApiClient(postResponsesByPath: {_startPath: _proxyJson()}),
          connector: (_, {headers}) => throw StateError('no route to host'),
        );
        addTearDown(client.dispose);
        await expectLater(
          client.connect(screenPath: '/home'),
          completion(false),
        );
        expect(client.isConnected, isFalse);
      },
    );

    test(
      'a body that is not JSON-shaped at all falls back, not throws',
      () async {
        final client = clientFor(
          FakeApiClient(
            postResponsesByPath: {
              _startPath: const {'ok': true},
            },
          ),
        );
        addTearDown(client.dispose);
        await expectLater(
          client.connect(screenPath: '/home'),
          completion(false),
        );
        expect(client.isConnected, isFalse);
      },
    );
  });

  group('proxy transport', () {
    late StreamController<dynamic> inbound;
    late _FakeWebSocketChannel channel;
    late Uri connectedUri;
    late Map<String, dynamic>? connectedHeaders;

    GeminiLiveClient build() {
      inbound = StreamController<dynamic>();
      addTearDown(inbound.close);
      return GeminiLiveClient(
        FakeApiClient(postResponsesByPath: {_startPath: _proxyJson()}),
        connector: (url, {headers}) {
          connectedUri = url;
          connectedHeaders = headers;
          return channel = _FakeWebSocketChannel(inbound.stream);
        },
      );
    }

    test(
      'connects to wsUrl?t=… with NO setup frame and no auth header',
      () async {
        final client = build();
        addTearDown(client.dispose);

        expect(
          await client.connect(screenPath: '/home', detectedLanguage: 'as'),
          isTrue,
        );
        expect(client.isConnected, isTrue);
        expect(client.mode, LiveTransportMode.vertexProxy);
        expect(connectedUri.queryParameters['t'], 'uid.9999999999.sig');
        expect(connectedUri.queryParameters['lang'], 'as');
        expect(connectedUri.queryParameters['screen'], '/home');
        // No Google credential and no header auth on this path.
        expect(connectedHeaders, isNull);
        // The sidecar configures Vertex itself; a setup frame would be garbage.
        expect(_sentFrames(channel), isEmpty);
      },
    );

    test('sendAudioChunk emits {"audio": base64}', () async {
      final client = build();
      addTearDown(client.dispose);
      await client.connect(screenPath: '/home');

      final pcm = Uint8List.fromList([4, 5, 6, 7]);
      client.sendAudioChunk(pcm);
      expect(_sentFrames(channel).single, {'audio': base64Encode(pcm)});
    });

    test('close() sends {"end": true} so the billable session stops', () async {
      final client = build();
      addTearDown(client.dispose);
      await client.connect(screenPath: '/home');
      await client.close();
      expect(_sentFrames(channel), [
        {'end': true},
      ]);
      expect(client.isConnected, isFalse);
    });

    test('an {"audio": …} frame decodes onto audioOut', () async {
      final client = build();
      addTearDown(client.dispose);
      await client.connect(screenPath: '/home');

      final pcm = Uint8List.fromList([10, 20, 30, 40]);
      final audioFuture = client.audioOut.first;
      inbound.add(jsonEncode({'audio': base64Encode(pcm)}));
      expect(await audioFuture.timeout(const Duration(seconds: 2)), pcm);
    });

    test('the sidecar toolCall shape routes, and NOTHING is sent back', () async {
      final client = build();
      addTearDown(client.dispose);
      await client.connect(screenPath: '/home');

      final directiveFuture = client.toolCalls.first;
      // The real shape: one flattened call per frame, NOT {"functionCalls":[…]}.
      inbound.add(
        jsonEncode({
          'toolCall': {
            'name': 'lesson-plan',
            'args': {'topic': 'fractions', 'gradeLevel': 'Class 5'},
            'id': 'call-1',
          },
        }),
      );

      final directive = await directiveFuture.timeout(
        const Duration(seconds: 2),
      );
      expect(directive.flow, VidyaFlow.fromWire('lesson-plan'));
      expect(directive.params.topic, 'fractions');

      // The SIDECAR answers Vertex. A client-side toolResponse would be a
      // second reply to the same call.
      await Future<void>.delayed(Duration.zero);
      expect(_sentFrames(channel), isEmpty);
    });

    test('a hallucinated flow is dropped, not routed', () async {
      final client = build();
      addTearDown(client.dispose);
      await client.connect(screenPath: '/home');

      final seen = <VidyaDirective>[];
      final sub = client.toolCalls.listen(seen.add);
      addTearDown(sub.cancel);
      inbound.add(
        jsonEncode({
          'toolCall': {'name': 'summon-a-unicorn', 'args': {}, 'id': 'c9'},
        }),
      );
      await Future<void>.delayed(Duration.zero);
      expect(seen, isEmpty);
      expect(_sentFrames(channel), isEmpty);
    });

    test('turnComplete and interrupted surface on their streams', () async {
      final client = build();
      addTearDown(client.dispose);
      await client.connect(screenPath: '/home');

      final turn = client.turnComplete.first;
      final interrupt = client.interrupted.first;
      inbound.add(jsonEncode({'interrupted': true}));
      inbound.add(jsonEncode({'turnComplete': true}));
      await turn.timeout(const Duration(seconds: 2));
      await interrupt.timeout(const Duration(seconds: 2));
    });

    test('an {"error": …} frame surfaces as a typed error', () async {
      final client = build();
      addTearDown(client.dispose);
      await client.connect(screenPath: '/home');

      final errorFuture = client.errors.first;
      inbound.add(jsonEncode({'error': 'live session failed'}));
      final error = await errorFuture.timeout(const Duration(seconds: 2));
      expect(error, isA<LiveSessionException>());
      expect((error as LiveSessionException).message, 'live session failed');
    });

    test('an unparseable frame is ignored, not fatal', () async {
      final client = build();
      addTearDown(client.dispose);
      await client.connect(screenPath: '/home');

      inbound.add('} not json {');
      inbound.add(jsonEncode({'somethingNew': 1}));
      await Future<void>.delayed(Duration.zero);
      expect(client.isConnected, isTrue);
    });
  });

  group('developer-api rollback transport (dead but present)', () {
    test(
      'a legacy body still connects, with the setup frame and header auth',
      () async {
        final inbound = StreamController<dynamic>();
        addTearDown(inbound.close);
        late _FakeWebSocketChannel channel;
        Map<String, dynamic>? headersSeen;
        final client = GeminiLiveClient(
          FakeApiClient(postResponsesByPath: {_startPath: _legacyJson()}),
          connector: (_, {headers}) {
            headersSeen = headers;
            return channel = _FakeWebSocketChannel(inbound.stream);
          },
        );
        addTearDown(client.dispose);

        expect(await client.connect(screenPath: '/home'), isTrue);
        expect(client.mode, LiveTransportMode.developerApi);
        expect(headersSeen?['Authorization'], 'Token ephemeral-abc');
        expect(_sentFrames(channel).single.containsKey('setup'), isTrue);

        // Mic framing follows the transport, not the app.
        client.sendAudioChunk(Uint8List.fromList([1, 2]));
        expect(_sentFrames(channel).last.containsKey('realtimeInput'), isTrue);
      },
    );

    test('the nested functionCalls shape still routes', () async {
      final inbound = StreamController<dynamic>();
      addTearDown(inbound.close);
      final client = GeminiLiveClient(
        FakeApiClient(postResponsesByPath: {_startPath: _legacyJson()}),
        connector: (_, {headers}) => _FakeWebSocketChannel(inbound.stream),
      );
      addTearDown(client.dispose);
      await client.connect(screenPath: '/home');

      final directiveFuture = client.toolCalls.first;
      inbound.add(
        jsonEncode({
          'toolCall': {
            'functionCalls': [
              {
                'id': 'call-1',
                'name': 'quiz-generator',
                'args': {'subject': 'Science'},
              },
            ],
          },
        }),
      );
      final directive = await directiveFuture.timeout(
        const Duration(seconds: 2),
      );
      expect(directive.flow, VidyaFlow.fromWire('quiz-generator'));
      expect(directive.params.subject, 'Science');
    });

    test('an inlineData frame decodes onto audioOut', () async {
      final inbound = StreamController<dynamic>();
      addTearDown(inbound.close);
      final client = GeminiLiveClient(
        FakeApiClient(postResponsesByPath: {_startPath: _legacyJson()}),
        connector: (_, {headers}) => _FakeWebSocketChannel(inbound.stream),
      );
      addTearDown(client.dispose);
      await client.connect(screenPath: '/home');

      final pcm = Uint8List.fromList([10, 20, 30, 40]);
      final audioFuture = client.audioOut.first;
      inbound.add(
        jsonEncode({
          'serverContent': {
            'modelTurn': {
              'parts': [
                {
                  'inlineData': {
                    'mimeType': 'audio/pcm;rate=24000',
                    'data': base64Encode(pcm),
                  },
                },
              ],
            },
          },
        }),
      );
      expect(await audioFuture.timeout(const Duration(seconds: 2)), pcm);
    });
  });
}
