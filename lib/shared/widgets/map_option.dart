import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/theme/app_theme.dart';

/// The UX map's option row (`.opt`): a white 14px row with a hairline ring;
/// when [selected], a saffron tint with a stronger ring and, if [showCheck], a
/// saffron check at the end. Used for multi-select question types and for
/// "Try one of these" suggestions that fill a field.
class MapOption extends StatelessWidget {
  const MapOption({
    super.key,
    required this.label,
    required this.onTap,
    this.selected = false,
    this.showCheck = false,
    this.leaf = false,
  });

  final String label;
  final VoidCallback onTap;
  final bool selected;

  /// Whether a selected row carries a check (multi-select lists).
  final bool showCheck;

  /// The leaf variant (`.opt.gon`), for a chosen correct answer.
  final bool leaf;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final ring = selected
        ? BorderSide(
            color: leaf ? AppColors.mapOptLeafRing : AppColors.mapOptOnRing,
            width: 1.5,
          )
        : const BorderSide(color: AppColors.borderHairline);
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      onTap: onTap,
      child: Material(
        color: selected
            ? (leaf ? AppColors.mapOptLeaf : AppColors.mapOptOn)
            : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.rField,
          side: ring,
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      label,
                      style: text.bodyMedium?.copyWith(
                        fontSize: 13.5,
                        color: AppColors.textStrong,
                        fontWeight: selected
                            ? FontWeight.w600
                            : FontWeight.w400,
                      ),
                    ),
                  ),
                  if (showCheck && selected) ...[
                    const SizedBox(width: AppSpacing.space2),
                    const Icon(
                      LucideIcons.check,
                      size: 16,
                      color: AppColors.accent,
                    ),
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
