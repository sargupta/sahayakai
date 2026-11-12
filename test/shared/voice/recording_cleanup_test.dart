import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/shared/voice/audio_recorder_service.dart';

/// A teacher's voice (and her class's, in a roll call) must not stay on the
/// device after the request it was recorded for. Before this, every capture
/// was left in the app cache forever.
void main() {
  late Directory dir;

  setUp(() async {
    dir = await Directory.systemTemp.createTemp('recording_cleanup_test');
  });

  tearDown(() async {
    if (dir.existsSync()) await dir.delete(recursive: true);
  });

  Future<Recording> capture(String name, {int bytes = 4096}) async {
    final file = File('${dir.path}/$name');
    await file.writeAsBytes(List<int>.filled(bytes, 7));
    return Recording(path: file.path, byteLength: bytes);
  }

  test('takeBytes hands over the audio and deletes the file', () async {
    final rec = await capture('${kUtterancePrefix}1.wav');
    final bytes = await rec.takeBytes();
    expect(bytes, hasLength(4096));
    expect(File(rec.path).existsSync(), isFalse);
  });

  test('takeBytes deletes the file even when the read fails', () async {
    final rec = _FailingRead(await capture('${kUtterancePrefix}2.wav'));
    await expectLater(rec.takeBytes(), throwsA(isA<FileSystemException>()));
    expect(File(rec.path).existsSync(), isFalse);
  });

  test(
    'discard deletes the file, and is safe when it is already gone',
    () async {
      final rec = await capture('${kUtterancePrefix}3.wav');
      await rec.discard();
      expect(File(rec.path).existsSync(), isFalse);
      await rec.discard(); // no throw
    },
  );

  test('the sweep removes only leftover captures, never the one in progress '
      'or unrelated files', () async {
    final old1 = await capture('${kUtterancePrefix}10.wav');
    final old2 = await capture('${kUtterancePrefix}11.wav');
    final current = await capture('${kUtterancePrefix}12.wav');
    final other = await capture('lesson_export.wav');
    final notWav = await capture('${kUtterancePrefix}notes.txt');

    await sweepLeftoverUtterances(dir, keep: current.path);

    expect(File(old1.path).existsSync(), isFalse);
    expect(File(old2.path).existsSync(), isFalse);
    expect(File(current.path).existsSync(), isTrue);
    expect(File(other.path).existsSync(), isTrue);
    expect(File(notWav.path).existsSync(), isTrue);
  });

  test('the sweep never throws on a missing directory', () async {
    await sweepLeftoverUtterances(Directory('${dir.path}/missing'));
  });
}

/// A recording whose read fails (the file vanished, storage error), to prove
/// the delete still happens.
class _FailingRead extends Recording {
  _FailingRead(Recording r) : super(path: r.path, byteLength: r.byteLength);

  @override
  Future<Uint8List> readBytes() =>
      Future<Uint8List>.error(const FileSystemException('read failed'));
}
