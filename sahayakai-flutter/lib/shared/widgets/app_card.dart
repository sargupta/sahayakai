import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// The one card grammar reused everywhere: radius 12, 1dp outline border,
/// `shadowSoft`, `space4` padding, optional 4dp saffron accent bar (the ONLY
/// sanctioned decorative flourish). See DESIGN_RUBRIC §5.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding,
    this.onTap,
    this.accentBar = false,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final bool accentBar;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: AppRadius.rLg,
        border: Border.all(color: scheme.outline, width: 1),
        boxShadow: AppShadows.soft,
      ),
      child: ClipRRect(
        borderRadius: AppRadius.rLg,
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            onTap: onTap,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (accentBar)
                  Container(
                    height: 4,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          scheme.primary,
                          scheme.primary.withValues(alpha: 0.4),
                        ],
                      ),
                    ),
                  ),
                Padding(
                  padding:
                      padding ?? const EdgeInsets.all(AppSpacing.space4),
                  child: child,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
