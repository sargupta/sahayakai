import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/theme/app_theme.dart';

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
    this.size = AppIconSize.wellBox, // 48dp — floors the row past the 48dp target
  });

  final String name;
  final String? photoUrl;
  final bool isGroup;
  final double size;

  @override
  Widget build(BuildContext context) {
    final url = photoUrl?.trim();
    final fallback = _InitialFallback(
      name: name,
      isGroup: isGroup,
      size: size,
    );

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
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final saffronText = theme.brightness == Brightness.dark
        ? AppColors.dPrimaryText
        : AppColors.lPrimaryText;

    final trimmed = name.trim();
    final initial = trimmed.isEmpty
        ? null
        : String.fromCharCode(trimmed.runes.first).toUpperCase();

    // Glyph size scales with the well so the 40dp app-bar avatar and the 48dp
    // row avatar both read correctly.
    final glyph = size * 0.42;

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            scheme.primary.withValues(alpha: 0.16),
            scheme.primary.withValues(alpha: 0.06),
          ],
        ),
      ),
      child: Center(
        child: (isGroup || initial == null)
            ? Icon(
                isGroup ? LucideIcons.users : LucideIcons.user,
                size: glyph,
                color: scheme.primary,
              )
            : Text(
                initial,
                style: theme.textTheme.titleMedium?.copyWith(color: saffronText),
              ),
      ),
    );
  }
}
