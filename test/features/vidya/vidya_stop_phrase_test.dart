import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/vidya/domain/vidya_stop_phrase.dart';

void main() {
  group('ends the conversation', () {
    test('English, with or without politeness', () {
      expect(isVidyaStopPhrase('stop'), isTrue);
      expect(isVidyaStopPhrase('Stop.'), isTrue);
      expect(isVidyaStopPhrase("That's all, thank you"), isTrue);
      expect(isVidyaStopPhrase('ok VIDYA, stop listening'), isTrue);
      expect(isVidyaStopPhrase('bye'), isTrue);
    });

    test('Hindi and Hinglish, with or without the nukta', () {
      expect(isVidyaStopPhrase('बस'), isTrue);
      expect(isVidyaStopPhrase('ठीक है, बस करो'), isTrue);
      expect(isVidyaStopPhrase('धन्यवाद, रुक जाओ'), isTrue);
      expect(isVidyaStopPhrase('bas karo'), isTrue);
    });

    test('each Indic language has its goodbye', () {
      for (final phrase in const [
        'থামো',
        'બસ',
        'ನಿಲ್ಲಿಸು',
        'നിർത്തൂ',
        'थांबा',
        'ବନ୍ଦ କର',
        'ਬੱਸ',
        'நிறுத்து',
        'ఆపు',
      ]) {
        expect(isVidyaStopPhrase(phrase), isTrue, reason: phrase);
      }
    });
  });

  group('is a request, not a goodbye', () {
    test('a stop word inside a real request', () {
      expect(isVidyaStopPhrase('stop the lesson at chapter 3'), isFalse);
      expect(isVidyaStopPhrase('बस का किराया कितना है'), isFalse);
      expect(isVidyaStopPhrase('make a quiz, then stop'), isFalse);
    });

    test('politeness alone, or nothing at all', () {
      expect(isVidyaStopPhrase('thank you'), isFalse);
      expect(isVidyaStopPhrase(''), isFalse);
      expect(isVidyaStopPhrase('   '), isFalse);
    });
  });
}
