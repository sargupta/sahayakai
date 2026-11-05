import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import 'press_scale.dart';

/// PrimaryButton v2 (PREMIUM_DESIGN_SPEC.md §5). The single primary CTA: 56dp
/// tall, full-width, radius `control` 12, saffron fill with a signature glow so
/// it reads lit (`ctaGlowLight` / `dSaffronGlow`). Press scales 0.97; busy
/// shows an inline 20dp spinner while the full width holds. Solid fill only —
/// no fill gradient (a two-stop saffron gradient fails white-label AA).
///
/// API preserved ({label, onPressed, isBusy, icon}).
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.isBusy = false,
    this.icon,
    this.ink = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isBusy;
  final IconData? icon;

  /// The map's ink button (`background: var(--a-ink)`, no lift) for a
  /// tool whose primary action is not a making step (Instant Answer).
  final bool ink;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;
    final enabled = onPressed != null && !isBusy;
    final glow = enabled && !ink
        ? (isDark ? AppShadows.dSaffronGlow : const [AppShadows.mapButton])
        : null;

    return PressableScale(
      pressedScale: 0.97,
      enabled: enabled,
      child: DecoratedBox(
        // The UX map's `.btn`: a 52px saffron-600 pill with its warm lift;
        // disabled, the pale `.btn.dis` fill with no lift.
        decoration: ShapeDecoration(
          color: !(enabled || isBusy)
              ? (ink ? AppColors.textFaint : AppColors.mapButtonDisabled)
              : (ink ? AppColors.textStrong : AppColors.accentFill),
          shape: const StadiumBorder(),
          shadows: glow,
        ),
        child: ConstrainedBox(
          // A MINIMUM height, not a fixed one: at textScale 1.3 a long label
          // wraps to a second line and the button GROWS to fit it rather than
          // clipping it below the pill (a `ButtonStyleButton` defaults to
          // `Clip.none`). A short label at scale 1.0 still renders at exactly
          // 56dp. `minWidth: infinity` keeps the full-width fill.
          constraints: const BoxConstraints(
            minWidth: double.infinity,
            minHeight: 52,
          ),
          child: FilledButton(
            onPressed: isBusy ? null : onPressed,
            style: ButtonStyle(
              backgroundColor: const WidgetStatePropertyAll(Colors.transparent),
              foregroundColor: WidgetStatePropertyAll(scheme.onPrimary),
              elevation: const WidgetStatePropertyAll(0),
              // The theme's label style (the app font), sized to the map's
              // `.btn`. A bare TextStyle here would drop the font family and
              // fall back to the platform font.
              textStyle: WidgetStatePropertyAll(
                theme.textTheme.labelLarge?.copyWith(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
              shape: const WidgetStatePropertyAll(StadiumBorder()),
            ),
            child: isBusy
                ? SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: scheme.onPrimary,
                    ),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (icon != null) ...[
                        Icon(icon, size: AppIconSize.inline),
                        const SizedBox(width: AppSpacing.space2),
                      ],
                      Flexible(
                        child: Text(
                          label,
                          textAlign: TextAlign.center,
                          // Cap the wrap at two lines (then ellipsis) and clamp
                          // accessibility scaling at the project's tested 1.3
                          // ceiling, so a long localized label can never bleed
                          // past the pill — the same no-overflow discipline the
                          // floating nav slot applies.
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          textScaler: MediaQuery.textScalerOf(
                            context,
                          ).clamp(maxScaleFactor: 1.3),
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
