import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import 'ai_text.dart';

/// The ONE tinted "note" panel (DESIGN_RUBRIC §5 / §14).
///
/// A callout that sits beside the main content: a validation warning, a teacher
/// tip, an answer key, an internal-choice block, a privacy note. The app had
/// grown three incompatible renderings of this same role — a bordered
/// `space4` banner with a `titleSmall` label, a borderless `space3` sub-note
/// with a `labelMedium` + magic-`0.4`-tracking label, and an `rLg` assess
/// variant — so each is now this widget.
///
/// The container is fixed: `surfaceContainerHigh` fill, `rMd` radius, `space4`
/// padding, a 1dp `outlineVariant` border. The label is the [SectionLabel]-grade
/// `titleSmall` token (its `0.6` tracking is baked into the token, so there is
/// no magic number at the call site). The optional leading glyph is a Lucide
/// icon at the §13 inline size in the muted foreground.
///
/// Use the default constructor for the common case — one run of model prose,
/// rendered through [AiText]. Use [NoteBanner.custom] when the body is not a
/// single prose string (a bulleted list, stacked static paragraphs).
class NoteBanner extends StatelessWidget {
  /// A labelled tinted panel over one run of model [body] prose.
  const NoteBanner({
    super.key,
    this.icon,
    this.label,
    required String this.body,
    this.muted = false,
  }) : child = null;

  /// A tinted panel whose body is an arbitrary [child] (a list, stacked
  /// paragraphs) rather than a single prose string.
  const NoteBanner.custom({
    super.key,
    this.icon,
    this.label,
    required Widget this.child,
  })  : body = null,
        muted = false;

  /// Optional leading Lucide glyph, at the §13 inline size.
  final IconData? icon;

  /// Optional heading above the body.
  final String? label;

  /// Model prose for the default constructor; null for [NoteBanner.custom].
  final String? body;

  /// Custom body for [NoteBanner.custom]; null for the default constructor.
  final Widget? child;

  /// Dims the prose body (marking-scheme / secondary guidance).
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (label != null) ...[
          Text(
            label!,
            style: text.titleSmall?.copyWith(color: scheme.onSurface),
          ),
          const SizedBox(height: AppSpacing.space1),
        ],
        child ?? AiText(body!, muted: muted),
      ],
    );

    return Container(
      padding: const EdgeInsets.all(AppSpacing.space4),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHigh,
        borderRadius: AppRadius.rMd,
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: icon == null
          ? content
          : Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  icon,
                  size: AppIconSize.inline,
                  color: scheme.onSurfaceVariant,
                ),
                const SizedBox(width: AppSpacing.space3),
                Expanded(child: content),
              ],
            ),
    );
  }
}
