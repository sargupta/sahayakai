import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_motion.dart';
import '../../../../core/theme/app_shadows.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/press_scale.dart';

/// The five visual states of the floating VIDYA orb (Design System v3 canonical).
///
/// Colour *is* the state (v3 §"The orb is the signature. Colour is its state."):
///   • [resting]   — saffron radial gradient, 56px, parked, slow float (5.5s,
///     translateY −7px, scale 1.035), tap to talk.
///   • [dragging]  — lifted 64px, saffron-100 → saffron-500, ring halo
///     `0 0 0 12px rgba(201,106,40,.14)`, snaps to six perches.
///   • [listening] — 46px in sheet, saffron-200 → saffron-500, mic-pulse 2s
///     (scale 1.07), ring `0 0 0 8px rgba(201,106,40,.14)`.
///   • [working]   — indigo radial `#DCE2FA → #2A3B8F 74%`, 56px, pulse 1.8s
///     (scale 1.04), keeps working off-screen.
///   • [ready]     — leaf radial `#CFE6CF → #2C5F2D 74%`, 56px, **20px count
///     badge** (white on `#2C5F2D`, 2px `#FFFDF9` border) at top-right (−3px).
///   • [offline]   — grey `#E6E2DA → #8A8178`, greys out when no signal.
enum VidyaOrbVisual { resting, dragging, listening, working, ready, offline }

/// The floating, draggable VIDYA orb — VIDYA's omnipresent presence layer.
/// Mounted by [VidyaOverlay] above the app Navigator so it rides over every route.
/// Pure gradient sphere with specular highlight at 34%/30% (not a Material FAB).
/// All ambient motion guarded by [BuildContext.motionEnabled]; reduce-motion = still.
class VidyaOrb extends StatefulWidget {
  const VidyaOrb({
    super.key,
    required this.state,
    this.size = 56,
    this.readyCount = 0,
    this.onTap,
    this.onLongPress,
    this.semanticLabel,
    this.semanticHint,
    this.shadows,
  });

  final VidyaOrbVisual state;
  final double size;
  final int readyCount;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final String? semanticLabel;
  final String? semanticHint;

  /// Overrides the state's own drop shadow — the docked orb in the tab bar
  /// casts a smaller one than the floating orb (v2 9a).
  final List<BoxShadow>? shadows;

  /// The sphere's radial gradient for [state]: colour is the state. Shared
  /// with the dock's mini-orb so every sphere of VIDYA reads the same.
  static RadialGradient gradientFor(VidyaOrbVisual state) {
    // Highlight at 34%/30% = Alignment(-0.32, -0.4)
    const center = Alignment(-0.32, -0.4);
    const radius = 0.95;

    switch (state) {
      case VidyaOrbVisual.resting:
      case VidyaOrbVisual.listening:
        // saffron-200 (#FFD9AE) → saffron-500 (#C96A28) at 72%
        return const RadialGradient(
          center: center,
          radius: radius,
          colors: [AppColors.saffron200, AppColors.saffron500],
          stops: [0.0, 0.72],
        );
      case VidyaOrbVisual.dragging:
        // saffron-100 (#FFE3C2) → saffron-500 (#C96A28) at 72%
        return const RadialGradient(
          center: center,
          radius: radius,
          colors: [AppColors.saffron100, AppColors.saffron500],
          stops: [0.0, 0.72],
        );
      case VidyaOrbVisual.working:
        // indigo-100 (#DCE2FA) → indigo-500 (#2A3B8F) at 74%
        return const RadialGradient(
          center: center,
          radius: radius,
          colors: [AppColors.indigo100, AppColors.indigo500],
          stops: [0.0, 0.74],
        );
      case VidyaOrbVisual.ready:
        // leaf-100 (#CFE6CF) → leaf-500 (#2C5F2D) at 74%
        return const RadialGradient(
          center: center,
          radius: radius,
          colors: [AppColors.leaf100, AppColors.leaf500],
          stops: [0.0, 0.74],
        );
      case VidyaOrbVisual.offline:
        // grey wash: #E6E2DA → #8A8178
        return const RadialGradient(
          center: center,
          radius: radius,
          colors: [
            Color.fromARGB(255, 230, 226, 218),
            Color.fromARGB(255, 138, 129, 120),
          ],
          stops: [0.0, 0.72],
        );
    }
  }

