
import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_glass.dart';
import '../../core/theme/app_radius.dart';

/// GlassSurface — the v2 glass material (design system v2, `GlassCard`).
///
/// A translucent white fill with a 1px luminous `border-glass` edge, drawn
/// over the screen wash. Two constructors, one look:
///   • [GlassSurface.new] — chrome (the tab bar, app bar, sheets, a dialog):
///     the `surface-chrome` fill ([AppGlass.lChromeFill]).
///   • [GlassSurface.flat] — cards and list content: the `surface-glass` fill
///     ([AppGlass.lFlatFill]), or [fill] for the strong/soft card tones.
///
/// v2 glass is translucency, not blur, so it draws no `BackdropFilter`.
class GlassSurface extends StatelessWidget {
  /// Chrome surface — tab bar, app bar, sheets, dialog.
  const GlassSurface({
    super.key,
    required this.child,
    this.radius = AppRadius.card,
    this.borderRadius,
    this.padding,
    this.fill,
  }) : _chrome = true;

  /// Card surface — list content, cards, bubbles.
  const GlassSurface.flat({
    super.key,
    required this.child,
    this.radius = AppRadius.card,
    this.borderRadius,
    this.padding,
    this.fill,
  }) : _chrome = false;

  final Widget child;

  /// Uniform corner radius. Defaults to `AppRadius.card` (18); ignored when
  /// [borderRadius] is set.
  final double radius;

  /// Per-corner override (e.g. a bottom sheet's top-only rounding).
  final BorderRadius? borderRadius;
  final EdgeInsetsGeometry? padding;

  /// Overrides the fill, for the v2 card tones (`surface-glass-strong`,
  /// `surface-glass-soft`, `surface-inset`, a sheet's `surface-card`).
  final Color? fill;

  final bool _chrome;

  @override
  Widget build(BuildContext context) {
    final surfaceFill =
        fill ?? (_chrome ? AppGlass.lChromeFill : AppGlass.lFlatFill);
    final perCorner = borderRadius;
    final outerShape = perCorner != null
        ? AppGlass.shapeFromBorderRadius(perCorner)
        : AppGlass.shape(radius);

    // As the CSS draws it: the fill under the whole box, the 1px
    // `border-glass` edge on top.
    return ClipPath(
      clipper: ShapeBorderClipper(shape: outerShape),
      child: Stack(
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: ShapeDecoration(
                color: surfaceFill,
                shape: _withEdge(outerShape),
              ),
            ),
          ),
          Padding(padding: padding ?? EdgeInsets.zero, child: child),
        ],
      ),
    );
  }

  /// [shape] with the 1px `border-glass` edge drawn inside it.
  static ShapeBorder _withEdge(ShapeBorder shape) {
    const side = BorderSide(
      color: AppColors.borderGlass,
      width: AppGlass.borderWidth,
    );
    return shape is RoundedRectangleBorder ? shape.copyWith(side: side) : shape;
  }
}
