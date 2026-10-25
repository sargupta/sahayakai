import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import 'glass_surface.dart';

/// AppCard — the design system v2 `GlassCard`: a translucent white card with
/// a 1px luminous `border-glass` edge, drawn over the screen wash.
///
/// Variants (v2 tone / radius):
///   • [AppCardVariant.flat] — `surface-glass`, `radius-card` (18), flat. The
///     default for every card on a screen (list rows, panels).
///   • [AppCardVariant.elevated] — the ONE primary card on a screen:
///     `radius-panel` (20) + `shadow-card`. v2 raises only that card; every
///     other card stays flat.
///   • [AppCardVariant.inset] — context inside a sheet or a solid card:
///     `surface-inset` with a `border-hairline` edge at `radius-field` (14).
///
/// Padding is v2's 14 × 15 on a phone (24 on a tablet ≥ 600dp) unless
/// overridden. A tappable card presses to 0.98 and to the strong glass
/// (`surface-glass-strong`), as the v2 Tile does; v2 shadows are rare, so
/// press no longer steps a shadow up.
///
/// Built on [GlassSurface.flat] — the no-blur path, because `AppCard` is
/// reused inside scrolling lists across ~35 screens.
///
/// The API ({child, padding, onTap, accentBar, variant}) is unchanged.
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
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final animate = _tappable && !reduce;
    final pressed = animate && _pressed;

    final width = MediaQuery.maybeOf(context)?.size.width ?? 0;
    final pad =
        widget.padding ??
        (width >= 600
            ? const EdgeInsets.all(AppSpacing.space6)
            : const EdgeInsets.symmetric(vertical: 14, horizontal: 15));

    final corners = switch (widget.variant) {
      AppCardVariant.flat => AppRadius.rCard,
      AppCardVariant.elevated => AppRadius.rPanel,
      AppCardVariant.inset => AppRadius.rField,
    };

    // The tap layer (ripple + accent bar + padded child), clipped by the
    // surface that wraps it.
    final tapLayer = Material(
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
                  decoration: BoxDecoration(gradient: AppGradients.accentBar),
                ),
              ),
            Padding(padding: pad, child: widget.child),
          ],
        ),
      ),
    );

    final Widget content;
    if (widget.variant == AppCardVariant.inset) {
      content = DecoratedBox(
        decoration: BoxDecoration(
          color: isDark ? scheme.surfaceContainerLow : AppColors.surfaceInset,
          borderRadius: corners,
          border: Border.all(
            color: isDark ? scheme.outline : AppColors.borderHairline,
            width: 1,
          ),
        ),
        child: ClipRRect(
          borderRadius: corners,
          child: tapLayer,
        ),
      );
    } else {
      final raised = widget.variant == AppCardVariant.elevated;
      content = DecoratedBox(
        // Shadow-only carrier: GlassSurface casts no shadow of its own.
        decoration: BoxDecoration(
          borderRadius: corners,
          boxShadow: raised ? (isDark ? AppShadows.e2 : AppShadows.card) : null,
        ),
        child: GlassSurface.flat(
          borderRadius: corners,
          fill: pressed ? AppColors.surfaceGlassStrong : null,
          // Inset by the 1px edge so an edge-flush accent bar never covers it.
          padding: const EdgeInsets.all(AppGlass.borderWidth),
          child: tapLayer,
        ),
      );
    }

    final scaled = AnimatedScale(
      scale: pressed ? 0.98 : 1.0,
      duration: AppMotion.change,
      curve: AppMotion.standard,
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
}