  /// Fixed clear space around the sphere for listening ripple / drag halo / ready badge.
  static const double _halo = 14;

  @override
  State<VidyaOrb> createState() => _VidyaOrbState();
}

class _VidyaOrbState extends State<VidyaOrb>
    with SingleTickerProviderStateMixin {
  /// One clock drives every motion (float, pulse, spin, sheen): each derives
  /// its own phase from the elapsed seconds, so they never drift apart or
  /// restart when the state changes.
  late final Ticker _ticker;
  final ValueNotifier<double> _seconds = ValueNotifier<double>(0);

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(
      (elapsed) => _seconds.value = elapsed.inMicroseconds / 1e6,
    );
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

  /// The orb lives (spins, shines, floats) in every state but offline, where
  /// it greys and holds still; reduce-motion holds every state still.
  void _syncMotion() {
    final live =
        context.motionEnabled && widget.state != VidyaOrbVisual.offline;
    if (live) {
      if (!_ticker.isActive) _ticker.start();
    } else {
      if (_ticker.isActive) _ticker.stop();
      _seconds.value = 0;
    }
  }

  @override
  void dispose() {
    _ticker.dispose();
    _seconds.dispose();
    super.dispose();
  }

  /// 0 -> 1 -> 0 over [period], eased like a breath: no corners to read as a
  /// jolt, which a plain sine around the rest line or a snappy cubic-bezier
  /// both produce.
  static double _wave(double seconds, Duration period) {
    final t = (seconds % _secs(period)) / _secs(period);
    return 0.5 - 0.5 * math.cos(t * 2 * math.pi);
  }

  static double _secs(Duration d) => d.inMicroseconds / 1e6;

  /// The surface turns once every 16s; the sheen breathes every 3.6s.
  static const Duration _spinPeriod = Duration(seconds: 16);
  static const Duration _sheenPeriod = Duration(milliseconds: 3600);

  @override
  Widget build(BuildContext context) {
    final motion = context.motionEnabled;
    final box = widget.size + VidyaOrb._halo * 2;

    final orb = ValueListenableBuilder<double>(
      valueListenable: _seconds,
      builder: (context, seconds, _) {
        final listenPhase =
            (seconds % _secs(AppMotion.orbListenPulse)) /
            _secs(AppMotion.orbListenPulse);
        return SizedBox(
          width: box,
          height: box,
          child: Stack(
            alignment: Alignment.center,
            clipBehavior: Clip.none,
            children: [
              if (widget.state == VidyaOrbVisual.listening)
                _buildListenRing(listenPhase, motion),
              if (widget.state == VidyaOrbVisual.dragging) _buildDragRing(),
              Transform.translate(
                offset: Offset(0, _floatDy(seconds, motion)),
                child: Transform.scale(
                  scale: _scale(seconds, motion),
                  child: _buildSphere(seconds),
                ),
              ),
              if (widget.state == VidyaOrbVisual.ready && widget.readyCount > 0)
                _buildReadyBadge(),
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
          onLongPress: widget.onLongPress,
          child: orb,
        ),
      ),
    );
  }

  /// The sphere, adapted from the v2 design's living orb with the app's own
  /// state colours: the state gradient as the base; inside it, an oversized
  /// layer of three soft blobs (a deep one low right, a light one left, a
  /// warm one high) turning once every 16s so the surface slowly swirls; an
  /// edge shade for depth; and a specular sheen that drifts and brightens on
  /// a 3.6s breath. The size-relative geometry is the design's, measured on
  /// its 164px orb, so the docked 42px orb and Home's 144px orb are the same
  /// object at two sizes.
  Widget _buildSphere(double seconds) {
    final lifted = widget.state == VidyaOrbVisual.dragging;
    final d = lifted ? AppSpacing.orbDraggingSize : widget.size;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final gradient = VidyaOrb.gradientFor(widget.state);
    final light = gradient.colors.first;
    final base = gradient.colors.last;
    final deep = Color.lerp(base, Colors.black, 0.38)!;
    final k = d / 164; // the design's orb is 164px

    final spin = seconds / _secs(_spinPeriod) * 2 * math.pi;
    final sheen = _wave(seconds, _sheenPeriod);
    final layer = d * 1.6; // the design's inset: -30% on each side

    Widget blob({
      required double w,
      required double h,
      required Color color,
      double? left,
      double? right,
      double? top,
      double? bottom,
    }) {
      return Positioned(
        left: left == null ? null : layer * left,
        right: right == null ? null : layer * right,
        top: top == null ? null : layer * top,
        bottom: bottom == null ? null : layer * bottom,
        child: Transform(
          alignment: Alignment.center,
          // A circle stretched to the blob's aspect: an ellipse whose
          // gradient reaches zero at its rim, so no edge ever shows.
          transform: Matrix4.diagonal3Values(w / h, 1, 1),
          child: Container(
            width: h * k * 1.3,
            height: h * k * 1.3,
            decoration: BoxDecoration(
              gradient: RadialGradient(
                radius: 0.5,
                colors: [color, color.withValues(alpha: 0)],
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      width: d,
      height: d,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: gradient,
        boxShadow: widget.shadows ?? _orbShadows(isDark, lifted),
      ),
      // No glyph: the orb's meaning is its state colour, its motion and the
      // words beside it. A mic glyph is a control, never VIDYA (Orb spec).
      child: ClipOval(
        child: Stack(
          children: [
            Positioned.fill(
              child: OverflowBox(
                maxWidth: layer,
                maxHeight: layer,
                child: Transform.rotate(
                  angle: spin,
                  child: SizedBox(
                    width: layer,
                    height: layer,
                    child: Stack(
                      children: [
                        blob(
                          w: 110,
                          h: 92,
                          color: deep.withValues(alpha: 0.42),
                          bottom: 0.18,
                          right: 0.08,
                        ),
                        blob(
                          w: 100,
                          h: 78,
                          color: Color.lerp(
                            light,
                            Colors.white,
                            0.3,
                          )!.withValues(alpha: 0.45),
                          bottom: 0.30,
                          left: 0.06,
                        ),
                        blob(
                          w: 76,
                          h: 64,
                          color: Color.lerp(
                            light,
                            base,
                            0.35,
                          )!.withValues(alpha: 0.5),
                          top: 0.16,
                          right: 0.26,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            // Depth: the edge falls into shade, low and right (the design's
            // inset shadow), so the blobs read as a surface on a sphere.
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: const Alignment(-0.25, -0.35),
                    radius: 1.0,
                    colors: [
                      deep.withValues(alpha: 0),
                      deep.withValues(alpha: 0),
                      deep.withValues(alpha: 0.42),
                    ],
                    stops: const [0, 0.6, 1],
                  ),
                ),
              ),
            ),
            // The specular sheen, drifting and brightening on its breath.
            Positioned(
              left: 25 * k + 6 * k * sheen,
              top: 15 * k + 4 * k * sheen,
              child: Opacity(
                opacity: 0.55 + 0.4 * sheen,
                child: Transform.scale(
                  scale: 1 + 0.12 * sheen,
                  child: Transform(
                    alignment: Alignment.center,
                    transform: Matrix4.diagonal3Values(56 / 38, 1, 1),
                    child: Container(
                      width: 38 * k,
                      height: 38 * k,
                      decoration: BoxDecoration(
                        gradient: RadialGradient(
                          center: const Alignment(-0.2, -0.2),
                          radius: 0.5,
                          colors: [
                            Colors.white.withValues(alpha: 0.85),
                            Colors.white.withValues(alpha: 0),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<BoxShadow> _orbShadows(bool isDark, bool lifted) {
    switch (widget.state) {
      case VidyaOrbVisual.resting:
      case VidyaOrbVisual.listening:
        return [
          // Ambient drop
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.40)
                : AppShadows.orb.color.withValues(alpha: 0.8),
            offset: const Offset(0, 10),
            blurRadius: 26,
            spreadRadius: -2,
          ),
          // Saffron glow (`0 10px 26px rgba(201,106,40,.42)`)
          BoxShadow(
            color: isDark
                ? AppShadows.dSaffronGlow.first.color
                : AppShadows.orb.color,
            offset: const Offset(0, 10),
            blurRadius: 26,
            spreadRadius: -4,
          ),
        ];
      case VidyaOrbVisual.dragging:
        return [
          AppShadows.orbDraggingLifted,
          AppShadows.ringOrbDrag,
          BoxShadow(
            color: AppColors.saffron500.withValues(alpha: 0.42),
            offset: const Offset(0, 16),
            blurRadius: 34,
          ),
        ];
      case VidyaOrbVisual.working:
        return [AppShadows.orbWorking];
      case VidyaOrbVisual.ready:
        return [AppShadows.orbReady];
      case VidyaOrbVisual.offline:
        return [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.12),
            offset: const Offset(0, 8),
            blurRadius: 18,
            spreadRadius: -4,
          ),
        ];
    }
  }

  /// Listening ring: `0 0 0 8px rgba(201,106,40,.14)` + mic-pulse scale.
  Widget _buildListenRing(double t, bool motion) {
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
              color: AppColors.saffron500.withValues(alpha: 0.14),
              width: 8,
            ),
          ),
        ),
      ),
    );
  }

  /// Dragging ring: `0 0 0 12px rgba(201,106,40,.14)`.
  Widget _buildDragRing() {
    return Container(
      width: widget.size + 12,
      height: widget.size + 12,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: AppColors.saffron500.withValues(alpha: 0.14),
          width: 12,
        ),
      ),
    );
  }

  /// Ready badge: white number on leaf, milk-50 ring. 20px with a 2px ring on
  /// the parked orb, at the halo's corner; on a big orb (Home's 144px orb) it
  /// grows to 32px with a 3px ring, 8px inside the sphere's corner.
  Widget _buildReadyBadge() {
    final label = widget.readyCount > 9 ? '9+' : '${widget.readyCount}';
    final big = widget.size >= _bigOrb;
    final inset = big ? VidyaOrb._halo + 8 : VidyaOrb._halo - 3;
    final diameter = big ? 32.0 : 20.0;
    return Positioned(
      top: inset,
      right: inset,
      child: Container(
        constraints: BoxConstraints(minWidth: diameter, minHeight: diameter),
        padding: const EdgeInsets.symmetric(horizontal: 5),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.leaf500,
          border: Border.all(color: AppColors.milk50, width: big ? 3 : 2),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            fontFamily: 'Instrument Sans',
            fontSize: big ? 15 : 12,
            height: 1.0,
            fontWeight: FontWeight.w700,
            color: AppColors.textOnAccent,
            // The badge renders in the overlay, outside any Material —
            // opt out of MaterialApp's fallback decoration (double
            // yellow underline) that bare Text would inherit.
            decoration: TextDecoration.none,
          ),
        ),
      ),
    );
  }

  /// From this diameter up the orb is a hero (Home's big orb), not a parked
  /// control: its badge scales with it.
  static const double _bigOrb = 100;

  /// Float: resting and ready, one 5.5s breath up and back, never below the
  /// rest line. The lift scales with the orb, 7px on Home's 144px orb down to
  /// 2px in the tab bar, so every orb drifts at the same pace and none
  /// jitters in a tight slot.
  double _floatDy(double seconds, bool motion) {
    if (!motion) return 0;
    if (widget.state != VidyaOrbVisual.resting &&
        widget.state != VidyaOrbVisual.ready) {
      return 0;
    }
    final lift = (7 * widget.size / 144).clamp(2.0, 7.0);
    return -lift * _wave(seconds, AppMotion.orbFloat);
  }

  /// Scale: the float's 1.035 swell, the listening pulse 1.07, the working
  /// pulse 1.04, each on the same breath-shaped wave.
  double _scale(double seconds, bool motion) {
    if (!motion) return 1.0;
    switch (widget.state) {
      case VidyaOrbVisual.resting:
      case VidyaOrbVisual.ready:
        return 1.0 + 0.035 * _wave(seconds, AppMotion.orbFloat);
      case VidyaOrbVisual.listening:
        return 1.0 + 0.07 * _wave(seconds, AppMotion.orbListenPulse);
      case VidyaOrbVisual.working:
        return 1.0 + 0.04 * _wave(seconds, AppMotion.orbWorkPulse);
      case VidyaOrbVisual.dragging:
      case VidyaOrbVisual.offline:
        return 1.0;
    }
  }
}
