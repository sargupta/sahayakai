import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_motion.dart';
import '../../../core/theme/app_shadows.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../shared/motion/animated_entrance.dart';

/// Where the bar is drawn: the app's wash, or the scanner's dark camera ground.
enum FloatingNavTone { standard, camera }

/// Icon-only floating tab bar — design system `TabBar`
/// (docs/design-system/components/TabBar), with VIDYA optionally docked in it
/// (v2 canvas 9a, "VIDYA lives in the tab bar").
///
/// A centred capsule 18px above the screen bottom: `surface-chrome` fill,
/// 1px `border-glass` edge, `shadow-float`, 7px inner padding. Four tabs in
/// order: **Home · Library · Community · You**. Labels are never drawn: each is
/// the tab's accessible name only.
///
/// - **Undocked**: 42px discs 6px apart in 48px touch cells; the active tab is
///   a saffron disc with a white icon.
/// - **Docked** ([dock] given): 40px discs 4px apart in 44px touch cells, then
///   a 1×24 divider and the [dock] (VIDYA's orb). The active tab is a 12%
///   saffron tint with a saffron-600 icon, so the orb stays the one saffron
///   sphere in the bar.
///
/// [prompt] sits directly above the capsule (the dock's "what VIDYA offers
/// here" capsule) and owns its own spacing. With [FloatingNavTone.camera] the
/// capsule is 16% milk with no shadow and inactive icons are `on-camera-icon`.
///
/// No fifth tab, no Create action — creation starts from VIDYA.
class FloatingBottomNav extends StatelessWidget {
  const FloatingBottomNav({
    super.key,
    this.currentPage = 0.0,
    required this.currentIndex,
    required this.onSelected,
    this.dock,
    this.showDock = true,
    this.prompt,
    this.tone = FloatingNavTone.standard,
  });

  /// Fractional page position (0.0-3.0) for indicator animation.
  final double currentPage;

  /// Index of the active tab: 0=Home, 1=Library, 2=Community, 3=You.
  final int currentIndex;

  /// Called when a tab is tapped.
  final ValueChanged<int> onSelected;

  /// VIDYA's docked orb, drawn after a divider at the end of the bar.
  final Widget? dock;

  /// Whether the [dock] is drawn right now. Home hides it — its big orb is
  /// VIDYA there — while the bar keeps the docked layout, so the tabs do not
  /// change size as the teacher swipes; the bar's width animates instead.
  final bool showDock;

  /// A capsule drawn above the bar; it owns its own spacing.
  final Widget? prompt;

  /// The ground the bar sits on.
  final FloatingNavTone tone;

  static const List<IconData> _icons = [
    LucideIcons.home,
    LucideIcons.library,
    LucideIcons.users,
    LucideIcons.user,
  ];

  @override
  Widget build(BuildContext context) {
    final motion = context.motionEnabled;
    final camera = tone == FloatingNavTone.camera;
    final docked = dock != null;
    final geometry = docked ? _Geometry.docked : _Geometry.undocked;
    final labels = _labels(context);
    final effectivePage = (currentPage == 0.0 && currentIndex != 0)
        ? currentIndex.toDouble()
        : currentPage;

    final tabs = List<Widget>.generate(_icons.length, (i) {
      final dist = (effectivePage - i).abs().clamp(0.0, 1.0);
      return _TabButton(
        key: ValueKey('tab_$i'),
        icon: _icons[i],
        label: labels[i],
        isActive: i == currentIndex,
        activeWeight: 1.0 - dist,
        camera: camera,
        tint: docked,
        geometry: geometry,
        motion: motion,
        onTap: () {
          if (i != currentIndex) HapticFeedback.selectionClick();
          onSelected(i);
        },
      );
    });

    final row = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        ...tabs,
        if (docked && showDock) ...[
          const SizedBox(width: _Geometry.dividerLead),
          const _DockDivider(),
          const SizedBox(width: _Geometry.dividerTrail),
          dock!,
        ],
      ],
    );

    final capsule = DecoratedBox(
      decoration: BoxDecoration(
        color: camera ? AppColors.cameraGlass : AppColors.surfaceChrome,
        borderRadius: BorderRadius.circular(9999),
        border: Border.all(
          color: camera ? AppColors.cameraBorder : AppColors.borderGlass,
        ),
        boxShadow: camera ? null : const [AppShadows.navFloatLight],
      ),
      child: Padding(
        padding: geometry.capsulePadding,
        // The bar's width eases when the dock shows or hides. Under reduce
        // motion it simply jumps: a zero-length AnimatedSize re-dirties its
        // own layout, so it is left out rather than run at Duration.zero.
        child: motion
            ? AnimatedSize(
                duration: AppMotion.small,
                curve: AppMotion.easeOutQuart,
                child: row,
              )
            : row,
      ),
    );

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.tabBarBottom),
        // heightFactor keeps the bar a floating capsule instead of a
        // full-height slab: the Scaffold's bottomNavigationBar slot hands down
        // loose full-screen constraints, so a bare Center would expand to the
        // whole slot and collapse the body to zero height.
        child: Align(
          heightFactor: 1,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (prompt != null)
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.screenGutter,
                  ),
                  child: prompt,
                ),
              capsule,
            ],
          ),
        ),
      ),
    );
  }

  /// Screen-reader labels — the bar is icon-only visually; assistive tech
  /// still gets the localized destination name.
  static List<String> _labels(BuildContext context) {
    final l10n = context.l10n;
    return [l10n.navHome, l10n.navLibrary, l10n.networkTitle, l10n.navProfile];
  }
}

