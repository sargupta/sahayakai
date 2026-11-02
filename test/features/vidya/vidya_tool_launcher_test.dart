import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/features/vidya/data/dto/vidya_action.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_controller.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_nav_dispatcher.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_sheet.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_tool_launcher.dart';
import 'package:sahayakai/shared/domain/tool_prefill.dart';

/// VIDYA keeps listening after she opens a tool, with her sheet closed. What
/// the teacher says next must still reach the tools: open one, change the open
/// one in place (re-run, no stacking), or switch to another.

VidyaDirective _quiz(VidyaDirectiveParams params) =>
    VidyaDirective(flow: VidyaFlow.quizGenerator, params: params);

/// A tool screen that records the prefill each new instance opened with (a
/// replacement is a new instance, so its form seeds and auto-runs afresh).
class _Tool extends StatefulWidget {
  const _Tool(this.prefill, this.opens);

  final ToolPrefill? prefill;
  final List<ToolPrefill?> opens;

  @override
  State<_Tool> createState() => _ToolState();
}

class _ToolState extends State<_Tool> {
  @override
  void initState() {
    super.initState();
    widget.opens.add(widget.prefill);
  }

  @override
  Widget build(BuildContext context) => const Scaffold(body: Text('quiz tool'));
}

void main() {
  late List<ToolPrefill?> quizOpens;
  late List<ToolPrefill?> lessonOpens;
  late GoRouter router;
  late ProviderContainer container;

  Future<void> pumpApp(WidgetTester tester) async {
    quizOpens = [];
    lessonOpens = [];
    router = GoRouter(
      initialLocation: Routes.home,
      routes: [
        GoRoute(
          path: Routes.home,
          builder: (_, _) => const Scaffold(body: Text('home')),
        ),
        GoRoute(
          path: Routes.quizGenerator,
          builder: (_, state) => _Tool(state.extra as ToolPrefill?, quizOpens),
        ),
        GoRoute(
          path: Routes.lessonPlan,
          builder: (_, state) =>
              _Tool(state.extra as ToolPrefill?, lessonOpens),
        ),
      ],
    );
    container = ProviderContainer();
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(
          routerConfig: router,
          builder: (context, child) =>
              VidyaToolLauncher(router: router, child: child!),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  void say(VidyaDirective directive) => container
      .read(vidyaControllerProvider.notifier)
      .dispatchDirective(directive);

  String here() => topLocation(router);

  testWidgets('with the sheet closed, a directive opens its tool, filled and '
      'set to run', (tester) async {
    await pumpApp(tester);

    say(
      _quiz(
        const VidyaDirectiveParams(
          topic: 'Photosynthesis',
          gradeLevel: 'Class 7',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(here(), Routes.quizGenerator);
    expect(quizOpens, hasLength(1));
    expect(quizOpens.single!.topic, 'Photosynthesis');
    expect(quizOpens.single!.autoSubmit, isTrue);
    final state = container.read(vidyaControllerProvider);
    expect(state.pendingNavigation, isNull, reason: 'consumed once');
    expect(state.screenPath, Routes.quizGenerator);
    expect(state.screenUiState, {
      'topic': 'Photosynthesis',
      'gradeLevel': 'Class 7',
    });
  });

  testWidgets('a change to the open tool re-runs it in place, keeping what '
      'the change left out', (tester) async {
    await pumpApp(tester);
    say(
      _quiz(
        const VidyaDirectiveParams(
          topic: 'Photosynthesis',
          gradeLevel: 'Class 7',
          subject: 'Science',
        ),
      ),
    );
    await tester.pumpAndSettle();

    say(_quiz(const VidyaDirectiveParams(gradeLevel: 'Class 5')));
    await tester.pumpAndSettle();

    expect(quizOpens, hasLength(2), reason: 'a fresh run of the tool');
    final rerun = quizOpens.last!;
    expect(rerun.topic, 'Photosynthesis');
    expect(rerun.gradeLevel, 'Class 5');
    expect(rerun.subject, 'Science');
    expect(rerun.autoSubmit, isTrue);

    // Replaced, not stacked: one Back reaches home.
    router.pop();
    await tester.pumpAndSettle();
    expect(here(), Routes.home);
    expect(find.text('home'), findsOneWidget);
  });

  testWidgets('a new topic keeps the class but not the old subject', (
    tester,
  ) async {
    await pumpApp(tester);
    say(
      _quiz(
        const VidyaDirectiveParams(
          topic: 'Photosynthesis',
          gradeLevel: 'Class 7',
          subject: 'Science',
        ),
      ),
    );
    await tester.pumpAndSettle();

    say(_quiz(const VidyaDirectiveParams(topic: 'Fractions')));
    await tester.pumpAndSettle();

    expect(quizOpens.last!.topic, 'Fractions');
    expect(quizOpens.last!.gradeLevel, 'Class 7');
    expect(quizOpens.last!.subject, isNull);
  });

  testWidgets('another tool opens on top of the first', (tester) async {
    await pumpApp(tester);
    say(_quiz(const VidyaDirectiveParams(topic: 'Photosynthesis')));
    await tester.pumpAndSettle();

    say(
      const VidyaDirective(
        flow: VidyaFlow.lessonPlan,
        params: VidyaDirectiveParams(topic: 'Photosynthesis'),
      ),
    );
    await tester.pumpAndSettle();

    expect(here(), Routes.lessonPlan);
    expect(lessonOpens, hasLength(1));
    expect(quizOpens, hasLength(1));
  });

  testWidgets('leaving the tool clears what VIDYA reasons about', (
    tester,
  ) async {
    await pumpApp(tester);
    say(_quiz(const VidyaDirectiveParams(topic: 'Photosynthesis')));
    await tester.pumpAndSettle();

    router.pop();
    await tester.pumpAndSettle();

    expect(container.read(vidyaOpenedToolProvider), isNull);
    final state = container.read(vidyaControllerProvider);
    expect(state.screenPath, Routes.home);
    expect(state.screenUiState, isNull);
  });

  testWidgets('while the VIDYA sheet is open it is left to the sheet', (
    tester,
  ) async {
    await pumpApp(tester);
    container.read(vidyaConversationSheetOpenProvider.notifier).state = true;

    final directive = _quiz(const VidyaDirectiveParams(topic: 'Fractions'));
    say(directive);
    await tester.pumpAndSettle();

    expect(here(), Routes.home);
    expect(
      container.read(vidyaControllerProvider).pendingNavigation,
      directive,
    );
  });
}
