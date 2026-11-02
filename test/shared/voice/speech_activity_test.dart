import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/shared/voice/speech_activity.dart';

void main() {
  test('the first reading is the room, never speech', () {
    final speech = SpeechActivity();
    expect(speech.add(0.5), isFalse);
    expect(speech.room, 0.5);
  });

  test('speech starts on the second reading above the room', () {
    final speech = SpeechActivity()..add(0.05);
    expect(speech.add(0.4), isFalse, reason: 'one loud reading is a click');
    expect(speech.add(0.4), isTrue);
    expect(speech.speechStarted, isTrue);
  });

  test('a single click never starts speech', () {
    final speech = SpeechActivity()..add(0.05);
    expect(speech.add(0.9), isFalse);
    for (var i = 0; i < 10; i++) {
      expect(speech.add(0.05), isFalse);
    }
    expect(speech.speechStarted, isFalse);
  });

  test('a steady hum louder than the old fixed onset is the room', () {
    final speech = SpeechActivity();
    for (var i = 0; i < 20; i++) {
      expect(speech.add(i.isEven ? 0.30 : 0.33), isFalse);
    }
    expect(speech.add(0.6), isFalse);
    expect(speech.add(0.6), isTrue, reason: 'speech over the hum');
    expect(speech.add(0.32), isFalse, reason: 'back to the hum is silence');
  });

  test(
    'talking from the first reading is recognised once the room is heard',
    () {
      final speech = SpeechActivity();
      expect(speech.add(0.6), isFalse);
      expect(speech.add(0.6), isFalse);
      expect(speech.add(0.1), isTrue, reason: 'the pause shows the room');
    },
  );

  test('soft sound above the room counts as heard', () {
    final speech = SpeechActivity()
      ..add(0.05)
      ..add(0.12);
    expect(speech.speechStarted, isFalse);
    expect(speech.soundHeard, isTrue);
  });

  test('on a dead-silent line flickers are not speech', () {
    final speech = SpeechActivity()..add(0);
    expect(speech.onset, kSpeechMargin);
    expect(speech.add(0.1), isFalse);
    expect(speech.add(0.1), isFalse);
  });

  test('reset forgets the capture', () {
    final speech = SpeechActivity()
      ..add(0.05)
      ..add(0.5)
      ..add(0.5)
      ..reset();
    expect(speech.speechStarted, isFalse);
    expect(speech.peak, 0);
    expect(speech.room, 0);
  });
}
