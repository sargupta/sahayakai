import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/exam_paper/domain/exam_paper.dart';
import 'package:sahayakai/features/exam_paper/presentation/exam_paper_controller.dart';
import 'package:sahayakai/features/exam_paper/presentation/exam_paper_screen.dart';
import 'package:sahayakai/features/profile/domain/profile_settings.dart';
import 'package:sahayakai/features/profile/domain/teacher_profile.dart';
import 'package:sahayakai/features/profile/presentation/profile_controller.dart';
import 'package:sahayakai/shared/domain/tool_prefill.dart';
import 'package:sahayakai/shared/voice/audio_player_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import '../../support/fake_voice.dart';
import 'exam_paper_fixtures.dart';

/// The Exam Paper Generator's voice wiring (VOICE_FIRST_GAP §4 + §5.6). The
/// classifier's params carry no board, so a voice directive:
///   * SEEDS the grade/subject/chapter/language and the board (the teacher's
///     own from her profile, else CBSE), then
///   * GENERATES by itself, like every other tool: speak → result, no tap
///     (class gate, 2026-11-13: it used to wait on the form for the board), and
///   * auto-speaks the short summary once when the paper lands.
/// A manual (tile) open seeds nothing extra, waits for Generate, never speaks.

const String _b64 = 'ZmFrZS1tcDM=';

/// Records the generate call the sticky button would have made, without a
/// repository. `build()` is inherited (`=> null`), so the screen renders idle.
class _RecordingExam extends ExamPaperController {
  _RecordingExam(this.log);
  final List<ExamPaperRequest> log;
  @override
  Future<void> generate(ExamPaperRequest request) async => log.add(request);
}

/// Transitions loading → data (so the Ready-paper `ref.listen` — the Part-B
/// hook — fires), landing a rendered paper with no network.
class _AutoExam extends ExamPaperController {
  @override
  Future<void> generate(ExamPaperRequest request) async {
    state = const AsyncLoading<ExamPaperResult?>();
    await Future<void>.delayed(Duration.zero);
    state = AsyncData<ExamPaperResult?>(buildReady());
  }
}

/// A teacher whose profile names her board.
class _KarnatakaTeacher extends ProfileController {
  @override
  Future<TeacherProfile> build() async => const TeacherProfile(
    settings: ProfileSettings(educationBoard: 'Karnataka State Board (KSEEB)'),
  );
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

Future<void> _selectDropdown(
  WidgetTester tester,
  Finder field,
  String value,
) async {
  await tester.ensureVisible(field);
  await tester.tap(field);
  await tester.pumpAndSettle();
  await tester.tap(find.text(value).last);
  await tester.pumpAndSettle();
}

List<({String path, Object? data})> _ttsPosts(FakeApiClient c) =>
    c.posts.where((p) => p.path == '/api/tts').toList();

void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  final boardField = find.byType(DropdownButtonFormField<String?>).at(0);

