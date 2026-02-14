import 'dart:ui';

import 'package:flutter/material.dart';
import 'glass_theme.dart';
import 'glass_card.dart';

/// A preview card with an image placeholder (like "THE NOTEBOOK THEME" preview)
class GlassPreviewCard extends StatelessWidget {
  final String label;
  final Widget? child;
  final double height;
  final Color? backgroundColor;

  const GlassPreviewCard({
    super.key,
    required this.label,
    this.child,
    this.height = 180,
    this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Label badge
        Container(
          padding: const EdgeInsets.symmetric(
            horizontal: GlassSpacing.md,
            vertical: GlassSpacing.xs,
          ),
          decoration: BoxDecoration(
            color: GlassColors.primary.withOpacity(0.1),
            borderRadius: BorderRadius.circular(GlassRadius.xs),
          ),
          child: Text(
            label.toUpperCase(),
            style: GlassTypography.labelSmall(color: GlassColors.primary),
          ),
        ),
        const SizedBox(height: GlassSpacing.sm),
        // Preview container
        Container(
          height: height,
          width: double.infinity,
          decoration: BoxDecoration(
            color: backgroundColor ?? GlassColors.cardBackground,
            borderRadius: GlassRadius.cardRadius,
            boxShadow: GlassColors.cardShadow,
          ),
          clipBehavior: Clip.antiAlias,
          child: child ??
              _buildPlaceholderContent(),
        ),
      ],
    );
  }

  Widget _buildPlaceholderContent() {
    return Stack(
      children: [
        // Placeholder lines
        Positioned(
          left: GlassSpacing.xl,
          top: GlassSpacing.xl,
          right: GlassSpacing.xxxl * 2,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                height: 12,
                decoration: BoxDecoration(
                  color: GlassColors.textTertiary.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(6),
                ),
              ),
              const SizedBox(height: GlassSpacing.sm),
              Container(
                height: 10,
                width: 120,
                decoration: BoxDecoration(
                  color: GlassColors.textTertiary.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(5),
                ),
              ),
              const SizedBox(height: GlassSpacing.md),
              Container(
                height: 8,
                width: 80,
                decoration: BoxDecoration(
                  color: GlassColors.textTertiary.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ],
          ),
        ),
        // Decorative element in corner
        Positioned(
          right: GlassSpacing.lg,
          top: GlassSpacing.lg,
          child: Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: GlassColors.primary.withOpacity(0.2),
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Icon(
              Icons.edit_outlined,
              size: 14,
              color: GlassColors.primary,
            ),
          ),
        ),
        // Bottom decorative illustration placeholder
        Positioned(
          right: 0,
          bottom: 0,
          child: Container(
            width: 80,
            height: 100,
            decoration: BoxDecoration(
              color: GlassColors.textTertiary.withOpacity(0.08),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(40),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// A list item with icon, title, subtitle, and trailing action
class GlassListItem extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final Color? iconBackgroundColor;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;

  const GlassListItem({
    super.key,
    required this.icon,
    required this.iconColor,
    this.iconBackgroundColor,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: onTap,
      padding: const EdgeInsets.all(GlassSpacing.lg),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: iconBackgroundColor ?? iconColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(GlassRadius.md),
            ),
            child: Icon(icon, color: iconColor, size: 24),
          ),
          const SizedBox(width: GlassSpacing.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: GlassTypography.labelLarge()),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    style: GlassTypography.bodySmall(),
                  ),
                ],
              ],
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// A section label for grouping content
class GlassSectionLabel extends StatelessWidget {
  final String label;
  final Widget? trailing;

  const GlassSectionLabel({
    super.key,
    required this.label,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(
        left: GlassSpacing.xl,
        right: GlassSpacing.xl,
        top: GlassSpacing.lg,
        bottom: GlassSpacing.sm,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label.toUpperCase(),
            style: GlassTypography.sectionHeader(),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// A divider for the glassmorphic design
class GlassDivider extends StatelessWidget {
  final double indent;
  final double endIndent;

  const GlassDivider({
    super.key,
    this.indent = 0,
    this.endIndent = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: indent, right: endIndent),
      child: Container(
        height: 1,
        color: GlassColors.divider,
      ),
    );
  }
}

/// A loading indicator with glassmorphic style
class GlassLoadingIndicator extends StatelessWidget {
  final String? message;
  final Color? color;

  const GlassLoadingIndicator({
    super.key,
    this.message,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(
            strokeWidth: 3,
            valueColor: AlwaysStoppedAnimation<Color>(
              color ?? GlassColors.primary,
            ),
          ),
          if (message != null) ...[
            const SizedBox(height: GlassSpacing.lg),
            Text(
              message!,
              style: GlassTypography.bodyMedium(
                color: GlassColors.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// An empty state placeholder
class GlassEmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;

  const GlassEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.action,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(GlassSpacing.xxxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: GlassColors.primary.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: 40,
                color: GlassColors.primary,
              ),
            ),
            const SizedBox(height: GlassSpacing.xl),
            Text(
              title,
              style: GlassTypography.headline3(),
              textAlign: TextAlign.center,
            ),
            if (message != null) ...[
              const SizedBox(height: GlassSpacing.sm),
              Text(
                message!,
                style: GlassTypography.bodyMedium(
                  color: GlassColors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
            ],
            if (action != null) ...[
              const SizedBox(height: GlassSpacing.xl),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

/// A tool/action card for the home screen grid with frosted glass effect
class GlassToolCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color? iconColor;
  final VoidCallback? onTap;
  final double height;

  const GlassToolCard({
    super.key,
    required this.title,
    required this.icon,
    this.iconColor,
    this.onTap,
    this.height = 140,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveIconColor = iconColor ?? GlassColors.primary;
    
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: GlassRadius.cardRadius,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
          child: Container(
            height: height,
            decoration: BoxDecoration(
              // Plain frosted glass - white semi-transparent
              color: Colors.white.withOpacity(0.45),
              borderRadius: GlassRadius.cardRadius,
              // Subtle glass border
              border: Border.all(
                color: Colors.white.withOpacity(0.6),
                width: 1.5,
              ),
              // Soft shadow
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            padding: const EdgeInsets.all(GlassSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Orange icon container
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: effectiveIconColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(GlassRadius.md),
                  ),
                  child: Icon(icon, color: effectiveIconColor, size: 24),
                ),
                Text(
                  title,
                  style: GlassTypography.labelLarge(),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Hero card for the home dashboard
class GlassHeroCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final Widget? illustration;
  final VoidCallback? onTap;

  const GlassHeroCard({
    super.key,
    required this.title,
    required this.subtitle,
    this.illustration,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        height: 200,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFFFFB366), // Light saffron
              Color(0xFFFFD4A3), // Peach
              Color(0xFFFFF0E0), // Cream
            ],
          ),
          borderRadius: GlassRadius.cardRadius,
          boxShadow: [
            BoxShadow(
              color: GlassColors.primary.withOpacity(0.25),
              blurRadius: 24,
              offset: const Offset(0, 12),
              spreadRadius: -4,
            ),
          ],
        ),
        child: Stack(
          children: [
            // Illustration
            if (illustration != null)
              Positioned(
                right: 0,
                top: 0,
                bottom: 0,
                child: illustration!,
              ),
            // Text Content
            Padding(
              padding: const EdgeInsets.all(GlassSpacing.xxl),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    title,
                    style: GlassTypography.headline1().copyWith(
                      fontSize: 32,
                      height: 1.1,
                    ),
                  ),
                  const SizedBox(height: GlassSpacing.md),
                  SizedBox(
                    width: 180,
                    child: Text(
                      subtitle,
                      style: GlassTypography.bodyMedium(
                        color: GlassColors.textSecondary,
                      ),
                    ),
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

/// Bottom navigation bar with glassmorphic style
class GlassBottomNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
  final List<GlassNavItem> items;

  const GlassBottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: GlassColors.cardBackground,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: GlassSpacing.lg,
            vertical: GlassSpacing.sm,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: items.asMap().entries.map((entry) {
              final index = entry.key;
              final item = entry.value;
              final isSelected = index == currentIndex;

              return GestureDetector(
                onTap: () => onTap(index),
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: GlassSpacing.md,
                    vertical: GlassSpacing.sm,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isSelected ? item.activeIcon : item.icon,
                        color: isSelected
                            ? GlassColors.primary
                            : GlassColors.textTertiary,
                        size: 24,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        item.label,
                        style: GlassTypography.labelSmall(
                          color: isSelected
                              ? GlassColors.primary
                              : GlassColors.textTertiary,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      ),
    );
  }
}

/// Navigation item for the bottom nav bar
class GlassNavItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;

  const GlassNavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
  });
}
