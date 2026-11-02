import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../shared/domain/tool_prefill.dart';
import '../data/dto/vidya_action.dart';
import 'vidya_controller.dart'
    show normaliseVidyaLanguage, vidyaControllerProvider;

/// The NAVIGATE_AND_FILL dispatcher — it threads a VIDYA directive INTO the
/// tools: map each [VidyaFlow] to its tool [Routes] constant and carry a
/// [ToolPrefill] the destination form seeds from. THE single source of truth for
/// `flow → route` (both the VIDYA home and the everywhere VIDYA sheet dispatch
/// through it, so they can never disagree).
///
/// Every [VidyaFlow] now maps to a real, shipped tool route (U9 — Visual Aid
/// Designer / Virtual Field Trip / Video Storyteller were live routes all
/// along; only this map had gone stale). [routeForFlow] stays nullable and
/// [dispatch] keeps its false-return/no-push contract as the guard against a
/// FUTURE flow landing in the enum before its tool ships — a hallucinated
/// *wire* flow never even becomes a [VidyaFlow] in the first place; that
/// closed-enum guard is at the DTO, U-V2.
class VidyaNavDispatcher {
  const VidyaNavDispatcher._();

  /// The tool route a flow opens. Kept exhaustive (no `default`) so adding a
  /// [VidyaFlow] fails the compile until it is mapped.
  static String? routeForFlow(VidyaFlow flow) {
    switch (flow) {
      case VidyaFlow.lessonPlan:
        return Routes.lessonPlan;
      case VidyaFlow.quizGenerator:
        return Routes.quizGenerator;
      case VidyaFlow.worksheetWizard:
        return Routes.worksheetWizard;
      case VidyaFlow.rubricGenerator:
        return Routes.rubricGenerator;
      case VidyaFlow.examPaper:
        return Routes.examPaper;
      case VidyaFlow.teacherTraining:
        return Routes.teacherTraining;
      case VidyaFlow.instantAnswer:
        return Routes.instantAnswer;
      case VidyaFlow.visualAidDesigner:
        return Routes.visualAid;
      case VidyaFlow.virtualFieldTrip:
        return Routes.virtualFieldTrip;
      case VidyaFlow.videoStoryteller:
        return Routes.videoStoryteller;
    }
  }

  /// The prefill a directive carries into its tool form. The directive's
  /// language is normalised to an ISO-2 code (matching the picker); unknown
  /// languages fall to null rather than poisoning the field.
  ///
  /// [ToolPrefill.autoSubmit] is `true` here because this is the *only* place a
  /// prefill is built, and it is only ever built on the voice path: both
  /// consumers — the VIDYA home listener ([dispatch]) and the everywhere VIDYA
  /// sheet — react to a `pendingNavigation` directive, which is set for both the
  /// single-directive intent and the compound confirm-chip tap
  /// (`dispatchDirective`). So every voice-originated open carries the RUN verb;
  /// a manual tool-grid open builds no prefill and stays tap-gated. The tool
  /// screen still guards on its required field, so a fieldless utterance lands
  /// on the form and waits rather than firing empty.
  static ToolPrefill prefillFor(VidyaDirectiveParams params) => ToolPrefill(
    topic: params.topic,
    gradeLevel: params.gradeLevel,
    subject: params.subject,
    language: normaliseVidyaLanguage(params.language),
    autoSubmit: true,
  );

  /// Routes to [directive]'s tool with its prefill, or returns false (and pushes
  /// nothing) when the flow has no built tool. The tool reads the [ToolPrefill]
  /// from `GoRouterState.extra`; an empty prefill passes null so the tool opens
  /// exactly as an un-prefilled push.
  static bool dispatch(BuildContext context, VidyaDirective directive) {
    final route = routeForFlow(directive.flow);
    if (route == null) return false;
    final prefill = prefillFor(directive.params);
    context.push(route, extra: prefill.isEmpty ? null : prefill);
    return true;
  }

  /// Opens [directive]'s tool from wherever the teacher is, and returns what
  /// was opened (null when the flow has no tool). When that tool is already on
  /// top, it is REPLACED rather than stacked, so a spoken change ("make it for
  /// Class 5", "now in Hindi") runs straight away; the fields the change left
  /// out are kept from [current], what VIDYA last opened there.
  static OpenedTool? open(
    GoRouter router,
    VidyaDirective directive, {
    OpenedTool? current,
  }) {
    final route = routeForFlow(directive.flow);
    if (route == null) return null;
    var prefill = prefillFor(directive.params);
    final onTop = topLocation(router) == route;
    if (onTop && current?.route == route) {
      prefill = prefill.over(current!.prefill);
    }
    final extra = prefill.isEmpty ? null : prefill;
    if (onTop) {
      router.pushReplacement(route, extra: extra);
    } else {
      router.push(route, extra: extra);
    }
    return OpenedTool(route: route, prefill: prefill);
  }
}

/// The screen on top: the last pushed route (a pushed route does not change
/// the router's `uri`, which still names the shell underneath).
String topLocation(GoRouter router) {
  final matches = router.routerDelegate.currentConfiguration;
  return matches.isEmpty ? matches.uri.path : matches.last.matchedLocation;
}

/// A tool VIDYA opened and what she filled it with.
@immutable
class OpenedTool {
  const OpenedTool({required this.route, required this.prefill});

  final String route;
  final ToolPrefill prefill;
}

/// The tool VIDYA last opened, while it is still on screen; null once the
/// teacher has left it. A spoken change re-runs this tool keeping its fields.
final vidyaOpenedToolProvider = StateProvider<OpenedTool?>((ref) => null);

/// Routes [directive] (see [VidyaNavDispatcher.open]) and tells VIDYA which
/// tool is now open and with what, so the next thing the teacher says is
/// understood against it. The one call both directive routers make: the VIDYA
/// sheet and the app-wide `VidyaToolLauncher`.
void openVidyaTool(WidgetRef ref, GoRouter router, VidyaDirective directive) {
  final opened = VidyaNavDispatcher.open(
    router,
    directive,
    current: ref.read(vidyaOpenedToolProvider),
  );
  if (opened == null) return;
  ref.read(vidyaOpenedToolProvider.notifier).state = opened;
  ref
      .read(vidyaControllerProvider.notifier)
      .registerScreenContext(opened.route, uiState: opened.prefill.toUiState());
}
