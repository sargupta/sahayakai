// ignore_for_file: experimental_member_use
import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/shared/voice/audio_player_service.dart';

/// A fake player that never opens a speaker. Records what it was asked to play,
/// so the controller layer (U-V3) can assert "VIDYA spoke this reply" without
/// audio hardware. The seam the provider override swaps in.
class FakeAudioPlayerService implements AudioPlayerService {
  final List<String> played = <String>[];
  int stopCount = 0;
  bool disposed = false;
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

  int pcmStreamCount = 0;

  @override
  Future<int?> playPcmStream(Stream<Uint8List> pcm) async {
    pcmStreamCount++;
    final id = ++_session;
    unawaited(pcm.drain<void>());
    if (!_progress.isClosed) _progress.add(PlaybackProgress(id, true));
    return id;
  }

  @override
  Future<void> stop() async => stopCount++;

  @override
  Future<void> dispose() async {
    disposed = true;
    if (!_progress.isClosed) await _progress.close();
  }
}

void main() {
  // A tiny, valid base64 payload standing in for the mp3 the TTS route returns.
  final rawBytes = Uint8List.fromList([0x49, 0x44, 0x33, 0x04, 0x00, 0x01]);
  final validB64 = base64Encode(rawBytes);

  group('decodeBase64Mp3', () {
    test('round-trips a plain base64 payload', () {
      expect(decodeBase64Mp3(validB64), rawBytes);
    });

    test('strips a data: URI prefix (a lenient reply still plays)', () {
      expect(decodeBase64Mp3('data:audio/mpeg;base64,$validB64'), rawBytes);
    });

    test('tolerates embedded whitespace / newlines', () {
      final withWs = '${validB64.substring(0, 4)}\n  ${validB64.substring(4)}';
      expect(decodeBase64Mp3(withWs), rawBytes);
    });

    test('empty input degrades to silence, not a throw', () {
      expect(decodeBase64Mp3(''), isEmpty);
      expect(decodeBase64Mp3('   '), isEmpty);
      expect(decodeBase64Mp3('data:audio/mpeg;base64,'), isEmpty);
    });

    test('garbage degrades to silence, not a throw', () {
      expect(decodeBase64Mp3('!!!not base64!!!'), isEmpty);
    });
  });

  group('Base64Mp3Source — in-memory mp3 for just_audio', () {
    test('a full request returns audio/mpeg and every byte', () async {
      final source = Base64Mp3Source(rawBytes);
      final res = await source.request();

      expect(res.contentType, 'audio/mpeg');
      expect(res.sourceLength, rawBytes.length);
      expect(res.offset, 0);
      expect(res.contentLength, rawBytes.length);

      final collected = <int>[];
      await for (final chunk in res.stream) {
        collected.addAll(chunk);
      }
      expect(collected, rawBytes);
    });

    test(
      'a ranged request returns the correct slice with its offset',
      () async {
        final source = Base64Mp3Source(rawBytes);
        final res = await source.request(2, 5);

        expect(res.offset, 2);
        expect(res.contentLength, 3);
        expect(res.sourceLength, rawBytes.length);

        final collected = <int>[];
        await for (final chunk in res.stream) {
          collected.addAll(chunk);
        }
        expect(collected, rawBytes.sublist(2, 5));
      },
    );
  });

  group('AudioPlayerService fake — the seam tests drive', () {
    test('playBase64Mp3 records what VIDYA was asked to speak', () async {
      final player = FakeAudioPlayerService();
      await player.playBase64Mp3('abc');
      await player.playBase64Mp3('def');
      expect(player.played, ['abc', 'def']);
    });

    test('stop is observable (VIDYA cancel / mic re-tap)', () async {
      final player = FakeAudioPlayerService();
      await player.stop();
      expect(player.stopCount, 1);
    });
  });

  group('audioPlayerServiceProvider', () {
    test('is overridable with a fake so nothing touches the speaker', () {
      final fake = FakeAudioPlayerService();
      final container = ProviderContainer(
        overrides: [audioPlayerServiceProvider.overrideWithValue(fake)],
      );
      addTearDown(container.dispose);

      expect(container.read(audioPlayerServiceProvider), same(fake));
    });
  });
}
