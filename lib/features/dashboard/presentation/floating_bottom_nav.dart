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

/// The floating tab bar, drawn to the UX map's `tabbar`, with VIDYA optionally
/// docked at its end (v2 canvas 9a, kept by the product owner).
///
/// A centred capsule 18px above the screen bottom: 92% white, a 1px white
/// edge, a soft warm shadow, 7px inner padding. Four tabs in order: **Home ·
/// Library · Community · Profile**, 42px tall and 4px apart. An inactive tab
/// is a bare 19px icon; the active tab is a saffron-600 pill carrying a white
/// icon AND its name, so the teacher always reads where she is.
///
/// With a [dock], a 1×24 divider and VIDYA's orb follow the tabs. [prompt]
/// sits directly above the capsule and owns its own spacing. With
/// [FloatingNavTone.camera] the capsule is 16% milk with no shadow and
/// inactive icons are `on-camera-icon`.
///
/// No fifth tab, no Create action: creation starts from VIDYA.
class FloatingBottomNav extends StatelessWidget {
  const FloatingBottomNav({
    super.key,
    this.currentPage = 0.0,
    required this.currentIndex,
    required this.onSelected,
    this.dock,
    this.showDock = true,
    this.dockLeading = false,
    this.prompt,
    this.tone = FloatingNavTone.standard,
  });

  /// Fractional page position (0.0-3.0) while the teacher swipes. Kept for the
  /// shell's API; the pill moves when the page settles on [currentIndex].
  final double currentPage;

  /// Index of the active tab: 0=Home, 1=Library, 2=Community, 3=Profile.
  final int currentIndex;

  /// Called when a tab is tapped.
  final ValueChanged<int> onSelected;

  /// VIDYA's docked orb, drawn after a divider at the end of the bar.
  final Widget? dock;

  /// Whether the [dock] is drawn right now. Home hides it: its big orb is
  /// VIDYA there.
  final bool showDock;

  /// Whether VIDYA sits at the start of the bar (the teacher's left hand)
  /// rather than the end. Changing it glides the orb across.
  final bool dockLeading;

  /// A capsule drawn above the bar; it owns its own spacing.
  final Widget? prompt;

  /// The ground the bar sits on.
  final FloatingNavTone tone;

  /// How far a tab's 48dp touch cell reaches past its drawn 42px button.
  static const double _hit = (AppSpacing.tabHit - AppSpacing.tabButton) / 2;

  /// The orb's slot: its 44 touch cell plus 1px either side, so the sphere
  /// sits 6px in from the capsule edge.
  static const double _orbSlot = AppSpacing.dockCell + 2;

  /// From the orb's slot to the divider: margin + gap, less the orb cell's
  /// 1px overhang and the slot's 1px.
  static const double _dividerGap =
      AppSpacing.dockDividerMargin + AppSpacing.dockGap - 2;

  /// The room VIDYA takes on its side: slot, gap, divider, and the gap to the
  /// nearest tab's touch cell (less that cell's overhang).
  static const double _dockRun =
      _orbSlot +
      _dividerGap +
      1 +
      (AppSpacing.dockGap + AppSpacing.dockDividerMargin - _hit);

  /// The map's glyphs: a folder for Library (saved work), not a bookshelf.
  static const List<IconData> _icons = [
    LucideIcons.home,
    LucideIcons.folder,
    LucideIcons.users,
    LucideIcons.user,
  ];

