import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../data/dto/vidya_action.dart';
import '../vidya_controller.dart';

/// One inked turn in the VIDYA home register — a composed document block, NOT a
/// chat bubble (PREMIUM_DESIGN_SPEC §B.3):
///   • the teacher's transcript → `AppCard(inset)` with a "YOU SAID" overline
///   • VIDYA's reply → `AppCard(flat)` + a 3px saffron accent bar + a section
///     tick, its prose through the shared `AiText` (Indic matra-safe, 1.7 lh)
///
/// A compound reply (2–3 directives) renders a `Wrap` of confirm chips under the
/// reply; [onChipTap] dispatches the picked one.
class ConversationBlockView extends StatelessWidget {
  const ConversationBlockView({
    super.key,
    required this.block,
    this.onChipTap,
  });

  final ConversationBlock block;
  final ValueChanged<VidyaDirective>? onChipTap;

  @override
  Widget build(BuildContext context) {
    return block.role == ConversationRole.teacher
        ? _TeacherBlock(text: block.text)
        : _VidyaBlock(
            text: block.text,
            directives: block.directives,
            onChipTap: onChipTap,
          );
  }
}

class _TeacherBlock extends StatelessWidget {
  const _TeacherBlock({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final extras = AppTextExtras.of(context);
    return AppCard(
      variant: AppCardVariant.inset,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(_uppercaseLatin(l10n.vidyaYouSaid), style: extras.overline),
          const SizedBox(height: AppSpacing.space2),
          AiText(text),
        ],
      ),
    );
  }
}

class _VidyaBlock extends StatelessWidget {
  const _VidyaBlock({
    required this.text,
    required this.directives,
    required this.onChipTap,
  });

  final String text;
  final List<VidyaDirective> directives;
  final ValueChanged<VidyaDirective>? onChipTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final saffron = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;

    return AppCard(
      accentBar: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // A small saffron tick — the editorial anchor of a VIDYA reply.
              Container(
                margin: const EdgeInsets.only(top: 4),
                width: 4,
                height: 14,
                decoration: BoxDecoration(
                  color: saffron,
                  borderRadius: AppRadius.rSm,
                ),
              ),
              const SizedBox(width: AppSpacing.space3),
              Expanded(child: AiText(text)),
            ],
          ),
          if (directives.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space4),
            Wrap(
              spacing: AppSpacing.space2,
              runSpacing: AppSpacing.space2,
              children: [
                for (final d in directives)
                  _ConfirmChip(
                    label: vidyaFlowLabel(d.flow, AppLocalizations.of(context)),
                    onTap: onChipTap == null ? null : () => onChipTap!(d),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// A compound-intent confirm chip (PREMIUM_DESIGN_SPEC §B.4): `primaryContainer`
/// fill, a 1.5px `primary` border, a Lucide `sparkles` glyph + the flow label.
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
      shape: StadiumBorder(
        side: BorderSide(color: scheme.primary, width: 1.5),
      ),
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
              Icon(LucideIcons.sparkles,
                  size: AppIconSize.inline, color: scheme.onPrimaryContainer),
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

/// The localized label shown on a confirm chip for a flow. Reuses the built
/// tools' titles where they exist; the three not-yet-built flows carry their own
/// keys.
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

/// Uppercase for Latin overlines; leave unicameral Indic scripts untouched.
String _uppercaseLatin(String s) =>
    s.runes.any((r) => r > 0x24F) ? s : s.toUpperCase();
