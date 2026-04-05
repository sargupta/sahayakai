import 'package:flutter/material.dart';
import 'glass_components.dart';

/// A shimmer effect widget that overlays a pulsing gradient on its child.
class GlassShimmer extends StatefulWidget {
  final Widget child;

  const GlassShimmer({super.key, required this.child});

  @override
  State<GlassShimmer> createState() => _GlassShimmerState();
}

class _GlassShimmerState extends State<GlassShimmer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
    _animation = Tween<double>(begin: -1.0, end: 2.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return ShaderMask(
          shaderCallback: (bounds) {
            return LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: const [
                Color(0xFFEEEEEE),
                Color(0xFFF5F5F5),
                Color(0xFFEEEEEE),
              ],
              stops: [
                _animation.value - 0.3,
                _animation.value,
                _animation.value + 0.3,
              ],
            ).createShader(bounds);
          },
          blendMode: BlendMode.srcATop,
          child: child,
        );
      },
      child: widget.child,
    );
  }
}

/// A single skeleton placeholder box with rounded corners.
class GlassSkeletonBox extends StatelessWidget {
  final double? width;
  final double height;
  final double borderRadius;

  const GlassSkeletonBox({
    super.key,
    this.width,
    this.height = 16,
    this.borderRadius = 8,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: GlassColors.inputBackground,
        borderRadius: BorderRadius.circular(borderRadius),
      ),
    );
  }
}

/// A shimmer card skeleton matching GlassCard dimensions.
class GlassSkeletonCard extends StatelessWidget {
  final double height;

  const GlassSkeletonCard({super.key, this.height = 80});

  @override
  Widget build(BuildContext context) {
    return GlassShimmer(
      child: Container(
        height: height,
        padding: const EdgeInsets.all(GlassSpacing.lg),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(GlassRadius.md),
          border: Border.all(color: GlassColors.border),
        ),
        child: Row(
          children: [
            const GlassSkeletonBox(width: 44, height: 44, borderRadius: 12),
            const SizedBox(width: GlassSpacing.lg),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  GlassSkeletonBox(
                    width: MediaQuery.of(context).size.width * 0.4,
                    height: 14,
                  ),
                  const SizedBox(height: 8),
                  GlassSkeletonBox(
                    width: MediaQuery.of(context).size.width * 0.25,
                    height: 10,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A list of shimmer skeleton cards for loading states.
class GlassSkeletonList extends StatelessWidget {
  final int itemCount;
  final double itemHeight;
  final EdgeInsetsGeometry? padding;

  const GlassSkeletonList({
    super.key,
    this.itemCount = 5,
    this.itemHeight = 80,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding ?? EdgeInsets.zero,
      child: Column(
        children: List.generate(
          itemCount,
          (index) => Padding(
            padding: const EdgeInsets.only(bottom: GlassSpacing.md),
            child: GlassSkeletonCard(height: itemHeight),
          ),
        ),
      ),
    );
  }
}
