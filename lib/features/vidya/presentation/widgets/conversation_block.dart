import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_icon_size.dart';
import '../../../../core/theme/app_motion.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/ai_report_sheet.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../data/dto/vidya_action.dart';
import '../vidya_controller.dart';

/// Conversation turn rendered as a modern chat bubble (Gemini/ChatGPT voice
/// mode pattern, not the old composed document block):
///   • teacher turns are right-aligned in the brand tint;
///   • VIDYA replies are left-aligned on a plain surface;
///   • no "YOU SAID / THIS PAGE" labels;
///   • a timestamp appears only when [showTimestamp] is true (first block of a
///     group).
class ConversationBlockView extends StatelessWidget {
  const ConversationBlockView({
    super.key,
    required this.block,
    this.onChipTap,
    this.showTimestamp = false,
  });

  final ConversationBlock block;
  final ValueChanged<VidyaDirective>? onChipTap;
  final bool showTimestamp;

  @override
  Widget build(BuildContext context) {
    final motion = context.motionEnabled;
    final timestamp = showTimestamp && block.timestamp != null
        ? DateFormat.jm().format(block.timestamp!)
        : null;

    Widget bubble = block.role == ConversationRole.teacher
        ? _TeacherBubble(text: block.text)
        : _VidyaBubble(
            text: block.text,
            directives: block.directives,
            onChipTap: onChipTap,
          );

    // New replies fade in with an 8dp rise over 200ms, ease-out; no bounce.
    // Reduce-motion renders the final frame instantly.
    if (block.role == ConversationRole.vidya && motion) {
      bubble = bubble
          .animate()
          .fadeIn(
            duration: const Duration(milliseconds: 200),
            curve: AppMotion.easeOutQuart,
          )
          .moveY(
            begin: 8,
            end: 0,
            duration: const Duration(milliseconds: 200),
            curve: AppMotion.easeOutQuart,
          );
    }

    final row = Padding(
      padding: EdgeInsets.only(
        top: timestamp == null ? 0 : AppSpacing.space1,
        bottom: AppSpacing.space1,
      ),
      child: Column(
        crossAxisAlignment: block.role == ConversationRole.teacher
            ? CrossAxisAlignment.end
            : CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (timestamp != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Text(
                timestamp,
                style: Theme.of(
                  context,
                ).textTheme.labelSmall?.copyWith(color: AppColors.textMuted),
                // 12px floor is enforced by the theme; keep decoration off for
                // the overlay (outside Material's text fallback).
                textAlign: block.role == ConversationRole.teacher
                    ? TextAlign.right
                    : TextAlign.left,
              ),
            ),
          bubble,
        ],
      ),
    );

    return Semantics(
      label: block.role == ConversationRole.teacher
          ? 'You said: ${block.text}'
          : block.text,
      child: Align(
        alignment: block.role == ConversationRole.teacher
            ? Alignment.centerRight
            : Alignment.centerLeft,
        child: row,
      ),
    );
  }
}

class _TeacherBubble extends StatelessWidget {
  const _TeacherBubble({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 320),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.accentTint,
          // 18 / 12 = AppRadius.card / AppRadius.row (token guard takes
          // numeric literals only outside lib/core/theme).
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(18),
            topRight: Radius.circular(18),
            bottomLeft: Radius.circular(18),
            bottomRight: Radius.circular(12),
          ),
          border: Border.all(color: AppColors.accentTintBorder, width: 1),
        ),
        child: AiText(text),
      ),
    );
  }
}

/// VIDYA reply — plain surface, subtle divider only when directives exist.
class _VidyaBubble extends StatelessWidget {
  const _VidyaBubble({
    required this.text,
    required this.directives,
    required this.onChipTap,
  });

  final String text;
  final List<VidyaDirective> directives;
  final ValueChanged<VidyaDirective>? onChipTap;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 320),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.milk50,
          // 18 = AppRadius.card (token guard takes numeric literals only
          // outside lib/core/theme).
          borderRadius: const BorderRadius.all(Radius.circular(18)),
          border: Border.all(
            color: AppColors.ink900.withValues(alpha: 0.08),
            width: 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (text.isNotEmpty) AiText(text),
            // Google Play's AI-generated content policy: VIDYA's replies can
            // be reported to the team from inside the app.
            if (text.isNotEmpty)
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: TextButton.icon(
                  onPressed: () => showAiReportSheet(
                    context,
                    content: text,
                    feature: 'vidya',
                  ),
                  style: TextButton.styleFrom(
                    minimumSize: const Size(0, 44),
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.space2,
                    ),
                    foregroundColor: AppColors.textMuted,
                    textStyle: Theme.of(context).textTheme.labelMedium,
                  ),
                  icon: const Icon(LucideIcons.flag, size: 14),
                  label: Text(AppLocalizations.of(context).aiReportAction),
                ),
              ),
            if (directives.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.space3),
              Container(
                height: 1,
                color: AppColors.ink900.withValues(alpha: 0.06),
              ),
              const SizedBox(height: AppSpacing.space3),
              Wrap(
                spacing: AppSpacing.space2,
                runSpacing: AppSpacing.space2,
                children: [
                  for (final d in directives)
                    _ConfirmChip(
                      label: vidyaFlowLabel(
                        d.flow,
                        AppLocalizations.of(context),
                      ),
                      onTap: onChipTap == null ? null : () => onChipTap!(d),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ConfirmChip extends StatelessWidget {
  const _ConfirmChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Material(
      color: scheme.primaryContainer,
      shape: StadiumBorder(side: BorderSide(color: scheme.primary, width: 1.5)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.space3,
            vertical: AppSpacing.space2,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                LucideIcons.sparkles,
                size: AppIconSize.inline,
                color: scheme.onPrimaryContainer,
              ),
              const SizedBox(width: AppSpacing.space2),
              Text(
                label,
                style: text.labelMedium?.copyWith(
                  color: scheme.onPrimaryContainer,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String vidyaFlowLabel(VidyaFlow flow, AppLocalizations l10n) {
  switch (flow) {
    case VidyaFlow.lessonPlan:
      return l10n.lessonPlanTitle;
    case VidyaFlow.quizGenerator:
      return l10n.quizTitle;
    case VidyaFlow.worksheetWizard:
      return l10n.worksheetTitle;
    case VidyaFlow.rubricGenerator:
      return l10n.rubricTitle;
    case VidyaFlow.examPaper:
      return l10n.examPaperTitle;
    case VidyaFlow.teacherTraining:
      return l10n.teacherTrainingTitle;
    case VidyaFlow.instantAnswer:
      return l10n.instantAnswerTitle;
    case VidyaFlow.visualAidDesigner:
      return l10n.vidyaFlowVisualAid;
    case VidyaFlow.virtualFieldTrip:
      return l10n.vidyaFlowVirtualFieldTrip;
    case VidyaFlow.videoStoryteller:
      return l10n.vidyaFlowVideoStoryteller;
  }
}
