import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/features/vidya/data/dto/vidya_action.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_nav_dispatcher.dart';
import 'package:sahayakai/shared/domain/tool_prefill.dart';

/// U-V6/U9 — the NAVIGATE_AND_FILL dispatcher: the `flow → route` map (now
/// exhaustive — every [VidyaFlow] has a real, shipped tool) and the prefill it
/// carries.

VidyaDirective _dir(VidyaFlow flow, [VidyaDirectiveParams? params]) =>
    VidyaDirective(flow: flow, params: params ?? const VidyaDirectiveParams());

void main() {
  group('flow → route map', () {
    test('every built flow maps to its tool route', () {
      expect(VidyaNavDispatcher.routeForFlow(VidyaFlow.lessonPlan),
          Routes.lessonPlan);
      expect(VidyaNavDispatcher.routeForFlow(VidyaFlow.quizGenerator),
          Routes.quizGenerator);
      expect(VidyaNavDispatcher.routeForFlow(VidyaFlow.instantAnswer),
          Routes.instantAnswer);
      expect(VidyaNavDispatcher.routeForFlow(VidyaFlow.worksheetWizard),
          Routes.worksheetWizard);
      expect(VidyaNavDispatcher.routeForFlow(VidyaFlow.rubricGenerator),
          Routes.rubricGenerator);
      expect(VidyaNavDispatcher.routeForFlow(VidyaFlow.examPaper),
          Routes.examPaper);
      expect(VidyaNavDispatcher.routeForFlow(VidyaFlow.teacherTraining),
          Routes.teacherTraining);
    });

    test(
        'U9 regression: Visual Aid / Virtual Field Trip / Video Storyteller '
        'no longer map to null — all three are real, shipped tools the '
        'dispatcher used to silently drop', () {
      expect(VidyaNavDispatcher.routeForFlow(VidyaFlow.visualAidDesigner),
          Routes.visualAid);
      expect(VidyaNavDispatcher.routeForFlow(VidyaFlow.virtualFieldTrip),
          Routes.virtualFieldTrip);
      expect(VidyaNavDispatcher.routeForFlow(VidyaFlow.videoStoryteller),
          Routes.videoStoryteller);
    });
  });

  group('prefill', () {
    test('carries topic/grade/subject and normalises the language to ISO-2', () {
      final prefill = VidyaNavDispatcher.prefillFor(const VidyaDirectiveParams(
        topic: 'Fractions',
        gradeLevel: 'Class 10',
        subject: 'Science',
        language: 'Hindi', // full name → normalised
      ));
      expect(prefill.topic, 'Fractions');
      expect(prefill.gradeLevel, 'Class 10');
      expect(prefill.subject, 'Science');
      expect(prefill.language, 'hi');
    });

    test('drops an unknown language rather than poisoning the field', () {
      final prefill = VidyaNavDispatcher.prefillFor(
        const VidyaDirectiveParams(topic: 'X', language: 'klingon'),
      );
      expect(prefill.language, isNull);
    });

    test('an empty directive yields an empty prefill', () {
      expect(VidyaNavDispatcher.prefillFor(const VidyaDirectiveParams()).isEmpty,
          isTrue);
    });
  });

  group('dispatch', () {
    testWidgets('routes a built flow to its tool with the prefill in extra',
        (tester) async {
      ToolPrefill? captured;
      var lessonBuilt = false;
      final router = GoRouter(
        initialLocation: '/',
        routes: [
          GoRoute(
            path: '/',
            builder: (context, _) => _Launcher(
              directive: _dir(
                VidyaFlow.lessonPlan,
                const VidyaDirectiveParams(
                    topic: 'Fractions', gradeLevel: 'Class 10'),
              ),
            ),
          ),
          GoRoute(
            path: Routes.lessonPlan,
            builder: (context, state) {
              lessonBuilt = true;
              captured = state.extra is ToolPrefill
                  ? state.extra! as ToolPrefill
                  : null;
              return const Scaffold(body: Text('lesson tool'));
            },
          ),
        ],
      );

      await tester.pumpWidget(MaterialApp.router(routerConfig: router));
      await tester.tap(find.byType(ElevatedButton));
      await tester.pumpAndSettle();

      expect(lessonBuilt, isTrue);
      expect(captured, isNotNull);
      expect(captured!.topic, 'Fractions');
      expect(captured!.gradeLevel, 'Class 10');
      expect(tester.takeException(), isNull);
    });

    testWidgets(
        'U9 regression: the three previously-dropped flows now really '
        'navigate, each to its own real route', (tester) async {
      for (final entry in {
        VidyaFlow.visualAidDesigner: Routes.visualAid,
        VidyaFlow.virtualFieldTrip: Routes.virtualFieldTrip,
        VidyaFlow.videoStoryteller: Routes.videoStoryteller,
      }.entries) {
        bool? returned;
        var built = false;
        final router = GoRouter(
          initialLocation: '/',
          routes: [
            GoRoute(
              path: '/',
              builder: (context, _) => _Launcher(
                directive: _dir(
                  entry.key,
                  const VidyaDirectiveParams(topic: 'Volcanoes'),
                ),
                onDispatched: (ok) => returned = ok,
              ),
            ),
            GoRoute(
              path: entry.value,
              builder: (context, state) {
                built = true;
                return const Scaffold(body: Text('destination'));
              },
            ),
          ],
        );

        await tester.pumpWidget(MaterialApp.router(routerConfig: router));
        await tester.tap(find.byType(ElevatedButton));
        await tester.pumpAndSettle();

        expect(returned, isTrue, reason: '${entry.key} must dispatch');
        expect(built, isTrue,
            reason: '${entry.key} must reach ${entry.value}, not a 404');
        expect(tester.takeException(), isNull);
      }
    });
  });
}

class _Launcher extends StatelessWidget {
  const _Launcher({required this.directive, this.onDispatched});

  final VidyaDirective directive;
  final ValueChanged<bool>? onDispatched;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ElevatedButton(
          onPressed: () {
            final ok = VidyaNavDispatcher.dispatch(context, directive);
            onDispatched?.call(ok);
          },
          child: const Text('launcher'),
        ),
      ),
    );
  }
}