  @override
  Widget build(BuildContext context) {
    final motion = context.motionEnabled;
    final camera = tone == FloatingNavTone.camera;
    final docked = dock != null && showDock;
    final labels = _labels(context);
    final showName = _nameFits(context, labels[currentIndex], docked: docked);

    final tabs = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < _icons.length; i++)
          _TabButton(
            key: ValueKey('tab_$i'),
            icon: _icons[i],
            label: labels[i],
            isActive: i == currentIndex,
            showName: i == currentIndex && showName,
            camera: camera,
            motion: motion,
            onTap: () {
              if (i != currentIndex) HapticFeedback.selectionClick();
              onSelected(i);
            },
          ),
      ],
    );

    // VIDYA sits on the teacher's side. When the side changes the tabs make
    // room on the other end, the orb glides across the bar to its new slot,
    // and the divider fades from one gap to the other.
    final glide = motion ? AppMotion.medium : Duration.zero;
    final row = !docked
        ? tabs
        : Stack(
            clipBehavior: Clip.none,
            children: [
              AnimatedPadding(
                duration: glide,
                curve: AppMotion.emphasized,
                padding: EdgeInsetsDirectional.only(
                  start: dockLeading ? _dockRun : 0,
                  end: dockLeading ? 0 : _dockRun,
                ),
                child: tabs,
              ),
              for (final leadingSide in const [true, false])
                PositionedDirectional(
                  start: leadingSide ? _orbSlot + _dividerGap : null,
                  end: leadingSide ? null : _orbSlot + _dividerGap,
                  top: 0,
                  bottom: 0,
                  child: AnimatedOpacity(
                    duration: glide,
                    curve: AppMotion.emphasized,
                    opacity: leadingSide == dockLeading ? 1 : 0,
                    child: const Center(child: _DockDivider()),
                  ),
                ),
              Positioned.fill(
                child: AnimatedAlign(
                  duration: glide,
                  curve: AppMotion.emphasized,
                  alignment: dockLeading
                      ? AlignmentDirectional.centerStart
                      : AlignmentDirectional.centerEnd,
                  child: SizedBox(
                    width: _orbSlot,
                    child: Center(child: dock),
                  ),
                ),
              ),
            ],
          );

    final capsule = DecoratedBox(
      decoration: BoxDecoration(
        color: camera ? AppColors.cameraGlass : AppColors.surfaceTabBar,
        borderRadius: BorderRadius.circular(9999),
        border: Border.all(
          color: camera ? AppColors.cameraBorder : AppColors.borderGlass,
        ),
        boxShadow: camera ? null : const [AppShadows.tabBar],
      ),
      child: Padding(
        // Each tab's 48dp touch cell overhangs its drawn 42px button by 3px a
        // side, into the capsule's 7px padding, so the drawn geometry stays
        // the map's 56px capsule. The orb's slot carries its own spacing, so
        // the padding is the same on both ends whichever side VIDYA is on.
        padding: const EdgeInsets.all(AppSpacing.tabBarPadding - _hit),
        // The pill's width eases as it moves between tabs and the dock shows
        // or hides. Under reduce motion it jumps: a zero-length AnimatedSize
        // re-dirties its own layout, so it is left out rather than run at
        // Duration.zero.
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

  /// Whether the active tab's drawn name fits on this screen. A long name at
  /// a large text size (Tamil at 1.3x on 360dp, say) would push the bar past
  /// the screen; the a11y rules forbid shrinking or ellipsizing it, so the pill
  /// keeps only its icon then. The name is still the tab's accessible label.
  static bool _nameFits(
    BuildContext context,
    String name, {
    required bool docked,
  }) {
    final painter = TextPainter(
      text: TextSpan(text: name, style: _TabButton.nameStyle(context)),
      textDirection: Directionality.of(context),
      textScaler: MediaQuery.textScalerOf(context),
      maxLines: 1,
    )..layout();
    final nameWidth = painter.width;
    painter.dispose();

    const inactiveCells = 3 * AppSpacing.tabHit;
    final activeCell =
        AppSpacing.tabPillStart +
        AppSpacing.tabIcon +
        AppSpacing.tabLabelGap +
        nameWidth +
        AppSpacing.tabPillEnd +
        2 * _hit;
    // Padding both sides, plus the 1px border both sides.
    const chrome = 2 * (AppSpacing.tabBarPadding - _hit) + 2;
    final barWidth =
        inactiveCells + activeCell + chrome + (docked ? _dockRun : 0);
    final available =
        MediaQuery.sizeOf(context).width - 2 * AppSpacing.screenGutter;
    return barWidth <= available;
  }

  /// The localized destination names: drawn on the active tab, and every
  /// tab's accessible name.
  static List<String> _labels(BuildContext context) {
    final l10n = context.l10n;
    return [
      l10n.navHome,
      l10n.navLibrary,
      l10n.communityTitle,
      l10n.navProfile,
    ];
  }
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

/// One tab. Inactive: a 42px circle around a muted icon. Active: a saffron-600
/// pill with a white icon and the destination's name. Exposed to assistive
/// tech as a selected/unselected button carrying the localized name.
class _TabButton extends StatelessWidget {
  const _TabButton({
    super.key,
    required this.icon,
    required this.label,
    required this.isActive,
    required this.showName,
    required this.camera,
    required this.motion,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool isActive;

  /// Whether the active pill draws its name (see `_nameFits`).
  final bool showName;

  /// The drawn name's style; the bar measures with it too.
  static TextStyle? nameStyle(BuildContext context) => Theme.of(
    context,
  ).textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w600);
  final bool camera;
  final bool motion;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final inactive = camera ? AppColors.onCameraIcon : AppColors.ink500;
    final foreground = isActive ? AppColors.textOnAccent : inactive;

    return Semantics(
      button: true,
      selected: isActive,
      label: label,
      enabled: true,
      onTap: onTap,
      excludeSemantics: true,
      // The whole 48dp cell is the target; the drawn button sits inside it.
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(FloatingBottomNav._hit),
          child: Material(
            type: MaterialType.transparency,
            child: InkWell(
              onTap: onTap,
              customBorder: const StadiumBorder(),
              child: AnimatedContainer(
                duration: motion ? AppMotion.small : Duration.zero,
                curve: AppMotion.easeOutQuart,
                height: AppSpacing.tabButton,
                constraints: const BoxConstraints(
                  minWidth: AppSpacing.tabButton,
                ),
                padding: isActive
                    ? const EdgeInsetsDirectional.only(
                        start: AppSpacing.tabPillStart,
                        end: AppSpacing.tabPillEnd,
                      )
                    : EdgeInsets.zero,
                decoration: ShapeDecoration(
                  color: isActive ? AppColors.accentFill : null,
                  shape: const StadiumBorder(),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(icon, size: AppSpacing.tabIcon, color: foreground),
                    if (showName) ...[
                      const SizedBox(width: AppSpacing.tabLabelGap),
                      Text(
                        label,
                        style: nameStyle(context)?.copyWith(color: foreground),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
