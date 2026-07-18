import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/features/vidya/data/dto/vidya_action.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_nav_dispatcher.dart';
import 'package:sahayakai/shared/domain/tool_prefill.dart';

/// U-V6 — the NAVIGATE_AND_FILL dispatcher: the `flow → route` map, the prefill
/// it carries, and that a not-yet-built flow is dropped (never a 404).

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

    test('the three not-yet-built tools map to null (dropped, never a 404)', () {
      expect(VidyaNavDispatcher.routeForFlow(VidyaFlow.visualAidDesigner),
          isNull);
      expect(
          VidyaNavDispatcher.routeForFlow(VidyaFlow.virtualFieldTrip), isNull);
      expect(
          VidyaNavDispatcher.routeForFlow(VidyaFlow.videoStoryteller), isNull);
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

    testWidgets('drops a not-built flow without navigating or crashing',
        (tester) async {
      bool? returned;
      final router = GoRouter(
        initialLocation: '/',
        routes: [
          GoRoute(
            path: '/',
            builder: (context, _) => _Launcher(
              directive: _dir(VidyaFlow.visualAidDesigner),
              onDispatched: (ok) => returned = ok,
            ),
          ),
          // No visual-aid route is registered — a bad dispatch would 404 here.
        ],
      );

      await tester.pumpWidget(MaterialApp.router(routerConfig: router));
      await tester.tap(find.byType(ElevatedButton));
      await tester.pumpAndSettle();

      expect(returned, isFalse); // dropped
      expect(find.text('launcher'), findsOneWidget); // never left home
      expect(tester.takeException(), isNull);
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
