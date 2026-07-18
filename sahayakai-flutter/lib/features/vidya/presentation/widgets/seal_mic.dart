import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/motion/animated_entrance.dart';
import '../../../../shared/widgets/press_scale.dart';

/// The visual phase the [SealMic] renders — a small enum the widget owns so it
/// is testable and reusable independently of the [VidyaController] state
/// machine. The home maps `VidyaStatus` onto these (PREMIUM_DESIGN_SPEC §B.2).
enum SealMicState { idle, listening, transcribing, thinking, speaking }

/// The Seal Mic — the app's authored signature control (PREMIUM_DESIGN_SPEC
/// §B.2). A circular saffron wax-seal (`brandSaffron` face + a 2px `brandBrass`
/// ring, an `onPrimary` Lucide mic glyph, lifted on the `e2` warm shadow), NOT a
/// Material FAB. Five states drive five calm motions, each guarded by
/// `context.motionEnabled` so reduce-motion renders the composed still:
///   • idle → a slow ~3s breathing scale
///   • listening → concentric rings that react to the passed 0..1 [amplitude]
///   • transcribing / thinking → a calm orbiting arc (never a bare spinner)
///   • speaking → a gentle pulse
///
/// The 128dp disc is far past the 48dp tap floor; the seal presses on tap via
/// [PressableScale] and announces itself through [Semantics].
class SealMic extends StatefulWidget {
  const SealMic({
    super.key,
    required this.state,
    this.amplitude = 0,
    this.onTap,
    this.size = 128,
    this.semanticLabel,
    this.semanticHint,
  });

  final SealMicState state;

  /// Live 0..1 input level, used only while [SealMicState.listening] to size the
  /// reactive rings.
  final double amplitude;

  final VoidCallback? onTap;

  /// The footprint (and disc scale) of the seal. 128 is the idle hero; a caller
  /// can settle it smaller when anchored.
  final double size;

  /// Announced as the button label (e.g. "VIDYA voice").
  final String? semanticLabel;

  /// Announced as the button hint — the current state's spoken label.
  final String? semanticHint;

  @override
  State<SealMic> createState() => _SealMicState();
}

class _SealMicState extends State<SealMic>
    with SingleTickerProviderStateMixin {
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
  void didUpdateWidget(SealMic old) {
    super.didUpdateWidget(old);
    if (old.state != widget.state) _syncMotion();
  }

  /// The natural tempo of each state's ambient motion; null = no continuous
  /// motion (listening is driven by [SealMic.amplitude] data, not a tween).
  Duration? _periodFor(SealMicState s) {
    switch (s) {
      case SealMicState.idle:
        return const Duration(milliseconds: 3000); // slow breathing
      case SealMicState.transcribing:
      case SealMicState.thinking:
        return const Duration(milliseconds: 1400); // orbiting arc
      case SealMicState.speaking:
        return const Duration(milliseconds: 1100); // gentle pulse
      case SealMicState.listening:
        return null;
    }
  }

  void _syncMotion() {
    final motion = context.motionEnabled;
    final period = _periodFor(widget.state);
    if (!motion || period == null) {
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final motion = context.motionEnabled;
    final brass = isDark ? AppColors.dBrandBrass : AppColors.brandBrass;
    final disc = widget.size * 0.72;

    final seal = AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final t = _c.value; // 0..1; frozen at 0 under reduce-motion
        final breatheScale = _breatheScale(widget.state, t, motion);
        return SizedBox(
          width: widget.size,
          height: widget.size,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // The state overlay (rings / arc / pulse) sits behind the disc.
              Positioned.fill(
                child: IgnorePointer(
                  child: CustomPaint(
                    painter: _SealMicPainter(
                      state: widget.state,
                      phase: t,
                      amplitude: widget.amplitude.clamp(0.0, 1.0),
                      motion: motion,
                      color: scheme.primary,
                      discDiameter: disc,
                    ),
                  ),
                ),
              ),
              // The wax seal.
              Transform.scale(
                scale: breatheScale,
                child: Container(
                  width: disc,
                  height: disc,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.brandSaffron,
                    border: Border.all(color: brass, width: 2),
                    boxShadow:
                        isDark ? AppShadows.dSaffronGlow : AppShadows.ctaGlowLight,
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    LucideIcons.mic,
                    size: disc * 0.42,
                    color: scheme.onPrimary,
                  ),
                ),
              ),
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
        pressedScale: 0.97,
        enabled: widget.onTap != null,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: widget.onTap,
          child: seal,
        ),
      ),
    );
  }

  /// The breathing / pulsing scale of the disc itself. Idle breathes slowly,
  /// speaking pulses a touch faster; everything else holds at 1.0. Frozen at 0
  /// phase (the still) under reduce-motion.
  double _breatheScale(SealMicState s, double t, bool motion) {
    if (!motion) return 1.0;
    switch (s) {
      case SealMicState.idle:
        return 1.0 + 0.03 * math.sin(t * 2 * math.pi);
      case SealMicState.speaking:
        return 1.0 + 0.025 * math.sin(t * 2 * math.pi);
      case SealMicState.listening:
        return 1.0 + 0.03 * widget.amplitude.clamp(0.0, 1.0);
      case SealMicState.transcribing:
      case SealMicState.thinking:
        return 1.0;
    }
  }
}

