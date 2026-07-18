import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/motion/animated_entrance.dart';

/// One destination (or action) in the [FloatingBottomNav].
///
/// [isAction] items (e.g. Create) open something instead of switching tabs, so
/// they NEVER show the active pill and are always rendered inactive — the shell
/// leaves the current tab's pill exactly where it was. See
/// PREMIUM_DESIGN_SPEC.md §5 ("Bottom nav — floating").
@immutable
class FloatingNavItem {
  const FloatingNavItem({
    required this.icon,
    required this.label,
    this.isAction = false,
  });

  final IconData icon;
  final String label;
  final bool isAction;
}

/// U9 — the floating bottom navigation (PREMIUM_DESIGN_SPEC.md §5).
///
/// An INSET FLOATED bar (not edge-to-edge): radius [AppRadius.hero] (20),
/// `surface` fill, 1px `outline` border, shadow [AppShadows.e3] in light /
/// [AppShadows.dKey] + a top catch-light in dark, height 56 above the bottom
/// safe-area inset, with a horizontal margin so it floats.
///
/// The active tab wears a `primary@0.12` STADIUM pill that SLIDES + fades to the
/// newly-selected tab (240ms · easeOutQuart); its icon is `primary` scaled to
/// 1.08 (160ms micro); inactive icons are `onSurfaceVariant`. Labels are
/// `labelMedium` (≥12sp), weight 600 + `primary` when active, `onSurfaceVariant`
/// otherwise. Every animation is guarded by [MotionContext.motionEnabled]: under
/// reduce-motion the pill jumps and nothing tweens (the final composed frame).
///
/// [onSelected] fires for every tap (actions included); the shell decides
/// whether to switch [currentIndex] or open a palette. Because selecting an
/// action never changes [currentIndex], the pill stays put on the current tab.
class FloatingBottomNav extends StatelessWidget {
  const FloatingBottomNav({
    super.key,
    required this.currentIndex,
    required this.items,
    required this.onSelected,
  });

  final int currentIndex;
  final List<FloatingNavItem> items;
  final ValueChanged<int> onSelected;

  /// Inner bar height (the bottom safe-area inset is added on top of this).
  static const double _barHeight = 56;

  /// Fixed pill geometry — a stadium behind the ~24dp glyph.
  static const double _pillWidth = 56;
  static const double _pillHeight = 32;

  /// Vertical alignment (Stack space) that seats the pill behind the icon band,
  /// which sits above the label in each slot.
  static const double _pillAlignY = -0.4;

  /// The pill's horizontal alignment (start-relative, RTL-safe) for the slot at
  /// [index] of [count] equal-width slots. Exposed for tests.
  @visibleForTesting
  static double pillAlignmentX(int index, int count) {
    if (count <= 1) return 0;
    return -1 + 2 * (index + 0.5) / count;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;
    final motion = context.motionEnabled;

    // Never seat the pill on an action slot (Create): it is not a destination.
    final activeIsDestination =
        currentIndex >= 0 &&
        currentIndex < items.length &&
        !items[currentIndex].isAction;

    return SafeArea(
      top: false,
      child: Padding(
        // Horizontal margin so the bar floats inset from the screen edges, plus
        // a small gap below so it lifts off the very bottom.
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.space4,
          0,
          AppSpacing.space4,
          AppSpacing.space2,
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: scheme.surface,
            borderRadius: AppRadius.rHero,
            border: Border.all(color: scheme.outline, width: 1),
            boxShadow: isDark ? AppShadows.dKey : AppShadows.e3,
          ),
          child: ClipRRect(
            borderRadius: AppRadius.rHero,
            child: SizedBox(
              height: _barHeight,
              child: Stack(
                children: [
                  // The sliding active pill sits BEHIND the icons.
                  Positioned.fill(
                    child: IgnorePointer(
                      child: AnimatedAlign(
                        key: const ValueKey('nav-pill-align'),
                        alignment: AlignmentDirectional(
                          pillAlignmentX(currentIndex, items.length),
                          _pillAlignY,
                        ),
                        duration: motion ? AppMotion.small : Duration.zero,
                        curve: AppMotion.easeOutQuart,
                        child: AnimatedOpacity(
                          opacity: activeIsDestination ? 1 : 0,
                          duration: motion ? AppMotion.small : Duration.zero,
                          curve: AppMotion.easeOutQuart,
                          child: Container(
                            key: const ValueKey('nav-active-pill'),
                            width: _pillWidth,
                            height: _pillHeight,
                            decoration: ShapeDecoration(
                              color: scheme.primary.withValues(alpha: 0.12),
                              shape: const StadiumBorder(),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  // The tappable destinations / actions.
                  Material(
                    type: MaterialType.transparency,
                    child: Row(
                      children: [
                        for (final (index, item) in items.indexed)
                          Expanded(
                            child: _NavSlot(
                              item: item,
                              active: index == currentIndex && !item.isAction,
                              motion: motion,
                              onTap: () => onSelected(index),
                            ),
                          ),
                      ],
                    ),
                  ),
                  // Dark: a 1px top catch-light, drawn as a clipped overlay (a
                  // rounded bar forbids a top-only Border), the same treatment
                  // AppCard uses on raised dark surfaces. Realizes the spec's
                  // `dTopHighlight` alongside the `dKey` key shadow above.
                  if (isDark)
                    Positioned(
                      top: 0,
                      left: 0,
                      right: 0,
                      child: IgnorePointer(
                        child: Container(
                          height: 1,
                          color: Colors.white.withValues(alpha: 0.05),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// One slot: a full-height, ≥48dp tap target carrying the icon and label, with
/// the active-icon micro-scale + role colours. All motion is implicit (no
/// first-build animation) and collapses to `Duration.zero` under reduce-motion.
class _NavSlot extends StatelessWidget {
  const _NavSlot({
    required this.item,
    required this.active,
    required this.motion,
    required this.onTap,
  });

  final FloatingNavItem item;
  final bool active;
  final bool motion;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final iconColor = active ? scheme.primary : scheme.onSurfaceVariant;
    final labelStyle = theme.textTheme.labelMedium!.copyWith(
      color: iconColor,
      fontWeight: active ? FontWeight.w600 : FontWeight.w500,
    );

    return Semantics(
      button: true,
      selected: active,
      label: item.label,
      excludeSemantics: true,
      child: InkResponse(
        onTap: onTap,
        radius: FloatingBottomNav._pillWidth * 0.6,
        child: SizedBox(
          height: FloatingBottomNav._barHeight,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedScale(
                scale: active ? 1.08 : 1.0,
                duration: motion ? AppMotion.micro : Duration.zero,
                curve: AppMotion.easeOutQuart,
                child: Icon(
                  item.icon,
                  size: AppIconSize.standalone,
                  color: iconColor,
                ),
              ),
              const SizedBox(height: AppSpacing.space1),
              AnimatedDefaultTextStyle(
                style: labelStyle,
                duration: motion ? AppMotion.small : Duration.zero,
                curve: AppMotion.standard,
                child: Text(
                  item.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  // Cap label growth so the compact bar never overflows 56dp at
                  // the highest tested text scale (labelMedium stays ≥12sp).
                  textScaler: MediaQuery.textScalerOf(
                    context,
                  ).clamp(maxScaleFactor: 1.3),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
