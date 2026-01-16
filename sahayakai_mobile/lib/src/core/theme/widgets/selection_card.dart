import 'package:flutter/material.dart';
import 'glass_card.dart';

/// A selection card with icon, title, subtitle, and optional checkmark
/// Matches the format selector pattern from Quiz reference
///
/// Usage:
/// ```dart
/// SelectionCard(
///   icon: Icons.list_alt,
///   iconColor: Colors.teal,
///   title: 'Multiple Choice',
///   subtitle: 'Best for quick recall',
///   isSelected: true,
///   onTap: () {},
/// )
/// ```
class SelectionCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final Color? iconBackgroundColor;
  final String title;
  final String subtitle;
  final bool isSelected;
  final VoidCallback? onTap;

  const SelectionCard({
    super.key,
    required this.icon,
    required this.iconColor,
    this.iconBackgroundColor,
    required this.title,
    required this.subtitle,
    this.isSelected = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    const primaryColor = Color(0xFFFF9933);

    return GlassCard(
      onTap: onTap,
      borderRadius: 16,
      padding: const EdgeInsets.all(16),
      border: isSelected
          ? Border.all(color: primaryColor.withOpacity(0.4), width: 2)
          : null,
      child: Row(
        children: [
          // Icon container
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: iconBackgroundColor ?? iconColor.withOpacity(0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              icon,
              color: iconColor,
              size: 32,
            ),
          ),
          const SizedBox(width: 16),
          // Title and subtitle
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: theme.brightness == Brightness.dark
                        ? Colors.white
                        : Colors.black87,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.brightness == Brightness.dark
                        ? Colors.grey.shade400
                        : Colors.grey.shade600,
                  ),
                ),
              ],
            ),
          ),
          // Checkmark indicator
          if (isSelected)
            Container(
              width: 24,
              height: 24,
              decoration: const BoxDecoration(
                color: primaryColor,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check,
                color: Colors.white,
                size: 16,
              ),
            ),
        ],
      ),
    );
  }
}
