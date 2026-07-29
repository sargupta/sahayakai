import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/shared/voice/audio_recorder_service.dart';

/// A fake recorder that never opens a microphone. It records the lifecycle
/// calls and lets a test push amplitude values by hand, so the controller layer
/// (U-V3) and the widgets can be driven deterministically. This is the seam the
/// provider override swaps in.
class FakeAudioRecorderService implements AudioRecorderService {
  FakeAudioRecorderService({
    this.granted = true,
    this.stopResult = const Recording(path: '/tmp/fake.wav', byteLength: 4096),
  });

  bool granted;
  Recording? stopResult;

  int startCount = 0;
  int stopCount = 0;
  int cancelCount = 0;
  bool disposed = false;

  final StreamController<double> _amplitude =
      StreamController<double>.broadcast();
  bool _isRecording = false;

  void emitAmplitude(double level) => _amplitude.add(level);

  @override
  Future<bool> hasPermission() async => granted;

  @override
  bool get isRecording => _isRecording;

  @override
  Stream<double> get amplitude => _amplitude.stream;

  @override
  Future<void> start() async {
    startCount++;
    _isRecording = true;
  }

  int startStreamCount = 0;
  final StreamController<Uint8List> _pcmStream =
      StreamController<Uint8List>.broadcast();

  @override
  Future<Stream<Uint8List>> startStream() async {
    startStreamCount++;
    _isRecording = true;
    return _pcmStream.stream;
  }

  @override
  Future<Recording?> stop() async {
    stopCount++;
    _isRecording = false;
    return stopResult;
  }

  @override
  Future<void> cancel() async {
    cancelCount++;
    _isRecording = false;
  }

  @override
  Future<void> dispose() async {
    disposed = true;
    await _amplitude.close();
    await _pcmStream.close();
  }
}

void main() {
  group('normaliseAmplitudeDb', () {
    test('0 dB (loudest) maps to 1.0', () {
      expect(normaliseAmplitudeDb(0), 1.0);
    });

    test('the floor maps to 0.0', () {
      expect(normaliseAmplitudeDb(-45), 0.0);
    });

    test('a mid reading lands mid-range', () {
      // Halfway between the -45 floor and 0 dB ceiling.
      expect(normaliseAmplitudeDb(-22.5), closeTo(0.5, 0.001));
    });

    test('anything below the floor clamps to 0, never negative', () {
      expect(normaliseAmplitudeDb(-120), 0.0);
    });

    test('a positive reading clamps to 1, never over', () {
      expect(normaliseAmplitudeDb(6), 1.0);
    });

    test('NaN / infinity never throw inside an animation tick', () {
      expect(normaliseAmplitudeDb(double.nan), 0.0);
      expect(normaliseAmplitudeDb(double.infinity), 0.0);
      expect(normaliseAmplitudeDb(double.negativeInfinity), 0.0);
    });
  });

  group('Recording — the upload contract the STT route keys Sarvam on', () {
    test('filename and content type are WAV, not opus', () {
      // The Sarvam Saaras v3 fast path only fires for audio/(mpeg|mp3|wav).
      expect(Recording.uploadFilename, 'recording.wav');
      expect(Recording.uploadContentType, 'audio/wav');
    });

    test('carries the path and byte length the multipart upload needs', () {
      const rec = Recording(path: '/tmp/vidya_utterance.wav', byteLength: 8192);
      expect(rec.path, '/tmp/vidya_utterance.wav');
      expect(rec.byteLength, 8192);
    });
  });

  group('AudioRecorderService fake — the seam tests drive', () {
    test('start/stop toggles isRecording and returns the recording', () async {
      final recorder = FakeAudioRecorderService();
      expect(recorder.isRecording, isFalse);

      await recorder.start();
      expect(recorder.isRecording, isTrue);
      expect(recorder.startCount, 1);

      final rec = await recorder.stop();
      expect(recorder.isRecording, isFalse);
      expect(rec?.byteLength, 4096);
    });

    test('cancel resets recording without producing a Recording', () async {
      final recorder = FakeAudioRecorderService();
      await recorder.start();
      await recorder.cancel();
      expect(recorder.isRecording, isFalse);
      expect(recorder.cancelCount, 1);
    });

    test('amplitude stream forwards the pushed levels for the ring', () async {
      final recorder = FakeAudioRecorderService();
      final seen = <double>[];
      final sub = recorder.amplitude.listen(seen.add);
      recorder
        ..emitAmplitude(0.2)
        ..emitAmplitude(0.9);
      await Future<void>.delayed(Duration.zero);
      await sub.cancel();
      expect(seen, [0.2, 0.9]);
    });

    test('hasPermission answers from the field, never the OS', () async {
      expect(await FakeAudioRecorderService(granted: false).hasPermission(),
          isFalse);
      expect(await FakeAudioRecorderService().hasPermission(), isTrue);
    });
  });

  group('audioRecorderServiceProvider', () {
    test('is overridable with a fake so nothing touches the mic', () {
      final fake = FakeAudioRecorderService();
      final container = ProviderContainer(overrides: [
        audioRecorderServiceProvider.overrideWithValue(fake),
      ]);
      addTearDown(container.dispose);

      expect(container.read(audioRecorderServiceProvider), same(fake));
    });
  });
}
