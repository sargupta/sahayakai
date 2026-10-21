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
// VIDYA Live client (the Flutter Live path)
//
// Additive, behind the `voiceMode` flag. The turn-based STT -> classifier -> TTS
// pipeline is untouched and remains the ALWAYS-AVAILABLE fallback (see
// `VidyaController._beginVoice`). `connect()` therefore never throws: every
// failure shape returns false so the caller runs `_begin()`.
//
// TWO TRANSPORTS, one funded.
//
//   1. `vertex-proxy` (LiveTransportMode.vertexProxy) — THE LIVE PATH.
//      The client opens a WebSocket to the SIDECAR's own proxy
//      (`wss://<sidecar>/v1/vidya-voice/stream?t=<streamToken>`), and the
//      sidecar holds ADC and talks to Vertex Live on our behalf. Vertex AI Live
//      is billed to Cloud Billing (startup credits fund it); the Gemini
//      Developer API's Live tier is prepaid-only and is depleted here. No Google
//      credential ever reaches the device — only the opaque, expiring,
//      HMAC-signed `streamToken` the web route mints.
//
//      Frame protocol (JSON text both ways):
//        client -> sidecar: {"audio": "<base64 PCM16LE 16kHz mono>"}
//                           {"text": "<utterance>"}
//                           {"end": true}
//        sidecar -> client: {"audio": "<base64 PCM16LE 24kHz>"}
//                           {"toolCall": {"name": ..., "args": {...}, "id": ...}}
//                           {"turnComplete": true} | {"interrupted": true}
//                           {"error": "..."}
//
//   2. `developer-api` (LiveTransportMode.developerApi) — DEAD BUT PRESENT.
//      The original path: the sidecar mints a 60s ephemeral Google token and the
//      client opens a WebSocket DIRECTLY to Google, sending a `setup` frame and
//      the `realtimeInput.mediaChunks` framing. It is billing-dead today (that
//      prepaid tier is empty), but it is kept whole and exercised by tests on
//      purpose: it is flag-gated server-side, costs nothing while the web route
//      returns `mode: "vertex-proxy"`, and it is the ONLY rollback target if
//      Vertex Live has an outage. Deleting it would mean rebuilding it under
//      pressure. Do not remove it without a replacement rollback path.
//
// DUAL-SHAPE PARSING is deliberate, not defensive clutter: a rolled-back deploy
// or a stale Cloud Run revision can still answer `/api/vidya-voice/start-session`
// with the old Developer-API body. The parser accepts both, prefers the proxy
// shape, and degrades to "not usable" (-> turn-based) rather than bricking.
// ─────────────────────────────────────────────────────────────────────────────

/// Which transport the `start-session` response asked the client to use.
enum LiveTransportMode {
  /// Client <-> sidecar <-> Vertex Live. The funded path.
  vertexProxy,

  /// Client <-> Google, with a sidecar-minted ephemeral token. Kept as the
  /// rollback target only (see the file header).
  developerApi,

  /// A `mode` this build does not understand — a server newer than the app.
  /// Always treated as unusable so the teacher gets the turn-based pipeline
  /// instead of a socket opened against a protocol we cannot speak.
  unknown,
}

/// The `sessionConfig` block of a Developer-API start-session response. Absent
/// from the proxy shape, where the sidecar owns the model/voice configuration.
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

/// The `start-session` response, parsed from EITHER wire shape.
@immutable
class LiveStartSession {
  const LiveStartSession({
    required this.mode,
    required this.expiresInSeconds,
    this.wsUrl = '',
    this.streamToken = '',
    this.languageCode,
    this.sessionToken = '',
    this.wssUrl = '',
    this.sessionConfig,
    this.tools = const [],
    this.sidecarVersion,
  });

  /// Which of the two transports this response describes.
  final LiveTransportMode mode;

  final int expiresInSeconds;

  // ── vertex-proxy fields ────────────────────────────────────────────────────

  /// The sidecar's `wss://…/v1/vidya-voice/stream` endpoint.
  final String wsUrl;

  /// The opaque HMAC-signed token the sidecar verifies as `?t=` before it opens
  /// a billable Vertex session. Not a Google credential.
  final String streamToken;

  /// The language the sidecar should configure Vertex with (`?lang=`).
  final String? languageCode;

  // ── developer-api fields (rollback path) ───────────────────────────────────

  final String sessionToken;
  final String wssUrl;
  final LiveSessionConfig? sessionConfig;
  final List<LiveToolDescriptor> tools;
  final String? sidecarVersion;

