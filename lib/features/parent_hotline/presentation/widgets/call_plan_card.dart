import 'package:flutter/material.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';

/// v3 screen 14 — the honest call-plan card, in the canonical card grammar: a
/// near-opaque warm-white panel, a 1px white edge, 18px radius, 14/15 padding,
/// a tracked saffron eyebrow, 14/1.6 body, and an 11px muted helper line.
///
/// Shared by the review stage (before the call) and the `calling` stage (while
/// the AI is on the line) because both are answering the same question — what is
/// actually happening on this call — and answering it twice in two different
/// materials would be worse than answering it once in one.
///
/// It is NOT a live in-call script. The parent call is placed and conducted by
/// VIDYA server-side (the teacher is not on the line), so there is no "say this
/// next" line and no mute/end affordance to fake: the card describes how the
/// warm outreach call goes and what happens after it, which is the truth.
class CallPlanCard extends StatelessWidget {
  const CallPlanCard({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final isDark = scheme.brightness == Brightness.dark;
    final text = Theme.of(context).textTheme;
    final extras = AppTextExtras.of(context);

    // `ink600` is the design's muted body colour on the light wash; dark has no
    // wash to sit on, so it falls back to the theme's own muted role.
    final muted = isDark ? scheme.onSurfaceVariant : AppColors.ink600;

    Widget point(String label) => Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.space2),
      child: Text(
        label,
        style: text.bodyLarge?.copyWith(height: 1.6, color: scheme.onSurface),
      ),
    );

    return DecoratedBox(
      decoration: BoxDecoration(
        color: isDark
            ? scheme.surfaceContainerHigh
            : Colors.white.withValues(alpha: 0.90),
        borderRadius: AppRadius.rCard,
        border: isDark
            ? null
            : Border.all(color: Colors.white.withValues(alpha: 0.95)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.space4,
          vertical: AppSpacing.space4,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(l10n.parentHotlineCoverTitle, style: extras.eyebrow),
            const SizedBox(height: AppSpacing.space3),
            point(l10n.parentHotlineCoverPoint1),
            point(l10n.parentHotlineCoverPoint2),
            point(l10n.parentHotlineCoverPoint3),
            const SizedBox(height: AppSpacing.space1),
            Text(
              l10n.parentHotlineCoverAfter,
              style: text.bodySmall?.copyWith(color: muted, height: 1.6),
            ),
          ],
        ),
      ),
    );
  }
}
