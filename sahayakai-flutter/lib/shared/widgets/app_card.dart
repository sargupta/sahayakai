import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// AppCard v2 — the keystone card grammar (PREMIUM_DESIGN_SPEC.md §5).
///
/// Radius `card` 16, warm two-layer shadow, drawn on the widget's own
/// `DecoratedBox` (Material tonal elevation cannot express two layers). Dark
/// raised surfaces gain a 1px top `#FFFFFF@0.05` catch-light. When [onTap] is
/// set the card presses (scale 0.98 + `e1`→`e2`), keeping M3 ink underneath.
///
/// Variants:
///   • [AppCardVariant.flat] — border + `e1` (default; list rows, panels)
///   • [AppCardVariant.elevated] — `e2`, no border in light (feature tile,
///     result masthead)
///   • [AppCardVariant.inset] — no shadow, `surfaceContainerLow` fill, 1px
///     border (nested panels read as recession)
///
/// The v1 API ({child, padding, onTap, accentBar}) is preserved; `variant`
/// defaults to `flat`, so every existing call site keeps working.
enum AppCardVariant { flat, elevated, inset }

class AppCard extends StatefulWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding,
    this.onTap,
    this.accentBar = false,
    this.variant = AppCardVariant.flat,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;

  /// Optional 3px saffron ribbon on the top edge (top corners clipped).
  final bool accentBar;
  final AppCardVariant variant;

  @override
  State<AppCard> createState() => _AppCardState();
}

class _AppCardState extends State<AppCard> {
  bool _pressed = false;

  bool get _tappable => widget.onTap != null;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final animate = _tappable && !reduce;

    // Card padding: 16 phone / 24 tablet (>=600dp), unless overridden.
    final width = MediaQuery.maybeOf(context)?.size.width ?? 0;
    final pad = widget.padding ??
        EdgeInsets.all(width >= 600 ? AppSpacing.space6 : AppSpacing.space4);

    final fill = widget.variant == AppCardVariant.inset
        ? scheme.surfaceContainerLow
        : scheme.surface;

    List<BoxShadow>? shadow;
    switch (widget.variant) {
      case AppCardVariant.flat:
        shadow = (animate && _pressed) ? AppShadows.e2 : AppShadows.e1;
      case AppCardVariant.elevated:
        shadow = (animate && _pressed) ? AppShadows.e3 : AppShadows.e2;
      case AppCardVariant.inset:
        shadow = null;
    }

    // Dark raised surfaces (flat/elevated, not the recessed inset) get a 1px
    // top catch-light. It is drawn as a clipped overlay, NOT a non-uniform
    // Border (a borderRadius requires uniform border colours).
    final showCatchLight =
        isDark && widget.variant != AppCardVariant.inset && !widget.accentBar;

    final content = AnimatedContainer(
      duration: animate ? AppMotion.micro : Duration.zero,
      curve: AppMotion.easeOutQuart,
      decoration: BoxDecoration(
        color: fill,
        borderRadius: AppRadius.rCard,
        border: _border(scheme),
        boxShadow: shadow,
      ),
      child: ClipRRect(
        borderRadius: AppRadius.rCard,
        child: Stack(
          children: [
            Material(
              type: MaterialType.transparency,
              child: InkWell(
                onTap: widget.onTap,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (widget.accentBar)
                      const SizedBox(
                        height: 3,
                        child: DecoratedBox(
                          decoration:
                              BoxDecoration(gradient: AppGradients.accentBar),
                        ),
                      ),
                    Padding(padding: pad, child: widget.child),
                  ],
                ),
              ),
            ),
            if (showCatchLight)
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
    );

    final scaled = AnimatedScale(
      scale: (animate && _pressed) ? 0.98 : 1.0,
      duration: AppMotion.micro,
      curve: AppMotion.easeOutQuart,
      child: content,
    );

    if (!_tappable) return scaled;
    return Listener(
      onPointerDown: (_) => setState(() => _pressed = true),
      onPointerUp: (_) => setState(() => _pressed = false),
      onPointerCancel: (_) => setState(() => _pressed = false),
      child: scaled,
    );
  }

  // Uniform border only (a borderRadius forbids per-side colours). The dark
  // top catch-light is a clipped overlay drawn in build(). Elevated carries no
  // border (it earns its separation from the e2 shadow); flat/inset are ruled.
  BoxBorder? _border(ColorScheme scheme) {
    switch (widget.variant) {
      case AppCardVariant.flat:
      case AppCardVariant.inset:
        return Border.all(color: scheme.outline, width: 1);
      case AppCardVariant.elevated:
        return null;
    }
  }
}
