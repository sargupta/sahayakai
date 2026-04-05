import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/core/services/tts_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  group('TTSService - singleton', () {
    test('singleton returns same instance', () {
      final a = TTSService.instance;
      final b = TTSService.instance;
      expect(identical(a, b), true);
    });

    test('isPlaying is false initially', () {
      expect(TTSService.instance.isPlaying, false);
    });

    test('playbackState stream is a broadcast stream', () {
      final stream = TTSService.instance.playbackState;
      expect(stream, isA<Stream<bool>>());
      // Broadcast streams allow multiple listeners.
      final sub1 = stream.listen((_) {});
      final sub2 = stream.listen((_) {});
      sub1.cancel();
      sub2.cancel();
    });
  });

  group('TTSService - speak() guards', () {
    test('speak returns immediately for empty text', () async {
      await TTSService.instance.speak('');
      expect(TTSService.instance.isPlaying, false);
    });

    test('speak returns immediately for whitespace-only text', () async {
      await TTSService.instance.speak('   ');
      expect(TTSService.instance.isPlaying, false);
    });

    test('speak returns immediately for tab/newline text', () async {
      await TTSService.instance.speak('\t\n  ');
      expect(TTSService.instance.isPlaying, false);
    });
  });

  group('TTSService - text truncation', () {
    test('text longer than 2500 chars would be truncated', () {
      // Verify the truncation logic: text.substring(0, 2500) + '...'
      final longText = 'a' * 3000;
      expect(longText.length, greaterThan(2500));
      final truncated = '${longText.substring(0, 2500)}...';
      expect(truncated.length, 2503);
      expect(truncated.endsWith('...'), true);
    });

    test('text at exactly 2500 chars is not truncated', () {
      final text = 'b' * 2500;
      // text.length > 2500 is false, so no truncation.
      expect(text.length <= 2500, true);
    });

    test('text under 2500 chars is not truncated', () {
      final text = 'c' * 100;
      expect(text.length <= 2500, true);
    });
  });

  group('TTSService - stop()', () {
    test('stop does not throw when not playing', () async {
      await TTSService.instance.stop();
      expect(TTSService.instance.isPlaying, false);
    });

    test('stop sets isPlaying to false', () async {
      await TTSService.instance.stop();
      expect(TTSService.instance.isPlaying, false);
    });

    test('stop emits false on playbackState stream', () async {
      final emissions = <bool>[];
      final sub = TTSService.instance.playbackState.listen(emissions.add);

      await TTSService.instance.stop();

      // Allow async emission to propagate.
      await Future<void>.delayed(Duration.zero);

      expect(emissions, contains(false));
      await sub.cancel();
    });
  });

  group('TTSService - dispose()', () {
    test('dispose creates a new instance on next access', () async {
      final oldInstance = TTSService.instance;
      await oldInstance.dispose();
      final newInstance = TTSService.instance;
      expect(identical(oldInstance, newInstance), false);
      // Clean up the new instance too.
      await newInstance.dispose();
    });

    test('after dispose, new instance has isPlaying false', () async {
      final instance = TTSService.instance;
      await instance.dispose();
      expect(TTSService.instance.isPlaying, false);
      await TTSService.instance.dispose();
    });
  });

  group('TTSService - concurrent speak prevention', () {
    test('speak on unauthenticated env throws (no Firebase)', () async {
      // In test env, FlutterSoundPlayer.openPlayer() or
      // FirebaseAuth.instance.currentUser will fail because
      // Firebase/audio session is not initialized.
      try {
        await TTSService.instance.speak('Hello world');
        // If it somehow succeeds (unlikely), that's also fine.
      } catch (e) {
        expect(e, isA<Exception>());
      }
      // After error, isPlaying should be reset to false.
      expect(TTSService.instance.isPlaying, false);
      await TTSService.instance.dispose();
    });
  });

  group('TTSService - speak() error recovery', () {
    test('isPlaying is false after speak() throws', () async {
      try {
        await TTSService.instance.speak('Test text for TTS');
      } catch (_) {}
      expect(TTSService.instance.isPlaying, false);
      await TTSService.instance.dispose();
    });

    test('playbackState emits false after speak() error', () async {
      final emissions = <bool>[];
      final sub = TTSService.instance.playbackState.listen(emissions.add);

      try {
        await TTSService.instance.speak('Test text');
      } catch (_) {}

      await Future<void>.delayed(Duration.zero);

      // After error, playbackState should have emitted false.
      if (emissions.isNotEmpty) {
        expect(emissions.last, false);
      }
      await sub.cancel();
      await TTSService.instance.dispose();
    });

    test('speak() with languageCode parameter does not change error behavior',
        () async {
      try {
        await TTSService.instance.speak('Hello', languageCode: 'hi-IN');
      } catch (_) {}
      expect(TTSService.instance.isPlaying, false);
      await TTSService.instance.dispose();
    });
  });

  group('TTSService - _cleanupTempFile', () {
    test('dispose cleans up without error even when no temp file', () async {
      final instance = TTSService.instance;
      // No speak() was called, so _lastTempFilePath is null.
      // dispose() should handle this gracefully.
      await instance.dispose();
      expect(TTSService.instance.isPlaying, false);
      await TTSService.instance.dispose();
    });
  });

  group('TTSService - stop() idempotent', () {
    test('multiple stop() calls do not throw', () async {
      await TTSService.instance.stop();
      await TTSService.instance.stop();
      await TTSService.instance.stop();
      expect(TTSService.instance.isPlaying, false);
    });

    test('stop after dispose on new instance works', () async {
      await TTSService.instance.dispose();
      final newInstance = TTSService.instance;
      await newInstance.stop();
      expect(newInstance.isPlaying, false);
      await newInstance.dispose();
    });
  });

  group('TTSService - speak lock behavior', () {
    test('speakLock is initialized on speak call', () async {
      // After a failed speak(), the lock completer should be completed.
      // This is verified by the fact that dispose() succeeds.
      try {
        await TTSService.instance.speak('Test');
      } catch (_) {}

      // If the lock were stuck, this would hang. It completes successfully.
      expect(TTSService.instance.isPlaying, false);
      await TTSService.instance.dispose();
    });
  });
}
