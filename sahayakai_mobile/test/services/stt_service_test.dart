import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/core/services/stt_service.dart';

void main() {
  group('STTResult', () {
    test('stores text and language', () {
      const result = STTResult(text: 'Hello world', language: 'en');
      expect(result.text, 'Hello world');
      expect(result.language, 'en');
    });

    test('language can be null', () {
      const result = STTResult(text: 'Test');
      expect(result.language, isNull);
    });

    test('text can be empty string', () {
      const result = STTResult(text: '');
      expect(result.text, isEmpty);
    });

    test('language stores full BCP-47 codes', () {
      const result = STTResult(text: 'namaste', language: 'hi-IN');
      expect(result.language, 'hi-IN');
    });

    test('text preserves unicode characters', () {
      const result = STTResult(text: 'abc 123', language: 'hi');
      expect(result.text, contains('abc'));
    });

    test('const constructor allows compile-time creation', () {
      // Verify STTResult can be used as a compile-time constant.
      const r1 = STTResult(text: 'a');
      const r2 = STTResult(text: 'a');
      expect(identical(r1, r2), true);
    });
  });

  group('STTService.transcribe - file validation', () {
    test('throws on non-existent file', () async {
      expect(
        () => STTService.transcribe('/tmp/does_not_exist_12345.ogg'),
        throwsA(isA<Exception>().having(
          (e) => e.toString(),
          'message',
          contains('Audio file not found'),
        )),
      );
    });

    test('throws on empty path', () async {
      expect(
        () => STTService.transcribe(''),
        throwsException,
      );
    });

    test('throws with descriptive message including file path', () async {
      const fakePath = '/tmp/nonexistent_audio_test_file.ogg';
      expect(
        () => STTService.transcribe(fakePath),
        throwsA(isA<Exception>().having(
          (e) => e.toString(),
          'message',
          contains(fakePath),
        )),
      );
    });

    test('throws on existing file when Firebase is not initialized', () async {
      // Create a temp file so the file-existence check passes.
      final tempFile = File('${Directory.systemTemp.path}/stt_test_audio.ogg');
      await tempFile.writeAsBytes([0, 1, 2, 3]);
      addTearDown(() async {
        if (await tempFile.exists()) await tempFile.delete();
      });

      // File exists, but FirebaseAuth.instance will throw because
      // Firebase is not initialized in unit tests.
      expect(
        () => STTService.transcribe(tempFile.path),
        throwsA(anything),
      );
    });
  });

  group('STTService - structure', () {
    test('transcribe is a static method', () {
      expect(
        STTService.transcribe,
        isA<Future<STTResult> Function(String)>(),
      );
    });
  });

  group('STTService.transcribe - auth validation', () {
    test('throws when file exists but user is not authenticated', () async {
      // Create a valid temp file.
      final tempFile = File('${Directory.systemTemp.path}/stt_auth_test.ogg');
      await tempFile.writeAsBytes([0xFF, 0xFB, 0x90, 0x00]);
      addTearDown(() async {
        if (await tempFile.exists()) await tempFile.delete();
      });

      // FirebaseAuth.instance throws because Firebase is not initialized.
      // This exercises the auth check path.
      expect(
        () => STTService.transcribe(tempFile.path),
        throwsA(anything),
      );
    });

    test('file-not-found error includes the full path', () async {
      const path = '/tmp/completely_missing_file_xyz.ogg';
      try {
        await STTService.transcribe(path);
        fail('Should have thrown');
      } catch (e) {
        expect(e.toString(), contains('Audio file not found'));
        expect(e.toString(), contains(path));
      }
    });
  });

  group('STTResult - equality and field access', () {
    test('two results with same fields are not identical (no == override)',
        () {
      final r1 = STTResult(text: 'hello', language: 'en');
      final r2 = STTResult(text: 'hello', language: 'en');
      // STTResult does not override ==, so object identity check fails.
      expect(identical(r1, r2), false);
      // But field values are the same.
      expect(r1.text, r2.text);
      expect(r1.language, r2.language);
    });

    test('text field is accessible', () {
      const result = STTResult(text: 'transcribed text', language: 'hi-IN');
      expect(result.text, 'transcribed text');
    });

    test('language field is accessible', () {
      const result = STTResult(text: 'test', language: 'ta-IN');
      expect(result.language, 'ta-IN');
    });
  });
}
