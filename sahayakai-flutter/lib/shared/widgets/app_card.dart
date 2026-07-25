import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import 'glass_surface.dart';

/// AppCard v2 — the keystone card grammar (PREMIUM_DESIGN_SPEC.md §5).
///
/// Radius `card` 16. `flat`/`elevated` build on [GlassSurface.flat] (App-wide
/// Glassmorphism Reskin, GL-3) for their fill/border/sheen — the cheap
/// NO-BLUR path, never real `BackdropFilter` blur: `AppCard` is reused inside
/// scrolling `ListView`s across ~35 screens, and GL-1's own docs are explicit
/// that stacking real blur passes inside a scrolling list is the one thing
/// this reskin must never do. `GlassSurface` draws no external shadow of its
/// own (confirmed by reading `glass_surface.dart` — same finding GL-2 made
/// for `FloatingBottomNav`), so the press-driven shadow step (`e1`→`e2` /
/// `e2`→`e3`) is carried by an external `AnimatedContainer` wrapping the
/// glass panel — the same shadow-only-carrier pattern GL-2 used for
/// `FloatingBottomNav` and the modal sheets. That external carrier is still
/// needed even though the base card has no *traditional* `boxShadow` from
/// `GlassSurface.flat`: the "card lifts on press" cue is real product
/// behaviour (list rows/tiles across the app), not decoration for its own
/// sake, so it survives the reskin via the carrier rather than disappearing.
///
/// [AppCardVariant.inset] is deliberately left OFF the glass treatment and
/// keeps its original flat/opaque `surfaceContainerLow` fill + 1px border,
/// no shadow. Its entire point is to read as a RECESSED nested panel — the
/// conceptual opposite of a floating translucent glass surface. Glassing it
/// would blur the "sits below the surface" cue into "floats above it,"
/// contradicting the variant's own name and the semantics documented at
/// each call site (nested panels reading as recession). A recessed panel
/// and a floating glass card are different materials; only `flat`/`elevated`
/// (the two variants that were always meant to read as raised/floating)
/// move to glass.
///
/// Variants:
///   • [AppCardVariant.flat] — glass fill + border + sheen, `e1`→`e2` shadow
///     step on press (default; list rows, panels)
///   • [AppCardVariant.elevated] — glass fill + border + sheen, `e2`→`e3`
///     shadow step on press (feature tile, result masthead)
///   • [AppCardVariant.inset] — opaque `surfaceContainerLow` fill, 1px
///     border, no shadow (nested panels read as recession) — unchanged
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
    final scheme = Theme.of(context).colorScheme;
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final animate = _tappable && !reduce;

    // Card padding: 16 phone / 24 tablet (>=600dp), unless overridden.
    final width = MediaQuery.maybeOf(context)?.size.width ?? 0;
    final pad = widget.padding ??
        EdgeInsets.all(width >= 600 ? AppSpacing.space6 : AppSpacing.space4);

    List<BoxShadow>? shadow;
    switch (widget.variant) {
      case AppCardVariant.flat:
        shadow = (animate && _pressed) ? AppShadows.e2 : AppShadows.e1;
      case AppCardVariant.elevated:
        shadow = (animate && _pressed) ? AppShadows.e3 : AppShadows.e2;
      case AppCardVariant.inset:
        shadow = null;
    }

    // The tap layer (ripple + accent bar + padded child) is shared by both
    // the glass (flat/elevated) and opaque (inset) treatments below. Its own
    // clipping is provided by whichever surface wraps it — GlassSurface's
    // squircle ClipPath for glass, or the ClipRRect in `_insetContent` for
    // inset — so it stays a plain, unclipped Material/InkWell here.
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

    final Widget content = widget.variant == AppCardVariant.inset
        ? _insetContent(scheme, tapLayer)
        // Shadow-only carrier: GlassSurface.flat below draws the translucent
        // fill, gradient border and sheen, but (per the class doc) casts no
        // external shadow of its own — this AnimatedContainer supplies just
        // the press-stepped boxShadow, matching the old e1/e2/e3 cue, with a
        // borderRadius so the shadow itself renders as a rounded rect
        // matching the glass panel's corner (a plain rounded rect is a fine
        // approximation for a soft/blurred shadow — it does not need to
        // trace the squircle's exact Bezier).
        : AnimatedContainer(
            duration: animate ? AppMotion.micro : Duration.zero,
            curve: AppMotion.easeOutQuart,
            decoration: BoxDecoration(
              borderRadius: AppRadius.rCard,
              boxShadow: shadow,
            ),
            // padding: borderWidth, NOT zero — GlassSurface stacks its
            // `child` at its own OUTER bounds (the same edge the
            // border-gradient ring's outer edge sits on; only the fill layer
            // is inset by the padding-trick). With zero padding here, an
            // opaque, edge-flush `accentBar` (3px) fully occludes the 1px
            // border ring's strongest point (top edge, topLeft@0.40) —
            // caught by the GL-3 design review. Insetting `child` by the
            // same borderWidth keeps it flush with the INNER fill instead,
            // so the ring stays visible all the way around, accentBar
            // included; the 1px shift to the rest of the card's own
            // `pad`-ded content is imperceptible.
            child: GlassSurface.flat(
              radius: AppRadius.card,
              padding: const EdgeInsets.all(AppGlass.borderWidth),
              child: tapLayer,
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

  // Inset variant: deliberately NOT glassed (see class doc) — the original
  // opaque/recessed treatment, unchanged. Own AnimatedContainer (fill +
  // uniform 1px border; a borderRadius forbids per-side colours) + ClipRRect
  // + tap layer, no shadow.
  Widget _insetContent(ColorScheme scheme, Widget tapLayer) {
    return AnimatedContainer(
      duration: AppMotion.micro,
      curve: AppMotion.easeOutQuart,
      decoration: BoxDecoration(
        color: scheme.surfaceContainerLow,
        borderRadius: AppRadius.rCard,
        border: Border.all(color: scheme.outline, width: 1),
      ),
      child: ClipRRect(
        borderRadius: AppRadius.rCard,
        child: tapLayer,
      ),
    );
  }
}
