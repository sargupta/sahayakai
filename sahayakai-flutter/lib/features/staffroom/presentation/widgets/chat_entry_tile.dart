import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/icon_well.dart';

/// The tappable entry into a live chat room (SPEC §A3.1) — the Staff Room from
/// the staffroom home / Network hub, and a group's chat from Group detail. A
/// 48dp [IconWell] + a title (+ optional muted subtitle) + a chevron, inside an
/// [AppCard]. The [feature] variant (the Staff Room entry) is the elevated card
/// with the 3px saffron accent bar; a group entry is a flat card.
///
/// Muted `onSurfaceVariant` is legal for the subtitle + chevron here: an [AppCard]
/// is a white `surface` card (4.70:1), where "muted only on white cards" holds.
class ChatEntryTile extends StatelessWidget {
  const ChatEntryTile({
    super.key,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.icon = LucideIcons.messagesSquare,
    this.feature = false,
  });

  final String title;
  final String? subtitle;
  final VoidCallback onTap;
  final IconData icon;

  /// The prominent variant (elevated + saffron accent bar) — the Staff Room entry.
  final bool feature;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final subtitleText = subtitle?.trim();

    return AppCard(
      variant: feature ? AppCardVariant.elevated : AppCardVariant.flat,
      accentBar: feature,
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
                if (subtitleText != null && subtitleText.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.space1),
                  Text(
                    subtitleText,
                    style: text.bodyMedium
                        ?.copyWith(color: scheme.onSurfaceVariant),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.space2),
          Icon(
            LucideIcons.chevronRight,
            size: AppIconSize.inline,
            color: scheme.onSurfaceVariant,
          ),
        ],
      ),
    );
  }
}
