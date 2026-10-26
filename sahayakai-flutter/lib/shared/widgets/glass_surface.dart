import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_glass.dart';
import '../../core/theme/app_radius.dart';

/// GlassSurface — the v2 glass material (design system v2, `GlassCard`).
///
/// A translucent white fill with a 1px luminous `border-glass` edge, drawn
/// over the screen wash. Two constructors, one look in light:
///   • [GlassSurface.new] — chrome (the tab bar, app bar, sheets, a dialog):
///     the `surface-chrome` fill ([AppGlass.lChromeFill]).
///   • [GlassSurface.flat] — cards and list content: the `surface-glass` fill
///     ([AppGlass.lFlatFill]), or [fill] for the strong/soft card tones.
///
/// v2 glass is translucency, not blur, so light draws no `BackdropFilter`.
/// Dark keeps its pre-v2 treatment (blurred chrome, a gradient catch-light
/// edge and a faint sheen) because dark mode is an open founder decision.
///
/// Stack order (bottom → top): dark-only blur, the fill with its 1px edge,
/// the dark-only sheen, then [child].
class GlassSurface extends StatelessWidget {
  /// Chrome surface — tab bar, app bar, sheets, dialog.
  const GlassSurface({
    super.key,
    required this.child,
    this.radius = AppRadius.card,
    this.borderRadius,
    this.padding,
    this.addSheen = true,
    this.fill,
  }) : _chrome = true;

  /// Card surface — list content, cards, bubbles.
  const GlassSurface.flat({
    super.key,
    required this.child,
    this.radius = AppRadius.card,
    this.borderRadius,
    this.padding,
    this.addSheen = true,
    this.fill,
  }) : _chrome = false;

  final Widget child;

  /// Uniform corner radius. Defaults to `AppRadius.card` (18); ignored when
  /// [borderRadius] is set.
  final double radius;

  /// Per-corner override (e.g. a bottom sheet's top-only rounding).
  final BorderRadius? borderRadius;
  final EdgeInsetsGeometry? padding;

  /// Dark only: the faint diagonal sheen. Light glass has none.
  final bool addSheen;

  /// Light only: overrides the fill, for the v2 card tones
  /// (`surface-glass-strong`, `surface-glass-soft`, `surface-inset`).
  final Color? fill;

  final bool _chrome;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final Color surfaceFill;
    if (isDark) {
      surfaceFill = _chrome ? AppGlass.dChromeFill : AppGlass.dFlatFill;
    } else {
      surfaceFill =
          fill ?? (_chrome ? AppGlass.lChromeFill : AppGlass.lFlatFill);
    }
    final ShapeBorder outerShape;
    final ShapeBorder innerShape;
    final perCorner = borderRadius;
    if (perCorner != null) {
      outerShape = AppGlass.shapeFromBorderRadius(perCorner);
      innerShape = AppGlass.shapeFromBorderRadius(
        AppGlass.insetBorderRadius(perCorner),
      );
    } else {
      outerShape = AppGlass.shape(radius);
      final innerRadius = math.max(0.0, radius - AppGlass.borderWidth);
      innerShape = AppGlass.shape(innerRadius);
    }

    return ClipPath(
      clipper: ShapeBorderClipper(shape: outerShape),
      child: Stack(
        children: [
          if (isDark && _chrome)
            Positioned.fill(
              child: BackdropFilter(
                filter: ImageFilter.blur(
                  sigmaX: AppGlass.blurSigma,
                  sigmaY: AppGlass.blurSigma,
                ),
                child: const SizedBox.expand(),
              ),
            ),
          if (isDark)
            // Dark: the pre-v2 gradient ring — the outer shape carries the
            // catch-light gradient, an inner shape inset by `borderWidth`
            // carries the fill over it.
            Positioned.fill(
              child: DecoratedBox(
                decoration: ShapeDecoration(
                  shape: outerShape,
                  gradient: AppGlass.dBorderGradient,
                ),
                child: Padding(
                  padding: const EdgeInsets.all(AppGlass.borderWidth),
                  child: DecoratedBox(
                    decoration: ShapeDecoration(
                      shape: innerShape,
                      color: surfaceFill,
                    ),
                  ),
                ),
              ),
            )
          else
            // Light: as the CSS draws it — the fill under the whole box, the
            // 1px `border-glass` edge on top.
            Positioned.fill(
              child: DecoratedBox(
                decoration: ShapeDecoration(
                  color: surfaceFill,
                  shape: _withEdge(outerShape),
                ),
              ),
            ),
          if (isDark && addSheen)
            Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: ShapeDecoration(
                    shape: outerShape,
                    gradient: AppGlass.dSheenGradient,
                  ),
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
