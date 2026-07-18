import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import 'press_scale.dart';

/// SecondaryButton (PREMIUM_DESIGN_SPEC.md §5). 52dp, radius `control` 12,
/// transparent fill, 1.5px `primary` border, saffron TEXT label
/// (`lPrimaryText` 5.6:1 on paper / `dPrimaryText` on dark). Press scales 0.97;
/// busy shows an inline spinner while the width holds. Mirrors [PrimaryButton]'s
/// API so a call site can swap emphasis without rewrites.
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

    return PressableScale(
      pressedScale: 0.97,
      enabled: enabled,
      child: SizedBox(
        height: 52,
        width: double.infinity,
        child: OutlinedButton(
          onPressed: isBusy ? null : onPressed,
          style: OutlinedButton.styleFrom(
            foregroundColor: labelColor,
            side: BorderSide(color: scheme.primary, width: 1.5),
            shape: const RoundedRectangleBorder(borderRadius: AppRadius.rControl),
            minimumSize: const Size(0, 52),
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
                    Flexible(child: Text(label, textAlign: TextAlign.center)),
                  ],
                ),
        ),
      ),
    );
  }
}
