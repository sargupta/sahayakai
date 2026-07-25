import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';

import '../../core/theme/app_glass.dart';
import '../../core/theme/app_radius.dart';

/// GlassSurface — App-wide Glassmorphism Reskin, GL-1 foundation widget.
///
/// The Apple "Liquid Glass" material primitive: a translucent, softly
/// gradient-bordered, subtly sheened panel with a squircle corner (built-in
/// `ContinuousRectangleBorder`, no custom painter, no new package). Two
/// rendering paths, same visual language:
///   • [GlassSurface.new] — REAL blur (`BackdropFilter(ImageFilter.blur)`)
///     behind a translucent [AppGlass.lChromeFill]/[AppGlass.dChromeFill]
///     tint. For singular, floating, non-scrolling chrome — nav bar, app
///     bar, sheets, the one dialog. `BackdropFilter` forces a `saveLayer` +
///     GPU blur pass per instance; do not stack these inside a scrolling
///     list.
///   • [GlassSurface.flat] — the cheap path: same fill/border/sheen
///     treatment and corner shape, sourced from
///     [AppGlass.lFlatFill]/[AppGlass.dFlatFill] instead, with NO
///     `BackdropFilter`. For list-context reuse (`AppCard`, chat bubbles,
///     badges — GL-3/GL-4; not wired into either by this unit).
///
/// This unit only adds the widget — it is not yet used by any screen.
///
/// Stack order (bottom → top): optional blur, then a gradient-bordered fill
/// ring (the "padding trick": an outer squircle painted with the border
/// gradient, inset by [AppGlass.borderWidth], with an inner squircle of the
/// real fill on top — see `app_glass.dart` for why this replaces a
/// `Border`/`BoxBorder`), then an optional barely-there diagonal sheen, then
/// the actual [child] content.
class GlassSurface extends StatelessWidget {
  /// Real-blur chrome surface — nav bar, app bar, sheets, dialog.
  const GlassSurface({
    super.key,
    required this.child,
    this.radius = AppRadius.card,
    this.borderRadius,
    this.padding,
    this.addSheen = true,
  }) : _blur = true;

  /// Cheap flat-fill surface — no `BackdropFilter`. For list-context reuse.
  const GlassSurface.flat({
    super.key,
    required this.child,
    this.radius = AppRadius.card,
    this.borderRadius,
    this.padding,
    this.addSheen = true,
  }) : _blur = false;

  final Widget child;

  /// Uniform corner radius, squircle-shaped via [AppGlass.squircle].
  /// Defaults to `AppRadius.card` (16); ignored when [borderRadius] is set.
  final double radius;

  /// Per-corner override (e.g. a bottom sheet's top-only rounding) via
  /// [AppGlass.squircleFromBorderRadius]. Takes precedence over [radius]
  /// when set — pass a `BorderRadius.only(...)` directly rather than
  /// clipping a uniform squircle with an outer `ClipRRect`: a squircle's
  /// curve is NOT the same geometry as a circular-arc `RRect` corner, so an
  /// outer RRect clip silently discards the squircle shape instead of
  /// trimming it to a partial one (see [AppGlass.squircleFromBorderRadius]).
  final BorderRadius? borderRadius;
  final EdgeInsetsGeometry? padding;

  /// Barely-there diagonal sheen overlay (see [AppGlass.lSheenGradient]).
  /// On by default; set false for surfaces where even that faint highlight
  /// would compete with busy content underneath.
  final bool addSheen;

  final bool _blur;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final fill = _blur
        ? (isDark ? AppGlass.dChromeFill : AppGlass.lChromeFill)
        : (isDark ? AppGlass.dFlatFill : AppGlass.lFlatFill);
    final borderGradient =
        isDark ? AppGlass.dBorderGradient : AppGlass.lBorderGradient;
    final sheenGradient =
        isDark ? AppGlass.dSheenGradient : AppGlass.lSheenGradient;

    final ShapeBorder outerShape;
    final ShapeBorder innerShape;
    final perCorner = borderRadius;
    if (perCorner != null) {
      outerShape = AppGlass.squircleFromBorderRadius(perCorner);
      innerShape = AppGlass.squircleFromBorderRadius(
        AppGlass.insetBorderRadius(perCorner),
      );
    } else {
      outerShape = AppGlass.squircle(radius);
      final innerRadius = math.max(0.0, radius - AppGlass.borderWidth);
      innerShape = AppGlass.squircle(innerRadius);
    }

    return ClipPath(
      clipper: ShapeBorderClipper(shape: outerShape),
      child: Stack(
        children: [
          if (_blur)
            Positioned.fill(
              child: BackdropFilter(
                filter: ImageFilter.blur(
                  sigmaX: AppGlass.blurSigma,
                  sigmaY: AppGlass.blurSigma,
                ),
                child: const SizedBox.expand(),
              ),
            ),
          // Gradient edge-highlight + real fill, via the padding trick: the
          // outer squircle carries the border gradient as its own fill; an
          // inner squircle inset by `borderWidth`, painted with the actual
          // glass fill, covers all but a `borderWidth`-wide ring of it.
          Positioned.fill(
            child: DecoratedBox(
              decoration: ShapeDecoration(
                shape: outerShape,
                gradient: borderGradient,
              ),
              child: Padding(
                padding: const EdgeInsets.all(AppGlass.borderWidth),
                child: DecoratedBox(
                  decoration: ShapeDecoration(shape: innerShape, color: fill),
                ),
              ),
            ),
          ),
          if (addSheen)
            Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: ShapeDecoration(
                    shape: outerShape,
                    gradient: sheenGradient,
                  ),
                ),
              ),
            ),
          Padding(
            padding: padding ?? EdgeInsets.zero,
            child: child,
          ),
        ],
      ),
    );
  }
}
