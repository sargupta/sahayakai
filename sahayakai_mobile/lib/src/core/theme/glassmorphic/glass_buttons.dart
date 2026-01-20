import 'package:flutter/material.dart';
import 'glass_theme.dart';

/// Primary glassmorphic button with gradient and shadow
class GlassPrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool isLoading;
  final bool isExpanded;
  final double? height;

  const GlassPrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.isLoading = false,
    this.isExpanded = true,
    this.height,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: isExpanded ? double.infinity : null,
      height: height ?? 56,
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              GlassColors.primaryLight,
              GlassColors.primary,
            ],
          ),
          borderRadius: GlassRadius.buttonRadius,
          boxShadow: onPressed != null ? GlassColors.buttonShadow : null,
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: isLoading ? null : onPressed,
            borderRadius: GlassRadius.buttonRadius,
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: GlassSpacing.xxl,
                vertical: GlassSpacing.lg,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: isExpanded ? MainAxisSize.max : MainAxisSize.min,
                children: [
                  if (isLoading) ...[
                    const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    ),
                  ] else ...[
                    if (icon != null) ...[
                      Icon(icon, color: Colors.white, size: 20),
                      const SizedBox(width: GlassSpacing.sm),
                    ],
                    Text(label, style: GlassTypography.buttonLarge()),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Secondary outline button
class GlassSecondaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool isExpanded;
  final double? height;

  const GlassSecondaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.isExpanded = true,
    this.height,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: isExpanded ? double.infinity : null,
      height: height ?? 56,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.transparent,
          borderRadius: GlassRadius.buttonRadius,
          border: Border.all(
            color: GlassColors.primary,
            width: 1.5,
          ),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onPressed,
            borderRadius: GlassRadius.buttonRadius,
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: GlassSpacing.xxl,
                vertical: GlassSpacing.lg,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: isExpanded ? MainAxisSize.max : MainAxisSize.min,
                children: [
                  if (icon != null) ...[
                    Icon(icon, color: GlassColors.primary, size: 20),
                    const SizedBox(width: GlassSpacing.sm),
                  ],
                  Text(
                    label,
                    style: GlassTypography.buttonLarge(
                      color: GlassColors.primary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Icon button with circle background
class GlassIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onPressed;
  final Color? backgroundColor;
  final Color? iconColor;
  final double size;
  final bool isOutlined;

  const GlassIconButton({
    super.key,
    required this.icon,
    this.onPressed,
    this.backgroundColor,
    this.iconColor,
    this.size = 44,
    this.isOutlined = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: isOutlined
            ? Colors.transparent
            : (backgroundColor ?? GlassColors.cardBackground),
        shape: BoxShape.circle,
        border: isOutlined
            ? Border.all(color: GlassColors.inputBorder, width: 1)
            : null,
        boxShadow: isOutlined ? null : GlassColors.cardShadow,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(size / 2),
          child: Center(
            child: Icon(
              icon,
              color: iconColor ?? GlassColors.textPrimary,
              size: size * 0.5,
            ),
          ),
        ),
      ),
    );
  }
}

/// Floating action button with glass effect
class GlassFloatingButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool isLoading;

  const GlassFloatingButton({
    super.key,
    required this.label,
    required this.icon,
    this.onPressed,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(
        horizontal: GlassSpacing.xxl,
        vertical: GlassSpacing.lg,
      ),
      child: GlassPrimaryButton(
        label: label,
        icon: icon,
        onPressed: onPressed,
        isLoading: isLoading,
      ),
    );
  }
}

/// Back button with glassmorphic style
class GlassBackButton extends StatelessWidget {
  final VoidCallback? onPressed;

  const GlassBackButton({
    super.key,
    this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return GlassIconButton(
      icon: Icons.chevron_left_rounded,
      onPressed: onPressed ?? () => Navigator.of(context).pop(),
      size: 40,
    );
  }
}

/// Menu button (three dots)
class GlassMenuButton extends StatelessWidget {
  final VoidCallback? onPressed;

  const GlassMenuButton({
    super.key,
    this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return GlassIconButton(
      icon: Icons.more_horiz_rounded,
      onPressed: onPressed,
      size: 40,
      isOutlined: true,
    );
  }
}
