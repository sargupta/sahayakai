import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/avatar_initials.dart';

/// A staffroom author / teacher avatar: the photo when it loads, and a dignified
/// saffron-tint initial (or a neutral user glyph) as the fallback — **never** a
/// broken red-X. It follows the app's `Image.network` convention (both a
/// [Image.loadingBuilder] and an [Image.errorBuilder]), mirroring
/// `InboxAvatar` / the Video Storyteller thumbnail: while the photo streams, and
/// if it fails, the same [_InitialFallback] shows, so a feed row never flickers
/// to an error glyph.
///
/// The initial is taken by **rune** (not `substring`) so an Indic name shows its
/// base character rather than a split UTF-16 code unit, and its colour is the
/// AA-safe saffron-**text** token (`#AC4815` light / `#EB9447` dark) on the light
/// saffron tint — legible, never the `#E0924D` fill routed as text.
class StaffroomAvatar extends StatelessWidget {
  const StaffroomAvatar({
    super.key,
    required this.name,
    this.photoUrl,
    this.size =
        AppIconSize.wellBox, // 48dp — floors the row past the 48dp target
  });

  final String name;
  final String? photoUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final url = photoUrl?.trim();
    final fallback = _InitialFallback(name: name, size: size);

    return ClipOval(
      child: SizedBox(
        width: size,
        height: size,
        child: (url == null || url.isEmpty)
            ? fallback
            : Image.network(
                url,
                fit: BoxFit.cover,
                gaplessPlayback: true,
                excludeFromSemantics: true,
                loadingBuilder: (context, child, progress) =>
                    progress == null ? child : fallback,
                errorBuilder: (context, error, stack) => fallback,
              ),
      ),
    );
  }
}

/// The saffron-tint fallback: the name's first rune, or a neutral user glyph
/// when there is no name yet.
class _InitialFallback extends StatelessWidget {
  const _InitialFallback({required this.name, required this.size});

  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final text = avatarInitials(name);
    final (fill, ink) = avatarTint(name);
    return ColoredBox(
      color: fill,
      child: Center(
        child: text == null
            ? Icon(LucideIcons.user, size: size * 0.42, color: ink)
            : Text(
                text,
                maxLines: 1,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  // 12px on the map's 36px avatar, scaled with the size.
                  fontSize: size / 3,
                  fontWeight: FontWeight.w700,
                  height: 1,
                  color: ink,
                ),
              ),
      ),
    );
  }
}
