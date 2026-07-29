import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/vidya/data/dto/vidya_action.dart';
import 'package:sahayakai/features/vidya/data/gemini_live_client.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../../../support/fake_api_client.dart';

/// Pins the Gemini Live WIRE FORMAT. The web spike's opus/binary framing is
/// wrong for Live; this client implements the JSON `realtimeInput.mediaChunks`
/// (PCM16@16k up) / `inlineData` (PCM24k down) / `toolCall` framing from
/// scratch. The real audio round-trip is only provable on-device against
/// Google — but the exact frames the client emits and how it decodes what it
/// receives ARE verifiable here, deterministically, and are the part most
/// likely to be subtly wrong. These tests are the regression fence around that.
const String _startPath = '/api/vidya-voice/start-session';

Map<String, dynamic> _sessionJson({
  String token = 'ephemeral-abc',
  String wss = 'wss://generativelanguage.googleapis.com/ws/x',
  String model = 'gemini-2.0-flash-live-001',
  String voice = 'Aoede',
}) =>
    {
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
      'spike': true,
    };

/// A single-subscription inbound stream + a sink that captures every JSON frame
/// the client sends, so a test can push server frames in and assert what went
/// out. `ready` completes immediately (a healthy handshake).
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
  _FakeWebSocketChannel(this._inbound);
  final Stream<dynamic> _inbound;
  final _FakeWebSocketSink _sink = _FakeWebSocketSink();

  @override
  Stream<dynamic> get stream => _inbound;
  @override
  WebSocketSink get sink => _sink;
  @override
  Future<void> get ready => Future<void>.value();

  // Everything else on the WebSocketChannel surface is unused by the client.
  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

/// Decoded frames the sink captured, newest-last.
List<Map<String, dynamic>> _sentFrames(_FakeWebSocketChannel ch) => [
      for (final s in ch._sink.sent)
        (jsonDecode(s) as Map).cast<String, dynamic>(),
    ];

