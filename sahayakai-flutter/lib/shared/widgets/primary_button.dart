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
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isBusy;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final enabled = onPressed != null && !isBusy;
    final glow = enabled
        ? (AppShadows.ctaGlowLight)
        : null;

    return PressableScale(
      pressedScale: 0.97,
      enabled: enabled,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: AppRadius.rControl,
          boxShadow: glow,
        ),
        child: ConstrainedBox(
          // A MINIMUM height, not a fixed one: at textScale 1.3 a long label
          // wraps to a second line and the button GROWS to fit it rather than
          // clipping it below the pill (a `ButtonStyleButton` defaults to
          // `Clip.none`). A short label at scale 1.0 still renders at exactly
          // 56dp. `minWidth: infinity` keeps the full-width fill.
          constraints: const BoxConstraints(
            minWidth: double.infinity,
            minHeight: 56,
          ),
          child: FilledButton(
            onPressed: isBusy ? null : onPressed,
            style: const ButtonStyle(
              shape: WidgetStatePropertyAll(
                RoundedRectangleBorder(borderRadius: AppRadius.rControl),
              ),
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
                          // The label follows the phone's own text size with no
                          // clamp (12px floor, decided 26 Oct 2026): a long or
                          // scaled label wraps and the pill grows from its
                          // 56dp minimum, never truncating (v2 Button).
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
