import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_shadows.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../shared/motion/animated_entrance.dart';

/// Icon-only floating tab bar — Design System v3 canonical.
///
/// A centred capsule 18px above the screen bottom: `rgba(255,253,249,.9)` fill,
/// 1px `rgba(255,255,255,.95)` border, `0 8px 22px rgba(23,19,16,.1)` shadow,
/// 7px inner padding and a 6px gap between targets.
///
/// Four 42px circular targets in order: **Home · Library · Community · You**.
/// The active tab is a **saffron disc with a white icon**; inactive icons are
/// ink-500 `#6E655C`. While the orb is dragged the active tab shows only a
/// 12% saffron tint instead of the full disc. On the dark scanner surface the
/// bar becomes `rgba(255,253,249,.16)` with milk icons.
///
/// No labels, no fifth tab, no Create action (Create lives as a Home tile) —
/// the orb is presence, never a tab.
class FloatingBottomNav extends StatelessWidget {
  const FloatingBottomNav({
    super.key,
    required this.currentIndex,
    required this.onSelected,
    this.orbDragging = false,
  });

  /// Index of the active tab: 0=Home, 1=Library, 2=Community, 3=You.
  final int currentIndex;

  /// Called when a tab is tapped.
  final ValueChanged<int> onSelected;

  /// When true the active tab shows a 12% saffron tint instead of the disc.
  final bool orbDragging;

  /// 20px line icons, ~1.7px stroke (lucide's 2/24 scales to 1.67 at 20).
  static const double _iconSize = 20;
  static const double _tabTarget = AppSpacing.tabSize; // 42

  static const List<IconData> _icons = [
    LucideIcons.home,
    LucideIcons.library,
    LucideIcons.users,
    LucideIcons.user,
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final motion = context.motionEnabled;

    // Light: rgba(255,253,249,.90). Dark (scanner): rgba(255,253,249,.16).
    final fillColor = isDark
        ? const Color(0x29FFFDF9)
        : const Color(0xE6FFFDF9);

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.tabBarBottom),
        // heightFactor keeps the bar a floating capsule (56 = 42 target + 2×7
        // padding) instead of a full-height slab: the Scaffold's
        // bottomNavigationBar slot hands down loose full-screen constraints, so
        // a bare Center would expand to the whole slot and collapse the body to
        // zero height. The body keeps its own space and the bar floats over it,
        // which is what the design (and AppShell) intends.
        child: Align(
          heightFactor: 1,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: fillColor,
              borderRadius: BorderRadius.circular(9999),
              border: Border.all(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.14)
                    : AppColors.borderGlass, // 95% white
                width: 1,
              ),
              boxShadow: [AppShadows.navFloatLight],
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.tabBarPadding,
                vertical: AppSpacing.tabBarPadding,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(_icons.length, (i) {
                  return _TabButton(
                    key: ValueKey('tab_$i'),
                    icon: _icons[i],
                    label: _labels(context)[i],
                    isActive: i == currentIndex,
                    isDark: isDark,
                    orbDragging: orbDragging,
                    motion: motion,
                    onTap: () {
                      if (i != currentIndex) HapticFeedback.selectionClick();
                      onSelected(i);
                    },
                  );
                }),
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Screen-reader labels — the bar is icon-only *visually*; assistive tech
  /// still gets the localized destination name (v3: icons only, but never
  /// silent).
  static List<String> _labels(BuildContext context) {
    final l10n = context.l10n;
    return [l10n.navHome, l10n.navLibrary, l10n.networkTitle, l10n.navProfile];
  }
}

/// One 42px circular target: saffron disc when active, bare icon when not.
/// Visually icon-only; exposed to assistive tech as a selected/unselected
/// button carrying the localized destination label.
class _TabButton extends StatelessWidget {
  const _TabButton({
    super.key,
    required this.icon,
    required this.label,
    required this.isActive,
    required this.isDark,
    required this.orbDragging,
    required this.motion,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool isActive;
  final bool isDark;
  final bool orbDragging;
  final bool motion;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    Color? background;
    Color iconColor;

    if (isDark) {
      // Scanner surface: active = translucent milk, icons milk/ink-400.
      background = isActive ? const Color(0x29FFFDF9) : null;
      iconColor = isActive ? AppColors.milk50 : AppColors.ink400;
    } else if (isActive) {
      if (orbDragging) {
        // Dragging: only a 12% saffron tint stands in for the disc.
        background = AppColors.accentTint;
        iconColor = AppColors.saffron600;
      } else {
        background = AppColors.saffron500;
        iconColor = AppColors.textOnAccent;
      }
    } else {
      background = null;
      iconColor = AppColors.ink500;
    }

    // Instagram-style: only the active tab speaks its label, expanding the
    // circular disc into a rounded pill that carries icon + label. Inactive
    // tabs stay bare icon-only circles, so the bar stays quiet until a tab is
    // chosen.
    final borderRadius = BorderRadius.circular(
      isActive ? 9999 : FloatingBottomNav._tabTarget / 2,
    );

    return Semantics(
      button: true,
      selected: isActive,
      label: label,
      // The bar is ONE clean node per tab: with excludeSemantics the
      // InkWell's own semantics (tap action + enabled state) are dropped, so
      // they must be re-declared here or assistive tech announces a button it
      // cannot activate (no tap action, no hasEnabledState).
      enabled: true,
      onTap: onTap,
      excludeSemantics: true,
      child: AnimatedContainer(
        duration: motion ? AppMotion.small : Duration.zero,
        curve: AppMotion.easeOutQuart,
        height: FloatingBottomNav._tabTarget,
        padding: isActive
            ? const EdgeInsets.symmetric(horizontal: 14)
            : EdgeInsets.zero,
        decoration: BoxDecoration(color: background, borderRadius: borderRadius),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            customBorder: RoundedRectangleBorder(borderRadius: borderRadius),
            onTap: onTap,
            child: Center(
              child: isActive
                  ? Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          icon,
                          size: FloatingBottomNav._iconSize,
                          color: iconColor,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          label,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: iconColor,
                          ),
                        ),
                      ],
                    )
                  : SizedBox(
                      width: FloatingBottomNav._tabTarget,
                      height: FloatingBottomNav._tabTarget,
                      child: Center(
                        child: Icon(
                          icon,
                          size: FloatingBottomNav._iconSize,
                          color: iconColor,
                        ),
                      ),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
