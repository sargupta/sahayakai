import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/shared/voice/os_tts_service.dart';

/// VIDYA's on-device voice must be slightly SLOWER than normal speech.
///
/// flutter_tts treats 0.5 as normal speed (Android doubles the value before
/// `TextToSpeech.setSpeechRate`), so the rate it is handed must stay below
/// 0.5. The old 0.85 played at about 1.7× and teachers found her rushed.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('flutter_tts');
  final calls = <MethodCall>[];
  // What the Android plugin answers: 1 / 0 (ints), never a bool.
  var languageReply = 1;

  setUp(() {
    calls.clear();
    languageReply = 1;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
          calls.add(call);
          return call.method == 'setLanguage' ? languageReply : 1;
        });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  test('the speech rate is a little below normal (0.5)', () {
    expect(kVidyaOsSpeechRate, lessThan(0.5));
    expect(kVidyaOsSpeechRate, greaterThanOrEqualTo(0.4));
  });

  // The service is a process-wide singleton, so these run in order: the
  // first initialize configures the engine, later ones only switch language.
  test('the first initialize hands that rate, normal pitch and full volume to '
      'the engine, and reads the int reply Android gives', () async {
    expect(await OsTtsService.instance.initialize('en-IN'), isTrue);

    final byName = {for (final c in calls) c.method: c.arguments};
    expect(byName['setSpeechRate'], kVidyaOsSpeechRate);
    expect(byName['setPitch'], 1.0);
    expect(byName['setVolume'], 1.0);
    expect(byName['setLanguage'], 'en-IN');
    // One pitch call, not a pitch that is set and then overridden.
    expect(calls.where((c) => c.method == 'setPitch'), hasLength(1));
  });

  test(
    'a later initialize reports an unavailable language (0) as false',
    () async {
      languageReply = 0;
      expect(await OsTtsService.instance.initialize('or-IN'), isFalse);
      expect(calls.map((c) => c.method), ['setLanguage']);
    },
  );
}
