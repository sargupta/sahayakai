import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'package:lucide_icons/lucide_icons.dart';

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
enum VidyaOrbVisual {
  resting,
  dragging,
  listening,
  working,
  ready,
  offline,
}

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
    this.semanticLabel,
    this.semanticHint,
  });

  final VidyaOrbVisual state;
  final double size;
  final int readyCount;
  final VoidCallback? onTap;
  final String? semanticLabel;
  final String? semanticHint;

  /// Fixed clear space around the sphere for listening ripple / drag halo / ready badge.
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

  Duration? _periodFor(VidyaOrbVisual s) {
    switch (s) {
      case VidyaOrbVisual.resting:
        return AppMotion.orbFloat; // 5.5s
      case VidyaOrbVisual.listening:
        return AppMotion.orbListenPulse; // 2s
      case VidyaOrbVisual.working:
        return AppMotion.orbWorkPulse; // 1.8s
      case VidyaOrbVisual.dragging:
      case VidyaOrbVisual.ready:
      case VidyaOrbVisual.offline:
        return null;
    }
  }

  void _syncMotion() {
    final period = _periodFor(widget.state);
    final motion = context.motionEnabled;
    if (!motion || period == null) {
      _c.stop();
      _c.value = 0;
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
                _buildListenRing(t, motion),
              if (widget.state == VidyaOrbVisual.dragging)
                _buildDragRing(),
              Transform.translate(
                offset: Offset(0, _floatDy(t, motion)),
                child: Transform.scale(
                  scale: _scale(t, motion),
                  child: _buildSphere(),
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
          child: orb,
        ),
      ),
    );
  }

  /// The sphere — exact radial gradient from design tokens.
  /// Specular highlight at 34%/30% (Alignment(-0.32, -0.4)).
  Widget _buildSphere() {
    final lifted = widget.state == VidyaOrbVisual.dragging;
    final diameter = lifted ? AppSpacing.orbDraggingSize : widget.size;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      width: diameter,
      height: diameter,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: _orbGradient(),
        boxShadow: _orbShadows(isDark, lifted),
      ),
      alignment: Alignment.center,
      child: _glyph(diameter),
    );
  }

  RadialGradient _orbGradient() {
    // Highlight at 34%/30% = Alignment(-0.32, -0.4)
    const center = Alignment(-0.32, -0.4);
    const radius = 0.95;

    switch (widget.state) {
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
          colors: [Color(0xFFE6E2DA), Color(0xFF8A8178)],
          stops: [0.0, 0.72],
        );
    }
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
        return [
          AppShadows.orbWorking,
        ];
      case VidyaOrbVisual.ready:
        return [
          AppShadows.orbReady,
        ];
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

  Widget? _glyph(double diameter) {
    IconData? icon;
    switch (widget.state) {
      case VidyaOrbVisual.resting:
      case VidyaOrbVisual.dragging:
      case VidyaOrbVisual.listening:
        // Lucide, like every other glyph in the app (and SealMic's mic).
        icon = LucideIcons.mic;
      case VidyaOrbVisual.working:
        icon = LucideIcons.sparkles;
      case VidyaOrbVisual.ready:
      case VidyaOrbVisual.offline:
        icon = null;
    }
    if (icon == null) return null;
    return Icon(
      icon,
      size: diameter * 0.38,
      color: _onBaseColor().withValues(alpha: 0.92),
    );
  }

  Color _onBaseColor() {
    switch (widget.state) {
      case VidyaOrbVisual.resting:
      case VidyaOrbVisual.dragging:
      case VidyaOrbVisual.listening:
        return AppColors.textOnAccent; // white
      case VidyaOrbVisual.working:
        return AppColors.textOnAccent; // white on indigo
      case VidyaOrbVisual.ready:
        return AppColors.textOnAccent; // white on leaf
      case VidyaOrbVisual.offline:
        return AppColors.textOnAccent;
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

  /// Ready badge: 20px circle, white number on leaf-500, 2px milk-50 border.
  Widget _buildReadyBadge() {
    final label = widget.readyCount > 9 ? '9+' : '${widget.readyCount}';
    return Positioned(
      top: VidyaOrb._halo - 3,
      right: VidyaOrb._halo - 3,
      child: Container(
        constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
        padding: const EdgeInsets.symmetric(horizontal: 5),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.leaf500,
          border: Border.all(color: AppColors.milk50, width: 2),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: const TextStyle(
            fontFamily: 'Instrument Sans',
            fontSize: 10,
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

  /// Float: resting only, 5.5s ease-in-out, translateY -7px.
  double _floatDy(double t, bool motion) {
    if (!motion || widget.state != VidyaOrbVisual.resting) return 0;
    return -7 * math.sin(t * 2 * math.pi);
  }

  /// Scale: resting float scale 1.035, listening pulse 1.07, working pulse 1.04.
  double _scale(double t, bool motion) {
    if (!motion) return 1.0;
    switch (widget.state) {
      case VidyaOrbVisual.resting:
        return 1.0 + 0.035 * (0.5 + 0.5 * math.sin(t * 2 * math.pi));
      case VidyaOrbVisual.listening:
        return 1.0 + 0.07 * (0.5 + 0.5 * math.sin(t * 2 * math.pi));
      case VidyaOrbVisual.working:
        return 1.0 + 0.04 * math.sin(t * 2 * math.pi);
      case VidyaOrbVisual.dragging:
      case VidyaOrbVisual.ready:
      case VidyaOrbVisual.offline:
        return 1.0;
    }
  }
}