import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/worksheet_wizard/domain/worksheet.dart';
import 'package:sahayakai/features/worksheet_wizard/presentation/topic_page.dart';
import 'package:sahayakai/features/worksheet_wizard/presentation/worksheet_controller.dart';
import 'package:sahayakai/features/worksheet_wizard/presentation/worksheet_wizard_screen.dart';
import 'package:sahayakai/shared/domain/tool_prefill.dart';
import 'package:sahayakai/shared/media/image_input.dart';
import 'package:sahayakai/shared/voice/audio_player_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import '../../support/fake_voice.dart';
import 'worksheet_fixtures.dart';

/// The Worksheet Wizard's voice wiring (VOICE_FIRST_GAP §4 + §5.6). The
/// endpoint needs a page image and speech carries none, so a voice directive
/// with a topic:
///   * SEEDS the prompt/grade/subject/language,
///   * DRAWS a topic page into the image field (shown, and replaceable by a
///     real textbook photo), and
///   * GENERATES by itself, then speaks the short summary once.
/// A manual (tile) open seeds nothing extra, never auto-runs, never speaks.

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

/// The topic page, without the canvas work: the fixed tiny PNG.
final PickedImage _topicPage = tinyPicked();

Widget _host(Widget screen, List<Override> overrides) => ProviderScope(
  overrides: [
    topicPageRendererProvider.overrideWithValue((_) async => _topicPage),
    ...overrides,
  ],
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

  group('P0 — the RUN verb draws the topic page and generates', () {
    testWidgets('autoSubmit + a prompt generates from the topic page', (
      tester,
    ) async {
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

      // The spoken description seeded the prompt, and the grade/subject applied
      // (Class and Subject live under More options).
      expect(find.text('Fractions practice'), findsOneWidget);
      await tester.tap(find.text('More options'));
      await tester.pumpAndSettle();
      expect(find.text('Class 6'), findsOneWidget);
      expect(find.text('Mathematics'), findsOneWidget);
      // With no photo, the topic page stands in and the worksheet is made.
      expect(log, hasLength(1), reason: 'the teacher never taps Generate');
      expect(log.single.imageDataUri, _topicPage.dataUri);
      expect(log.single.prompt, 'Fractions practice');
      expect(log.single.gradeLevel, 'Class 6');
      expect(log.single.subject, 'Mathematics');
      // And the form says where the page came from.
      expect(
        find.text(
          'VIDYA made this from your topic. Add a photo of a textbook page '
          'to build it from your book instead.',
        ),
        findsOneWidget,
      );
    });

    testWidgets('the topic page shows the topic, the class and the note', (
      tester,
    ) async {
      _tallPhone(tester);
      final drawn = <TopicPageContent>[];

      await tester.pumpWidget(
        _host(
          const WorksheetWizardScreen(
            prefill: ToolPrefill(
              topic: 'Photosynthesis',
              gradeLevel: 'Class 7',
              subject: 'Science',
              autoSubmit: true,
            ),
          ),
          [
            topicPageRendererProvider.overrideWithValue((content) async {
              drawn.add(content);
              return _topicPage;
            }),
            worksheetControllerProvider.overrideWith(
              () => _RecordingWorksheet([]),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(drawn, hasLength(1));
      expect(drawn.single.topic, 'Photosynthesis');
      expect(drawn.single.details, 'Class 7 · Science');
      expect(drawn.single.note, contains('No textbook page was given'));
    });

    testWidgets('a real photo replaces the topic page and its note', (
      tester,
    ) async {
      _tallPhone(tester);
      final log = <WorksheetRequest>[];

      await tester.pumpWidget(
        _host(
          const WorksheetWizardScreen(
            prefill: ToolPrefill(topic: 'Fractions practice', autoSubmit: true),
          ),
          [
            worksheetControllerProvider.overrideWith(
              () => _RecordingWorksheet(log),
            ),
            imagePickerServiceProvider.overrideWithValue(
              FakeImagePickerService(result: tinyRaw()),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('VIDYA made this'), findsOneWidget);

      await tester.tap(find.text('Retake photo'));
      await tester.pumpAndSettle();
      expect(find.textContaining('VIDYA made this'), findsNothing);
      // The real photo now fills the page slot (still a picked page, not the
      // required empty box).
      expect(find.text('TEXTBOOK PAGE'), findsOneWidget);
      expect(find.byTooltip('Remove photo'), findsOneWidget);
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
    testWidgets('a voice open auto-speaks once when the worksheet lands', (
      tester,
    ) async {
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
      // No taps: the topic page is drawn and the worksheet generated.
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
      await tester.tap(find.text('Generate worksheet'));
      await tester.pumpAndSettle();

      // The worksheet landed — but a manual generation must never auto-speak.
      expect(player.played, isEmpty);
      expect(_ttsPosts(client), isEmpty);
    });
  });

  group('the topic page itself', () {
    testWidgets('renders a PNG the endpoint accepts', (tester) async {
      final page = await tester.runAsync(
        () => renderTopicPage(
          const TopicPageContent(
            topic: 'प्रकाश संश्लेषण',
            details: 'Class 7 · Science',
            note: 'No textbook page was given.',
            titleStyle: TextStyle(),
            bodyStyle: TextStyle(),
          ),
        ),
      );
      expect(page, isNotNull);
      expect(page!.mimeType, 'image/png');
      expect(page.dataUri, startsWith('data:image/png;base64,'));
      // Well over the agent's 20-character minimum, far under the 14 MB cap.
      expect(page.sizeBytes, greaterThan(1000));
      expect(page.isOverLimit, isFalse);
    });
  });
}
