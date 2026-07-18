import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'audio_recorder_service.g.dart';

/// The capture format the STT route needs to reach the Sarvam Saaras v3 Indic
/// fast path: **WAV, 16 kHz, mono**. `/api/ai/voice-to-text` only tries Sarvam
/// when the uploaded MIME matches `audio/(mpeg|mp3|wav)` — opus/webm/ogg are
/// rejected and fall to the slower Gemini path. The web is stuck on opus (all a
/// browser emits); Flutter is not, so we deliberately record WAV. See
/// `SPEC_voice_vidya.md` §A.2 / §C.2.
const int kRecorderSampleRate = 16000;
const int kRecorderNumChannels = 1;

/// Maps a dBFS amplitude reading (0 dB = loudest, quiet room ≈ −45 dB) into a
/// 0..1 level the listening ring animates on. Clamped and NaN/∞-safe so a bad
/// reading never throws inside an animation tick. [floorDb] is the quietest
/// reading pinned to 0.
double normaliseAmplitudeDb(double db, {double floorDb = -45.0}) {
  if (floorDb >= 0) return 0; // guard against a nonsensical floor
  if (db.isNaN || db.isInfinite) return 0;
  final clamped = db.clamp(floorDb, 0.0);
  return ((clamped - floorDb) / (0 - floorDb)).clamp(0.0, 1.0);
}

/// A completed capture: the on-device WAV [path] the multipart upload streams
/// from (U-V2) and its [byteLength]. [readBytes] loads the bytes on demand for
/// callers that need them in memory (e.g. the `< 2000` byte silence reject).
@immutable
class Recording {
  const Recording({required this.path, required this.byteLength});

  final String path;
  final int byteLength;

  /// The multipart filename + content type the STT route keys the Sarvam fast
  /// path on. Kept here so the repository and the recorder agree on one source
  /// of truth.
  static const String uploadFilename = 'recording.wav';
  static const String uploadContentType = 'audio/wav';

  Future<Uint8List> readBytes() => File(path).readAsBytes();
}

/// Captures the teacher's spoken request. The one seam tests override so no
/// unit test ever opens a real microphone (mirrors `ImagePickerService`).
///
/// Lifecycle: [start] → the teacher speaks (drives [amplitude]) → [stop]
/// returns the [Recording], or [cancel] aborts and discards it (the "tap again
/// while recording = cancel" gesture from the web state machine).
abstract interface class AudioRecorderService {
  /// Whether RECORD_AUDIO is granted. The impl asks the OS; a fake answers from
  /// a field.
  Future<bool> hasPermission();

  /// True between a [start] and its [stop]/[cancel].
  bool get isRecording;

  /// Normalised (0..1) input levels while recording, for the listening ring.
  /// A broadcast stream; emits nothing while idle.
  Stream<double> get amplitude;

  /// Begins capturing WAV 16 kHz mono to a temp file. A no-op if already
  /// recording.
  Future<void> start();

  /// Stops and returns the completed [Recording] (path + byte length), or null
  /// when nothing was captured.
  Future<Recording?> stop();

  /// Aborts the current capture and deletes the temp file. Safe when idle.
  Future<void> cancel();

  /// Releases native resources and closes the amplitude stream.
  Future<void> dispose();
}

/// The production [AudioRecorderService], backed by `record`.
///
/// Records WAV 16 kHz mono (the Sarvam fast path) to a `path_provider` temp
/// file and forwards `record`'s dB amplitude — normalised through
/// [normaliseAmplitudeDb] — onto a broadcast stream for the listening ring.
class RecordAudioRecorderService implements AudioRecorderService {
  RecordAudioRecorderService([AudioRecorder? recorder])
      : _recorder = recorder ?? AudioRecorder();

  final AudioRecorder _recorder;
  final StreamController<double> _amplitude =
      StreamController<double>.broadcast();
  StreamSubscription<Amplitude>? _amplitudeSub;
  String? _activePath;
  bool _isRecording = false;

  @override
  Future<bool> hasPermission() => _recorder.hasPermission();

  @override
  bool get isRecording => _isRecording;

  @override
  Stream<double> get amplitude => _amplitude.stream;

  @override
  Future<void> start() async {
    if (_isRecording) return;
    final dir = await getTemporaryDirectory();
    final path =
        '${dir.path}/vidya_utterance_${DateTime.now().millisecondsSinceEpoch}.wav';
    await _recorder.start(
      const RecordConfig(
        encoder: AudioEncoder.wav,
        sampleRate: kRecorderSampleRate,
        numChannels: kRecorderNumChannels,
        // Match the web capture constraints: autoGain OFF (the web sets
        // autoGainControl:false) so the ported VAD thresholds stay comparable;
        // echo cancellation + noise suppression ON for cleaner classroom audio.
        autoGain: false,
        echoCancel: true,
        noiseSuppress: true,
      ),
      path: path,
    );
    _activePath = path;
    _isRecording = true;
    _amplitudeSub = _recorder
        .onAmplitudeChanged(const Duration(milliseconds: 100))
        .listen((amp) {
      if (!_amplitude.isClosed) {
        _amplitude.add(normaliseAmplitudeDb(amp.current));
      }
    });
  }

  @override
  Future<Recording?> stop() async {
    if (!_isRecording) return null;
    await _amplitudeSub?.cancel();
    _amplitudeSub = null;
    final stopped = await _recorder.stop();
    _isRecording = false;
    final resolved = stopped ?? _activePath;
    _activePath = null;
    if (resolved == null) return null;
    final file = File(resolved);
    if (!file.existsSync()) return null;
    return Recording(path: resolved, byteLength: file.lengthSync());
  }

  @override
  Future<void> cancel() async {
    await _amplitudeSub?.cancel();
    _amplitudeSub = null;
    if (_isRecording) {
      await _recorder.cancel();
      _isRecording = false;
    }
    final path = _activePath;
    _activePath = null;
    if (path != null) {
      final file = File(path);
      if (file.existsSync()) {
        try {
          file.deleteSync();
        } catch (_) {
          // A leftover temp file is harmless; never surface a delete failure.
        }
      }
    }
  }

  @override
  Future<void> dispose() async {
    await _amplitudeSub?.cancel();
    _amplitudeSub = null;
    if (!_amplitude.isClosed) await _amplitude.close();
    await _recorder.dispose();
  }
}

/// The injectable recorder. Override this provider in tests with a fake so the
/// controller under test never touches the microphone. Kept alive so the single
/// recorder follows VIDYA across navigation.
@Riverpod(keepAlive: true)
AudioRecorderService audioRecorderService(Ref ref) {
  final service = RecordAudioRecorderService();
  ref.onDispose(service.dispose);
  return service;
}
