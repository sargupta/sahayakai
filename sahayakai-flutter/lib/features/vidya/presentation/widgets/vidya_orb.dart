import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/press_scale.dart';

/// The five visual phases of the floating VIDYA orb (v3 "VIDYA floats over
/// everything"). Distinct from [SealMic]'s states: the orb is VIDYA's *presence*
/// that rides above every screen, so it carries the two colours the home hero
/// never needed — indigo while it works off-screen, green with a badge when a
/// result is ready to deliver.
///
///   • [resting]   — parked saffron sphere, a slow float; tap to talk.
///   • [dragging]  — lifted (larger) with a ring halo while the teacher moves it.
///   • [listening] — saffron with a live ripple; the page stays visible behind.
///   • [working]   — indigo, a calm pulse; keeps working while she moves on.
///   • [ready]     — green + a count badge; tap to open what was produced.
enum VidyaOrbVisual { resting, dragging, listening, working, ready }

/// The floating, draggable VIDYA orb — VIDYA's omnipresent presence layer
/// (v3 §"The orb, five states"). A pure gradient sphere (not a Material FAB),
/// mounted by [VidyaOverlay] above the app Navigator so it rides over every
/// route. This widget owns only the *look* of one orb at one place; the drag,
/// the six snap perches and the per-hand memory live in the overlay and
/// [VidyaOrbPlacementController], so the orb stays a testable pure widget.
///
/// Colour comes from the theme roles, never raw hex (token guard):
/// saffron = `scheme.primary`, indigo = `scheme.tertiary`, green =
/// `scheme.secondary`, each lifted to a top-left specular highlight. Every
/// ambient motion is guarded by [BuildContext.motionEnabled] and degrades to
/// the composed still under reduce-motion (PREMIUM_DESIGN_SPEC §4).
class VidyaOrb extends StatefulWidget {
  const VidyaOrb({
    super.key,
    required this.state,
    this.size = 56,
    this.readyCount = 0,
    this.onTap,
    this.semanticLabel,
    this.semanticHint,
  });

  final VidyaOrbVisual state;

  /// The resting footprint. The [VidyaOrbVisual.dragging] phase lifts a touch
  /// past this; the ripples/badge stay inside a fixed [_halo] margin so the
  /// widget never overflows its box.
  final double size;

  /// The number of ready-to-deliver results; the badge shows on
  /// [VidyaOrbVisual.ready] when this is > 0 (capped at "9+").
  final int readyCount;

  final VoidCallback? onTap;

  /// Announced as the control's label (e.g. the app name — "VIDYA").
  final String? semanticLabel;

  /// Announced as the hint — the current state's spoken label.
  final String? semanticHint;

  /// Fixed clear space around the sphere for the listening ripple / drag halo /
  /// ready badge, so the painted box is always [size] + 2·[_halo] regardless of
  /// state and the orb can be positioned by its perch without reflowing.
  static const double _halo = 14;

  @override
  State<VidyaOrb> createState() => _VidyaOrbState();
}

