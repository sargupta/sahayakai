import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/avatar_initials.dart';

/// A conversation avatar: the participant's photo when it loads, and a dignified
/// saffron-tint initial (or a group glyph) as the fallback — **never** a broken
/// red-X. It follows the app's `Image.network` convention (both a
/// [Image.loadingBuilder] and an [Image.errorBuilder]), mirroring the Video
/// Storyteller thumbnail: while the photo streams, and if it fails, the same
/// [_InitialFallback] shows, so the row never flickers to an error glyph.
///
/// The initial is taken by **rune** (not `substring`) so an Indic name shows its
/// base character rather than a split UTF-16 code unit, and its colour is the
/// AA-safe saffron-**text** token (`#AC4815` light / `#EB9447` dark) on the light
/// saffron tint — legible, never the `#E0924D` fill routed as text.
class InboxAvatar extends StatelessWidget {
  const InboxAvatar({
    super.key,
    required this.name,
    this.photoUrl,
    this.isGroup = false,
    this.size =
        AppIconSize.wellBox, // 48dp — floors the row past the 48dp target
  });

  final String name;
  final String? photoUrl;
  final bool isGroup;
  final double size;

  @override
  Widget build(BuildContext context) {
    final url = photoUrl?.trim();
    final fallback = _InitialFallback(name: name, isGroup: isGroup, size: size);

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

/// The saffron-tint fallback: a group glyph, or the name's first rune, or a
/// neutral user glyph when there is no name yet.
class _InitialFallback extends StatelessWidget {
  const _InitialFallback({
    required this.name,
    required this.isGroup,
    required this.size,
  });

  final String name;
  final bool isGroup;
  final double size;

  @override
  Widget build(BuildContext context) {
    // The map's avatar: two initials on the name's own tint, as on every
    // Community surface; a group shows its icon on the same tint.
    final initials = avatarInitials(name);
    final (fill, ink) = avatarTint(name);
    return ColoredBox(
      color: fill,
      child: Center(
        child: (isGroup || initials == null)
            ? Icon(
                isGroup ? LucideIcons.users : LucideIcons.user,
                size: size * 0.42,
                color: ink,
              )
            : Text(
                initials,
                maxLines: 1,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
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