  /// Whether this response carries everything the chosen transport needs. A
  /// `false` here is a fallback trigger, never an error.
  bool get isUsable => switch (mode) {
    LiveTransportMode.vertexProxy => wsUrl.isNotEmpty && streamToken.isNotEmpty,
    LiveTransportMode.developerApi =>
      wssUrl.isNotEmpty && sessionToken.isNotEmpty,
    LiveTransportMode.unknown => false,
  };

  /// The socket URI for the proxy transport: the sidecar's stream endpoint with
  /// the signed token plus the context it needs to build the Vertex session.
  /// Any query already on [wsUrl] is preserved.
  Uri proxySocketUri({String? screenPath, String? language}) {
    final base = Uri.parse(wsUrl);
    final override = language?.trim();
    final lang = (override != null && override.isNotEmpty)
        ? override
        : languageCode?.trim();
    final screen = screenPath?.trim();
    return base.replace(
      queryParameters: <String, String>{
        ...base.queryParameters,
        't': streamToken,
        if (lang != null && lang.isNotEmpty) 'lang': lang,
        if (screen != null && screen.isNotEmpty) 'screen': screen,
      },
    );
  }

  static String _str(Object? v) => v is String ? v.trim() : '';

  /// Parses either wire shape. An explicit `mode` wins; without one the shape is
  /// inferred from which fields are present, preferring the proxy shape so a
  /// response carrying both never routes the teacher onto the unfunded path.
  static LiveStartSession fromJson(Map<String, dynamic> json) {
    final wsUrl = _str(json['wsUrl']);
    final streamToken = _str(json['streamToken']);
    final wssUrl = _str(json['wssUrl']);
    final sessionToken = _str(json['sessionToken']);

    final declared = _str(json['mode']).toLowerCase();
    final LiveTransportMode mode;
    if (declared.isNotEmpty) {
      mode = switch (declared) {
        'vertex-proxy' => LiveTransportMode.vertexProxy,
        'developer-api' || 'ephemeral-token' => LiveTransportMode.developerApi,
        // A mode this build has never heard of. Do NOT guess from the fields:
        // guessing is how a client ends up speaking the wrong protocol into a
        // live socket. Unusable -> turn-based.
        _ => LiveTransportMode.unknown,
      };
    } else if (wsUrl.isNotEmpty || streamToken.isNotEmpty) {
      mode = LiveTransportMode.vertexProxy;
    } else if (wssUrl.isNotEmpty || sessionToken.isNotEmpty) {
      mode = LiveTransportMode.developerApi;
    } else {
      mode = LiveTransportMode.unknown;
    }

    final configJson = (json['sessionConfig'] as Map?)?.cast<String, dynamic>();
    final toolsJson = (json['tools'] as List?) ?? const [];
    return LiveStartSession(
      mode: mode,
      expiresInSeconds: json['expiresInSeconds'] is num
          ? (json['expiresInSeconds'] as num).toInt()
          : 0,
      wsUrl: wsUrl,
      streamToken: streamToken,
      languageCode: () {
        final fromRoot = _str(json['languageCode']);
        if (fromRoot.isNotEmpty) return fromRoot;
        final fromConfig = _str(configJson?['languageCode']);
        return fromConfig.isEmpty ? null : fromConfig;
      }(),
      sessionToken: sessionToken,
      wssUrl: wssUrl,
      sessionConfig: configJson == null
          ? null
          : LiveSessionConfig.fromJson(configJson),
      tools: [
        for (final t in toolsJson)
          if (t is Map) LiveToolDescriptor.fromJson(t.cast<String, dynamic>()),
      ],
      sidecarVersion: () {
        final v = _str(json['sidecarVersion']);
        return v.isEmpty ? null : v;
      }(),
    );
  }
}

/// The dependency seam for the WebSocket transport, so a test can inject a fake
/// channel without opening a real socket. Takes optional [headers] because the
/// Developer-API rollback path authenticates with an `Authorization: Token …`
/// HEADER (verified against a real session) — NOT a `?access_token=` query
/// param, which Google rejects as an unregistered caller. The proxy path needs
/// no headers (its token rides as `?t=`). Only `IOWebSocketChannel` can set
/// request headers, so the default uses it.
typedef WebSocketConnector =
    WebSocketChannel Function(Uri url, {Map<String, dynamic>? headers});