class _VidyaOrbState extends State<VidyaOrb> with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncMotion();
  }

  @override
  void didUpdateWidget(VidyaOrb old) {
    super.didUpdateWidget(old);
    if (old.state != widget.state) _syncMotion();
  }

  /// The natural tempo of each state's ambient motion; null = no continuous
  /// motion (dragging is driven by the overlay, ready is a still + badge).
  Duration? _periodFor(VidyaOrbVisual s) {
    switch (s) {
      case VidyaOrbVisual.resting:
        return const Duration(milliseconds: 5500); // slow float
      case VidyaOrbVisual.listening:
        return const Duration(milliseconds: 2000); // ripple + breath
      case VidyaOrbVisual.working:
        return const Duration(milliseconds: 1800); // indigo pulse
      case VidyaOrbVisual.dragging:
      case VidyaOrbVisual.ready:
        return null;
    }
  }

  void _syncMotion() {
    final period = _periodFor(widget.state);
    if (!context.motionEnabled || period == null) {
      _c.stop();
      _c.value = 0; // the composed still
      return;
    }
    if (_c.duration != period) _c.duration = period;
    if (!_c.isAnimating) _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final motion = context.motionEnabled;
    final box = widget.size + VidyaOrb._halo * 2;

    final orb = AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final t = _c.value; // 0..1, frozen at 0 under reduce-motion
        return SizedBox(
          width: box,
          height: box,
          child: Stack(
            alignment: Alignment.center,
            clipBehavior: Clip.none,
            children: [
              if (widget.state == VidyaOrbVisual.listening)
                _buildRipple(scheme, t, motion),
              Transform.translate(
                offset: Offset(0, _floatDy(t, motion)),
                child: Transform.scale(
                  scale: _scale(t, motion),
                  child: _buildSphere(scheme),
                ),
              ),
              if (widget.state == VidyaOrbVisual.ready && widget.readyCount > 0)
                _buildBadge(scheme),
            ],
          ),
        );
      },
    );

    return Semantics(
      button: true,
      enabled: widget.onTap != null,
      label: widget.semanticLabel,
      hint: widget.semanticHint,
      onTap: widget.onTap,
      excludeSemantics: true,
      child: PressableScale(
        pressedScale: 0.94,
        enabled: widget.onTap != null,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: widget.onTap,
          child: orb,
        ),
      ),
    );
  }

  /// The sphere itself — a radial-gradient disc lifted to a top-left specular
  /// highlight, with a state-tinted glow. Dragging lifts it a touch larger.
  Widget _buildSphere(ColorScheme scheme) {
    final base = _baseColor(scheme);
    final highlight = Color.lerp(base, Colors.white, 0.62)!;
    final lifted = widget.state == VidyaOrbVisual.dragging;
    final diameter = widget.size * (lifted ? 1.14 : 1.0);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      width: diameter,
      height: diameter,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          center: const Alignment(-0.35, -0.4),
          radius: 0.95,
          colors: [highlight, base],
          stops: const [0.0, 0.78],
        ),
        boxShadow: [
          // Ambient drop so the orb reads as floating above the page.
          BoxShadow(
            color: scheme.shadow.withValues(alpha: isDark ? 0.5 : 0.16),
            offset: const Offset(0, 8),
            blurRadius: 18,
            spreadRadius: -4,
          ),
          // A state-tinted glow — its own colour, never repeated elsewhere.
          BoxShadow(
            color: base.withValues(alpha: lifted ? 0.42 : 0.34),
            offset: const Offset(0, 6),
            blurRadius: lifted ? 26 : 20,
            spreadRadius: lifted ? 0 : -2,
          ),
        ],
      ),
      alignment: Alignment.center,
      child: _glyph(scheme, diameter),
    );
  }

  /// A subtle affordance glyph so the sphere reads as tappable — a mic while it
  /// waits or listens, a spark while it works. The ready state speaks through
  /// its badge, so it carries no glyph.
  Widget? _glyph(ColorScheme scheme, double diameter) {
    final IconData? icon;
    switch (widget.state) {
      case VidyaOrbVisual.resting:
      case VidyaOrbVisual.dragging:
      case VidyaOrbVisual.listening:
        icon = LucideIcons.mic;
      case VidyaOrbVisual.working:
        icon = LucideIcons.sparkles;
      case VidyaOrbVisual.ready:
        icon = null;
    }
    if (icon == null) return null;
    return Icon(
      icon,
      size: diameter * 0.4,
      color: _onBaseColor(scheme).withValues(alpha: 0.92),
    );
  }

  /// The expanding ripple behind the sphere while listening — a single ring that
  /// grows and fades on the ambient clock (a still ring under reduce-motion).
  Widget _buildRipple(ColorScheme scheme, double t, bool motion) {
    final phase = motion ? t : 0.0;
    final ringScale = 1.0 + 0.5 * phase;
    final opacity = motion ? (1 - phase) * 0.5 : 0.28;
    return Opacity(
      opacity: opacity.clamp(0.0, 1.0),
      child: Transform.scale(
        scale: ringScale,
        child: Container(
          width: widget.size,
          height: widget.size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: scheme.primary.withValues(alpha: 0.6),
              width: 2,
            ),
          ),
        ),
      ),
    );
  }

  /// The green count badge on the ready state — top-right, "9+" past nine.
  Widget _buildBadge(ColorScheme scheme) {
    final label = widget.readyCount > 9 ? '9+' : '${widget.readyCount}';
    return Positioned(
      top: VidyaOrb._halo - 2,
      right: VidyaOrb._halo - 2,
      child: Container(
        constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
        padding: const EdgeInsets.symmetric(horizontal: 5),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: scheme.secondary,
          border: Border.all(color: scheme.surface, width: 2),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            fontFamily: 'Inter',
            fontSize: 10,
            height: 1.0,
            fontWeight: FontWeight.w700,
            color: scheme.onSecondary,
          ),
        ),
      ),
    );
  }

  Color _baseColor(ColorScheme scheme) {
    switch (widget.state) {
      case VidyaOrbVisual.resting:
      case VidyaOrbVisual.dragging:
      case VidyaOrbVisual.listening:
        return scheme.primary; // saffron
      case VidyaOrbVisual.working:
        return scheme.tertiary; // indigo / navy
      case VidyaOrbVisual.ready:
        return scheme.secondary; // green
    }
  }

  Color _onBaseColor(ColorScheme scheme) {
    switch (widget.state) {
      case VidyaOrbVisual.resting:
      case VidyaOrbVisual.dragging:
      case VidyaOrbVisual.listening:
        return scheme.onPrimary;
      case VidyaOrbVisual.working:
        return scheme.onTertiary;
      case VidyaOrbVisual.ready:
        return scheme.onSecondary;
    }
  }

  /// Vertical float offset — only the resting orb drifts; everything else holds.
  double _floatDy(double t, bool motion) {
    if (!motion || widget.state != VidyaOrbVisual.resting) return 0;
    return -3.5 * math.sin(t * 2 * math.pi);
  }

  /// The breathing / pulsing disc scale. Listening breathes, working pulses;
  /// the rest hold at 1.0. Frozen under reduce-motion.
  double _scale(double t, bool motion) {
    if (!motion) return 1.0;
    switch (widget.state) {
      case VidyaOrbVisual.listening:
        return 1.0 + 0.05 * (0.5 + 0.5 * math.sin(t * 2 * math.pi));
      case VidyaOrbVisual.working:
        return 1.0 + 0.035 * math.sin(t * 2 * math.pi);
      case VidyaOrbVisual.resting:
      case VidyaOrbVisual.dragging:
      case VidyaOrbVisual.ready:
        return 1.0;
    }
  }
}
