import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/icon_well.dart';
import '../../../../shared/widgets/map_card.dart';
import '../../../../shared/widgets/map_icon_tile.dart';
import '../../domain/group.dart';

/// A group's tint family, from its kind: a class-and-subject group is indigo,
/// a school amber, a region leaf, and an interest group saffron. The server's
/// `coverColor` (a CSS gradient) is never painted; every surface that shows a
/// group (chip, hero band, network tile) reads this, so a group keeps one
/// colour across the app.
MapTint groupTint(Group group) => switch (group.type) {
  GroupType.subjectGrade => MapTint.indigo,
  GroupType.school => MapTint.amber,
  GroupType.region => MapTint.leaf,
  GroupType.interest => MapTint.saffron,
};

/// A group's glyph, from its kind. Always shown beside the group's name, never
/// as the only signal.
IconData groupIcon(Group group) => switch (group.type) {
  GroupType.subjectGrade => LucideIcons.bookOpen,
  GroupType.school => LucideIcons.school,
  GroupType.region => LucideIcons.mapPin,
  GroupType.interest => LucideIcons.users,
};

/// A group chip for the horizontal "Your groups" / "Discover groups" strips
/// (SPEC §A3.1). A fixed-width tappable `MapCard(flat)`: an [IconWell] spine
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
      child: MapCard(
        onTap: onTap,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            MapIconTile(icon: groupIcon(group), tint: groupTint(group)),
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
                    style: extras.dataMedium.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
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
