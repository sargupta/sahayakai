import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

/// How a [CommunityPillButton] is drawn.
enum CommunityPillTone {
  /// Saffron fill, white label — the map's `.chip.s.on` (Connect, Join, Accept).
  primary,

  /// White with a hairline — a secondary action (Decline, Message).
  outline,
}

/// The UX map's compact row action (`.chip.s`): a 32px pill drawn inside a
/// ≥48dp touch target, so a list row keeps its density without shrinking the
/// tap area. The label wraps instead of clipping at large text sizes.
///
/// Unlike `MapChip` (a *selection* chip that announces "selected"), this is a
/// plain button to assistive tech. While [busy] it shows a small spinner and
/// ignores taps; with a null [onPressed] it is disabled.
class CommunityPillButton extends StatelessWidget {
  const CommunityPillButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.tone = CommunityPillTone.primary,
    this.busy = false,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final CommunityPillTone tone;
  final bool busy;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !busy;
    final primary = tone == CommunityPillTone.primary;
    final fill = primary ? AppColors.accentFill : AppColors.surfaceMapCard;
    final ink = primary ? AppColors.textOnAccent : AppColors.textStrong;
    final edge = primary
        ? BorderSide.none
        : const BorderSide(color: AppColors.borderHairline);

    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      excludeSemantics: true,
      onTap: enabled ? onPressed : null,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
        child: Center(
          widthFactor: 1,
          heightFactor: 1,
          child: Opacity(
            opacity: enabled || busy ? 1 : 0.5,
            child: Material(
              color: fill,
              shape: StadiumBorder(side: edge),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: enabled ? onPressed : null,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 32),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 6,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (busy)
                          SizedBox.square(
                            dimension: 14,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: ink,
                            ),
                          )
                        else if (icon != null)
                          Icon(icon, size: 15, color: ink),
                        if (busy || icon != null)
                          const SizedBox(width: AppSpacing.space1),
                        Flexible(
                          child: Text(
                            label,
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.labelMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: ink,
                                ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
