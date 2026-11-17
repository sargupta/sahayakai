import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// EditorialSectionHeader — the design system v2 `Eyebrow`: the uppercase,
/// tracked saffron label (10px/600, .16em, `text-eyebrow`) that names a card
/// or section. Latin text is uppercased; Indic text is neither uppercased nor
/// tracked and renders at 12px (the `eyebrow` type token handles both).
///
/// v2 eyebrows carry no trailing rule; `scripts/token_guard.sh` keeps one from
/// coming back.
class EditorialSectionHeader extends StatelessWidget {
  const EditorialSectionHeader(this.eyebrow, {super.key});

  final String eyebrow;

  @override
  Widget build(BuildContext context) {
    final extras = AppTextExtras.of(context);
    // UPPERCASE Latin only; leave Indic untouched.
    final label = _hasNonLatin(eyebrow) ? eyebrow : eyebrow.toUpperCase();
    return Text(label, style: extras.eyebrow);
  }
}

bool _hasNonLatin(String s) => s.runes.any((r) => r > 0x24F);
