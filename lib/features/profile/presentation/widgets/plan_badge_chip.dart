import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../data/plan_claim_provider.dart';
import '../../domain/plan_badge.dart';

/// The plan badge on the identity card.
///
/// Three renderings, because there are three honest answers:
///   - a paid plan  -> the saffron accent, earned,
///   - the free plan -> a neutral outline,
///   - unknown      -> a muted "Not available" plus the reason, never a
///                     fabricated "Free". See [PlanBadge.unknown].
class PlanBadgeChip extends ConsumerWidget {
  const PlanBadgeChip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final badge = ref.watch(planBadgeProvider);
    return badge.when(
      // The claim is decoded from a token already in memory, so this resolves
      // within a frame; a skeleton would flash more than it would inform.
      loading: () => _Chip(label: context.l10n.profilePlanLabel, muted: true),
      error: (_, _) => _Chip(label: context.l10n.profilePlanUnknown, muted: true),
      data: (plan) => _Chip(
        label: _planLabel(context.l10n, plan),
        muted: !plan.isPaid,
        icon: plan.isPaid ? LucideIcons.sparkles : null,
      ),
    );
  }
}

/// Exhaustive on purpose: a new tier will not compile until it has copy.
String _planLabel(AppLocalizations l10n, PlanBadge plan) {
  return switch (plan) {
    PlanBadge.free => l10n.profilePlanFree,
    PlanBadge.pro => l10n.profilePlanPro,
    PlanBadge.gold => l10n.profilePlanGold,
    PlanBadge.premium => l10n.profilePlanPremium,
    PlanBadge.unknown => l10n.profilePlanUnknown,
  };
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.muted, this.icon});

  final String label;
  final bool muted;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final text = theme.textTheme;
    // AA (label + icon, computed vs the ACTUAL fill):
    //   • PAID routes through the saffron-TEXT token — saffron-700 #AC4815 light
    //     / #EB9447 dark — on the primary@0.12 tint (~5.1:1), exactly like
    //     AppBadge's accent tone. NOT scheme.primary (#E0924D), which is only
    //     ~2.26:1 on that tint: the #E0924D-as-text anti-pattern app_colors bans.
    //   • MUTED/free inks full onSurface on its surfaceContainer fill (~14:1),
    //     not the sub-4.5 onSurfaceVariant it used before.
    final fg = muted
        ? scheme.onSurface
        : (theme.brightness == Brightness.dark
            ? AppColors.dPrimaryText
            : AppColors.lPrimaryText);

    // A bordered identity chip — the border is load-bearing (it separates the
    // free/outline, paid/accent and unknown/muted states), so it is not the
    // shared fill-only [AppBadge]. It does share §5.4's rounded-full pill shape
    // and the §13 inline icon token, which is all it took from that badge.
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: muted
            ? scheme.surfaceContainer
            : scheme.primary.withValues(alpha: 0.12),
        shape: StadiumBorder(
          side: BorderSide(
            color:
                muted ? scheme.outline : scheme.primary.withValues(alpha: 0.5),
          ),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.space2,
          vertical: AppSpacing.space1,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: AppIconSize.inline, color: fg),
              const SizedBox(width: AppSpacing.space1),
            ],
            // Flexible, not fixed: at textScale 1.3 in Malayalam this label is
            // several times its English width, and it sits in a Row.
            Flexible(
              child: Text(
                label,
                style: text.labelMedium?.copyWith(color: fg),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
