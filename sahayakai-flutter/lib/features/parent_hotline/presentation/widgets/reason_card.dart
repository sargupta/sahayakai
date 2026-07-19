import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/icon_well.dart';
import '../../../../shared/widgets/press_scale.dart';

/// A selectable reason tile for the Parent Hotline `reason` stage (SPEC §B.1
/// stage 2). NOT a radio: it is an `AppCard`-grammar tile that toggles into the
/// selected state — `primaryContainer` fill + a 1.5px `primary` border (the Chip
/// selected grammar, THEME_SPEC §5) — with a check glyph so selection reads
/// without relying on colour alone (WCAG 1.4.1).
///
/// Composition per the reused-widget map (§B.4): an [IconWell] glyph, a
/// `titleMedium` label, and a muted `bodyMedium` description, pressed by
/// [PressableScale]. The whole tile is the target, well past 48dp.
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
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;

    final fill = selected ? scheme.primaryContainer : scheme.surface;
    final border = selected
        ? Border.all(color: scheme.primary, width: 1.5)
        : Border.all(color: scheme.outline, width: 1);

    final content = AnimatedContainer(
      duration: reduce ? Duration.zero : AppMotion.micro,
      curve: AppMotion.easeOutQuart,
      decoration: BoxDecoration(
        color: fill,
        borderRadius: AppRadius.rCard,
        border: border,
        boxShadow: AppShadows.e1,
      ),
      child: ClipRRect(
        borderRadius: AppRadius.rCard,
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.space4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  IconWell(icon: icon),
                  const SizedBox(width: AppSpacing.space4),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(label, style: text.titleMedium),
                        const SizedBox(height: AppSpacing.space1),
                        Text(
                          description,
                          style: text.bodyMedium
                              ?.copyWith(color: scheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.space3),
                  // A colour-independent selection cue (WCAG 1.4.1): the checked
                  // glyph appears only when selected, so the state is legible in
                  // greyscale, not only by the saffron fill/border. On the
                  // selected `primaryContainer` fill it uses `onPrimaryContainer`
                  // (saffron-800, ~7.9:1) — the Chip-label treatment — not the
                  // low-contrast `primary` fill tone.
                  Icon(
                    selected ? LucideIcons.checkCircle2 : LucideIcons.circle,
                    size: AppIconSize.inline,
                    color: selected
                        ? scheme.onPrimaryContainer
                        : scheme.onSurfaceVariant,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );

    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: PressableScale(pressedScale: 0.98, child: content),
    );
  }
}
