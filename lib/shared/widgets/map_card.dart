import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import 'map_icon_tile.dart';

/// The UX map's `.card`: 86% white, a hairline ring, a soft warm shadow, the
/// 18px card radius. With [onTap] the whole card is one ink-splashed target.
///
/// [padding] defaults to the map's 14px; a list card passes a thin vertical
/// padding and lets its rows pad themselves, so each row's ink fills edge to
/// edge.
class MapCard extends StatelessWidget {
  const MapCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(14),
    this.onTap,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final body = Padding(padding: padding, child: child);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surfaceMapCard,
        borderRadius: AppRadius.rCard,
        border: Border.all(color: AppColors.borderHairline),
        boxShadow: const [AppShadows.mapCard],
      ),
      child: ClipRRect(
        borderRadius: AppRadius.rCard,
        child: onTap == null
            ? body
            : Material(
                type: MaterialType.transparency,
                child: InkWell(onTap: onTap, child: body),
              ),
      ),
    );
  }
}

/// The map's `.ov` section label: 11px+ bold, tracked and uppercase in Latin
/// script only (Indic scripts have no case and tracking breaks their joins).
class MapOverline extends StatelessWidget {
  const MapOverline(this.label, {super.key, this.color = AppColors.textMuted});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final latin = Localizations.localeOf(context).languageCode == 'en';
    return Text(
      latin ? label.toUpperCase() : label,
      style: Theme.of(context).textTheme.labelMedium?.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: latin ? 1.5 : 0,
        color: color,
      ),
    );
  }
}

/// An empty state sized for a [MapCard]: a tinted icon tile beside an
/// optional bold line and the message, with an optional action under them.
/// The map writes empties as a quiet line in the card ("Nothing here yet."),
/// not the full-page haloed glyph.
class MapEmptyNote extends StatelessWidget {
  const MapEmptyNote({
    super.key,
    required this.icon,
    required this.message,
    this.title,
    this.action,
  });

  final IconData icon;
  final String message;
  final String? title;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MapIconTile(icon: icon),
            const SizedBox(width: AppSpacing.space3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (title != null)
                    Text(
                      title!,
                      style: text.bodyLarge?.copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textStrong,
                      ),
                    ),
                  Text(
                    message,
                    style: text.bodyMedium?.copyWith(
                      color: title == null
                          ? AppColors.textStrong
                          : AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        if (action != null) ...[
          const SizedBox(height: AppSpacing.space3),
          action!,
        ],
      ],
    );
  }
}
