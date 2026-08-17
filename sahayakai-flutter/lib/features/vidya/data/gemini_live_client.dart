import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:web_socket_channel/io.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import 'dto/vidya_action.dart';

part 'gemini_live_client.g.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Gemini Live client (Phase 3 — the Flutter Live path)
//
// Additive, behind the `voiceMode` flag. The turn-based STT -> classifier -> TTS
// pipeline is untouched and remains the fallback (see `VidyaController`).
//
// Flow:
//   1. POST /api/vidya-voice/start-session via the app's dio ApiClient (Firebase
//      Bearer auto-attached by the interceptor). The web proxy forwards to the
//      sidecar, which mints a 60s ephemeral Google token and returns the wss URL
//      + session config + tool list.
//   2. Open a WebSocket DIRECTLY to Google at `wssUrl?access_token=<sessionToken>`
//      (NOT via ApiClient/dio — dio only talks to sahayakai.com). All frames are
//      JSON text (BidiGenerateContent). NEVER embed a raw Google API key in the
//      app — only the ephemeral `sessionToken` from the start-session response
//      ever touches the socket.
//   3. Send the `setup` frame, then stream mic PCM16@16k up and receive model
//      PCM24k + tool-calls down.
//
// WIRE-FORMAT NOTE (unverified until a real on-device session runs): the web
// spike's opus/binary framing is WRONG for Live. Live requires base64 PCM16 in
// JSON `realtimeInput.mediaChunks` and returns base64 PCM24k in JSON
// `serverContent.modelTurn.parts[].inlineData`. The encode/decode helpers below
// are kept small and clearly named so the framing can be adjusted during device
// verification without touching the controller.
// ─────────────────────────────────────────────────────────────────────────────

/// The `sessionConfig` block of the start-session response.
@immutable
class LiveSessionConfig {
  const LiveSessionConfig({
    required this.model,
    required this.voice,
    this.responseModalities = const ['AUDIO'],
    this.languageCode,
  });

  /// The Gemini Live model id (e.g. `gemini-2.0-flash-live-001`). The `setup`
  /// frame prefixes it with `models/` if it is not already.
  final String model;

  /// The prebuilt voice name (e.g. `Aoede`).
  final String voice;

  final List<String> responseModalities;
  final String? languageCode;

  static LiveSessionConfig fromJson(Map<String, dynamic> json) {
    final modalities =
        (json['responseModalities'] as List?)?.whereType<String>().toList(
          growable: false,
        ) ??
        const ['AUDIO'];
    return LiveSessionConfig(
      model: (json['model'] as String?)?.trim() ?? '',
      voice: (json['voice'] as String?)?.trim() ?? '',
      responseModalities: modalities.isEmpty ? const ['AUDIO'] : modalities,
      languageCode: (json['languageCode'] as String?)?.trim(),
    );
  }
}

/// One tool the session exposes. [name] is the wire id the model must call and
/// MUST equal a [VidyaFlow.wire] for the call to route.
@immutable
class LiveToolDescriptor {
  const LiveToolDescriptor({
    required this.name,
    required this.description,
    this.flow,
  });

  final String name;
  final String description;
  final String? flow;

  static LiveToolDescriptor fromJson(Map<String, dynamic> json) =>
      LiveToolDescriptor(
        name: (json['name'] as String?)?.trim() ?? '',
        description: (json['description'] as String?)?.trim() ?? '',
        flow: (json['flow'] as String?)?.trim(),
      );
}

/// The full start-session response (pass-through from the sidecar).
@immutable
class LiveStartSession {
  const LiveStartSession({
    required this.sessionToken,
    required this.wssUrl,
    required this.expiresInSeconds,
    required this.sessionConfig,
    required this.tools,
    this.sidecarVersion,
  });

  final String sessionToken;
  final String wssUrl;
  final int expiresInSeconds;
  final LiveSessionConfig sessionConfig;
  final List<LiveToolDescriptor> tools;
  final String? sidecarVersion;

