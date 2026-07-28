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

/// One playback-progress event: the [session] id of a clip and whether it is
/// currently [playing]. Each new clip supersedes the prior session id; natural
/// completion or an explicit stop flips [playing] to false for that session.
///
/// Read-aloud controls listen to this to reflect true state: a control owns a
/// session id (from [AudioPlayerService.playBase64Mp3]) and considers itself
/// "playing" only while the latest event carries *its* session with
/// `playing == true`. A newer session (another clip started) supersedes it, and
/// completion resets it — so the play/stop icon never lies and two controls
/// never both claim to be playing.
class PlaybackProgress {
  const PlaybackProgress(this.session, this.playing);

  /// The clip's monotonically-increasing id (0 before anything has played).
  final int session;

  /// Whether that clip is actively playing (false on completion / stop).
  final bool playing;
}

/// Speaks VIDYA's replies and the read-aloud deliverable. The one seam tests
/// override so no unit test ever opens a real speaker (mirrors
/// `AudioRecorderService`).
abstract interface class AudioPlayerService {
  /// Decodes [base64Mp3] and plays it, **cancelling any clip already playing**
  /// (the web's `tts.cancel()` before the next `speak()`). Completes once
  /// playback has started; the clip plays on in the background. Returns the new
  /// clip's [PlaybackProgress.session] id, or **null** when there was nothing
  /// to play (the payload decoded to zero bytes) — returning null, not the
  /// stale session id, so a caller never shows a "Stop" state for a clip that
  /// never started and can never emit a completion event.
  Future<int?> playBase64Mp3(String base64Mp3);

  /// Stops the current clip (VIDYA cancel / mic re-tap / read-aloud stop).
  Future<void> stop();

  /// Playback-progress for the currently-loaded clip. Emits on play-start
  /// (`playing: true`), on natural completion and on [stop] (`playing: false`).
  /// A broadcast stream — many read-aloud controls may listen at once.
  Stream<PlaybackProgress> get playback;

  /// Releases native resources.
  Future<void> dispose();
}

/// The production [AudioPlayerService], backed by `just_audio` + `audio_session`.
class JustAudioPlayerService implements AudioPlayerService {
  JustAudioPlayerService([AudioPlayer? player])
      : _player = player ?? AudioPlayer();

  final AudioPlayer _player;
  bool _sessionConfigured = false;
  int _session = 0;
  StreamSubscription<ProcessingState>? _stateSub;
  final StreamController<PlaybackProgress> _progress =
      StreamController<PlaybackProgress>.broadcast();

  @override
  Stream<PlaybackProgress> get playback => _progress.stream;

  void _emit(bool playing) {
    if (!_progress.isClosed) {
      _progress.add(PlaybackProgress(_session, playing));
    }
  }

  /// Configure the OS audio session once as speech so TTS ducks other audio,
  /// and wire the completion signal once. A clip reaching the end drives
  /// `processingState == completed` (its `playing` flag stays true in
  /// just_audio, so the state stream alone is not enough); an explicit
  /// [stop]/next-clip drives it to `idle`, which is not a completion. So only
  /// `completed` flips this session to `playing: false`.
  Future<void> _ensureSession() async {
    if (_sessionConfigured) return;
    final session = await AudioSession.instance;
    await session.configure(AudioSessionConfiguration.speech());
    _stateSub ??= _player.processingStateStream.listen((s) {
      if (s == ProcessingState.completed) _emit(false);
    });
    _sessionConfigured = true;
  }

  @override
  Future<int?> playBase64Mp3(String base64Mp3) async {
    final bytes = decodeBase64Mp3(base64Mp3);
    if (bytes.isEmpty) return null;
    await _ensureSession();
    // Cancel the previous clip before the next speak (tts.cancel parity). This
    // drives processingState to idle, not completed, so it emits no false event
    // for the outgoing session — the new session's `playing: true` below is the
    // supersede signal the prior clip's listeners key off.
    await _player.stop();
    final id = ++_session;
    await _player.setAudioSource(Base64Mp3Source(bytes));
    _emit(true);
    // Start playback but do not await completion — mirror the web's
    // `new Audio().play()` which resolves when playback *begins*, so the
    // caller's conversation flow is not blocked for the length of the clip.
    unawaited(_player.play());
    return id;
  }

  @override
  Future<void> stop() async {
    _emit(false);
    await _player.stop();
  }

  @override
  Future<void> dispose() async {
    await _stateSub?.cancel();
    await _progress.close();
    await _player.dispose();
  }
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
