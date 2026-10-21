import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// The leading dot of a bullet-list row.
///
/// ONE dot for the whole app: the lesson-plan objectives drew a 6x6 dot with a
/// fixed `top: space2` nudge, the instant-answer markdown lists drew a 5x5 dot
/// sized off the line box — two sizes, both off the 4dp grid, for the same
/// role. This is the line-box version (it tracks the first line at any
/// textScale instead of drifting), at the on-grid 4dp diameter.
class BulletDot extends StatelessWidget {
  const BulletDot({super.key, this.lineStyle});

  /// The style of the text the dot sits beside, so the dot centres on that
  /// line's real box. Defaults to the AI-body style both call sites use
  /// (`bodyMedium` at line-height 1.7).
  final TextStyle? lineStyle;

  /// On the 4dp grid (§0); the card-accent bar uses the same 4dp decorative
  /// scale.
  static const double _diameter = AppSpacing.space1; // 4

  /// Both AI-body call sites (`_AiText`, `_Prose`) render `bodyMedium` at this
  /// line height regardless of the theme default, so the dot tracks 1.7 too.
  static const double _aiBodyLineHeight = 1.7;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final base = lineStyle ?? Theme.of(context).textTheme.bodyMedium!;
    final lineHeight =
        (base.fontSize ?? 14) * (lineStyle?.height ?? _aiBodyLineHeight);
    return SizedBox(
      width: AppSpacing.space2,
      height: MediaQuery.textScalerOf(context).scale(lineHeight),
      child: Center(
        child: Container(
          width: _diameter,
          height: _diameter,
          decoration: BoxDecoration(
            color: scheme.primary,
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }
}