  bool get isUsable => sessionToken.isNotEmpty && wssUrl.isNotEmpty;

  static LiveStartSession fromJson(Map<String, dynamic> json) {
    final config =
        (json['sessionConfig'] as Map?)?.cast<String, dynamic>() ??
        const <String, dynamic>{};
    final toolsJson = (json['tools'] as List?) ?? const [];
    return LiveStartSession(
      sessionToken: (json['sessionToken'] as String?)?.trim() ?? '',
      wssUrl: (json['wssUrl'] as String?)?.trim() ?? '',
      expiresInSeconds: json['expiresInSeconds'] is num
          ? (json['expiresInSeconds'] as num).toInt()
          : 0,
      sessionConfig: LiveSessionConfig.fromJson(config),
      tools: [
        for (final t in toolsJson)
          if (t is Map) LiveToolDescriptor.fromJson(t.cast<String, dynamic>()),
      ],
      sidecarVersion: (json['sidecarVersion'] as String?)?.trim(),
    );
  }
}

/// The dependency seam for the WebSocket transport, so a test can inject a fake
/// channel without opening a real socket. Takes optional [headers] because a
/// Gemini Live ephemeral token authenticates via the `Authorization: Token …`
/// HEADER (verified against a real session) — NOT a `?access_token=` query
/// param, which Google rejects as an unregistered caller. Only `IOWebSocketChannel`
/// can set request headers, so the default uses it (mobile/desktop; the browser
/// path would need the JS SDK, which can't set WS headers).
typedef WebSocketConnector =
    WebSocketChannel Function(Uri url, {Map<String, dynamic>? headers});

/// The real-time Gemini Live client. A plain class behind an overridable
/// [geminiLiveClientProvider] (mirroring `voiceToTextRepository`), so tests swap
/// it out. Holds one socket + a set of broadcast streams the controller wires
/// onto the existing `VidyaStatus` machine.
class GeminiLiveClient {
  GeminiLiveClient(this._client, {WebSocketConnector? connector})
    : _connector =
          connector ??
          ((url, {headers}) =>
              IOWebSocketChannel.connect(url, headers: headers));

  final ApiClient _client;
  final WebSocketConnector _connector;

  static const String _startSessionPath = '/api/vidya-voice/start-session';

  WebSocketChannel? _channel;
  // VERIFIED NOT A LEAK: _closeSocket() reads this into a local, nulls the
  // field, then awaits sub.cancel(). The analyzer cannot trace disposal
  // through that null-then-cancel indirection, so it reports the subscription
  // as uncancelled. The rule stays enabled because it would catch a genuine
  // leak in code written later; this one site is annotated rather than the
  // rule being dropped.
  // ignore: cancel_subscriptions
  StreamSubscription<dynamic>? _socketSub;
  LiveStartSession? _session;

  final StreamController<Uint8List> _audioOut =
      StreamController<Uint8List>.broadcast();
  final StreamController<VidyaDirective> _toolCalls =
      StreamController<VidyaDirective>.broadcast();
  final StreamController<String> _transcript =
      StreamController<String>.broadcast();
  final StreamController<void> _turnComplete =
      StreamController<void>.broadcast();
  final StreamController<void> _interrupted =
      StreamController<void>.broadcast();
  final StreamController<Object> _errors = StreamController<Object>.broadcast();

  /// Base64-decoded model audio, PCM16LE 24 kHz mono, chunk by chunk.
  Stream<Uint8List> get audioOut => _audioOut.stream;

  /// A guarded [VidyaDirective] per model tool-call (the enum guard already
  /// dropped any hallucinated flow). Reuses the same domain type the turn-based
  /// classifier emits, so the RUN-verb / nav chain downstream is unchanged.
  Stream<VidyaDirective> get toolCalls => _toolCalls.stream;

  /// Any text the server streams (`serverContent...text` /
  /// `outputTranscription`). Best-effort — an AUDIO-only session may send none.
  Stream<String> get transcript => _transcript.stream;

