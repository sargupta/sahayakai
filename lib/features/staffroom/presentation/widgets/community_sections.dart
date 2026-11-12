import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';

/// Community's section switcher, pulled from the left edge.
///
/// Closed, it is [CommunitySectionsGrip]: a slim cream grip with two short
/// lines and a small saffron dot while Messages or Updates has something
/// unread. Open, it is [CommunitySectionsPanel] beside a
/// [CommunitySectionsCloseTab]: one row per section with an icon, a line of
/// what is inside and its unread count.

/// The closed state. The drawn grip is 14dp wide; its touch area is 44dp, and
/// a swipe to the right on it opens the panel just like a tap.
class CommunitySectionsGrip extends StatelessWidget {
  const CommunitySectionsGrip({
    super.key,
    required this.label,
    required this.showDot,
    required this.onOpen,
  });

  /// The accessible name, e.g. "Open sections. Now: Staffroom".
  final String label;

  /// Whether anything in Messages or Updates is unread.
  final bool showDot;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onOpen,
        onHorizontalDragEnd: (d) {
          if ((d.primaryVelocity ?? 0) > 0) onOpen();
        },
        child: SizedBox(
          width: AppSpacing.targetMin,
          height: 104,
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 14,
                  height: 84,
                  decoration: const BoxDecoration(
                    color: AppColors.milk50,
                    borderRadius: BorderRadiusDirectional.horizontal(
                      end: Radius.circular(10),
                    ),
                    boxShadow: [AppShadows.card],
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [_GripLine(), SizedBox(width: 3), _GripLine()],
                  ),
                ),
                if (showDot)
                  PositionedDirectional(
                    top: -3,
                    end: -3,
                    child: Container(
                      key: const ValueKey('community-sections-dot'),
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: AppColors.saffron500,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.milk50, width: 1.5),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _GripLine extends StatelessWidget {
  const _GripLine();

  @override
  Widget build(BuildContext context) => Container(
    width: 2,
    height: 26,
    decoration: BoxDecoration(
      color: AppColors.ink400,
      borderRadius: BorderRadius.circular(2),
    ),
  );
}

/// The open state's tab on the panel's edge: a chevron that closes it.
class CommunitySectionsCloseTab extends StatelessWidget {
  const CommunitySectionsCloseTab({
    super.key,
    required this.label,
    required this.onClose,
  });

  final String label;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onClose,
        child: SizedBox(
          width: 34,
          height: 104,
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            child: Container(
              width: 30,
              height: 64,
              decoration: const BoxDecoration(
                color: AppColors.milk50,
                borderRadius: BorderRadiusDirectional.horizontal(
                  end: Radius.circular(16),
                ),
                boxShadow: [AppShadows.card],
              ),
              child: const Icon(
                LucideIcons.chevronLeft,
                size: 16,
                color: AppColors.textLink,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The pulled-out panel: "Community / Where to?" and the three sections. The
/// open section is tinted, ringed and announced as selected.
class CommunitySectionsPanel extends StatelessWidget {
  const CommunitySectionsPanel({
    super.key,
    required this.selected,
    required this.labels,
    required this.unreadMessages,
    required this.unreadUpdates,
    required this.onSelect,
  });

  final int selected;

  /// Staffroom, Messages, Updates — in pane order.
  final List<String> labels;
  final int unreadMessages;
  final int unreadUpdates;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final latin = Localizations.localeOf(context).languageCode == 'en';
    final eyebrow = l10n.communitySectionsEyebrow;
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.milk50,
        borderRadius: BorderRadiusDirectional.horizontal(
          end: Radius.circular(30),
        ),
        boxShadow: [AppShadows.sheet],
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsetsDirectional.fromSTEB(20, 28, 16, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              latin ? eyebrow.toUpperCase() : eyebrow,
              style: text.labelMedium?.copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: latin ? 1.7 : 0,
                color: AppColors.textEyebrow,
              ),
            ),
            const SizedBox(height: AppSpacing.space1),
            Semantics(
              header: true,
              child: Text(
                l10n.communitySectionsTitle,
                style: text.displayLarge?.copyWith(
                  fontSize: 24,
                  color: AppColors.textStrong,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.space4),
            _SectionRow(
              key: const ValueKey('community-section-0'),
              icon: LucideIcons.users,
              wellColor: AppColors.accentFill,
              iconColor: AppColors.textOnAccent,
              title: labels[0],
              subtitle: l10n.communityStaffroomSub,
              count: 0,
              countColor: AppColors.accentFill,
              selected: selected == 0,
              onTap: () => onSelect(0),
            ),
            const SizedBox(height: 10),
            _SectionRow(
              key: const ValueKey('community-section-1'),
              icon: LucideIcons.messageCircle,
              wellColor: AppColors.tileIndigoBg,
              iconColor: AppColors.tileIndigoInk,
              title: labels[1],
              subtitle: l10n.communityMessagesSub,
              count: unreadMessages,
              countColor: AppColors.accentFill,
              selected: selected == 1,
              onTap: () => onSelect(1),
            ),
            const SizedBox(height: 10),
            _SectionRow(
              key: const ValueKey('community-section-2'),
              icon: LucideIcons.bell,
              wellColor: AppColors.tileAmberBg,
              iconColor: AppColors.tileAmberInk,
              title: labels[2],
              subtitle: l10n.communityUpdatesSub,
              count: unreadUpdates,
              countColor: AppColors.red500,
              selected: selected == 2,
              onTap: () => onSelect(2),
            ),
            const SizedBox(height: AppSpacing.space6),
            Text(
              l10n.communitySectionsHint,
              style: text.bodyMedium?.copyWith(color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionRow extends StatelessWidget {
  const _SectionRow({
    super.key,
    required this.icon,
    required this.wellColor,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.count,
    required this.countColor,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final Color wellColor;
  final Color iconColor;
  final String title;
  final String subtitle;
  final int count;
  final Color countColor;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(20),
      side: BorderSide(
        color: selected ? AppColors.mapOptOnRing : AppColors.borderHairline,
      ),
    );
    return Semantics(
      button: true,
      selected: selected,
      label: count > 0
          ? '$title, $subtitle, ${l10n.inboxUnreadLabel(count)}'
          : '$title, $subtitle',
      excludeSemantics: true,
      child: Material(
        color: selected ? AppColors.mapOptOn : AppColors.milk50,
        shape: shape,
        child: InkWell(
          customBorder: shape,
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 64),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: wellColor,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(icon, size: 19, color: iconColor),
                  ),
                  const SizedBox(width: AppSpacing.space3),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: text.titleLarge?.copyWith(
                            fontSize: 16,
                            color: AppColors.textStrong,
                          ),
                        ),
                        Text(
                          subtitle,
                          style: text.bodyMedium?.copyWith(
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (count > 0) ...[
                    const SizedBox(width: AppSpacing.space2),
                    Container(
                      constraints: const BoxConstraints(minWidth: 22),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: countColor,
                        borderRadius: AppRadius.rPill,
                      ),
                      child: Text(
                        '$count',
                        textAlign: TextAlign.center,
                        style: text.labelMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppColors.textOnAccent,
                        ),
                      ),
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
