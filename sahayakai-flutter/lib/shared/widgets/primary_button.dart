import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// The single primary CTA. Always >= 56dp tall (thumb-zone reachable),
/// filled saffron, shows an inline spinner while busy. See DESIGN_RUBRIC §2.
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
    final scheme = Theme.of(context).colorScheme;
    return SizedBox(
      height: 56,
      width: double.infinity,
      child: FilledButton(
        onPressed: isBusy ? null : onPressed,
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
                    Icon(icon, size: 20),
                    const SizedBox(width: AppSpacing.space2),
                  ],
                  Flexible(
                    child: Text(label, textAlign: TextAlign.center),
                  ),
                ],
              ),
      ),
    );
  }
}
