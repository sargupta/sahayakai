import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/icon_well.dart';

/// One tool card on the Content Creator Studio hub (U-PD2).
///
/// It carries the dashboard tool-row grammar (PREMIUM_DESIGN_SPEC.md §5): a flat
/// [AppCard] that presses on tap (and degrades to a static frame under
/// reduce-motion), a 48dp saffron [IconWell], the tool name and a muted one-line
/// description, and a 32dp circular chevron go-affordance — so the hub reads as a
/// curated slice of the Prep desk rather than a new visual language.
///
/// Purely presentational: the hub owns the route, passing [onTap] as
/// `context.push(<route>)`. The whole card is the tap target (far past 48dp).
///
/// The [description] is muted ([ColorScheme.onSurfaceVariant]) and sits on the
/// card's WHITE surface, where saffron-700-grade muted ink clears AA (4.70:1);
/// it is never placed on the warm page ground, where it would fall below 4.5.
class ContentCreatorCard extends StatelessWidget {
  const ContentCreatorCard({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    required this.onTap,
  });

  /// The tool's registered Lucide glyph (image / globe / video).
  final IconData icon;

  /// The localized tool name (reuses the tool's own ARB title).
  final String title;

  /// The localized hub-card description (the richer, web-parity copy).
  final String description;

  /// Deep-links to the tool — the hub passes `() => context.push(<route>)`.
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return AppCard(
      // The whole card is the target, so it is far past 48dp.
      onTap: onTap,
      child: Row(
        children: [
          IconWell(icon: icon),
          const SizedBox(width: AppSpacing.space4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(title, style: text.titleMedium),
                const SizedBox(height: AppSpacing.space1),
                Text(
                  description,
                  style: text.bodyMedium?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.space3),
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: scheme.surfaceContainerHigh,
            ),
            alignment: Alignment.center,
            child: Icon(
              LucideIcons.chevronRight,
              size: AppIconSize.inline,
              color: scheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}