  /// `serverContent.turnComplete == true`.
  Stream<void> get turnComplete => _turnComplete.stream;

  /// `serverContent.interrupted == true` (barge-in) — the sink should flush.
  Stream<void> get interrupted => _interrupted.stream;

  /// Transport / protocol errors. The controller routes these through the
  /// existing typed-error handler.
  Stream<Object> get errors => _errors.stream;

  bool get isConnected => _channel != null;

  LiveStartSession? get session => _session;

  /// Fetches the start-session token and opens the socket. Returns **true** once
  /// the socket handshake has completed and the `setup` frame is sent; returns
  /// **false** on ANY failure (start-session non-200, missing token, socket
  /// handshake failure) so the caller can fall back to the turn-based pipeline.
  /// This method never throws.
  Future<bool> connect({
    Map<String, dynamic>? teacherProfile,
    String? screenPath,
    Map<String, dynamic>? screenUiState,
    String? detectedLanguage,
    String? systemInstruction,
  }) async {
    // 1. Mint the ephemeral session (via the app's authed dio client).
    final LiveStartSession session;
    try {
      final body = <String, dynamic>{
        if (teacherProfile != null && teacherProfile.isNotEmpty)
          'teacherProfile': teacherProfile,
        if (screenPath != null)
          'currentScreenContext': {
            'path': screenPath,
            if (screenUiState != null && screenUiState.isNotEmpty)
              'uiState': screenUiState,
          },
        if (detectedLanguage != null && detectedLanguage.isNotEmpty)
          'detectedLanguage': detectedLanguage,
      };
      session = await _client.post<LiveStartSession>(
        _startSessionPath,
        data: body,
        decode: LiveStartSession.fromJson,
      );
    } catch (_) {
      // Any failure here (401 signed-out, 502 mint failure, offline) is the
      // sanctioned fallback trigger — the caller runs the turn-based path.
      return false;
    }
    if (!session.isUsable) return false;

    // 2. Open the socket DIRECTLY to Google with the ephemeral token.
    //    Auth is the `Authorization: Token <token>` HEADER (verified against a
    //    real Live session) — NOT a `?access_token=` query param. `wssUrl` is
    //    the v1alpha BidiGenerateContentConstrained endpoint the sidecar returns.
    try {
      final uri = Uri.parse(session.wssUrl);
      final channel = _connector(
        uri,
        headers: {'Authorization': 'Token ${session.sessionToken}'},
      );
      // `ready` completes when the handshake succeeds and throws when it fails,
      // so a dead socket falls back rather than silently stranding the session.
      await channel.ready;
      _channel = channel;
      _session = session;
      _socketSub = channel.stream.listen(
        _onFrame,
        onError: _onSocketError,
        onDone: _onSocketDone,
        cancelOnError: false,
      );
      // 3. First client frame — setup.
      _send(buildSetupFrame(session, systemInstruction: systemInstruction));
      return true;
    } catch (_) {
      await _closeSocket();
      return false;
    }
  }

  /// Streams one mic chunk up (PCM16LE 16 kHz mono, base64 inside JSON).
  void sendAudioChunk(Uint8List pcm16le16k) {
    if (_channel == null || pcm16le16k.isEmpty) return;
    _send(encodeRealtimeAudio(pcm16le16k));
  }

  /// Acknowledges a tool-call so the model does not wait on a real result — on
  /// this client, a dispatch is a fire-and-forget navigation.
  void sendToolResponse({
    required String id,
    required String name,
    Map<String, dynamic> response = const {'status': 'dispatched'},
  }) {
    if (_channel == null) return;
    _send({
      'toolResponse': {
        'functionResponses': [
          {'id': id, 'name': name, 'response': response},
        ],
      },
    });
  }