void main() {
  group('wire encode (pure)', () {
    test('setup frame: models/-prefixed model, AUDIO, voice, tool names', () {
      final session = LiveStartSession.fromJson(_sessionJson());
      final frame = GeminiLiveClient.buildSetupFrame(session);
      final setup = frame['setup'] as Map<String, dynamic>;

      expect(setup['model'], 'models/gemini-2.0-flash-live-001');
      final gen = setup['generationConfig'] as Map<String, dynamic>;
      expect(gen['responseModalities'], ['AUDIO']);
      final voiceName = (((gen['speechConfig'] as Map)['voiceConfig'] as Map)
          ['prebuiltVoiceConfig'] as Map)['voiceName'];
      expect(voiceName, 'Aoede');

      final decls = ((setup['tools'] as List).single
          as Map)['functionDeclarations'] as List;
      expect(decls.map((d) => (d as Map)['name']),
          containsAll(<String>['lesson-plan', 'quiz-generator']));
      // No systemInstruction when none is supplied (the token is server-bound).
      expect(setup.containsKey('systemInstruction'), isFalse);
    });

    test('setup frame: an already models/-prefixed model is not double-prefixed',
        () {
      final session =
          LiveStartSession.fromJson(_sessionJson(model: 'models/foo-live'));
      final setup =
          GeminiLiveClient.buildSetupFrame(session)['setup'] as Map<String, dynamic>;
      expect(setup['model'], 'models/foo-live');
    });

    test('mic frame: realtimeInput.mediaChunks, PCM16@16k mime, base64 data',
        () {
      final pcm = Uint8List.fromList([0, 1, 2, 3, 250, 255]);
      final frame = GeminiLiveClient.encodeRealtimeAudio(pcm);
      final chunk =
          ((frame['realtimeInput'] as Map)['mediaChunks'] as List).single as Map;
      expect(chunk['mimeType'], 'audio/pcm;rate=16000');
      expect(chunk['data'], base64Encode(pcm));
    });

    test('audio decode: base64 round-trips; garbage degrades to silence', () {
      final pcm = Uint8List.fromList([9, 8, 7, 6]);
      expect(GeminiLiveClient.decodeBase64Audio(base64Encode(pcm)), pcm);
      expect(GeminiLiveClient.decodeBase64Audio('!!!not-base64!!!'),
          isEmpty);
      expect(GeminiLiveClient.decodeBase64Audio(''), isEmpty);
    });
  });

  group('start-session parse', () {
    test('fromJson maps the sidecar pass-through shape', () {
      final s = LiveStartSession.fromJson(_sessionJson());
      expect(s.sessionToken, 'ephemeral-abc');
      expect(s.wssUrl, startsWith('wss://'));
      expect(s.expiresInSeconds, 60);
      expect(s.sessionConfig.model, 'gemini-2.0-flash-live-001');
      expect(s.sessionConfig.voice, 'Aoede');
      expect(s.tools, hasLength(2));
      expect(s.isUsable, isTrue);
    });

    test('a session missing token/url is not usable', () {
      final s = LiveStartSession.fromJson({
        ...(_sessionJson()),
        'sessionToken': '',
      });
      expect(s.isUsable, isFalse);
    });
  });

  group('connect / socket behaviour', () {
    test('connect() returns false when start-session errors (fallback trigger)',
        () async {
      final client = GeminiLiveClient(
        FakeApiClient(postErrorsByPath: {_startPath: Exception('503')}),
        connector: (_) => _FakeWebSocketChannel(const Stream.empty()),
      );
      addTearDown(client.dispose);
      expect(await client.connect(screenPath: '/home'), isFalse);
      expect(client.isConnected, isFalse);
    });

    test('connect() sends the setup frame first on a healthy socket', () async {
      final inbound = StreamController<dynamic>();
      addTearDown(inbound.close);
      late _FakeWebSocketChannel channel;
      final client = GeminiLiveClient(
        FakeApiClient(postResponsesByPath: {_startPath: _sessionJson()}),
        connector: (_) => channel = _FakeWebSocketChannel(inbound.stream),
      );
      addTearDown(client.dispose);

      expect(await client.connect(screenPath: '/home'), isTrue);
      expect(client.isConnected, isTrue);
      final frames = _sentFrames(channel);
      expect(frames, hasLength(1));
      expect(frames.single.containsKey('setup'), isTrue);
    });

    test('a toolCall frame -> VidyaDirective + a toolResponse is sent back',
        () async {
      final inbound = StreamController<dynamic>();
      addTearDown(inbound.close);
      late _FakeWebSocketChannel channel;
      final client = GeminiLiveClient(
        FakeApiClient(postResponsesByPath: {_startPath: _sessionJson()}),
        connector: (_) => channel = _FakeWebSocketChannel(inbound.stream),
      );
      addTearDown(client.dispose);
      await client.connect(screenPath: '/home');

      final directiveFuture = client.toolCalls.first;
      inbound.add(jsonEncode({
        'toolCall': {
          'functionCalls': [
            {
              'id': 'call-1',
              'name': 'lesson-plan',
              'args': {'topic': 'fractions', 'gradeLevel': 'Class 5'},
            },
          ],
        },
      }));

      final directive = await directiveFuture.timeout(const Duration(seconds: 2));
      expect(directive.flow, VidyaFlow.fromWire('lesson-plan'));

      // The model must be acked so it does not hang waiting on a result.
      await Future<void>.delayed(Duration.zero);
      final responses = _sentFrames(channel)
          .where((f) => f.containsKey('toolResponse'))
          .toList();
      expect(responses, hasLength(1));
      final fr = ((responses.single['toolResponse'] as Map)['functionResponses']
          as List).single as Map;
      expect(fr['id'], 'call-1');
      expect(fr['name'], 'lesson-plan');
    });

    test('an inlineData frame -> decoded PCM bytes on audioOut', () async {
      final inbound = StreamController<dynamic>();
      addTearDown(inbound.close);
      final client = GeminiLiveClient(
        FakeApiClient(postResponsesByPath: {_startPath: _sessionJson()}),
        connector: (_) => _FakeWebSocketChannel(inbound.stream),
      );
      addTearDown(client.dispose);
      await client.connect(screenPath: '/home');

      final pcm = Uint8List.fromList([10, 20, 30, 40]);
      final audioFuture = client.audioOut.first;
      inbound.add(jsonEncode({
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
      }));

      expect(await audioFuture.timeout(const Duration(seconds: 2)), pcm);
    });

    test('turnComplete and interrupted surface on their streams', () async {
      final inbound = StreamController<dynamic>();
      addTearDown(inbound.close);
      final client = GeminiLiveClient(
        FakeApiClient(postResponsesByPath: {_startPath: _sessionJson()}),
        connector: (_) => _FakeWebSocketChannel(inbound.stream),
      );
      addTearDown(client.dispose);
      await client.connect(screenPath: '/home');

      final turn = client.turnComplete.first;
      final interrupt = client.interrupted.first;
      inbound.add(jsonEncode({
        'serverContent': {'interrupted': true},
      }));
      inbound.add(jsonEncode({
        'serverContent': {'turnComplete': true},
      }));
      await turn.timeout(const Duration(seconds: 2));
      await interrupt.timeout(const Duration(seconds: 2));
    });
  });
}