/// Disc and touch-cell sizes for the two bar layouts. Touch cells overlap the
/// drawn padding and gaps, so the capsule keeps the drawn geometry exactly.
class _Geometry {
  const _Geometry({
    required this.disc,
    required this.cell,
    required this.capsulePadding,
  });

  /// 42 discs, 6 apart, 7 from the edge: 48 cells overhang 3 a side.
  static const undocked = _Geometry(
    disc: AppSpacing.tabSize,
    cell: AppSpacing.tabHit,
    capsulePadding: EdgeInsets.all(AppSpacing.tabBarPadding - 3),
  );

  /// 40 discs, 4 apart, 7 from the left edge (44 cells overhang 2); the 42
  /// orb in a 44 cell sits 7 from the right edge and sets the 56 height.
  static const docked = _Geometry(
    disc: AppSpacing.dockTabSize,
    cell: AppSpacing.dockCell,
    capsulePadding: EdgeInsets.fromLTRB(
      AppSpacing.tabBarPadding - 2,
      AppSpacing.tabBarPadding - 1,
      AppSpacing.tabBarPadding - 1,
      AppSpacing.tabBarPadding - 1,
    ),
  );

  /// Last disc → divider: 4 gap + 3 margin, less the cell's 2 overhang.
  static const double dividerLead =
      AppSpacing.dockGap + AppSpacing.dockDividerMargin - 2;

  /// Divider → orb sphere: 3 margin + 4 gap, less the orb cell's 1 overhang.
  static const double dividerTrail =
      AppSpacing.dockDividerMargin + AppSpacing.dockGap - 1;

  final double disc;
  final double cell;
  final EdgeInsets capsulePadding;
}

/// The 1×24 hairline between the destinations and VIDYA.
class _DockDivider extends StatelessWidget {
  const _DockDivider();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 1,
      height: AppSpacing.dockDividerHeight,
      child: ColoredBox(color: AppColors.borderStrong),
    );
  }
}

/// One tab: a touch cell around a disc — saffron (or a saffron tint when
/// VIDYA is docked) when active, bare when not. Exposed to assistive tech as a
/// selected/unselected button carrying the localized destination label.
class _TabButton extends StatelessWidget {
  const _TabButton({
    super.key,
    required this.icon,
    required this.label,
    required this.isActive,
    this.activeWeight = 0.0,
    required this.camera,
    required this.tint,
    required this.geometry,
    required this.motion,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool isActive;

  /// 0..1 — how close the swipe is to this tab; drives the disc cross-fade.
  final double activeWeight;
  final bool camera;

  /// Active tab as a 12% saffron tint instead of a filled disc.
  final bool tint;
  final _Geometry geometry;
  final bool motion;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final inactiveIcon = camera ? AppColors.onCameraIcon : AppColors.ink500;
    final activeFill = tint ? AppColors.accentTintStrong : AppColors.saffron500;
    final activeIcon = tint ? AppColors.saffron600 : AppColors.textOnAccent;

    // Inactive tabs paint no background at all (null, not transparent).
    final background = activeWeight <= 0.0
        ? null
        : Color.lerp(Colors.transparent, activeFill, activeWeight);
    final iconColor = Color.lerp(inactiveIcon, activeIcon, activeWeight)!;

    return Semantics(
      button: true,
      selected: isActive,
      label: label,
      enabled: true,
      onTap: onTap,
      excludeSemantics: true,
      child: SizedBox.square(
        dimension: geometry.cell,
        child: Material(
          type: MaterialType.transparency,
          child: InkResponse(
            onTap: onTap,
            radius: geometry.disc / 2,
            customBorder: const CircleBorder(),
            child: Center(
              child: AnimatedContainer(
                duration: motion ? AppMotion.small : Duration.zero,
                curve: AppMotion.easeOutQuart,
                width: geometry.disc,
                height: geometry.disc,
                decoration: BoxDecoration(
                  color: background,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  icon,
                  size: AppSpacing.tabIconSize,
                  color: iconColor,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