  /// Closes the socket (end of session / cancel). Safe to call when idle. The
  /// broadcast streams stay open so the client instance can be reused for the
  /// next session; [dispose] closes them for good.
  Future<void> close() => _closeSocket();

  Future<void> dispose() async {
    await _closeSocket();
    await _audioOut.close();
    await _toolCalls.close();
    await _transcript.close();
    await _turnComplete.close();
    await _interrupted.close();
    await _errors.close();
  }

  // ── Wire encode/decode (kept small + named for on-device tuning) ───────────

  /// The first client frame. Builds from the start-session `sessionConfig` +
  /// `tools`. The ephemeral token is already bound server-side to the model +
  /// system instruction, so [systemInstruction] here is only an optional short
  /// reinforcement (omitted when null). The tool `name`s MUST equal the wire ids
  /// the sidecar returned.
  @visibleForTesting
  static Map<String, dynamic> buildSetupFrame(
    LiveStartSession session, {
    String? systemInstruction,
  }) {
    final config = session.sessionConfig;
    final model = config.model.startsWith('models/')
        ? config.model
        : 'models/${config.model}';
    final instruction = systemInstruction?.trim();
    return {
      'setup': {
        'model': model,
        'generationConfig': {
          'responseModalities': const ['AUDIO'],
          'speechConfig': {
            'voiceConfig': {
              'prebuiltVoiceConfig': {'voiceName': config.voice},
            },
          },
        },
        if (instruction != null && instruction.isNotEmpty)
          'systemInstruction': {
            'parts': [
              {'text': instruction},
            ],
          },
        'tools': [
          {
            'functionDeclarations': [
              for (final tool in session.tools)
                {
                  'name': tool.name,
                  'description': tool.description,
                  'parameters': _toolParameterSchema(),
                },
            ],
          },
        ],
      },
    };
  }

  /// The prefill fields a NAVIGATE_AND_FILL tool accepts, mirroring
  /// `VidyaActionParamsDto`. The classifier fills what the utterance implied.
  static Map<String, dynamic> _toolParameterSchema() => {
    'type': 'object',
    'properties': {
      'topic': {
        'type': 'string',
        'description': 'The subject-matter topic the teacher named.',
      },
      'gradeLevel': {
        'type': 'string',
        'description': 'The class / grade, e.g. "Class 8".',
      },
      'subject': {
        'type': 'string',
        'description': 'The school subject, e.g. "Science".',
      },
      'language': {
        'type': 'string',
        'description':
            'The requested output language, if the teacher named one.',
      },
    },
  };

  @visibleForTesting
  static Map<String, dynamic> encodeRealtimeAudio(Uint8List pcm16le16k) => {
    'realtimeInput': {
      'mediaChunks': [
        {'mimeType': 'audio/pcm;rate=16000', 'data': base64Encode(pcm16le16k)},
      ],
    },
  };

  void _onFrame(dynamic raw) {
    final Map<String, dynamic>? msg = _decodeFrame(raw);
    if (msg == null) return;
    _handleMessage(msg);
  }

  Map<String, dynamic>? _decodeFrame(dynamic raw) {
    try {
      final String text;
      if (raw is String) {
        text = raw;
      } else if (raw is List<int>) {
        text = utf8.decode(raw);
      } else {
        return null;
      }
      final decoded = jsonDecode(text);
      return decoded is Map ? decoded.cast<String, dynamic>() : null;
    } catch (_) {
      // A frame we cannot parse is ignored rather than crashing the session.
      return null;
    }
  }

  void _handleMessage(Map<String, dynamic> msg) {
    final serverContent = msg['serverContent'];
    if (serverContent is Map) {
      _handleServerContent(serverContent.cast<String, dynamic>());
      return;
    }
    final toolCall = msg['toolCall'];
    if (toolCall is Map) {
      _handleToolCall(toolCall.cast<String, dynamic>());
      return;
    }
    // setupComplete / other control frames — nothing to surface.
  }

