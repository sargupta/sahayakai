import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/lesson_planner/domain/lesson_plan.dart';
import 'package:sahayakai/features/lesson_planner/presentation/widgets/lesson_plan_result_view.dart';
import 'package:sahayakai/shared/voice/audio_player_service.dart';
import 'package:sahayakai/shared/widgets/read_aloud_button.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import '../../support/fake_voice.dart';

/// VOICE_FIRST_GAP §5.6 part A — the "hear the result" half of the loop. The
/// read-aloud control reuses the *existing* TTS stack (no new path): it POSTs
/// the readable text to `/api/tts` (here a [FakeApiClient], never the network)
/// and plays the returned mp3 through the [FakeAudioPlayerService] (never a
/// speaker). These gates prove it renders on a result view, actually drives that
/// repository on tap, reflects play/stop state, and signals a failure quietly.

/// base64("fake-mp3"), the stand-in the fake `/api/tts` returns.
const String _b64 = 'ZmFrZS1tcDM=';

Widget _host(Widget child, List<Override> overrides) => ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(body: Center(child: child)),
      ),
    );

void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  testWidgets('renders a Listen control (no provider read at mount)',
      (tester) async {
    await tester.pumpWidget(
      _host(
        const ReadAloudButton(text: 'Plants make their own food.'),
        const <Override>[],
      ),
    );
    expect(find.text('Listen'), findsOneWidget);
  });

  testWidgets('mounts inside a real result view with no ProviderScope needed',
      (tester) async {
    // The reference result view is a plain (non-Consumer) widget; embedding the
    // read-aloud control must not force a ProviderScope on its render tests.
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const Scaffold(
          body: SingleChildScrollView(
            child: LessonPlanResultView(
              plan: LessonPlan(title: 'Photosynthesis', language: 'English'),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    // onRegenerate is null here (a read-only render), so the whole action bar —
    // including read-aloud — is intentionally omitted; the point is it does not
    // throw for want of a ProviderScope.
    expect(tester.takeException(), isNull);
  });

  testWidgets('tapping Listen synthesises via /api/tts and plays the result',
      (tester) async {
    final client = FakeApiClient(postResponse: {'audioContent': _b64});
    final player = FakeAudioPlayerService();
    await tester.pumpWidget(_host(
      const ReadAloudButton(text: 'Read me aloud.', language: 'Hindi'),
      [
        apiClientProvider.overrideWithValue(client),
        audioPlayerServiceProvider.overrideWithValue(player),
      ],
    ));

    await tester.tap(find.text('Listen'));
    await tester.pumpAndSettle();

    final ttsPosts = client.posts.where((p) => p.path == '/api/tts').toList();
    expect(ttsPosts, hasLength(1), reason: 'the TTS repository was driven once');
    final data = ttsPosts.single.data! as Map;
    expect(data['text'], 'Read me aloud.');
    // The domain language resolved to its Sarvam voice tag.
    expect(data['targetLang'], 'hi-IN');
    // The returned audio was handed to the player.
    expect(player.played, [_b64]);
    // The control now reflects the playing state.
    expect(find.text('Stop'), findsOneWidget);
    expect(find.text('Listen'), findsNothing);
  });

  testWidgets('a second tap stops playback and resets to Listen',
      (tester) async {
    final client = FakeApiClient(postResponse: {'audioContent': _b64});
    final player = FakeAudioPlayerService();
    await tester.pumpWidget(_host(
      const ReadAloudButton(text: 'x', language: 'en'),
      [
        apiClientProvider.overrideWithValue(client),
        audioPlayerServiceProvider.overrideWithValue(player),
      ],
    ));

    await tester.tap(find.text('Listen'));
    await tester.pumpAndSettle();
    expect(find.text('Stop'), findsOneWidget);

    await tester.tap(find.text('Stop'));
    await tester.pumpAndSettle();
    expect(player.stopCount, greaterThanOrEqualTo(1));
    expect(find.text('Listen'), findsOneWidget);
  });

  testWidgets(
      'disposing DURING synthesis stops the clip — audio never bleeds into the '
      'next screen', (tester) async {
    // The bug this pins (P1 review): the clip starts inside speak() during the
    // synth window, but the control only flips to "playing" AFTER speak()
    // returns. A teacher who taps Listen then navigates back mid-synthesis (a
    // slow rural connection) must not hear a full narration over the next
    // screen with no way to stop it. Delay the /api/tts reply so the dispose
    // lands mid-synthesis.
    final client = FakeApiClient(
      postResponse: {'audioContent': _b64},
      delay: const Duration(milliseconds: 200),
    );
    final player = FakeAudioPlayerService();
    final overrides = [
      apiClientProvider.overrideWithValue(client),
      audioPlayerServiceProvider.overrideWithValue(player),
    ];

    await tester.pumpWidget(_host(
      const ReadAloudButton(text: 'a long deliverable to narrate', language: 'en'),
      overrides,
    ));
    await tester.tap(find.text('Listen'));
    await tester.pump(); // _toggle runs up to `await speak()`; synth is in flight

    // Navigate away mid-synthesis (the button disposes while _playing is still
    // false, the exact window the fix covers).
    await tester.pumpWidget(_host(const SizedBox.shrink(), overrides));
    // Let the delayed synth resolve; the clip started on the shared player, and
    // the disposed control must have stopped it.
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();

    expect(player.stopCount, greaterThanOrEqualTo(1),
        reason: 'a clip started during synthesis must be stopped when the view '
            'disposes mid-synthesis, so it does not outlive the screen');
  });

  testWidgets('natural completion resets the control to Listen', (tester) async {
    final client = FakeApiClient(postResponse: {'audioContent': _b64});
    final player = FakeAudioPlayerService();
    await tester.pumpWidget(_host(
      const ReadAloudButton(text: 'x', language: 'en'),
      [
        apiClientProvider.overrideWithValue(client),
        audioPlayerServiceProvider.overrideWithValue(player),
      ],
    ));

    await tester.tap(find.text('Listen'));
    await tester.pumpAndSettle();
    expect(find.text('Stop'), findsOneWidget);

    // The clip finishes on its own (the completion signal the real player
    // derives from just_audio's processing state).
    player.completePlayback();
    await tester.pumpAndSettle();
    expect(find.text('Listen'), findsOneWidget);
    expect(find.text('Stop'), findsNothing);
  });

  testWidgets('a TTS failure surfaces a quiet snackbar, not a crash',
      (tester) async {
    final client = FakeApiClient(postError: Exception('tts unavailable'));
    final player = FakeAudioPlayerService();
    await tester.pumpWidget(_host(
      const ReadAloudButton(text: 'x', language: 'en'),
      [
        apiClientProvider.overrideWithValue(client),
        audioPlayerServiceProvider.overrideWithValue(player),
      ],
    ));

    await tester.tap(find.text('Listen'));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(player.played, isEmpty);
    expect(
      find.text("Couldn't play the audio. Please try again."),
      findsOneWidget,
    );
    // It fell back to the idle state, not a stuck "Stop".
    expect(find.text('Listen'), findsOneWidget);
  });
}
