import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// The web's `tool-icon-wrap`: a 48x48 rounded-12 well, `primary/10` fill,
/// `primary` glyph. Saffron as an accent, never a surface flood (DESIGN_RUBRIC
/// §4, §5) — and the ONE icon well, per §13.
///
/// It was hand-rolled at four call sites that had already drifted apart (a 20dp
/// glyph on the dashboard, profile and the instant-answer video row; a 24dp one
/// on login; a 64dp/rXl/12%-alpha well with a 32dp glyph on splash). Nothing
/// here is configurable on purpose: a second size is how the drift started.
class IconWell extends StatelessWidget {
  const IconWell({super.key, required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: AppIconSize.wellBox,
      height: AppIconSize.wellBox,
      decoration: BoxDecoration(
        color: scheme.primary.withValues(alpha: 0.1),
        borderRadius: AppRadius.rLg,
      ),
      alignment: Alignment.center,
      child: Icon(icon, size: AppIconSize.well, color: scheme.primary),
    );
  }
}
