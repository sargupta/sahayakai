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
/// A flow whose tool is not built yet (Visual Aid / Virtual Field Trip / Video
/// Storyteller) maps to null and is DROPPED — [dispatch] returns false and pushes
/// nothing, so a directive never routes to a 404. (A hallucinated *wire* flow
/// never even becomes a [VidyaFlow]; that closed-enum guard is at the DTO, U-V2.)
class VidyaNavDispatcher {
  const VidyaNavDispatcher._();

  /// The tool route a flow opens, or null for the three not-yet-built tools
  /// (U-PD*). Kept exhaustive (no `default`) so adding a [VidyaFlow] fails the
  /// compile until it is mapped.
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
      case VidyaFlow.virtualFieldTrip:
      case VidyaFlow.videoStoryteller:
        return null;
    }
  }

  /// The prefill a directive carries into its tool form. The directive's
  /// language is normalised to an ISO-2 code (matching the picker); unknown
  /// languages fall to null rather than poisoning the field.
  static ToolPrefill prefillFor(VidyaDirectiveParams params) => ToolPrefill(
        topic: params.topic,
        gradeLevel: params.gradeLevel,
        subject: params.subject,
        language: normaliseVidyaLanguage(params.language),
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
