import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// ScoreRing (PREMIUM_DESIGN_SPEC.md §5). A `CustomPaint` gauge for a scorecard:
/// a `surfaceContainerHigh` track, a `primary` progress arc that sweeps on
/// mount, and a centred score (`dataLarge`) over its denominator
/// (`labelSmall`). Reduce-motion jumps straight to the final frame.
class ScoreRing extends StatelessWidget {
  const ScoreRing({
    super.key,
    required this.score,
    required this.max,
    this.size = 120,
    this.stroke = 10,
  });

  final num score;
  final num max;
  final double size;
  final double stroke;

  static String _fmt(num n) =>
      n == n.roundToDouble() ? n.toInt().toString() : n.toString();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final extras = AppTextExtras.of(context);
    final fraction =
        max <= 0 ? 0.0 : (score / max).clamp(0.0, 1.0).toDouble();
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          TweenAnimationBuilder<double>(
            tween: Tween(begin: reduce ? fraction : 0, end: fraction),
            duration: reduce ? Duration.zero : AppMotion.medium,
            curve: AppMotion.easeOutQuart,
            builder: (context, value, _) => CustomPaint(
              size: Size.square(size),
              painter: _RingPainter(
                fraction: value,
                track: scheme.surfaceContainerHigh,
                progress: scheme.primary,
                stroke: stroke,
              ),
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_fmt(score), style: extras.dataLarge),
              Text(
                '/ ${_fmt(max)}',
                style: text.labelSmall?.copyWith(color: scheme.onSurfaceVariant),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({
    required this.fraction,
    required this.track,
    required this.progress,
    required this.stroke,
  });

  final double fraction;
  final Color track;
  final Color progress;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.shortestSide - stroke) / 2;

    final trackPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = track;
    canvas.drawCircle(center, radius, trackPaint);

    if (fraction <= 0) return;
    final progressPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..color = progress;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2, // start at 12 o'clock
      2 * math.pi * fraction,
      false,
      progressPaint,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.fraction != fraction ||
      old.track != track ||
      old.progress != progress ||
      old.stroke != stroke;
}
