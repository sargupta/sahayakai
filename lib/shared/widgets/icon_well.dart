import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// IconWell v2 (PREMIUM_DESIGN_SPEC.md §5). A 48dp (or 64dp [feature]) well,
/// radius `well` 14 (squircle-shaped, GL-3), filled with a diagonal saffron
/// tint gradient (`primary@0.16 → primary@0.06`), and a 20dp (28dp feature)
/// Lucide glyph in `primary`. Saffron as an accent, never a surface flood.
///
/// GL-3 (App-wide Glassmorphism Reskin) light touch: this well already read
/// as glass-consistent before the reskin (diagonal tint gradient + 1px
/// border is the same grammar `AppGlass`/`GlassSurface` formalised), so it
/// gets a tune, not a rewrite. Two changes: the flat `primary@0.22` border is
/// swapped for [AppGlass]'s shared gradient edge-highlight ring (the same
/// "padding trick" [GlassSurface] uses — an outer squircle painted with the
/// border gradient, inset by [AppGlass.borderWidth], with an inner squircle
/// of the actual saffron fill on top), so the well's edge now reads as part
/// of the same glass family as the cards around it; and the corner shape
/// moves from a circular-arc `RRect` to [AppGlass.squircle] so it matches the
/// squircle corners `AppCard`/`GlassSurface` now use. The saffron gradient
/// FILL itself is untouched — it is a deliberate brand-accent tint, not a
/// neutral glass fill, so it stays exactly as-is.
///
/// The v1 API (`IconWell(icon:)`) is preserved; [feature] defaults to false so
/// every existing call site keeps its 48dp/20dp well.
class IconWell extends StatelessWidget {
  const IconWell({super.key, required this.icon, this.feature = false});

  final IconData icon;

  /// The larger 64dp/28dp well used by the dashboard feature tile.
  final bool feature;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;
    final box = feature ? 64.0 : AppIconSize.wellBox; // 64 / 48
    final glyph = feature ? 28.0 : AppIconSize.well; // 28 / 20

    final borderGradient =
        isDark ? AppGlass.dBorderGradient : AppGlass.lBorderGradient;
    final outerShape = AppGlass.squircle(AppRadius.well);
    final innerShape = AppGlass.squircle(AppRadius.well - AppGlass.borderWidth);

    return SizedBox(
      width: box,
      height: box,
      child: DecoratedBox(
        decoration: ShapeDecoration(shape: outerShape, gradient: borderGradient),
        child: Padding(
          padding: const EdgeInsets.all(AppGlass.borderWidth),
          child: DecoratedBox(
            decoration: ShapeDecoration(
              shape: innerShape,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  scheme.primary.withValues(alpha: 0.16),
                  scheme.primary.withValues(alpha: 0.06),
                ],
              ),
            ),
            child: Center(child: Icon(icon, size: glyph, color: scheme.primary)),
          ),
        ),
      ),
    );
  }
}
