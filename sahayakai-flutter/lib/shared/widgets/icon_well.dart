import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// IconWell v2 (PREMIUM_DESIGN_SPEC.md §5). A 48dp (or 64dp [feature]) well,
/// radius `well` 14, filled with a diagonal saffron tint gradient
/// (`primary@0.16 → primary@0.06`), a 1px `primary@0.22` inner border, and a
/// 20dp (28dp feature) Lucide glyph in `primary`. Saffron as an accent, never a
/// surface flood.
///
/// The v1 API (`IconWell(icon:)`) is preserved; [feature] defaults to false so
/// every existing call site keeps its 48dp/20dp well.
class IconWell extends StatelessWidget {
  const IconWell({super.key, required this.icon, this.feature = false});

  final IconData icon;

  /// The larger 64dp/28dp well used by the dashboard feature tile.
  final bool feature;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final box = feature ? 64.0 : AppIconSize.wellBox; // 64 / 48
    final glyph = feature ? 28.0 : AppIconSize.well; // 28 / 20
    return Container(
      width: box,
      height: box,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            scheme.primary.withValues(alpha: 0.16),
            scheme.primary.withValues(alpha: 0.06),
          ],
        ),
        borderRadius: AppRadius.rWell,
        border: Border.all(color: scheme.primary.withValues(alpha: 0.22), width: 1),
      ),
      alignment: Alignment.center,
      child: Icon(icon, size: glyph, color: scheme.primary),
    );
  }
}