  group('P0 — a spoken request generates by itself', () {
    testWidgets('autoSubmit + grade/subject/chapter generates at once, on CBSE '
        'when the profile names no board', (tester) async {
      _tallPhone(tester);
      final log = <ExamPaperRequest>[];

      await tester.pumpWidget(
        _host(
          const ExamPaperScreen(
            prefill: ToolPrefill(
              topic: 'Quadratic equations',
              gradeLevel: 'Class 10',
              subject: 'Mathematics',
              autoSubmit: true,
            ),
          ),
          [examPaperControllerProvider.overrideWith(() => _RecordingExam(log))],
        ),
      );
      await tester.pumpAndSettle();

      // Grade + subject applied, and the spoken topic became a chapter chip.
      expect(find.text('Class 10'), findsOneWidget);
      expect(find.text('Mathematics'), findsOneWidget);
      expect(
        find.widgetWithText(InputChip, 'Quadratic equations'),
        findsOneWidget,
      );
      // Speak → result: no tap for the board voice never carries.
      expect(
        log,
        hasLength(1),
        reason: 'a spoken exam request must generate without a tap',
      );
      expect(log.single.board, 'CBSE');
      expect(log.single.gradeLevel, 'Class 10');
      expect(log.single.subject, 'Mathematics');
    });

    testWidgets('the board on the teacher profile wins over the CBSE default', (
      tester,
    ) async {
      _tallPhone(tester);
      final log = <ExamPaperRequest>[];
      final container = ProviderContainer(
        overrides: [
          profileControllerProvider.overrideWith(_KarnatakaTeacher.new),
          examPaperControllerProvider.overrideWith(() => _RecordingExam(log)),
        ],
      );
      addTearDown(container.dispose);
      // The home screen has loaded the profile by the time VIDYA opens a tool.
      await container.read(profileControllerProvider.future);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            theme: AppTheme.light(),
            locale: const Locale('en'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: const ExamPaperScreen(
              prefill: ToolPrefill(
                topic: 'Quadratic equations',
                gradeLevel: 'Class 10',
                subject: 'Mathematics',
                autoSubmit: true,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(log, hasLength(1));
      expect(log.single.board, 'Karnataka State Board (KSEEB)');
    });

    testWidgets('autoSubmit + no usable fields does NOT auto-run', (
      tester,
    ) async {
      _tallPhone(tester);
      final log = <ExamPaperRequest>[];

      await tester.pumpWidget(
        _host(const ExamPaperScreen(prefill: ToolPrefill(autoSubmit: true)), [
          examPaperControllerProvider.overrideWith(() => _RecordingExam(log)),
        ]),
      );
      await tester.pumpAndSettle();

      expect(log, isEmpty);
    });

    testWidgets('a manual open (autoSubmit: false) never auto-runs', (
      tester,
    ) async {
      _tallPhone(tester);
      final log = <ExamPaperRequest>[];

      await tester.pumpWidget(
        _host(
          const ExamPaperScreen(
            prefill: ToolPrefill(
              gradeLevel: 'Class 10',
              subject: 'Mathematics',
            ),
          ),
          [examPaperControllerProvider.overrideWith(() => _RecordingExam(log))],
        ),
      );
      await tester.pumpAndSettle();

      expect(log, isEmpty);
    });
  });

  group('P1 — the voice-path spoken summary', () {
    testWidgets('a voice open generates and auto-speaks once when the paper '
        'lands', (tester) async {
      _tallPhone(tester);
      final client = FakeApiClient(postResponse: {'audioContent': _b64});
      final player = FakeAudioPlayerService();

      await tester.pumpWidget(
        _host(
          // CBSE (the default board) Class 10 Mathematics is blueprinted, so
          // no chapters are needed: the voice seed is enough to generate.
          const ExamPaperScreen(
            prefill: ToolPrefill(
              gradeLevel: 'Class 10',
              subject: 'Mathematics',
              autoSubmit: true,
            ),
          ),
          [
            examPaperControllerProvider.overrideWith(_AutoExam.new),
            apiClientProvider.overrideWithValue(client),
            audioPlayerServiceProvider.overrideWithValue(player),
          ],
        ),
      );
      await tester.pumpAndSettle();

      // It generated by itself (no board pick, no Generate tap). Exactly one
      // utterance — the short summary — was synthesised and played.
      expect(player.played, [_b64]);
      final tts = _ttsPosts(client);
      expect(tts, hasLength(1));
      final spoken = (tts.single.data! as Map)['text'] as String;
      expect(spoken, contains('Mathematics'));
      expect(spoken.toLowerCase(), contains('ready'));
      expect(spoken.length, lessThan(120));
    });

    testWidgets('a manual open does NOT auto-speak when the paper lands', (
      tester,
    ) async {
      _tallPhone(tester);
      final client = FakeApiClient(postResponse: {'audioContent': _b64});
      final player = FakeAudioPlayerService();

      await tester.pumpWidget(
        _host(
          // autoSubmit defaults false — a tapped tile with grade/subject filled.
          const ExamPaperScreen(
            prefill: ToolPrefill(
              gradeLevel: 'Class 10',
              subject: 'Mathematics',
            ),
          ),
          [
            examPaperControllerProvider.overrideWith(_AutoExam.new),
            apiClientProvider.overrideWithValue(client),
            audioPlayerServiceProvider.overrideWithValue(player),
          ],
        ),
      );
      await tester.pumpAndSettle();

      await _selectDropdown(tester, boardField, 'CBSE');
      await tester.tap(find.text('Generate'));
      await tester.pumpAndSettle();

      // The paper landed — but a manual generation must never auto-speak.
      expect(player.played, isEmpty);
      expect(_ttsPosts(client), isEmpty);
    });
  });
}
