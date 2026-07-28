import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/lesson_planner/domain/lesson_plan.dart';
import 'package:sahayakai/features/lesson_planner/presentation/lesson_plan_controller.dart';
import 'package:sahayakai/features/lesson_planner/presentation/lesson_plan_screen.dart';
import 'package:sahayakai/shared/domain/tool_prefill.dart';
import 'package:sahayakai/shared/voice/audio_player_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import '../../support/fake_voice.dart';

/// VOICE_FIRST_GAP §5.6 part B — auto-speak on the voice path, closing
/// "speak → generate → hear". When a *voice-originated* generation
/// (`prefill.autoSubmit == true`) lands, the screen auto-speaks a short spoken
/// summary — the tool name + the topic, NOT the whole document — exactly once,
/// through the same TTS stack read-aloud uses. A *manual* generation never
/// speaks. The controller is a fake that transitions loading → data with no
/// network; the summary POSTs to a [FakeApiClient] `/api/tts` and plays through
/// a [FakeAudioPlayerService], so nothing opens a socket or a speaker.

const String _b64 = 'ZmFrZS1tcDM=';

/// A controller that actually transitions loading → data (so the screen's
/// result-landing `ref.listen` — the Part-B hook — fires), landing a plan.
class _AutoLesson extends LessonPlanController {
  @override
  Future<void> generate(LessonPlanRequest request) async {
    state = const AsyncLoading<LessonPlan?>();
    await Future<void>.delayed(Duration.zero);
    state = const AsyncData<LessonPlan?>(
      LessonPlan(
        title: 'Photosynthesis',
        language: 'English',
        objectives: ['Explain how plants make food'],
      ),
    );
  }
}

Widget _host(Widget screen, List<Override> overrides) => ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: screen,
      ),
    );

void _tallPhone(WidgetTester tester) {
  tester.view.physicalSize = const Size(420, 1600);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

List<({String path, Object? data})> _ttsPosts(FakeApiClient c) =>
    c.posts.where((p) => p.path == '/api/tts').toList();

void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  testWidgets('a voice-originated result auto-speaks a short summary, once',
      (tester) async {
    _tallPhone(tester);
    final client = FakeApiClient(postResponse: {'audioContent': _b64});
    final player = FakeAudioPlayerService();

    await tester.pumpWidget(_host(
      const LessonPlanScreen(
        prefill: ToolPrefill(topic: 'Photosynthesis', autoSubmit: true),
      ),
      [
        lessonPlanControllerProvider.overrideWith(_AutoLesson.new),
        apiClientProvider.overrideWithValue(client),
        audioPlayerServiceProvider.overrideWithValue(player),
      ],
    ));
    await tester.pumpAndSettle();

    // Exactly one utterance was played — the summary — and only once.
    expect(player.played, [_b64]);
    final tts = _ttsPosts(client);
    expect(tts, hasLength(1));

    // It is the SHORT summary (names the tool + topic, says "ready"), never the
    // whole document.
    final spoken = (tts.single.data! as Map)['text'] as String;
    expect(spoken, contains('Photosynthesis'));
    expect(spoken.toLowerCase(), contains('ready'));
    expect(spoken.length, lessThan(120));
  });

  testWidgets('a manually-generated result does NOT auto-speak', (tester) async {
    _tallPhone(tester);
    final client = FakeApiClient(postResponse: {'audioContent': _b64});
    final player = FakeAudioPlayerService();

    await tester.pumpWidget(_host(
      // autoSubmit defaults false — a tapped tile with the topic pre-filled.
      const LessonPlanScreen(prefill: ToolPrefill(topic: 'Photosynthesis')),
      [
        lessonPlanControllerProvider.overrideWith(_AutoLesson.new),
        apiClientProvider.overrideWithValue(client),
        audioPlayerServiceProvider.overrideWithValue(player),
      ],
    ));
    await tester.pumpAndSettle();

    // Nothing auto-ran, nothing spoke.
    expect(player.played, isEmpty);

    // Generate manually by tapping the sticky Generate button.
    await tester.tap(find.text('Generate'));
    await tester.pumpAndSettle();

    // The result landed — but a manual generation must never auto-speak.
    expect(player.played, isEmpty);
    expect(_ttsPosts(client), isEmpty);
  });
}
