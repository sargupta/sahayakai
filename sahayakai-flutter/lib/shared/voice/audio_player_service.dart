// just_audio marks StreamAudioSource / StreamAudioResponse @experimental, but
// they are the sanctioned (and only) API for playing in-memory bytes with no
// temp file — exactly what the base64-mp3 TTS payload needs (SPEC_voice_vidya
// §C.3). Scope the experimental-use warning to this file rather than reaching
// for a URL/temp-file playback path the spec explicitly rejects.
// ignore_for_file: experimental_member_use
import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:audio_session/audio_session.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'audio_player_service.g.dart';

/// Decodes the `/api/tts` `audioContent` (base64 mp3) into raw bytes.
///
/// Tolerates a `data:audio/...;base64,` prefix and embedded whitespace, and
/// normalises padding, so a slightly-off reply still plays. Returns **empty**
/// bytes for empty or un-decodable input rather than throwing — a malformed TTS
/// reply degrades to silence, never a crash mid-conversation.
Uint8List decodeBase64Mp3(String base64Mp3) {
  var data = base64Mp3.trim();
  if (data.isEmpty) return Uint8List(0);
  final comma = data.indexOf(',');
  if (data.startsWith('data:') && comma != -1) {
    data = data.substring(comma + 1);
  }
  data = data.replaceAll(RegExp(r'\s'), '');
  if (data.isEmpty) return Uint8List(0);
  try {
    return base64Decode(base64.normalize(data));
  } catch (_) {
    return Uint8List(0);
  }
}

/// Plays in-memory mp3 bytes through `just_audio` with no temp file. The TTS
/// route returns `{ audioContent: <base64 mp3> }` (bytes, not a URL), so the
/// decoded bytes are fed straight to the player. [contentType] is `audio/mpeg`
/// — the mp3 the route synthesises.
class Base64Mp3Source extends StreamAudioSource {
  Base64Mp3Source(this.bytes);

  final Uint8List bytes;

  @override
  Future<StreamAudioResponse> request([int? start, int? end]) async {
    final s = start ?? 0;
    final e = end ?? bytes.length;
    return StreamAudioResponse(
      sourceLength: bytes.length,
      contentLength: e - s,
      offset: s,
      contentType: 'audio/mpeg',
      stream: Stream<List<int>>.value(bytes.sublist(s, e)),
    );
  }
}

/// Speaks VIDYA's replies. The one seam tests override so no unit test ever
/// opens a real speaker (mirrors `AudioRecorderService`).
abstract interface class AudioPlayerService {
  /// Decodes [base64Mp3] and plays it, **cancelling any clip already playing**
  /// (the web's `tts.cancel()` before the next `speak()`). Completes once
  /// playback has started; the clip plays on in the background. An empty /
  /// un-decodable payload is a silent no-op.
  Future<void> playBase64Mp3(String base64Mp3);

  /// Stops the current clip (VIDYA cancel / mic re-tap while speaking).
  Future<void> stop();

  /// Releases native resources.
  Future<void> dispose();
}

/// The production [AudioPlayerService], backed by `just_audio` + `audio_session`.
class JustAudioPlayerService implements AudioPlayerService {
  JustAudioPlayerService([AudioPlayer? player])
      : _player = player ?? AudioPlayer();

  final AudioPlayer _player;
  bool _sessionConfigured = false;

  /// Configure the OS audio session once as speech so TTS ducks other audio.
  Future<void> _ensureSession() async {
    if (_sessionConfigured) return;
    final session = await AudioSession.instance;
    await session.configure(AudioSessionConfiguration.speech());
    _sessionConfigured = true;
  }

  @override
  Future<void> playBase64Mp3(String base64Mp3) async {
    final bytes = decodeBase64Mp3(base64Mp3);
    if (bytes.isEmpty) return;
    await _ensureSession();
    // Cancel the previous clip before the next speak (tts.cancel parity).
    await _player.stop();
    await _player.setAudioSource(Base64Mp3Source(bytes));
    // Start playback but do not await completion — mirror the web's
    // `new Audio().play()` which resolves when playback *begins*, so the
    // caller's conversation flow is not blocked for the length of the clip.
    unawaited(_player.play());
  }

  @override
  Future<void> stop() => _player.stop();

  @override
  Future<void> dispose() => _player.dispose();
}

/// The injectable player. Override this provider in tests with a fake so the
/// controller under test never touches the speaker. Kept alive so one reusable
/// player serves every VIDYA turn.
@Riverpod(keepAlive: true)
AudioPlayerService audioPlayerService(Ref ref) {
  final service = JustAudioPlayerService();
  ref.onDispose(service.dispose);
  return service;
}
