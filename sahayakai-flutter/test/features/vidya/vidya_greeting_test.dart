import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_greeting.dart';
import 'package:sahayakai/shared/voice/audio_player_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import '../../support/fake_voice.dart';

/// The mother-tongue greeting seam. It reuses the existing TTS stack (POST
/// `/api/tts` via a [FakeApiClient], never the network), so these pin the three
/// guards without any audio hardware: spoken ONCE per session, in the teacher's
/// language, and NEVER under reduce-motion (no surprise audio).
const String _b64 = 'ZmFrZS1tcDM='; // base64("fake-mp3")

void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  /// Pumps a bare ProviderScope with a faked TTS stack and captures a WidgetRef
  /// the test can hand to [maybeSpeakVidyaGreeting].
  Future<(FakeApiClient, WidgetRef)> pump(WidgetTester tester) async {
    final client = FakeApiClient(postResponse: {'audioContent': _b64});
    late WidgetRef captured;
    await tester.pumpWidget(ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(client),
        audioPlayerServiceProvider.overrideWithValue(FakeAudioPlayerService()),
      ],
      child: Consumer(builder: (context, ref, _) {
        captured = ref;
        return const SizedBox();
      }),
    ));
    return (client, captured);
  }

  List<({String path, Object? data})> ttsPosts(FakeApiClient c) =>
      c.posts.where((p) => p.path == '/api/tts').toList();

  testWidgets('speaks the greeting once, in the teacher language, motion on',
      (tester) async {
    final (client, ref) = await pump(tester);
    maybeSpeakVidyaGreeting(ref,
        motionEnabled: true, greeting: 'Welcome, teacher.');
    await tester.pumpAndSettle();

    final posts = ttsPosts(client);
    expect(posts, hasLength(1), reason: 'the greeting is synthesised once');
    final data = posts.single.data! as Map;
    expect(data['text'], 'Welcome, teacher.');
    // Default (English) locale -> en-IN; proves the language is threaded from
    // localeControllerProvider, not hard-coded.
    expect(data['targetLang'], 'en-IN');
  });

  testWidgets('does not re-speak within the same session', (tester) async {
    final (client, ref) = await pump(tester);
    maybeSpeakVidyaGreeting(ref, motionEnabled: true, greeting: 'Hi');
    await tester.pumpAndSettle();
    // A second call (a home rebuild / tab return) must be a no-op.
    maybeSpeakVidyaGreeting(ref, motionEnabled: true, greeting: 'Hi');
    await tester.pumpAndSettle();
    expect(ttsPosts(client), hasLength(1));
  });

  testWidgets('reduce-motion suppresses the greeting (no surprise audio)',
      (tester) async {
    final (client, ref) = await pump(tester);
    maybeSpeakVidyaGreeting(ref, motionEnabled: false, greeting: 'Hi');
    await tester.pumpAndSettle();
    expect(ttsPosts(client), isEmpty);
  });
}
