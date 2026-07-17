import 'package:flutter/material.dart';

/// A block of model-authored plain-text prose.
///
/// Carries line-height 1.7 with the height applied to the first ascent and the
/// last descent, so Indic top matras and bottom vowel signs are never cropped
/// (DESIGN_RUBRIC §12.4), and always soft-wraps so a long compound word breaks
/// instead of scrolling sideways. The lesson-plan and quiz result views each
/// kept a byte-identical private `_AiText`; this is the one.
///
/// (The instant-answer markdown renderer's `_Prose` shares these text metrics
/// but not this widget: it renders styled spans, not a plain string.)
class AiText extends StatelessWidget {
  const AiText(this.data, {super.key, this.muted = false});

  final String data;

  /// Renders in the secondary text colour, for sub-copy such as teacher notes.
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final base = Theme.of(context).textTheme.bodyMedium!;
    return Text(
      data,
      softWrap: true,
      textHeightBehavior: const TextHeightBehavior(
        applyHeightToFirstAscent: true,
        applyHeightToLastDescent: true,
      ),
      style: base.copyWith(
        height: 1.7,
        color: muted ? scheme.onSurfaceVariant : scheme.onSurface,
      ),
    );
  }
}
