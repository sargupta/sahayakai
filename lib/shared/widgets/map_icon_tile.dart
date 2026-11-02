import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// The tint families of the UX map's `mono` tiles and avatars.
enum MapTint {
  saffron(AppColors.tileSaffronBg, AppColors.tileSaffronInk),
  leaf(AppColors.tileLeafBg, AppColors.tileLeafInk),
  indigo(AppColors.tileIndigoBg, AppColors.tileIndigoInk),
  amber(AppColors.tileAmberBg, AppColors.tileAmberInk);

  const MapTint(this.fill, this.ink);

  final Color fill;
  final Color ink;
}

/// A 36px rounded square in a [MapTint], carrying an icon. The map draws
/// two-letter codes at an 11px radius; this uses an icon, which reads the same
/// in all 11 languages, and the app's 12px row radius.
class MapIconTile extends StatelessWidget {
  const MapIconTile({
    super.key,
    required this.icon,
    this.tint = MapTint.saffron,
  });

  final IconData icon;
  final MapTint tint;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: tint.fill,
          borderRadius: AppRadius.rRow,
        ),
        child: Icon(icon, size: 17, color: tint.ink),
      ),
    );
  }
}
