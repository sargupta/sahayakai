import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// The fill of a badge — everything else about it is fixed by the spec.
enum AppBadgeTone {
  /// A meta tag: a surface fill with body-coloured text.
  neutral,

  /// The saffron accent: the primary tint fill with primary, weighted text.
  accent,
}

/// How large the badge's text and vertical padding are.
enum AppBadgeSize {
  /// `labelMedium`, roomier vertical padding — the default meta chip.
  regular,

  /// `labelSmall`, tight vertical padding — inline tags on a dense card.
  small,
}

/// The one badge/tag in the app. THEME_SPEC §5.4: badges are rounded-full, so
/// this is always a [StadiumBorder] pill.
///
/// It replaces five hand-rolled variants that had all drifted to the 8dp
/// `rSm` rectangle — `_MetaChip` (byte-identical in three result views),
/// `_TypeBadge`, `_PhaseBadge`, and `_NumberBadge` — so on the Quiz screen the
/// form's pill chips sat above result badges drawn as rectangles. Its glyph
/// uses the §13 `AppIconSize.inline` token (the badges were the last call sites
/// still on the off-token 16dp icon; see the icon-size commit).
class AppBadge extends StatelessWidget {
  const AppBadge({
    super.key,
    required this.label,
    this.icon,
    this.tone = AppBadgeTone.neutral,
    this.size = AppBadgeSize.regular,
  }) : _count = false;

  /// A compact ordinal marker (a quiz question's number): a centred count in an
  /// accent pill that stays a legible circle for a single digit and grows to a
  /// pill for two.
  const AppBadge.count(this.label, {super.key})
      : icon = null,
        tone = AppBadgeTone.accent,
        size = AppBadgeSize.regular,
        _count = true;

  final String label;
  final IconData? icon;
  final AppBadgeTone tone;
  final AppBadgeSize size;
  final bool _count;

  /// The ordinal marker's floor on width and height, on the 4dp grid (§0), so a
  /// single digit reads as a circle rather than collapsing to the glyph width.
  static const double _countExtent = 24;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final Color background;
    final Color labelColor;
    final Color iconColor;
    final FontWeight? weight;
    switch (tone) {
      case AppBadgeTone.neutral:
        background = scheme.surfaceContainerHigh;
        // AA: full-ink onSurface for BOTH sizes (~14:1 on the surfaceContainerHigh
        // fill). The small size previously muted the LABEL to onSurfaceVariant,
        // which is only 3.86:1 on that fill — a fail. Only the size-derived text
        // STYLE stays small (labelSmall vs labelMedium), never the colour; the
        // glyph keeps onSurfaceVariant (3.86:1 clears the 3:1 non-text floor).
        labelColor = scheme.onSurface;
        iconColor = scheme.onSurfaceVariant;
        weight = null;
      case AppBadgeTone.accent:
        background = scheme.primary.withValues(alpha: 0.12);
        // Both the accent LABEL and its GLYPH route through the saffron-TEXT
        // token (saffron-700 `#AC4815` light / `#EB9447` dark), NOT
        // `scheme.primary` (the `#E0924D` brand FILL): `#E0924D` as ink on the
        // primary@0.12 tint is only ~2.26:1 — a gross AA fail AND the exact
        // #E0924D-as-text use app_colors.dart bans. saffron-text on the tint is
        // ~5.14:1 and matches production. The glyph now shares the label's token
        // so the two read as one accent unit (an earlier note wrongly exempted
        // the glyph as "non-text, 3:1 suffices"; it now matches the label).
        labelColor = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;
        iconColor = labelColor;
        weight = FontWeight.w600;
    }

    final baseStyle =
        size == AppBadgeSize.small ? text.labelSmall : text.labelMedium;
    final labelStyle =
        baseStyle?.copyWith(color: labelColor, fontWeight: weight);

    // The ordinal marker owns its height through [_countExtent]; everything
    // else takes vertical breathing room by size.
    final double verticalPadding = _count
        ? 0
        : (size == AppBadgeSize.small ? AppSpacing.space1 : AppSpacing.space2);
    final double horizontalPadding =
        _count ? AppSpacing.space2 : AppSpacing.space3;

    final Widget content = icon == null
        ? Text(label, style: labelStyle)
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: AppIconSize.inline, color: iconColor),
              const SizedBox(width: AppSpacing.space2),
              // Flexible, not fixed: at textScale 1.3 in Malayalam a label is
              // several times its English width and this sits inside a Row.
              Flexible(child: Text(label, style: labelStyle)),
            ],
          );

    return Container(
      constraints: _count
          ? const BoxConstraints(minWidth: _countExtent, minHeight: _countExtent)
          : null,
      alignment: _count ? Alignment.center : null,
      padding: EdgeInsets.symmetric(
        horizontal: horizontalPadding,
        vertical: verticalPadding,
      ),
      decoration: ShapeDecoration(
        color: background,
        shape: const StadiumBorder(),
      ),
      child: content,
    );
  }
}
