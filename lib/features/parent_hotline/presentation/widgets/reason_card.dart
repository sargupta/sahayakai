import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/map_icon_tile.dart';

/// One reason on step 1 of the Parent Hotline (the UX map's reason `.opt`
/// row): an icon tile, the reason and a one-line description, and a check.
///
/// Tapping SELECTS — it does not advance. The step's Next button confirms, so a
/// mis-tap costs nothing and the teacher can read all four before choosing.
///
/// Selected, the row takes the map's saffron option tint and a stronger ring;
/// the state is also carried by the glyph (an empty circle becomes a check),
/// so it reads in greyscale (WCAG 1.4.1) and is announced as `selected`.
class ReasonCard extends StatelessWidget {
  const ReasonCard({
    super.key,
    required this.icon,
    required this.label,
    required this.description,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String description;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Semantics(
      button: true,
      selected: selected,
      label: '$label. $description',
      excludeSemantics: true,
      onTap: onTap,
      child: Material(
        color: selected ? AppColors.mapOptOn : AppColors.surfaceMapCard,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.rField,
          side: selected
              ? const BorderSide(color: AppColors.mapOptOnRing, width: 1.5)
              : const BorderSide(color: AppColors.borderHairline),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(12, 12, 14, 12),
              child: Row(
                children: [
                  MapIconTile(icon: icon),
                  const SizedBox(width: AppSpacing.space3),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          label,
                          style: text.bodyLarge?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: AppColors.textStrong,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.space1),
                        Text(
                          description,
                          style: text.bodySmall?.copyWith(
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.space2),
                  Icon(
                    selected ? LucideIcons.checkCircle2 : LucideIcons.circle,
                    size: 18,
                    color: selected ? AppColors.accent : AppColors.textFaint,
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
