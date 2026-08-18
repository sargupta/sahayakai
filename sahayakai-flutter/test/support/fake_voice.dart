import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:sahayakai/shared/voice/audio_player_service.dart';
import 'package:sahayakai/shared/voice/audio_recorder_service.dart';
import 'package:sahayakai/shared/voice/mic_permission_service.dart';

/// A recorder that never opens a microphone. [stop] writes [captureBytes] of
/// zeros to a real temp file so `Recording.readBytes()` works exactly as it
/// would on device; set `captureBytes <= 0` to model "nothing captured" (a
/// null recording). Push levels through [emitAmplitude] to drive the VAD.
class FakeAudioRecorderService implements AudioRecorderService {
  FakeAudioRecorderService({
    this.permission = true,
    this.captureBytes = 8000,
    this.throwOnStart,
    this.throwOnStop,
  });

  bool permission;
  int captureBytes;

  /// When set, [start] throws this instead of starting — models a plugin
  /// hiccup (device busy, platform error), NOT the expected permission-denied
  /// path (that's [FakeMicPermissionService.result]).
  Object? throwOnStart;

  /// When set, [stop] throws this instead of returning a [Recording] — models
  /// a recorder failing to stop/flush.
  Object? throwOnStop;

  final StreamController<double> _amplitude =
      StreamController<double>.broadcast();
  bool _recording = false;
  int startCount = 0;
  int startStreamCount = 0;
  int stopCount = 0;
  int cancelCount = 0;
  final List<String> _tempPaths = [];

  /// Feeds the streaming (Live) capture. Push PCM chunks with [emitStreamChunk].
  final StreamController<Uint8List> _pcmStream =
      StreamController<Uint8List>.broadcast();

  void emitAmplitude(double level) {
    if (!_amplitude.isClosed) _amplitude.add(level);
  }

  /// Pushes one PCM chunk onto the streaming capture (VIDYA Live path).
  void emitStreamChunk(Uint8List chunk) {
    if (!_pcmStream.isClosed) _pcmStream.add(chunk);
  }

  @override
  Future<bool> hasPermission() async => permission;

  @override
  bool get isRecording => _recording;

  @override
  Stream<double> get amplitude => _amplitude.stream;

  @override
  Future<void> start() async {
    if (throwOnStart != null) throw throwOnStart!;
    _recording = true;
    startCount++;
  }

  /// When set, [startStream] throws this instead of returning a stream — models
  /// the mic failing to open for the Live path.
  Object? throwOnStartStream;

  @override
  Future<Stream<Uint8List>> startStream() async {
    if (throwOnStartStream != null) throw throwOnStartStream!;
    _recording = true;
    startStreamCount++;
    return _pcmStream.stream;
  }

  @override
  Future<Recording?> stop() async {
    if (throwOnStop != null) throw throwOnStop!;
    _recording = false;
    stopCount++;
    if (captureBytes <= 0) return null;
    final dir = Directory.systemTemp.createTempSync('vidya_fake_rec');
    final file = File('${dir.path}/utterance.wav');
    file.writeAsBytesSync(Uint8List(captureBytes));
    _tempPaths.add(dir.path);
    return Recording(path: file.path, byteLength: captureBytes);
  }

  @override
  Future<void> cancel() async {
    _recording = false;
    cancelCount++;
  }

  @override
  Future<void> dispose() async {
    if (!_amplitude.isClosed) await _amplitude.close();
    if (!_pcmStream.isClosed) await _pcmStream.close();
    for (final p in _tempPaths) {
      final d = Directory(p);
      if (d.existsSync()) d.deleteSync(recursive: true);
    }
  }
}

/// A player that records what it was asked to speak instead of touching a
/// speaker. Emits [PlaybackProgress] like the real one so read-aloud controls
/// can be driven in a test: each play starts a new session (`playing: true`);
/// [stop] and the [completePlayback] hook flip it to `playing: false`.
class FakeAudioPlayerService implements AudioPlayerService {
  final List<String> played = [];

  /// How many times the Live streaming-PCM playback was started.
  int pcmStreamCount = 0;
  int stopCount = 0;
  int _session = 0;
  final StreamController<PlaybackProgress> _progress =
      StreamController<PlaybackProgress>.broadcast();

  @override
  Stream<PlaybackProgress> get playback => _progress.stream;

  @override
  Future<int?> playBase64Mp3(String base64Mp3) async {
    played.add(base64Mp3);
    final id = ++_session;
    if (!_progress.isClosed) _progress.add(PlaybackProgress(id, true));
    return id;
  }

  @override
  Future<int?> playPcmStream(Stream<Uint8List> pcm) async {
    pcmStreamCount++;
    final id = ++_session;
    // Drain the feed so the source is not left dangling in a test.
    unawaited(pcm.drain<void>());
    if (!_progress.isClosed) _progress.add(PlaybackProgress(id, true));
    return id;
  }

  @override
  Future<void> stop() async {
    stopCount++;
    if (!_progress.isClosed) _progress.add(PlaybackProgress(_session, false));
  }

  /// Test hook: simulate the current clip finishing on its own (the completion
  /// signal the real player derives from just_audio's processing state).
  void completePlayback() {
    if (!_progress.isClosed) _progress.add(PlaybackProgress(_session, false));
  }

  @override
  Future<void> dispose() async {
    if (!_progress.isClosed) await _progress.close();
  }
}

/// A permission gate that answers from a field instead of the OS.
class FakeMicPermissionService implements MicPermissionService {
  FakeMicPermissionService([this.result = MicPermission.granted]);

  MicPermission result;
  int requestCount = 0;
  int openSettingsCount = 0;

  /// When set, [ensureGranted] throws this instead of returning [result] —
  /// models the permission plugin itself failing (a hiccup), distinct from
  /// the expected "denied" outcome which is a plain [MicPermission] value.
  Object? throwOnEnsureGranted;

  @override
  Future<MicPermission> ensureGranted() async {
    requestCount++;
    if (throwOnEnsureGranted != null) throw throwOnEnsureGranted!;
    return result;
  }

  @override
  Future<bool> openSettings() async {
    openSettingsCount++;
    return true;
  }
}
