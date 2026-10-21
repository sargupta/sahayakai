import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../../core/router/routes.dart';
import '../../../shared/domain/tool_prefill.dart';
import '../data/dto/vidya_action.dart';
import 'vidya_controller.dart' show normaliseVidyaLanguage;

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
}
