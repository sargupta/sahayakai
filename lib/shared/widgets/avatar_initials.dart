import 'dart:ui' show Color;

import '../../core/theme/app_theme.dart';

/// The UX map's avatar (`.av`): up to two initials on one of three soft tints.
/// Shared by the Staffroom and inbox avatars so a teacher looks the same on
/// every Community surface.

/// The map's three avatar tints (`.av`, `.av.g`, `.av.n`): a fill and its own
/// dark ink, each well above 4.5:1.
const List<(Color, Color)> _avatarTints = <(Color, Color)>[
  (AppColors.tileSaffronBg, AppColors.tileSaffronInk),
  (AppColors.tileLeafBg, AppColors.tileLeafInk),
  (AppColors.tileIndigoBg, AppColors.tileIndigoInk),
];

/// Up to two initials: the first letter of the first two words, upper-cased
/// (a no-op for Indic scripts). Null for an empty name.
String? avatarInitials(String name) {
  final words = name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
  final letters = [
    for (final w in words.take(2)) String.fromCharCode(w.runes.first),
  ];
  if (letters.isEmpty) return null;
  return letters.join().toUpperCase();
}

/// A stable (fill, ink) per name, so a teacher keeps one colour everywhere.
(Color, Color) avatarTint(String name) {
  var hash = 0;
  for (final unit in name.trim().codeUnits) {
    hash = (hash * 31 + unit) & 0x7fffffff;
  }
  return _avatarTints[hash % _avatarTints.length];
}