/// Paints the calm state overlays behind the seal, all within the seal's own
/// footprint so the control never overflows its box.
class _SealMicPainter extends CustomPainter {
  _SealMicPainter({
    required this.state,
    required this.phase,
    required this.amplitude,
    required this.motion,
    required this.color,
    required this.discDiameter,
  });

  final SealMicState state;
  final double phase; // 0..1
  final double amplitude; // 0..1
  final bool motion;
  final Color color;
  final double discDiameter;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final discR = discDiameter / 2;
    // The clear space between the disc edge and the widget's outer bound.
    final headroom = (size.shortestSide / 2) - discR;

    switch (state) {
      case SealMicState.idle:
        _paintBreathingHalo(canvas, center, discR, headroom);
      case SealMicState.listening:
        _paintListeningRings(canvas, center, discR, headroom);
      case SealMicState.transcribing:
      case SealMicState.thinking:
        _paintOrbitArc(canvas, center, discR, headroom);
      case SealMicState.speaking:
        _paintSpeakingPulse(canvas, center, discR, headroom);
    }
  }

  void _paintBreathingHalo(
      Canvas canvas, Offset center, double discR, double headroom) {
    // A single faint halo that swells and fades as the seal breathes.
    final swell = motion ? 0.5 + 0.5 * math.sin(phase * 2 * math.pi) : 0.5;
    final r = discR + headroom * (0.35 + 0.30 * swell);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = color.withValues(alpha: 0.06 + 0.06 * swell);
    canvas.drawCircle(center, r, paint);
  }

  void _paintListeningRings(
      Canvas canvas, Offset center, double discR, double headroom) {
    // Two concentric rings whose radius + opacity track the live input level.
    for (var i = 0; i < 2; i++) {
      final base = 0.30 + 0.30 * i;
      final r = discR + headroom * (base + 0.35 * amplitude);
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5 - i
        ..color = color.withValues(alpha: (0.22 - 0.08 * i) * (0.4 + 0.6 * amplitude));
      canvas.drawCircle(center, r, paint);
    }
  }

  void _paintOrbitArc(
      Canvas canvas, Offset center, double discR, double headroom) {
    final r = discR + headroom * 0.5;
    final rect = Rect.fromCircle(center: center, radius: r);
    // A faint full track...
    canvas.drawCircle(
      center,
      r,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = color.withValues(alpha: 0.08),
    );
    // ...with a calm arc that orbits (a full soft ring when motion is off).
    final sweep = motion ? math.pi * 0.5 : math.pi * 2;
    final start = motion ? phase * 2 * math.pi : 0.0;
    canvas.drawArc(
      rect,
      start,
      sweep,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = 3
        ..color = color.withValues(alpha: 0.55),
    );
  }

  void _paintSpeakingPulse(
      Canvas canvas, Offset center, double discR, double headroom) {
    // A soft ring that expands outward and fades — a gentle voice pulse.
    final t = motion ? phase : 0.0;
    final r = discR + headroom * (0.25 + 0.55 * t);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..color = color.withValues(alpha: 0.28 * (1 - t) + 0.06);
    canvas.drawCircle(center, r, paint);
  }

  @override
  bool shouldRepaint(_SealMicPainter old) =>
      old.state != state ||
      old.phase != phase ||
      old.amplitude != amplitude ||
      old.motion != motion ||
      old.color != color ||
      old.discDiameter != discDiameter;
}
