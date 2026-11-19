import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import 'map_card.dart';
import 'map_icon_tile.dart';

/// The map's centred empty state: a tinted icon circle, a title, a line of
/// explanation and, when there is a next step, one action under it — all on
/// one card. Messages and Blocked teachers use it, so every "nothing here
/// yet" page reads the same.
class MapEmptyCard extends StatelessWidget {
  const MapEmptyCard({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.tint = MapTint.saffron,
    this.action,
  });

  final IconData icon;
  final String title;
  final String message;
  final MapTint tint;

  /// The one next step (e.g. "Find teachers"); null when there is none.
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return MapCard(
      padding: const EdgeInsets.fromLTRB(24, 30, 24, 26),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(color: tint.fill, shape: BoxShape.circle),
            child: Icon(icon, size: 26, color: tint.ink),
          ),
          const SizedBox(height: AppSpacing.space3),
          Text(
            title,
            textAlign: TextAlign.center,
            style: text.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: AppColors.textStrong,
            ),
          ),
          const SizedBox(height: AppSpacing.space2),
          Text(
            message,
            textAlign: TextAlign.center,
            style: text.bodyMedium?.copyWith(
              color: AppColors.textMuted,
              height: 1.45,
            ),
          ),
          if (action != null) ...[
            const SizedBox(height: AppSpacing.space4),
            action!,
          ],
        ],
      ),
    );
  }
}
