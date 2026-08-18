import 'package:flutter/material.dart';
import 'package:gpt_markdown/gpt_markdown.dart';

/// Model-authored content that may carry **markdown** (bold / italic / lists /
/// headings) and **LaTeX math** — inline `$…$` and block `$$…$$` — which is the
/// format the worksheet flow is *instructed* to emit (`worksheet-wizard.ts`
/// rule 5: "Wrap ALL LaTeX in dollar signs"). Typesets both via `gpt_markdown`
/// (LaTeX through `flutter_math_fork`).
///
/// **Never crashes on bad input.** A malformed formula degrades to its raw text
/// rather than throwing (gpt_markdown's built-in `Math.tex` `onErrorFallback`),
/// so a stray or broken `$…$` can only ever look like plain text — it can't take
/// the result view down.
///
/// Shares [AiText]'s text metrics (line-height 1.7, the same surface/onSurface
/// colour roles) so it drops in wherever prose *might* contain math or markdown.
/// Plain prose that never does can stay on the lighter [AiText].
class RichMarkdown extends StatelessWidget {
  const RichMarkdown(this.data, {super.key, this.muted = false});

  final String data;

  /// Renders in the secondary text colour, for sub-copy such as notes.
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final base = Theme.of(context).textTheme.bodyMedium!;
    final style = base.copyWith(
      height: 1.7,
      color: muted ? scheme.onSurfaceVariant : scheme.onSurface,
    );
    return GptMarkdown(
      data,
      style: style,
      // The backend wraps math in `$…$` / `$$…$$` (worksheet-wizard rule 5), so
      // parse dollar-sign LaTeX. Without this, gpt_markdown only recognises the
      // `\(…\)` / `\[…\]` delimiters and would print the dollar markup raw.
      useDollarSignsForLatex: true,
    );
  }
}