/// The real-time VIDYA Live client. A plain class behind an overridable
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

  /// Any text the server streams. Best-effort — an AUDIO-only session may send
  /// none, and the proxy does not currently relay a text channel at all.
  Stream<String> get transcript => _transcript.stream;

  /// The model finished a turn.
  Stream<void> get turnComplete => _turnComplete.stream;

  /// Barge-in — the audio sink should flush.
  Stream<void> get interrupted => _interrupted.stream;

  /// Transport / protocol errors, including the sidecar's `{"error": …}` frame.
  /// The controller routes these through the existing typed-error handler.
  Stream<Object> get errors => _errors.stream;

  bool get isConnected => _channel != null;

  LiveStartSession? get session => _session;

  /// Which transport the open session is using, or null when idle.
  LiveTransportMode? get mode => _session?.mode;

  /// Authorises a session and opens the socket. Returns **true** once the
  /// handshake has completed (and, on the rollback transport, the `setup` frame
  /// is sent); returns **false** on ANY failure — start-session non-200, a
  /// missing `wsUrl`/`streamToken`, an unknown `mode`, or a socket handshake
  /// that throws — so the caller falls back to the turn-based pipeline.
  ///
  /// THIS METHOD NEVER THROWS. That is the whole fallback contract: a throw here
  /// would escape `_beginLive()` and leave the teacher with no voice at all.
  Future<bool> connect({
    Map<String, dynamic>? teacherProfile,
    String? screenPath,
    Map<String, dynamic>? screenUiState,
    String? detectedLanguage,
    String? systemInstruction,
  }) async {
    // 1. Authorise the session (via the app's authed dio client).
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
      // Any failure here (401 signed-out, 503 flag-off, 502, offline, or a
      // body that would not parse) is the sanctioned fallback trigger.
      return false;
    }
    // Covers: missing wsUrl, missing streamToken, an unknown mode, and the
    // legacy shape missing its token/url.
    if (!session.isUsable) return false;

    // 2. Open the socket for the transport the server chose.
    try {
      final Uri uri;
      final Map<String, dynamic>? headers;
      switch (session.mode) {
        case LiveTransportMode.vertexProxy:
          // The token rides as `?t=`; the sidecar verifies its HMAC before it
          // opens anything billable. No Google credential is involved.
          uri = session.proxySocketUri(
            screenPath: screenPath,
            language: detectedLanguage,
          );
          headers = null;
        case LiveTransportMode.developerApi:
          uri = Uri.parse(session.wssUrl);
          headers = <String, dynamic>{
            'Authorization': 'Token ${session.sessionToken}',
          };
        case LiveTransportMode.unknown:
          // Unreachable — isUsable already rejected it. Kept total so a new
          // enum member cannot silently fall through to a socket open.
          return false;
      }
      final channel = _connector(uri, headers: headers);
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
      // 3. First client frame — only the Developer-API transport needs one. On
      //    the proxy the sidecar has already configured Vertex (model, voice,
      //    system instruction, tools) from its own settings before it accepts
      //    our socket, so a `setup` frame here would be an unparseable frame.
      if (session.mode == LiveTransportMode.developerApi) {
        _send(buildSetupFrame(session, systemInstruction: systemInstruction));
      }
      return true;
    } catch (_) {
      await _closeSocket();
      return false;
    }
  }

  /// Streams one mic chunk up (PCM16LE 16 kHz mono, base64 inside JSON).
  void sendAudioChunk(Uint8List pcm16le16k) {
    final session = _session;
    if (_channel == null || session == null || pcm16le16k.isEmpty) return;
    _send(
      session.mode == LiveTransportMode.vertexProxy
          ? encodeProxyAudio(pcm16le16k)
          : encodeRealtimeAudio(pcm16le16k),
    );
  }

  /// Sends a text turn instead of audio. Proxy-only (`{"text": …}`); a no-op on
  /// the rollback transport, which has no equivalent single-frame turn.
  void sendText(String text) {
    final trimmed = text.trim();
    if (_channel == null || trimmed.isEmpty) return;
    if (_session?.mode != LiveTransportMode.vertexProxy) return;
    _send(<String, dynamic>{'text': trimmed});
  }

  // NOTE: there is deliberately NO sendToolResponse here. On the proxy path the
  // SIDECAR answers Vertex itself (`session.send_tool_response(...)` right after
  // it forwards the call to us), so a client-side response would be a second
  // reply to the same function call. A tool-call on this client is a
  // fire-and-forget navigation; nothing downstream waits on a result.

  /// Closes the socket (end of session / cancel). Safe to call when idle. The
  /// broadcast streams stay open so the client instance can be reused for the
  /// next session; [dispose] closes them for good.
  Future<void> close() async {
    // Tell the sidecar to stop the (billable) Vertex session promptly rather
    // than waiting for the socket teardown to propagate.
    if (_channel != null && _session?.mode == LiveTransportMode.vertexProxy) {
      _send(<String, dynamic>{'end': true});
    }
    await _closeSocket();
  }

  Future<void> dispose() async {
    await close();
    await _audioOut.close();
    await _toolCalls.close();
    await _transcript.close();
    await _turnComplete.close();
    await _interrupted.close();
    await _errors.close();
  }

  // ── Wire encode/decode ─────────────────────────────────────────────────────

  /// One mic chunk, proxy framing.
  @visibleForTesting
  static Map<String, dynamic> encodeProxyAudio(Uint8List pcm16le16k) => {
    'audio': base64Encode(pcm16le16k),
  };

  /// The first client frame on the DEVELOPER-API rollback transport. Builds from
  /// the start-session `sessionConfig` + `tools`. Unused while the server
  /// returns `mode: "vertex-proxy"` — see the file header on why it stays.
  @visibleForTesting
  static Map<String, dynamic> buildSetupFrame(
    LiveStartSession session, {
    String? systemInstruction,
  }) {
    final config =
        session.sessionConfig ?? const LiveSessionConfig(model: '', voice: '');
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

  /// One mic chunk, Developer-API framing (rollback transport).
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

  /// Routes a decoded frame. Keyed on the frame's OWN shape rather than the
  /// session mode: the two protocols use disjoint top-level keys, so one router
  /// serves both and a mid-session shape surprise degrades to "ignored".
  void _handleMessage(Map<String, dynamic> msg) {
    // ── Proxy frames (the funded Vertex path) ────────────────────────────────
    final audio = msg['audio'];
    if (audio is String) {
      if (audio.isNotEmpty) {
        final bytes = decodeBase64Audio(audio);
        if (bytes.isNotEmpty) _emit(_audioOut, bytes);
      }
      return;
    }
    final toolCall = msg['toolCall'];
    if (toolCall is Map) {
      _handleToolCall(toolCall.cast<String, dynamic>());
      return;
    }
    if (msg['interrupted'] == true) {
      _emit(_interrupted, null);
      return;
    }
    if (msg['turnComplete'] == true) {
      _emit(_turnComplete, null);
      return;
    }
    final error = msg['error'];
    if (error is String && error.isNotEmpty) {
      _emit(_errors, LiveSessionException(error));
      return;
    }

    // ── Developer-API frames (rollback transport) ────────────────────────────
    final serverContent = msg['serverContent'];
    if (serverContent is Map) {
      _handleServerContent(serverContent.cast<String, dynamic>());
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

  /// Handles BOTH tool-call shapes.
  ///
  /// The sidecar sends ONE FLATTENED CALL PER FRAME —
  /// `{"toolCall": {"name": …, "args": {…}, "id": …}}` — because it fans
  /// Vertex's `tool_call.function_calls` out into a frame each. The nested
  /// `{"functionCalls": [...]}` array is the Developer-API shape and is
  /// accepted only so the rollback transport still routes.
  void _handleToolCall(Map<String, dynamic> toolCall) {
    final nested = toolCall['functionCalls'];
    if (nested is List) {
      for (final call in nested) {
        if (call is Map) _emitToolCall(call.cast<String, dynamic>());
      }
      return;
    }
    _emitToolCall(toolCall);
  }

  void _emitToolCall(Map<String, dynamic> call) {
    final name = call['name'];
    if (name is! String) return;
    // The enum guard drops any flow the model hallucinated. A dropped call
    // needs no acknowledgement: the sidecar has already answered Vertex.
    final flow = VidyaFlow.fromWire(name);
    if (flow == null) return;
    final args =
        (call['args'] as Map?)?.cast<String, dynamic>() ??
        const <String, dynamic>{};
    _emit(
      _toolCalls,
      VidyaDirective(
        flow: flow,
        params: VidyaActionParamsDto.fromJson(args).toDomain(),
      ),
    );
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

/// The sidecar reported a failure on an open session (`{"error": "…"}`). Carried
/// on [GeminiLiveClient.errors] so the controller's typed-error handler can tell
/// a server-side session failure from a raw transport exception.
@immutable
class LiveSessionException implements Exception {
  const LiveSessionException(this.message);

  final String message;

  @override
  String toString() => 'LiveSessionException: $message';
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
