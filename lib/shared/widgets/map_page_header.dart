import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/theme/app_theme.dart';

/// The UX map's header row (`.hdr`): a 40px round Back button, and whatever
/// the page puts opposite it. No app bar and no title in it: the title is the
/// page's large heading below, and VIDYA is the orb.
class MapPageHeader extends StatelessWidget {
  const MapPageHeader({super.key, this.trailing, this.dark = false});

  final Widget? trailing;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final canPop = Navigator.of(context).canPop();
    final trailing = this.trailing;
    if (!canPop && trailing == null) return const SizedBox(height: 40);
    final label = MaterialLocalizations.of(context).backButtonTooltip;
    return Row(
      children: [
        if (canPop)
          Semantics(
            button: true,
            label: label,
            excludeSemantics: true,
            onTap: () => Navigator.of(context).maybePop(),
            child: SizedBox(
              width: 48,
              height: 48,
              child: Center(
                child: Material(
                  color: dark
                      ? AppColors.scanControl
                      : AppColors.surfaceMapCard,
                  shape: CircleBorder(
                    side: dark
                        ? BorderSide.none
                        : const BorderSide(color: AppColors.borderHairline),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => Navigator.of(context).maybePop(),
                    child: SizedBox(
                      width: 40,
                      height: 40,
                      child: Icon(
                        LucideIcons.chevronLeft,
                        size: 18,
                        color: dark ? AppColors.scanInk : AppColors.textStrong,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        const Spacer(),
        ?trailing,
      ],
    );
  }
}

/// The page's large heading (the map's `.h1`, 27px Bricolage) and its muted
/// subtitle (`.sub`).
class MapPageTitle extends StatelessWidget {
  const MapPageTitle({
    super.key,
    required this.title,
    this.subtitle,
    this.dark = false,
  });

  final String title;
  final String? subtitle;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final subtitle = this.subtitle;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          header: true,
          child: Text(
            title,
            style: text.displayLarge?.copyWith(
              fontSize: 27,
              height: 1.12,
              letterSpacing: -0.5,
              color: dark ? AppColors.scanInk : AppColors.textStrong,
            ),
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: AppSpacing.space1),
          Text(
            subtitle,
            style: text.bodyMedium?.copyWith(
              fontSize: 13,
              color: dark ? AppColors.scanMuted : AppColors.textBody,
            ),
          ),
        ],
      ],
    );
  }
}
