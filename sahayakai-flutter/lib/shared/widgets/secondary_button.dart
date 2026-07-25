import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import 'press_scale.dart';

/// SecondaryButton (PREMIUM_DESIGN_SPEC.md §5). 52dp, radius `control` 12,
/// transparent fill, a gradient `primary` edge-highlight border, saffron TEXT
/// label (`lPrimaryText` 5.6:1 on paper / `dPrimaryText` on dark). Press
/// scales 0.97; busy shows an inline spinner while the width holds. Mirrors
/// [PrimaryButton]'s API so a call site can swap emphasis without rewrites.
///
/// GL-3 (App-wide Glassmorphism Reskin): the border was a flat 1.5px
/// `scheme.primary` `BorderSide` — already transparent-filled, so this
/// button only lacked the shared glass edge-highlight the rest of the family
/// (`GlassSurface`/`AppCard`/`IconWell`/`AppBadge`) now carries. Deliberately
/// NOT reusing [AppGlass]'s own neutral white-based border gradient here: at
/// its documented alpha range (0.10-0.40) that gradient reads as almost
/// invisible against the near-white light-mode paper background, which would
/// erase this button's outline entirely — a real usability loss for a
/// functional secondary CTA, not an acceptable trade for visual consistency.
/// Instead the edge-highlight keeps the SAME directional grammar (brighter
/// top-left fading to dimmer bottom-right) but tinted with the button's own
/// `scheme.primary`, so it still reads as a soft glass catch-light rather
/// than a flat single-tone line, while staying legible in both themes.
/// `BorderSide` can only paint one flat colour, so the ring uses the same
/// padding-trick technique as [GlassSurface]/[IconWell]/[AppBadge]: an outer
/// `RoundedRectangleBorder` painted with the gradient, inset by
/// [AppGlass.borderWidth], with the (still transparent-filled)
/// `OutlinedButton` on top (`side: BorderSide.none` — the ring is now the
/// border). No blur: there is no fill to blur.
class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.isBusy = false,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isBusy;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;
    final labelColor = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;
    final enabled = onPressed != null && !isBusy;

    final borderGradient = LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        scheme.primary.withValues(alpha: 0.90),
        scheme.primary.withValues(alpha: 0.55),
      ],
    );
    final innerRadius = AppGlass.insetBorderRadius(AppRadius.rControl);

    return PressableScale(
      pressedScale: 0.97,
      enabled: enabled,
      child: SizedBox(
        height: 52,
        width: double.infinity,
        child: DecoratedBox(
          decoration: ShapeDecoration(
            shape: const RoundedRectangleBorder(borderRadius: AppRadius.rControl),
            gradient: borderGradient,
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppGlass.borderWidth),
            child: OutlinedButton(
              onPressed: isBusy ? null : onPressed,
              style: OutlinedButton.styleFrom(
                foregroundColor: labelColor,
                side: BorderSide.none,
                shape: RoundedRectangleBorder(borderRadius: innerRadius),
                minimumSize: Size.zero,
              ),
              child: isBusy
                  ? SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: labelColor,
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
                          child: Text(label, textAlign: TextAlign.center),
                        ),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
