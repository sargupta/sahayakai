import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/worksheet_wizard/domain/worksheet.dart';
import 'package:sahayakai/features/worksheet_wizard/presentation/worksheet_controller.dart';
import 'package:sahayakai/features/worksheet_wizard/presentation/worksheet_wizard_screen.dart';
import 'package:sahayakai/shared/domain/tool_prefill.dart';
import 'package:sahayakai/shared/media/image_input.dart';
import 'package:sahayakai/shared/voice/audio_player_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import '../../support/fake_voice.dart';
import 'worksheet_fixtures.dart';

/// The Worksheet Wizard's voice wiring (VOICE_FIRST_GAP §4 + §5.6). Unlike the
/// eight fully voice-driven tools, the worksheet's blocking required field is a
/// TEXTBOOK PHOTO, which the classifier can never resolve from speech. So a
/// voice directive:
///   * SEEDS the prompt/grade/subject/language, then
///   * WAITS on the pre-filled form for the teacher to add the photo — the
///     RUN-verb auto-run guard deliberately never fires without an image (there
///     is no honest "speak → result" for this tool), and
///   * once the teacher adds the photo and taps Generate, the voice-path spoken
///     summary auto-speaks once, closing the loop.
/// A manual (tile) open seeds nothing extra and never auto-speaks.

const String _b64 = 'ZmFrZS1tcDM=';

/// Records the generate call the sticky button would have made, without a
/// repository. `build()` is inherited (`=> null`), so the screen renders idle.
class _RecordingWorksheet extends WorksheetController {
  _RecordingWorksheet(this.log);
  final List<WorksheetRequest> log;
  @override
  Future<void> generate(WorksheetRequest request) async => log.add(request);
}

/// Transitions loading → data (so the result-landing `ref.listen` — the Part-B
/// hook — fires), landing a rendered worksheet with no network.
class _AutoWorksheet extends WorksheetController {
  @override
  Future<void> generate(WorksheetRequest request) async {
    state = const AsyncLoading<Worksheet?>();
    await Future<void>.delayed(Duration.zero);
    state = AsyncData<Worksheet?>(buildWorksheet());
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

  group('P0 — the RUN verb seeds the form but waits for the photo', () {
    testWidgets('autoSubmit + a prompt seeds the fields but does NOT auto-run '
        '(no photo)', (tester) async {
      _tallPhone(tester);
      final log = <WorksheetRequest>[];

      await tester.pumpWidget(
        _host(
          const WorksheetWizardScreen(
            prefill: ToolPrefill(
              topic: 'Fractions practice',
              gradeLevel: 'Class 6',
              subject: 'Mathematics',
              autoSubmit: true,
            ),
          ),
          [
            worksheetControllerProvider.overrideWith(
              () => _RecordingWorksheet(log),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      // The spoken description seeded the prompt, and the grade/subject applied.
      expect(find.text('Fractions practice'), findsOneWidget);
      expect(find.text('Class 6'), findsOneWidget);
      // But with no photo, the voice path must NOT auto-fire an invalid submit —
      // it lands on the form and waits for the teacher to add the textbook page.
      expect(
        log,
        isEmpty,
        reason: 'a photo-less worksheet directive must wait, not generate',
      );
    });

    testWidgets('autoSubmit + an empty prompt does NOT auto-run', (
      tester,
    ) async {
      _tallPhone(tester);
      final log = <WorksheetRequest>[];

      await tester.pumpWidget(
        _host(
          const WorksheetWizardScreen(
            prefill: ToolPrefill(gradeLevel: 'Class 6', autoSubmit: true),
          ),
          [
            worksheetControllerProvider.overrideWith(
              () => _RecordingWorksheet(log),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(log, isEmpty);
    });

    testWidgets('a manual open (autoSubmit: false) never auto-runs', (
      tester,
    ) async {
      _tallPhone(tester);
      final log = <WorksheetRequest>[];

      await tester.pumpWidget(
        _host(
          const WorksheetWizardScreen(
            prefill: ToolPrefill(topic: 'Fractions practice'),
          ),
          [
            worksheetControllerProvider.overrideWith(
              () => _RecordingWorksheet(log),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(log, isEmpty);
    });
  });

  group('P1 — the voice-path spoken summary', () {
    testWidgets('a voice open auto-speaks once when the worksheet lands '
        '(after the photo + Generate)', (tester) async {
      _tallPhone(tester);
      final client = FakeApiClient(postResponse: {'audioContent': _b64});
      final player = FakeAudioPlayerService();

      await tester.pumpWidget(
        _host(
          const WorksheetWizardScreen(
            prefill: ToolPrefill(topic: 'Fractions practice', autoSubmit: true),
          ),
          [
            worksheetControllerProvider.overrideWith(_AutoWorksheet.new),
            imagePickerServiceProvider.overrideWithValue(
              FakeImagePickerService(result: tinyRaw()),
            ),
            apiClientProvider.overrideWithValue(client),
            audioPlayerServiceProvider.overrideWithValue(player),
          ],
        ),
      );
      await tester.pumpAndSettle();

      // Nothing auto-ran yet (no photo), so nothing has spoken.
      expect(player.played, isEmpty);

      // Add the one thing voice could not: the textbook photo, then Generate.
      await tester.tap(find.text('Take photo'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Generate'));
      await tester.pumpAndSettle();

      // Exactly one utterance — the short summary — was synthesised and played.
      expect(player.played, [_b64]);
      final tts = _ttsPosts(client);
      expect(tts, hasLength(1));
      final spoken = (tts.single.data! as Map)['text'] as String;
      expect(spoken, contains('Fractions practice'));
      expect(spoken.toLowerCase(), contains('ready'));
      expect(spoken.length, lessThan(120));
    });

    testWidgets('a manual open does NOT auto-speak when the worksheet lands', (
      tester,
    ) async {
      _tallPhone(tester);
      final client = FakeApiClient(postResponse: {'audioContent': _b64});
      final player = FakeAudioPlayerService();

      await tester.pumpWidget(
        _host(
          // autoSubmit defaults false — a tapped tile with the prompt pre-filled.
          const WorksheetWizardScreen(
            prefill: ToolPrefill(topic: 'Fractions practice'),
          ),
          [
            worksheetControllerProvider.overrideWith(_AutoWorksheet.new),
            imagePickerServiceProvider.overrideWithValue(
              FakeImagePickerService(result: tinyRaw()),
            ),
            apiClientProvider.overrideWithValue(client),
            audioPlayerServiceProvider.overrideWithValue(player),
          ],
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Take photo'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Generate'));
      await tester.pumpAndSettle();

      // The worksheet landed — but a manual generation must never auto-speak.
      expect(player.played, isEmpty);
      expect(_ttsPosts(client), isEmpty);
    });
  });
}