  void _handleServerContent(Map<String, dynamic> sc) {
    if (sc['interrupted'] == true) {
      _emit(_interrupted, null);
    }
    final modelTurn = sc['modelTurn'];
    if (modelTurn is Map) {
      final parts = (modelTurn['parts'] as List?) ?? const [];
      for (final part in parts) {
        if (part is! Map) continue;
        final inlineData = part['inlineData'];
        if (inlineData is Map) {
          final data = inlineData['data'];
          if (data is String && data.isNotEmpty) {
            final bytes = decodeBase64Audio(data);
            if (bytes.isNotEmpty) _emit(_audioOut, bytes);
          }
        }
        final text = part['text'];
        if (text is String && text.trim().isNotEmpty) {
          _emit(_transcript, text);
        }
      }
    }
    // Best-effort transcription channels (present only if the session enabled
    // them server-side).
    final outputTx = sc['outputTranscription'];
    if (outputTx is Map && outputTx['text'] is String) {
      final t = (outputTx['text'] as String).trim();
      if (t.isNotEmpty) _emit(_transcript, t);
    }
    if (sc['turnComplete'] == true) {
      _emit(_turnComplete, null);
    }
  }

  void _handleToolCall(Map<String, dynamic> toolCall) {
    final calls = (toolCall['functionCalls'] as List?) ?? const [];
    for (final call in calls) {
      if (call is! Map) continue;
      final name = call['name'] as String?;
      final id = call['id'] as String?;
      final args =
          (call['args'] as Map?)?.cast<String, dynamic>() ??
          const <String, dynamic>{};
      final flow = VidyaFlow.fromWire(name);
      if (flow != null) {
        final directive = VidyaDirective(
          flow: flow,
          params: VidyaActionParamsDto.fromJson(args).toDomain(),
        );
        _emit(_toolCalls, directive);
      }
      // Ack every call (even a dropped/unknown flow) so the model is not left
      // waiting on a response it will never get.
      if (id != null && name != null) {
        sendToolResponse(id: id, name: name);
      }
    }
  }

  /// Decodes a base64 PCM payload, tolerating whitespace/padding, and never
  /// throwing (a malformed chunk degrades to silence).
  @visibleForTesting
  static Uint8List decodeBase64Audio(String data) {
    try {
      final cleaned = data.replaceAll(RegExp(r'\s'), '');
      if (cleaned.isEmpty) return Uint8List(0);
      return base64Decode(base64.normalize(cleaned));
    } catch (_) {
      return Uint8List(0);
    }
  }

  void _send(Map<String, dynamic> frame) {
    final channel = _channel;
    if (channel == null) return;
    try {
      channel.sink.add(jsonEncode(frame));
    } catch (e) {
      _emit(_errors, e);
    }
  }

  void _onSocketError(Object error, StackTrace _) => _emit(_errors, error);

  void _onSocketDone() {
    // The socket closed underneath us. Drop our references so a stale sink is
    // never written to; the controller has already torn down or will via its
    // own lifecycle. Do NOT emit an error for a clean close.
    _channel = null;
    _session = null;
  }

  void _emit<T>(StreamController<T> controller, T value) {
    if (!controller.isClosed) controller.add(value);
  }

  Future<void> _closeSocket() async {
    final sub = _socketSub;
    _socketSub = null;
    await sub?.cancel();
    final channel = _channel;
    _channel = null;
    _session = null;
    if (channel != null) {
      try {
        await channel.sink.close();
      } catch (_) {
        // A close race on an already-dead socket is harmless.
      }
    }
  }
}

/// The injectable Live client. Kept alive so the single socket-owning instance
/// follows VIDYA across the session (the keepAlive `VidyaController` reads it),
/// and overridable in tests with a fake so nothing opens a real socket.
@Riverpod(keepAlive: true)
GeminiLiveClient geminiLiveClient(Ref ref) {
  final client = GeminiLiveClient(ref.watch(apiClientProvider));
  ref.onDispose(client.dispose);
  return client;
}
