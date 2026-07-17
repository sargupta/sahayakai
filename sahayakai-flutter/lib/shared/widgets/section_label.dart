import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// The ONE section-label grammar (DESIGN_RUBRIC §5 / §14).
///
/// The app had grown two: `onSurfaceVariant` + tracking 0.6 + no icon on the
/// dashboard and the lesson-plan result, versus `onSurface` + a magic tracking
/// of 0.2 + an 18dp leading icon on Settings, Profile and Onboarding. Both are
/// the same role — the label above a block of content — so both are now this.
///
/// Tracking is NOT set here: `AppText.titleSmall` already bakes `ls: 0.6`, so
/// the token is the single source of it. A `copyWith(letterSpacing:)` at a call
/// site is how the second grammar appeared in the first place.
///
/// The colour is `onSurfaceVariant` (muted-foreground): a section label is
/// secondary chrome that orients the eye, not content competing with the titles
/// underneath it.
class SectionLabel extends StatelessWidget {
  const SectionLabel(this.label, {super.key, this.icon});

  final String label;

  /// Optional leading Lucide glyph, at the §13 inline size. Lets the header scan
  /// without emoji or decorative dividers.
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final style = text.titleSmall?.copyWith(color: scheme.onSurfaceVariant);

    if (icon == null) return Text(label, style: style);

    return Row(
      children: [
        Icon(icon, size: AppIconSize.inline, color: scheme.onSurfaceVariant),
        const SizedBox(width: AppSpacing.space2),
        Expanded(child: Text(label, style: style)),
      ],
    );
  }
}

/// A [SectionLabel] and the block it labels, with the standard `space3` gap.
///
/// Replaces the byte-identical private `_Section` in Settings, Profile and
/// Onboarding.
class Section extends StatelessWidget {
  const Section({
    super.key,
    required this.title,
    required this.child,
    this.icon,
  });

  final String title;
  final IconData? icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionLabel(title, icon: icon),
        const SizedBox(height: AppSpacing.space3),
        child,
      ],
    );
  }
}
