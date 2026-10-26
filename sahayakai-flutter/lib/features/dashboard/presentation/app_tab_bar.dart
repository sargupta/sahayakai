import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/motion/animated_entrance.dart';

/// The four destinations, in the order the v2 TabBar draws them. Creation is
/// not a tab: VIDYA, the orb, starts it from any screen.
enum AppTab { home, library, community, profile }

/// The v2 TabBar (design system v2, `TabBar`): a floating capsule of four
/// icon discs — home, library, community, profile — never five.
///
/// Geometry, exactly as `.sk-tabbar` draws it:
///   • each disc is [discSize] (42, `tab-size`); its touch target is
///     [targetSize] (48), extended evenly around the disc;
///   • discs sit 6px apart (`space-2`) and 7px inside the capsule
///     (`space-3`), so the capsule is 202 × 58 with its 1px edge;
///   • the capsule is `surface-chrome` with a 1px `border-glass` edge, a pill,
///     and `shadow-float`.
/// The 48px targets abut, so the visible 6px gap between discs falls out of
/// the target geometry (48 − 42) and no target overlaps another.
///
/// The active tab is a saffron disc with a white icon at a 1.8 stroke
/// (`emphasis="fill"`); inactive icons are `ink-500` at 1.7. While the orb is
/// being dragged ([dimmed]) the bar drops to half opacity and the active disc
/// becomes a 12% saffron tint with a `saffron-600` icon (`emphasis="tint"`).
///
/// No labels are drawn: [labels] are each tab's accessible name and tooltip.
/// The active tab reports itself selected (the `aria-current` analogue).
class AppTabBar extends StatelessWidget {
  const AppTabBar({
    super.key,
    required this.current,
    required this.labels,
    required this.onSelected,
    this.dimmed = false,
  });

  final AppTab current;

  /// The translated accessible name of each tab.
  final Map<AppTab, String> labels;
  final ValueChanged<AppTab> onSelected;

  /// True while VIDYA's orb is being dragged.
  final bool dimmed;

  static const double discSize = 42; // tab-size
  static const double targetSize = 48;
  static const double _gap = 6; // space-2
  static const double _padding = 7; // space-3

  /// The capsule's inner padding to the edge of each touch target: the 1px
  /// edge plus the 7px drawn padding, less the target's extension past its
  /// disc (a `Border` paints inside the box, CSS padding sits inside it).
  static const double _targetPadding =
      AppGlass.borderWidth + _padding - (targetSize - discSize) / 2;

  /// Where the capsule floats above the screen's foot (`tabbar-bottom`).
  static const double bottomOffset = 18;

