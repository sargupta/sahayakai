import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/icon_well.dart';
import '../../domain/group.dart';

/// A group chip for the horizontal "Your groups" / "Discover groups" strips
/// (SPEC §A3.1). A fixed-width tappable `AppCard(flat)`: an [IconWell] spine
/// (the group `coverColor` degrades to the deterministic saffron token tint —
/// a CSS gradient string is never bled full-width, per the §2.4 gradient ban),
/// the group name, and the member count. Tapping opens the group detail.
///
/// The card is ≥48dp tall (the 48dp IconWell + padding floors it), so the row
/// is a comfortable touch target.
class GroupChip extends StatelessWidget {
  const GroupChip({super.key, required this.group, required this.onTap});

  final Group group;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final text = theme.textTheme;
    final extras = AppTextExtras.of(context);

    return SizedBox(
      width: 220,
      child: AppCard(
        onTap: onTap,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const IconWell(icon: LucideIcons.users),
            const SizedBox(width: AppSpacing.space3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    group.name,
                    style: text.titleSmall,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.space1),
                  Text(
                    l10n.staffroomMemberCount(group.memberCount),
                    style:
                        extras.dataMedium.copyWith(color: scheme.onSurfaceVariant),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
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
