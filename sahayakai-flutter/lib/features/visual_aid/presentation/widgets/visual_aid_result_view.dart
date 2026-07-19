import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/document_sheet.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/note_banner.dart';
import '../../../../shared/widgets/secondary_button.dart';
import '../../domain/visual_aid.dart';

/// Renders a generated [VisualAid] as a printed document, not a chat dump
/// (PREMIUM_DESIGN_SPEC.md §5 / §6b U8 — the reference every other tool copies).
///
/// The drawing is wrapped in a [DocumentSheet]: a masthead ("VISUAL AID"
/// eyebrow, the teacher's [prompt] as the Fraunces title, saffron rule,
/// grade/subject meta badges), then the generated illustration as a framed hero
/// image ([Image.memory] over the decoded bytes), a "How to use this" section
/// carrying the model's pedagogical note, and a "Discussion spark" callout. Each
/// block inks in on the Ink-settle reveal, and a footer action bar offers
/// Regenerate / Copy.
///
/// All model-authored prose flows through [AiText] (line-height 1.7 + Indic
/// height behaviour) so matras and vowel signs never clip. See DESIGN_RUBRIC
/// §3 / §8.
class VisualAidResultView extends StatelessWidget {
  const VisualAidResultView({
    super.key,
    required this.aid,
    this.prompt,
    this.gradeLevel,
    this.onRegenerate,
  });

  final VisualAid aid;

  /// The teacher's prompt, used as the masthead title. Null when the view is
  /// rendered without the originating request (e.g. a direct render in a test),
  /// in which case the title falls back to the localized "Visual aid".
  final String? prompt;

  /// The grade the teacher chose on the form (the endpoint does not echo it), so
  /// the masthead can badge it. Null when none was chosen.
  final String? gradeLevel;

  /// Re-runs generation from the current form (the controller's `generate`).
  /// When null the footer action bar is omitted.
  final VoidCallback? onRegenerate;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    // The server can come back with no usable image; that is an empty state the
    // teacher can act on, not a broken card.
    if (!aid.hasImage) {
      return EmptyView(
        message: l10n.visualAidNoImage,
        icon: LucideIcons.image,
      );
    }

    final hasPrompt = prompt != null && prompt!.trim().isNotEmpty;
    final title = hasPrompt ? prompt!.trim() : l10n.visualAidResultTitle;
    final semanticLabel = hasPrompt ? prompt!.trim() : l10n.visualAidImageLabel;

    final meta = <Widget>[
      if (gradeLevel != null && gradeLevel!.trim().isNotEmpty)
        AppBadge(
          icon: LucideIcons.graduationCap,
          label: gradeLevel!.trim(),
          tone: AppBadgeTone.accent,
        ),
      if (aid.subject != null)
        AppBadge(icon: LucideIcons.bookOpen, label: aid.subject!),
    ];

    // The document blocks, in reading order: the drawing itself, then how to use
    // it, then the question to spark discussion.
    final blocks = <Widget>[
      _DrawingFrame(bytes: aid.imageBytes, semanticLabel: semanticLabel),
      if (aid.pedagogicalContext.isNotEmpty)
        DocumentSheetSection(
          title: l10n.visualAidHowToUse,
          child: AiText(aid.pedagogicalContext),
        ),
      if (aid.discussionSpark.isNotEmpty)
        NoteBanner(
          icon: LucideIcons.messageCircle,
          label: l10n.visualAidDiscussionSpark,
          body: aid.discussionSpark,
        ),
    ];

    // Ink-settle: each block fades + rises in turn, so the document assembles
    // itself. Degrades to the static composed frame under reduce-motion.
    final revealed = <Widget>[
      for (var i = 0; i < blocks.length; i++)
        inkSettle(context, blocks[i], index: i),
    ];

    return DocumentSheet(
      docType: l10n.visualAidTitle,
      title: title,
      meta: meta,
      footer: onRegenerate == null
          ? null
          : _ActionBar(
              aid: aid,
              prompt: hasPrompt ? prompt!.trim() : null,
              onRegenerate: onRegenerate!,
            ),
      children: revealed,
    );
  }
}

/// The generated drawing, framed like a mounted print: the decoded bytes in a
/// `BoxFit.contain` [Image.memory] on a recessed surface with a 1px outline and
/// the card radius. `contain` keeps the whole diagram visible; the recessed fill
/// letterboxes a non-rectangular image without a jarring seam. A corrupt payload
/// (decoded but not a valid image) degrades to a labelled placeholder rather
/// than a red error box.
class _DrawingFrame extends StatelessWidget {
  const _DrawingFrame({required this.bytes, required this.semanticLabel});

  final Uint8List bytes;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        color: scheme.surfaceContainerLow,
        borderRadius: AppRadius.rCard,
        border: Border.all(color: scheme.outline),
      ),
      child: ClipRRect(
        borderRadius: AppRadius.rCard,
        child: Image.memory(
          bytes,
          width: double.infinity,
          fit: BoxFit.contain,
          semanticLabel: semanticLabel,
          gaplessPlayback: true,
          errorBuilder: (context, error, stack) => _BrokenImage(),
        ),
      ),
    );
  }
}

/// The letterbox placeholder when decoded bytes are not a renderable image.
class _BrokenImage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.space8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(LucideIcons.imageOff,
              size: AppIconSize.standalone, color: scheme.onSurfaceVariant),
          const SizedBox(height: AppSpacing.space3),
          Text(
            l10n.visualAidImageError,
            textAlign: TextAlign.center,
            // Full ink, not muted: this caption IS the content of the failed
            // frame (chrome, not secondary sub-copy), so it must clear AA on the
            // frame's `surfaceContainerLow` fill. `onSurfaceVariant` (#65758B)
            // there is 4.49:1 — under the 4.5 floor; `onSurface` is ~14:1.
            style: text.bodyMedium?.copyWith(color: scheme.onSurface),
          ),
        ],
      ),
    );
  }
}

/// The document's action bar: Regenerate (secondary) over a Copy ghost. Copy
/// exports the prompt and the teaching notes as plain text to the clipboard (the
/// image itself cannot ride the clipboard) — a presentation-only action, no
/// controller involved.
class _ActionBar extends StatelessWidget {
  const _ActionBar({
    required this.aid,
    required this.prompt,
    required this.onRegenerate,
  });

  final VisualAid aid;
  final String? prompt;
  final VoidCallback onRegenerate;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final text = Theme.of(context).textTheme;
    final saffron = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;
    final messenger = ScaffoldMessenger.of(context);

    void copy() {
      final buffer = StringBuffer();
      if (prompt != null) buffer.writeln('$prompt\n');
      if (aid.pedagogicalContext.isNotEmpty) {
        buffer
          ..writeln(l10n.visualAidHowToUse)
          ..writeln(aid.pedagogicalContext);
      }
      if (aid.discussionSpark.isNotEmpty) {
        buffer
          ..writeln()
          ..writeln(l10n.visualAidDiscussionSpark)
          ..writeln(aid.discussionSpark);
      }
      Clipboard.setData(ClipboardData(text: buffer.toString().trimRight()));
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
