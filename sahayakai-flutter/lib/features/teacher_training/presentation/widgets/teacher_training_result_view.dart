import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/document_sheet.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/read_aloud_button.dart';
import '../../../../shared/widgets/secondary_button.dart';
import '../../domain/teacher_advice.dart';
import 'advice_card.dart';

/// Renders a [TeacherAdvice] result as a printed document, not a chat dump
/// (PREMIUM_DESIGN_SPEC.md §5 / §6b U8 — the reference every other tool copies).
///
/// The coaching advice is wrapped in a [DocumentSheet]: a masthead ("TEACHING
/// COACH" eyebrow, a Fraunces title, saffron rule, grade/subject meta badges),
/// the empathetic introduction prose, the strategies under a saffron-tick
/// section as numbered inset cards, and the closing prose. Each block inks in on
/// the Ink-settle reveal, and a footer action bar offers Regenerate / Copy.
///
/// All model-authored prose flows through [AiText] (line-height 1.7 + Indic
/// height behaviour) so matras and vowel signs never clip, and long compound
/// words wrap instead of scrolling — the matra-safety guarantee is untouched.
/// The copy stays dignified professional-development language: strategies a
/// teacher can weigh, never condescension.
class TeacherTrainingResultView extends StatelessWidget {
  const TeacherTrainingResultView({
    super.key,
    required this.advice,
    this.onRegenerate,
  });

  final TeacherAdvice advice;

  /// Re-runs generation from the current form (the controller's `ask`). When
  /// null (e.g. a direct render in a test) the footer action bar is omitted.
  final VoidCallback? onRegenerate;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    // The model can come back with nothing usable; that is an empty state the
    // teacher can act on, not a blank card.
    if (advice.isEmpty) {
      return EmptyView(
        message: l10n.teacherTrainingNoContent,
        icon: LucideIcons.messagesSquare,
      );
    }

    final points = advice.advice;

    final meta = <Widget>[
      if (advice.gradeLevel != null)
        AppBadge(
          icon: LucideIcons.graduationCap,
          label: advice.gradeLevel!,
          tone: AppBadgeTone.accent,
        ),
      if (advice.subject != null)
        AppBadge(icon: LucideIcons.bookOpen, label: advice.subject!),
    ];

    // The document blocks, in reading order. Content is unchanged from the flat
    // renderer — only the composition around it is new.
    final blocks = <Widget>[
      if (advice.introduction.isNotEmpty) AiText(advice.introduction),
      if (points.isNotEmpty)
        DocumentSheetSection(
          title: l10n.teacherTrainingStrategiesTitle,
          child: _Strategies(points: points),
        ),
      if (advice.conclusion.isNotEmpty) AiText(advice.conclusion, muted: true),
    ];

    // Ink-settle: each block fades + rises in turn, so the document assembles
    // itself. Degrades to the static composed frame under reduce-motion.
    final revealed = <Widget>[
      for (var i = 0; i < blocks.length; i++)
        inkSettle(context, blocks[i], index: i),
    ];

    return DocumentSheet(
      docType: l10n.teacherTrainingTitle,
      title: l10n.teacherTrainingResultTitle,
      meta: meta,
      footer: onRegenerate == null
          ? null
          : _ActionBar(advice: advice, onRegenerate: onRegenerate!),
      children: revealed,
    );
  }
}

/// The strategies as numbered inset cards, each led by a saffron numeral
/// medallion (mirrors the U8 activity cards).
class _Strategies extends StatelessWidget {
  const _Strategies({required this.points});

  final List<TeacherAdvicePoint> points;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final (index, point) in points.indexed) ...[
          if (index > 0) const SizedBox(height: AppSpacing.space3),
          AdviceCard(index: index + 1, point: point),
        ],
      ],
    );
  }
}

/// The document's action bar: Regenerate (secondary) over a Copy ghost. Copy
/// exports the advice as plain text to the clipboard — a presentation-only
/// action, no controller involved.
class _ActionBar extends StatelessWidget {
  const _ActionBar({required this.advice, required this.onRegenerate});

  final TeacherAdvice advice;
  final VoidCallback onRegenerate;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final text = Theme.of(context).textTheme;
    final saffron = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;
    final messenger = ScaffoldMessenger.of(context);

    void copy() {
      Clipboard.setData(ClipboardData(text: _adviceAsText(advice, l10n)));
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(l10n.copyConfirmation)));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        SecondaryButton(
          label: l10n.actionRegenerate,
          icon: LucideIcons.refreshCw,
          onPressed: onRegenerate,
        ),
        const SizedBox(height: AppSpacing.space2),
        ReadAloudButton(
          text: _adviceAsText(advice, l10n),
        ),
        const SizedBox(height: AppSpacing.space2),
        SizedBox(
          height: 48,
          child: TextButton.icon(
            onPressed: copy,
            icon: const Icon(LucideIcons.copy, size: AppIconSize.inline),
            label: Text(l10n.actionCopy),
            style: TextButton.styleFrom(
              foregroundColor: saffron,
              textStyle: text.labelLarge,
            ),
          ),
        ),
      ],
    );
  }
}

/// A plain-text export of the advice, for the clipboard.
String _adviceAsText(TeacherAdvice advice, AppLocalizations l10n) {
  final b = StringBuffer();
  final metaBits =
      [advice.gradeLevel, advice.subject].whereType<String>().toList();
  if (metaBits.isNotEmpty) b.writeln(metaBits.join(' · '));
  if (advice.introduction.isNotEmpty) {
    if (b.isNotEmpty) b.writeln();
    b.writeln(advice.introduction);
  }
  if (advice.advice.isNotEmpty) {
    b
      ..writeln()
      ..writeln(l10n.teacherTrainingStrategiesTitle);
    for (var i = 0; i < advice.advice.length; i++) {
      final p = advice.advice[i];
      if (p.strategy.isNotEmpty) b.writeln('${i + 1}. ${p.strategy}');
      if (p.pedagogy.isNotEmpty) b.writeln('   (${p.pedagogy})');
      if (p.explanation.isNotEmpty) b.writeln('   ${p.explanation}');
    }
  }
  if (advice.conclusion.isNotEmpty) {
    b
      ..writeln()
      ..writeln(advice.conclusion);
  }
  return b.toString().trimRight();
}
