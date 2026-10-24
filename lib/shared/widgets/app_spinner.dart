import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_motion.dart';

/// Branded loading indicator: a saffron arc spinner whose sweep length varies
/// as it rotates (1.1s per rotation). Sizes 20/32/48dp. Optional app mark in
/// the center at the large size. 60fps, no jank, no blur.
class AppSpinner extends StatefulWidget {
  const AppSpinner({
    super.key,
    this.size = 32,
    this.strokeWidth,
    this.color,
    this.showMark = false,
  });

  final double size;
  final double? strokeWidth;
  final Color? color;
  final bool showMark;

  @override
  State<AppSpinner> createState() => _AppSpinnerState();
}

class _AppSpinnerState extends State<AppSpinner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: AppMotion.spinnerRotation,
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final stroke = widget.strokeWidth ?? (widget.size <= 20 ? 2.0 : 3.0);
    final color = widget.color ?? AppColors.saffron500;

    if (reduce) {
      return SizedBox(
        width: widget.size,
        height: widget.size,
        child: Center(
          child: Container(
            width: widget.size * 0.4,
            height: widget.size * 0.4,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
        ),
      );
    }

    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (context, _) {
          // Sweep length varies between 0.15 and 0.85 of a full turn.
          final t = _ctrl.value;
          final sweep = 0.15 + 0.7 * (0.5 - 0.5 * math.cos(t * 2 * math.pi));
          final rotation = t * 2 * math.pi;
          return CustomPaint(
            painter: _ArcPainter(
              color: color,
              strokeWidth: stroke,
              rotation: rotation,
              sweep: sweep,
            ),
            child: widget.showMark && widget.size >= 48
                ? Center(
                    child: Text(
                      'S',
                      style: TextStyle(
                        fontFamily: 'Bricolage Grotesque',
                        fontSize: widget.size * 0.3,
                        fontWeight: FontWeight.w700,
                        color: color,
                      ),
                    ),
                  )
                : null,
          );
        },
      ),
    );
  }
}

class _ArcPainter extends CustomPainter {
  _ArcPainter({
    required this.color,
    required this.strokeWidth,
    required this.rotation,
    required this.sweep,
  });

  final Color color;
  final double strokeWidth;
  final double rotation;
  final double sweep;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    final rect = Rect.fromLTWH(
      strokeWidth / 2,
      strokeWidth / 2,
      size.width - strokeWidth,
      size.height - strokeWidth,
    );

    canvas.drawArc(rect, rotation, sweep * 2 * math.pi, false, paint);
  }

  @override
  bool shouldRepaint(_ArcPainter old) =>
      old.rotation != rotation ||
      old.sweep != sweep ||
      old.color != color ||
      old.strokeWidth != strokeWidth;
}