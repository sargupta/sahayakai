import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/instant_answer/domain/instant_answer.dart';
import 'package:sahayakai/features/instant_answer/presentation/instant_answer_controller.dart';
import 'package:sahayakai/features/instant_answer/presentation/instant_answer_screen.dart';
import 'package:sahayakai/features/lesson_planner/domain/lesson_plan.dart';
import 'package:sahayakai/features/lesson_planner/presentation/lesson_plan_controller.dart';
import 'package:sahayakai/features/lesson_planner/presentation/lesson_plan_screen.dart';
import 'package:sahayakai/features/quiz_generator/domain/quiz.dart';
import 'package:sahayakai/features/quiz_generator/presentation/quiz_controller.dart';
import 'package:sahayakai/features/quiz_generator/presentation/quiz_generator_screen.dart';
import 'package:sahayakai/features/vidya/data/dto/vidya_action.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_nav_dispatcher.dart';
import 'package:sahayakai/features/visual_aid/domain/visual_aid.dart';
import 'package:sahayakai/features/visual_aid/presentation/visual_aid_controller.dart';
import 'package:sahayakai/features/visual_aid/presentation/visual_aid_screen.dart';
import 'package:sahayakai/shared/domain/tool_prefill.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// P0 — the voice-first RUN verb (VOICE_FIRST_GAP.md §4). These gates prove the
/// last inch of the pipe: after voice prefills a tool, generation *fires itself*
/// — no finger on Generate — and, critically, only when the required field is
/// present. A partial utterance must land on the form and WAIT, never auto-fire
/// an empty submit. Coverage:
///   (a) the VIDYA nav dispatcher builds a ToolPrefill with autoSubmit == true;
///   (b) autoSubmit + a populated required field ACTUALLY runs generation;
///   (c) autoSubmit + an EMPTY required field does NOT run (the partial-utterance
///       guard) — the form stays put;
///   (d) a manual open (null prefill, or autoSubmit: false) never auto-runs.
/// The controller is replaced by a recording fake so no live API / Firebase is
/// touched — the fake records the call the sticky button would have made.

Widget _host(Widget screen, List<Override> overrides) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      theme: AppTheme.light(),
      locale: const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: screen,
    ),
  );
}

