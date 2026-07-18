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
    final isDark = theme.brightness == Brightness.dark;
    final enabled = onPressed != null && !isBusy;
    final glow = enabled
        ? (isDark ? AppShadows.dSaffronGlow : AppShadows.ctaGlowLight)
        : null;

    return PressableScale(
      pressedScale: 0.97,
      enabled: enabled,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: AppRadius.rControl,
          boxShadow: glow,
        ),
        child: SizedBox(
          height: 56,
          width: double.infinity,
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
                        child: Text(label, textAlign: TextAlign.center),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