  @override
  Widget build(BuildContext context) {
    assert(targetSize - discSize == _gap);

    final decoration = BoxDecoration(
      color: AppColors.surfaceChrome,
      borderRadius: AppRadius.rPill,
      border: Border.all(
        color: AppColors.borderGlass,
        width: AppGlass.borderWidth,
      ),
      boxShadow: AppShadows.float,
    );

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.only(bottom: bottomOffset),
        child: Center(
          heightFactor: 1,
          child: AnimatedOpacity(
            opacity: dimmed ? 0.5 : 1,
            duration: context.motionEnabled ? AppMotion.change : Duration.zero,
            curve: AppMotion.standard,
            child: Semantics(
              container: true,
              explicitChildNodes: true,
              child: DecoratedBox(
                decoration: decoration,
                child: Padding(
                  padding: const EdgeInsets.all(_targetPadding),
                  child: Material(
                    type: MaterialType.transparency,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        for (final tab in AppTab.values)
                          _TabDisc(
                            key: ValueKey('tab-${tab.name}'),
                            tab: tab,
                            label: labels[tab] ?? tab.name,
                            active: tab == current,
                            tint: dimmed,
                            onTap: () => onSelected(tab),
                          ),
                      ],
                    ),
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

class _TabDisc extends StatefulWidget {
  const _TabDisc({
    super.key,
    required this.tab,
    required this.label,
    required this.active,
    required this.tint,
    required this.onTap,
  });

  final AppTab tab;
  final String label;
  final bool active;

  /// The `emphasis="tint"` treatment (while the orb is dragged).
  final bool tint;
  final VoidCallback onTap;

  @override
  State<_TabDisc> createState() => _TabDiscState();
}

class _TabDiscState extends State<_TabDisc> {
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final motion = context.motionEnabled;

    final Color disc;
    final Color ink;
    if (!widget.active) {
      disc = Colors.transparent;
      ink = AppColors.textMuted;
    } else if (widget.tint) {
      disc = AppColors.accentTintStrong;
      ink = AppColors.saffron600;
    } else {
      disc = scheme.primary;
      ink = scheme.onPrimary;
    }
    final stroke = widget.active && !widget.tint ? 1.8 : 1.7;

    // One node per tab: its name, button role, selected state, and the
    // InkResponse's tap and focus actions merged into it (the icon paints no
    // semantics; the tooltip's are excluded so the name is not read twice).
    return Semantics(
      container: true,
      button: true,
      selected: widget.active,
      label: widget.label,
      child: Tooltip(
        message: widget.label,
        excludeFromSemantics: true,
        child: InkResponse(
          onTap: widget.onTap,
          onFocusChange: (f) => setState(() => _focused = f),
          containedInkWell: true,
          customBorder: const CircleBorder(),
          radius: AppTabBar.discSize / 2,
          focusColor: Colors.transparent,
          child: SizedBox.square(
            dimension: AppTabBar.targetSize,
            child: Center(
              child: AnimatedContainer(
                duration: motion ? AppMotion.change : Duration.zero,
                curve: AppMotion.standard,
                width: AppTabBar.discSize,
                height: AppTabBar.discSize,
                decoration: BoxDecoration(
                  color: disc,
                  shape: BoxShape.circle,
                ),
                // Focus: a 2px saffron-600 outline 2px outside the disc,
                // never a shadow.
                foregroundDecoration: _focused
                    ? BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: AppColors.saffron600,
                          width: 2,
                          strokeAlign: BorderSide.strokeAlignOutside + 2,
                        ),
                      )
                    : null,
                alignment: Alignment.center,
                child: AppTabIcon(widget.tab, color: ink, strokeWidth: stroke),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The app's own line icons for the four destinations (design system v2,
/// `assets/App icons/*.svg`): 20×20 paths with round caps and joins, drawn at
/// [size] (18) — so the 1.7 / 1.8 stroke scales with the glyph, as the SVG's
/// does.
class AppTabIcon extends StatelessWidget {
  const AppTabIcon(
    this.tab, {
    super.key,
    required this.color,
    this.strokeWidth = 1.7,
    this.size = 18,
  });

  final AppTab tab;
  final Color color;
  final double strokeWidth;
  final double size;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.square(size),
      painter: _AppTabIconPainter(tab, color, strokeWidth),
    );
  }
}

class _AppTabIconPainter extends CustomPainter {
  _AppTabIconPainter(this.tab, this.color, this.strokeWidth);

  final AppTab tab;
  final Color color;
  final double strokeWidth;

  /// The SVG viewBox side.
  static const double _box = 20;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / _box, size.height / _box);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = color;
    canvas.drawPath(_path(tab), paint);
  }

  static Path _path(AppTab tab) {
    switch (tab) {
      case AppTab.home:
        // M3 9.4 10 3.8l7 5.6V17H3z
        return Path()
          ..moveTo(3, 9.4)
          ..lineTo(10, 3.8)
          ..lineTo(17, 9.4)
          ..lineTo(17, 17)
          ..lineTo(3, 17)
          ..close();
      case AppTab.library:
        // M3 5.4h4.6L9.2 7.6H17v9H3z
        return Path()
          ..moveTo(3, 5.4)
          ..lineTo(7.6, 5.4)
          ..lineTo(9.2, 7.6)
          ..lineTo(17, 7.6)
          ..lineTo(17, 16.6)
          ..lineTo(3, 16.6)
          ..close();
      case AppTab.community:
        // circle 7.6,7.4 r2.8 · circle 13.4,9.2 r2.4 ·
        // M3.4 16.4c0-2.4 1.9-3.8 4.2-3.8s4.2 1.4 4.2 3.8
        return Path()
          ..addOval(Rect.fromCircle(center: const Offset(7.6, 7.4), radius: 2.8))
          ..addOval(Rect.fromCircle(center: const Offset(13.4, 9.2), radius: 2.4))
          ..moveTo(3.4, 16.4)
          ..cubicTo(3.4, 14, 5.3, 12.6, 7.6, 12.6)
          ..cubicTo(9.9, 12.6, 11.8, 14, 11.8, 16.4);
      case AppTab.profile:
        // circle 10,7 r2.8 · M4.4 17c0-3.1 2.5-4.8 5.6-4.8s5.6 1.7 5.6 4.8
        return Path()
          ..addOval(Rect.fromCircle(center: const Offset(10, 7), radius: 2.8))
          ..moveTo(4.4, 17)
          ..cubicTo(4.4, 13.9, 6.9, 12.2, 10, 12.2)
          ..cubicTo(13.1, 12.2, 15.6, 13.9, 15.6, 17);
    }
  }

  @override
  bool shouldRepaint(_AppTabIconPainter old) =>
      old.tab != tab || old.color != color || old.strokeWidth != strokeWidth;
}