void _tallPhone(WidgetTester tester) {
  tester.view.physicalSize = const Size(420, 1600);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

// --- Recording fakes: extend the real controller, override the generate call
// to record the request instead of hitting the repository. build() is inherited
// (all four already `build() => null`), so the screen renders its idle form. ---

class _RecordingLesson extends LessonPlanController {
  _RecordingLesson(this.log);
  final List<LessonPlanRequest> log;
  @override
  Future<void> generate(LessonPlanRequest request) async => log.add(request);
}

class _RecordingQuiz extends QuizController {
  _RecordingQuiz(this.log);
  final List<QuizRequest> log;
  @override
  Future<void> generate(QuizRequest request) async => log.add(request);
}

class _RecordingInstant extends InstantAnswerController {
  _RecordingInstant(this.log);
  final List<InstantAnswerRequest> log;
  @override
  Future<void> ask(InstantAnswerRequest request) async => log.add(request);
}

class _RecordingVisual extends VisualAidController {
  _RecordingVisual(this.log);
  final List<VisualAidRequest> log;
  @override
  Future<void> generate(VisualAidRequest request) async => log.add(request);
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  group('(a) the VIDYA voice path stamps autoSubmit on the prefill', () {
    test('prefillFor sets autoSubmit == true (the RUN verb travels)', () {
      final prefill = VidyaNavDispatcher.prefillFor(
        const VidyaDirectiveParams(topic: 'Photosynthesis'),
      );
      expect(prefill.autoSubmit, isTrue);
    });

    test('a manual ToolPrefill defaults autoSubmit == false', () {
      expect(const ToolPrefill(topic: 'Photosynthesis').autoSubmit, isFalse);
    });

    test('autoSubmit is part of value equality but not of isEmpty', () {
      // Equality distinguishes an auto-run prefill from a manual one...
      expect(
        const ToolPrefill(topic: 'x', autoSubmit: true),
        isNot(const ToolPrefill(topic: 'x')),
      );
      // ...but a fieldless prefill is still "empty" (nothing to auto-run on), so
      // the dispatcher still passes null and the screen opens blank.
      expect(const ToolPrefill(autoSubmit: true).isEmpty, isTrue);
    });
  });

  group('Lesson Plan — full a/b/c/d matrix', () {
    testWidgets('(b) autoSubmit + a topic RUNS generation, no tap',
        (tester) async {
      _tallPhone(tester);
      final log = <LessonPlanRequest>[];

      await tester.pumpWidget(_host(
        const LessonPlanScreen(
          prefill: ToolPrefill(
            topic: 'Photosynthesis',
            gradeLevel: 'Class 10',
            autoSubmit: true,
          ),
        ),
        [lessonPlanControllerProvider.overrideWith(() => _RecordingLesson(log))],
      ));
      await tester.pumpAndSettle();

      expect(log, hasLength(1), reason: 'voice must auto-run generation');
      expect(log.single.topic, 'Photosynthesis');
    });

    testWidgets('(c) autoSubmit + an EMPTY topic does NOT run — form waits',
        (tester) async {
      _tallPhone(tester);
      final log = <LessonPlanRequest>[];

      await tester.pumpWidget(_host(
        // A partial utterance ("plan a lesson") — grade only, no topic.
        const LessonPlanScreen(
          prefill: ToolPrefill(gradeLevel: 'Class 10', autoSubmit: true),
        ),
        [lessonPlanControllerProvider.overrideWith(() => _RecordingLesson(log))],
      ));
      await tester.pumpAndSettle();

      expect(log, isEmpty, reason: 'a topic-less utterance must not auto-fire');
      // The form is on screen, waiting for the teacher to finish it.
      expect(find.byType(TextFormField), findsWidgets);
    });

    testWidgets('(d) a manual open (null prefill) never auto-runs',
        (tester) async {
      _tallPhone(tester);
      final log = <LessonPlanRequest>[];

      await tester.pumpWidget(_host(
        const LessonPlanScreen(),
        [lessonPlanControllerProvider.overrideWith(() => _RecordingLesson(log))],
      ));
      await tester.pumpAndSettle();

      expect(log, isEmpty);
    });

    testWidgets('(d) autoSubmit: false + a topic never auto-runs (tile open)',
        (tester) async {
      _tallPhone(tester);
      final log = <LessonPlanRequest>[];

      await tester.pumpWidget(_host(
        const LessonPlanScreen(
          prefill: ToolPrefill(topic: 'Photosynthesis'),
        ),
        [lessonPlanControllerProvider.overrideWith(() => _RecordingLesson(log))],
      ));
      await tester.pumpAndSettle();

      expect(log, isEmpty, reason: 'a tapped tile did not ask to auto-generate');
    });
  });

  group('Quiz Generator — the extra required field must not block auto-run', () {
    testWidgets('(b) autoSubmit + a topic RUNS (defaulted types pass validation)',
        (tester) async {
      _tallPhone(tester);
      final log = <QuizRequest>[];

      await tester.pumpWidget(_host(
        const QuizGeneratorScreen(
          prefill: ToolPrefill(topic: 'The water cycle', autoSubmit: true),
        ),
        [quizControllerProvider.overrideWith(() => _RecordingQuiz(log))],
      ));
      await tester.pumpAndSettle();

      expect(log, hasLength(1));
      expect(log.single.topic, 'The water cycle');
    });

    testWidgets('(c) autoSubmit + an empty topic does NOT run', (tester) async {
      _tallPhone(tester);
      final log = <QuizRequest>[];

      await tester.pumpWidget(_host(
        const QuizGeneratorScreen(prefill: ToolPrefill(autoSubmit: true)),
        [quizControllerProvider.overrideWith(() => _RecordingQuiz(log))],
      ));
      await tester.pumpAndSettle();

      expect(log, isEmpty);
    });
  });

  group('Instant Answer — question is the required field', () {
    testWidgets('(b) autoSubmit + a question ASKS immediately', (tester) async {
      _tallPhone(tester);
      final log = <InstantAnswerRequest>[];

      await tester.pumpWidget(_host(
        const InstantAnswerScreen(
          prefill: ToolPrefill(topic: 'Why is the sky blue?', autoSubmit: true),
        ),
        [
          instantAnswerControllerProvider
              .overrideWith(() => _RecordingInstant(log)),
        ],
      ));
      await tester.pumpAndSettle();

      expect(log, hasLength(1));
      expect(log.single.question, 'Why is the sky blue?');
    });

    testWidgets('(c) autoSubmit + an empty question does NOT ask',
        (tester) async {
      _tallPhone(tester);
      final log = <InstantAnswerRequest>[];

      await tester.pumpWidget(_host(
        const InstantAnswerScreen(prefill: ToolPrefill(autoSubmit: true)),
        [
          instantAnswerControllerProvider
              .overrideWith(() => _RecordingInstant(log)),
        ],
      ));
      await tester.pumpAndSettle();

      expect(log, isEmpty);
    });
  });

  group('Visual Aid — prompt is the required field', () {
    testWidgets('(b) autoSubmit + a prompt DRAWS immediately', (tester) async {
      _tallPhone(tester);
      final log = <VisualAidRequest>[];

      await tester.pumpWidget(_host(
        const VisualAidScreen(
          prefill: ToolPrefill(topic: 'Label a plant cell', autoSubmit: true),
        ),
        [visualAidControllerProvider.overrideWith(() => _RecordingVisual(log))],
      ));
      await tester.pumpAndSettle();

      expect(log, hasLength(1));
      expect(log.single.prompt, 'Label a plant cell');
    });

    testWidgets('(c) autoSubmit + an empty prompt does NOT draw', (tester) async {
      _tallPhone(tester);
      final log = <VisualAidRequest>[];

      await tester.pumpWidget(_host(
        const VisualAidScreen(prefill: ToolPrefill(autoSubmit: true)),
        [visualAidControllerProvider.overrideWith(() => _RecordingVisual(log))],
      ));
      await tester.pumpAndSettle();

      expect(log, isEmpty);
    });
  });
}
