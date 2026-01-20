import 'dart:ui';
import 'package:flutter/material.dart';
import 'glass_theme.dart';

/// A frosted glass card component with backdrop blur effect.
/// CSS equivalent:
/// .glass-card {
///   background: rgba(255, 255, 255, 0.4);
///   backdrop-filter: blur(12px);
///   border: 1px solid rgba(255, 255, 255, 0.3);
/// }
class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double? borderRadius;
  final Color? backgroundColor;
  final double blurAmount;
  final double backgroundOpacity;
  final double borderOpacity;
  final VoidCallback? onTap;

  const GlassCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.borderRadius,
    this.backgroundColor,
    this.blurAmount = 12, // backdrop-filter: blur(12px)
    this.backgroundOpacity = 0.4, // rgba(255, 255, 255, 0.4)
    this.borderOpacity = 0.3, // rgba(255, 255, 255, 0.3)
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? GlassRadius.lg;
    
    Widget card = Container(
      margin: margin,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: blurAmount, sigmaY: blurAmount),
          child: Container(
            decoration: BoxDecoration(
              // background: rgba(255, 255, 255, 0.4)
              color: (backgroundColor ?? Colors.white).withOpacity(backgroundOpacity),
              borderRadius: BorderRadius.circular(radius),
              // border: 1px solid rgba(255, 255, 255, 0.3)
              border: Border.all(
                color: Colors.white.withOpacity(borderOpacity),
                width: 1,
              ),
            ),
            padding: padding ?? GlassSpacing.cardPadding,
            child: child,
          ),
        ),
      ),
    );

    if (onTap != null) {
      return GestureDetector(
        onTap: onTap,
        child: card,
      );
    }

    return card;
  }
}

/// A glass card with an icon header, like the "Lesson Details" card
class GlassIconCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;

  const GlassIconCard({
    super.key,
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.child,
    this.padding,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: padding ?? GlassSpacing.cardPadding,
      margin: margin,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: iconColor, size: 24),
              const SizedBox(width: GlassSpacing.sm),
              Text(title, style: GlassTypography.headline3()),
            ],
          ),
          const SizedBox(height: GlassSpacing.lg),
          child,
        ],
      ),
    );
  }
}

/// A section card for grouping related inputs with a header icon
class GlassSectionCard extends StatelessWidget {
  final String? decorativeLabel; // Italic script label like "Drafting New Worksheet..."
  final String title;
  final IconData? icon;
  final Color? iconColor;
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;

  const GlassSectionCard({
    super.key,
    this.decorativeLabel,
    required this.title,
    this.icon,
    this.iconColor,
    required this.child,
    this.padding,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (decorativeLabel != null) ...[
          Text(
            decorativeLabel!,
            style: GlassTypography.decorativeLabel(),
          ),
          const SizedBox(height: GlassSpacing.xs),
        ],
        if (icon != null)
          GlassIconCard(
            icon: icon!,
            iconColor: iconColor ?? GlassColors.primary,
            title: title,
            padding: padding,
            margin: margin,
            child: child,
          )
        else
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: GlassTypography.headline2()),
              const SizedBox(height: GlassSpacing.lg),
              GlassCard(
                padding: padding,
                margin: margin,
                child: child,
              ),
            ],
          ),
      ],
    );
  }
}
