import 'dart:ui';
import 'package:flutter/material.dart';

/// A glassmorphic card widget with frosted glass effect
///
/// Usage:
/// ```dart
/// GlassCard(
///   child: Text('Content'),
///   borderRadius: 16,
/// )
/// ```
class GlassCard extends StatelessWidget {
  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry? padding;
  final Color? tintColor;
  final double blurAmount;
  final double opacity;
  final Border? border;
  final VoidCallback? onTap;

  const GlassCard({
    super.key,
    required this.child,
    this.borderRadius = 16,
    this.padding,
    this.tintColor,
    this.blurAmount = 12,
    this.opacity = 0.4,
    this.border,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Default tint colors based on theme
    final defaultTint = isDark
        ? const Color(0xFF064E3B).withOpacity(opacity) // Dark green tint
        : Colors.white.withOpacity(opacity); // Light white tint

    final defaultBorder = isDark
        ? Border.all(color: Colors.white.withOpacity(0.1), width: 1)
        : Border.all(color: Colors.white.withOpacity(0.3), width: 1);

    final content = ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blurAmount, sigmaY: blurAmount),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: tintColor ?? defaultTint,
            borderRadius: BorderRadius.circular(borderRadius),
            border: border ?? defaultBorder,
          ),
          child: child,
        ),
      ),
    );

    if (onTap != null) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(borderRadius),
          child: content,
        ),
      );
    }

    return content;
  }
}
