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

  // Class gate (2026-11-13, reproduced on the emulator): whatever the room
  // sounds like and however the mic starts, once the teacher stops talking
  // the room must be back below the onset within the room window, or the
  // trailing silence never comes and the capture runs to the 30 s cap.
  group('the capture always ends when the talking ends', () {
    test('mic warm-up zeros are not the room', () {
      final speech = SpeechActivity();
      for (var i = 0; i < 4; i++) {
        expect(speech.add(0), isFalse, reason: 'warm-up');
      }
      // A normal background hum, louder than a dead line.
      for (var i = 0; i < 15; i++) {
        expect(
          speech.add(i.isEven ? 0.25 : 0.27),
          isFalse,
          reason: 'the hum is the room, not speech',
        );
      }
      expect(speech.room, closeTo(0.25, 1e-9));
      expect(speech.add(0.6), isFalse);
      expect(speech.add(0.6), isTrue, reason: 'speech over the hum');
      expect(speech.add(0.26), isFalse, reason: 'back to the hum is silence');
    });

    test('a hum that starts after a quiet moment becomes the room within '
        'the window', () {
      final speech = SpeechActivity();
      for (var i = 0; i < 5; i++) {
        speech.add(0.02); // quiet start
      }
      // A fan switches on (or the room was never as quiet as the first
      // readings said): at first it looks like speech…
      var lastSpeech = -1;
      for (var i = 0; i < kRoomWindow + 10; i++) {
        if (speech.add(i.isEven ? 0.30 : 0.33)) lastSpeech = i;
      }
      // …but within the room window it is the room, and stays silent.
      expect(lastSpeech, lessThan(kRoomWindow));
      expect(speech.add(0.31), isFalse);
    });

    test('dips between words keep the room down while the teacher talks', () {
      final speech = SpeechActivity()..add(0.05);
      // 6 s of talking: syllables at 0.6 with short dips to near the room.
      var silentReadings = 0;
      for (var i = 0; i < 60; i++) {
        final level = i % 4 == 3 ? 0.08 : 0.6;
        if (!speech.add(level) && level == 0.6) silentReadings++;
      }
      expect(
        silentReadings,
        lessThanOrEqualTo(1),
        reason: 'the talking itself must stay speech, or she is cut off',
      );
    });
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
