import 'package:flutter/widgets.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/i18n/gen/app_localizations.dart';
import '../../core/router/routes.dart';

/// One AI tool a teacher can open. The SINGLE source of truth for the tools that
/// appear BOTH on the dashboard tile grid and in the Create (command) palette.
///
/// Before this existed, the dashboard grid and the placeholder Create palette
/// each hardcoded their own copy of the same nine tools — the same names, icons
/// and routes, spelled out twice, already one step from drifting apart. Both now
/// walk [kToolRegistry], so they cannot disagree about which tools exist or what
/// they are called.
///
/// Names are NOT hardcoded English. [title]/[subtitle] resolve against the
/// active [AppLocalizations], so a tool reads in the teacher's language across
/// all 11 locales (DESIGN_RUBRIC §10). [icon] is the exact Lucide glyph the
/// dashboard tile already used; [route] is a [Routes] constant the router
/// registers.
@immutable
class ToolEntry {
  const ToolEntry({
    required this.id,
    required this.icon,
    required this.route,
    required this.title,
    required this.subtitle,
  });

  /// Stable kebab-case identifier, matching the web tool id. Used as a widget
  /// key and in tests; never shown to the teacher.
  final String id;

  /// The Lucide glyph shown in the tool's icon well. Same family, same weight,
  /// no emoji (DESIGN_RUBRIC §13).
  final IconData icon;

  /// The route this tool deep-links to — a [Routes] constant.
  final String route;

  /// The localized tool name, e.g. `(l10n) => l10n.lessonPlanTitle`.
  final String Function(AppLocalizations l10n) title;

  /// The localized one-line description under the name.
  final String Function(AppLocalizations l10n) subtitle;
}

/// Every built AI tool, in the order the dashboard shows them. Adding a tool
/// here lands it on the dashboard AND in the Create palette at once; there is no
/// second list to keep in step.
final List<ToolEntry> kToolRegistry = <ToolEntry>[
  ToolEntry(
    id: 'lesson-plan',
    icon: LucideIcons.bookOpen,
    route: Routes.lessonPlan,
    title: (l10n) => l10n.lessonPlanTitle,
    subtitle: (l10n) => l10n.lessonPlanSubtitle,
  ),
  ToolEntry(
    id: 'quiz',
    icon: LucideIcons.clipboardList,
    route: Routes.quizGenerator,
    title: (l10n) => l10n.quizTitle,
    subtitle: (l10n) => l10n.quizSubtitle,
  ),
  ToolEntry(
    id: 'instant-answer',
    icon: LucideIcons.messageSquare,
    route: Routes.instantAnswer,
    title: (l10n) => l10n.instantAnswerTitle,
    subtitle: (l10n) => l10n.instantAnswerSubtitle,
  ),
  ToolEntry(
    id: 'worksheet',
    icon: LucideIcons.fileText,
    route: Routes.worksheetWizard,
    title: (l10n) => l10n.worksheetTitle,
    subtitle: (l10n) => l10n.worksheetSubtitle,
  ),
  ToolEntry(
    id: 'rubric',
    icon: LucideIcons.clipboardCheck,
    route: Routes.rubricGenerator,
    title: (l10n) => l10n.rubricTitle,
    subtitle: (l10n) => l10n.rubricSubtitle,
  ),
  ToolEntry(
    id: 'exam-paper',
    icon: LucideIcons.scrollText,
    route: Routes.examPaper,
    title: (l10n) => l10n.examPaperTitle,
    subtitle: (l10n) => l10n.examPaperSubtitle,
  ),
  ToolEntry(
    id: 'teacher-training',
    icon: LucideIcons.compass,
    route: Routes.teacherTraining,
    title: (l10n) => l10n.teacherTrainingTitle,
    subtitle: (l10n) => l10n.teacherTrainingSubtitle,
  ),
  ToolEntry(
    id: 'parent-message',
    icon: LucideIcons.messageCircle,
    route: Routes.parentMessage,
    title: (l10n) => l10n.parentMessageTitle,
    subtitle: (l10n) => l10n.parentMessageSubtitle,
  ),
  ToolEntry(
    id: 'parent-hotline',
    icon: LucideIcons.phoneCall,
    route: Routes.parentHotline,
    title: (l10n) => l10n.parentHotlineTitle,
    subtitle: (l10n) => l10n.parentHotlineSubtitle,
  ),
  ToolEntry(
    id: 'assess-assignment',
    icon: LucideIcons.scanLine,
    route: Routes.assessAssignment,
    title: (l10n) => l10n.assessTitle,
    subtitle: (l10n) => l10n.assessSubtitle,
  ),
  ToolEntry(
    id: 'visual-aid',
    icon: LucideIcons.image,
    route: Routes.visualAid,
    title: (l10n) => l10n.visualAidTitle,
    subtitle: (l10n) => l10n.visualAidSubtitle,
  ),
  ToolEntry(
    id: 'video-storyteller',
    icon: LucideIcons.video,
    route: Routes.videoStoryteller,
    title: (l10n) => l10n.videoStorytellerTitle,
    subtitle: (l10n) => l10n.videoStorytellerSubtitle,
  ),
  ToolEntry(
    id: 'virtual-field-trip',
    icon: LucideIcons.globe,
    route: Routes.virtualFieldTrip,
    title: (l10n) => l10n.virtualFieldTripTitle,
    subtitle: (l10n) => l10n.virtualFieldTripSubtitle,
  ),
];
