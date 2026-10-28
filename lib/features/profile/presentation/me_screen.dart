import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/domain/picker_options.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/widgets/app_badge.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/glass_app_bar.dart';
import '../../../shared/widgets/icon_well.dart';
import '../../../shared/widgets/language_switcher.dart';
import '../../../shared/widgets/secondary_button.dart';
import '../../vidya/presentation/vidya_orb_placement_controller.dart';
import '../data/usage_repository.dart';
import '../domain/plan_badge.dart';
import '../domain/teacher_profile.dart';
import 'profile_controller.dart';
import 'widgets/plan_badge_chip.dart';

/// U-OS1 — the Me / operating-system hub (pillar 06), the 4th nav tab.
///
/// COMPOSES what already exists rather than duplicating it. The read-only
/// summary header, the Defaults board row and the Privacy & settings rows all
/// draw from the ONE profile reader ([profileControllerProvider], shared with
/// the full editor and Settings); the language control is the shared
/// [LanguageSwitcher]; the plan badge is the shared [PlanBadgeChip]; and the
/// full profile *editor* is unchanged — this hub links to it (`Routes.profile`)
/// and to Settings (`Routes.settings`) rather than re-implementing either.
///
/// The one genuinely new surface is **Plan & usage**, backed by
/// [usageSummaryProvider] (`GET /api/usage`).
///
/// AUTH GATE: the hub is gated on the profile read, exactly as the editor and
/// Settings are. A 401 (today's runtime state — `tokenProvider` is the P0.2
/// stub) degrades the WHOLE hub to a sign-in prompt: no faked identity, and the
/// usage read is never even fired (it is watched only inside the data branch).
class MeScreen extends ConsumerWidget {
  const MeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileControllerProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // v3 screen 16 "Offline and you": the warm paper wash the spec draws this
    // screen on, so the header, the offline card and the settings card sit on
    // one surface instead of the flat page background.
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: isDark ? AppGradients.darkVignette : AppGradients.washOffline,
      ),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: GlassAppBar(title: Text(context.l10n.meTitle)),
        body: SafeArea(
          child: profile.when(
            loading: () => const Padding(
              padding: AppSpacing.pagePadding,
              child: AppSkeleton(lines: 6),
            ),
            error: (error, _) => _MeError(
              error: error,
              onRetry: () =>
                  ref.read(profileControllerProvider.notifier).refresh(),
            ),
            // A brand-new teacher has no document (the onboarding gate is OFF in
            // production), which is an EMPTY profile — a valid, supported hub, not
            // an error.
            data: (data) => _MeHub(profile: data),
          ),
        ),
      ),
    );
  }
}

/// The profile read failed. Which state this is depends on WHY, so it branches
/// on the typed [ApiException] kind — the same three answers the editor and
/// Settings give for the same read.
class _MeError extends StatelessWidget {
  const _MeError({required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final kind = error is ApiException ? (error as ApiException).kind : null;

    // No identity -> the whole hub is a sign-in prompt. Offering "Try again"
    // here would be a lie: the read cannot succeed until the teacher signs in.
    if (kind == ApiErrorKind.unauthorized) {
      return const SingleChildScrollView(
        padding: AppSpacing.pagePadding,
        child: _SignedOutCard(),
      );
    }
    // Rural connectivity is intermittent: an expected failure with its own copy
    // and retry — the saffron offline card of v3 screen 16, not a grey error.
    if (kind == ApiErrorKind.network || kind == ApiErrorKind.timeout) {
      return SingleChildScrollView(
        padding: AppSpacing.pagePadding,
        child: _OfflineCard(onRetry: onRetry),
      );
    }
    return SingleChildScrollView(
      padding: AppSpacing.pagePadding,
      child: ErrorView(
        message: context.l10n.profileLoadFailed,
        onRetry: onRetry,
      ),
    );
  }
}

/// v3 screen 16's saffron "Working offline" panel: the tinted, hairline-bordered
/// card the spec draws for a connectivity failure, with a retry. Copy reuses the
/// `stateOffline*` + `actionRetry` strings — the spec's own lines ("Working
/// offline", "Voice needs signal…") have no l10n key, so they are reported as
/// missing rather than hardcoded.
class _OfflineCard extends StatelessWidget {
  const _OfflineCard({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final text = theme.textTheme;
    final isDark = theme.brightness == Brightness.dark;
    final titleColor =
        isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;
    final bodyColor = isDark ? AppColors.dMutedForeground : AppColors.ink600;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      decoration: BoxDecoration(
        color: AppColors.accentTint,
        border: Border.all(color: AppColors.accentTintBorder, width: 1),
        borderRadius: AppRadius.rCard,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(
                LucideIcons.wifiOff,
                size: AppIconSize.inline,
                color: titleColor,
              ),
              const SizedBox(width: AppSpacing.space2),
              Expanded(
                child: Text(
                  context.l10n.stateOfflineTitle,
                  style: text.titleSmall?.copyWith(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: titleColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.space1),
          Text(
            context.l10n.stateOfflineBody,
            style: text.bodySmall?.copyWith(height: 1.6, color: bodyColor),
          ),
          const SizedBox(height: AppSpacing.space3),
          SecondaryButton(
            label: context.l10n.actionRetry,
            icon: LucideIcons.rotateCcw,
            onPressed: onRetry,
          ),
        ],
      ),
    );
  }
}

/// The composed hub. Blocks in reading order, each inking in on the shared
/// staggered entrance (reduce-motion returns the static composed frame).
class _MeHub extends StatelessWidget {
  const _MeHub({required this.profile});

  final TeacherProfile profile;

  @override
  Widget build(BuildContext context) {
    final blocks = <Widget>[
      _ProfileSummaryCard(profile: profile),
      const _PlanUsageSection(),
      _DefaultsSection(profile: profile),
      const _PrivacySettingsSection(),
    ];

    return ListView(
      padding: AppSpacing.pagePadding,
      children: [
        for (final (index, block) in blocks.indexed) ...[
          if (index > 0) const SizedBox(height: AppSpacing.space8),
          inkSettle(context, block, index: index),
        ],
      ],
    );
  }
}

// --------------------------------------------------------------- (a) header

/// The read-only identity summary: who the teacher is + their plan, tapping
/// through to the full editor (`Routes.profile`). v3 screen 16 draws it as a
/// BARE header on the wash (glass avatar, name, one muted line) rather than a
/// card; the chevron + press signal that the block is still the way in to
/// editing, so the hub needs no separate "Edit" affordance.
class _ProfileSummaryCard extends StatelessWidget {
  const _ProfileSummaryCard({required this.profile});

  final TeacherProfile profile;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final text = theme.textTheme;
    final isDark = theme.brightness == Brightness.dark;

    final name = profile.displayName?.trim();
    final displayName =
        (name != null && name.isNotEmpty) ? name : l10n.profileNoName;
    final subtitle = _roleAndSchool(l10n, profile);
    final board = profile.settings.educationBoard;
    final language = profile.preferredLanguage;
    // 11px muted line on the wash — legible in both themes without a card
    // behind it (the spec's #5C534A is exactly `ink600`).
    final subColor = isDark ? AppColors.dMutedForeground : AppColors.ink600;

    // v3 screen 16 "You": a BARE header on the wash — glass avatar, name, one
    // muted line — not a card. The whole block stays the way in to the editor,
    // so the hub still needs no separate "Edit" affordance.
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.push(Routes.profile),
        borderRadius: AppRadius.rCard,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.space2),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  _InitialAvatar(name: name),
                  const SizedBox(width: AppSpacing.space3),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          displayName,
                          style: text.displaySmall?.copyWith(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          subtitle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: text.bodySmall?.copyWith(
                            fontSize: 12,
                            color: subColor,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.space2),
                  Icon(
                    LucideIcons.chevronRight,
                    size: AppIconSize.inline,
                    color: subColor,
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.space3),
              // Wrap, not Row: at textScale 1.3 in Malayalam the badge and
              // chips cannot share one line on a 360dp screen.
              Wrap(
                spacing: AppSpacing.space2,
                runSpacing: AppSpacing.space2,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  const PlanBadgeChip(),
                  if (board != null)
                    AppBadge(label: board, size: AppBadgeSize.small),
                  if (language != null)
                    AppBadge(
                      label: language.nativeLabel,
                      size: AppBadgeSize.small,
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// "{role} · {school}" — the teacher's hat and where they wear it. Role falls
/// back to plain "Teacher" (never an empty line), and school is dropped when
/// unset rather than leaving a dangling separator.
String _roleAndSchool(AppLocalizations l10n, TeacherProfile profile) {
  final role = profile.settings.administrativeRole;
  final roleLabel = role == null ? l10n.meRoleTeacher : _roleLabel(l10n, role);
  final school = profile.schoolName?.trim();
  if (school == null || school.isEmpty) return roleLabel;
  return '$roleLabel · $school';
}

/// A 44dp glass circle showing the teacher's initials (up to two, taken by rune
/// so an Indic name shows its base characters rather than split code units), or
/// the user glyph when they have no name yet. Fill and ring are the shared glass
/// tokens — the spec's `rgba(255,255,255,.86)` / `.95` are [AppGlass.lFlatFill]
/// / [AppGlass.lBorderColor]; the glyphs use the muted ink token, which the spec
/// itself sets (#5C534A = `ink600`).
class _InitialAvatar extends StatelessWidget {
  const _InitialAvatar({required this.name});

  final String? name;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final initials = _initialsOf(name);
    final fg = isDark ? AppColors.dMutedForeground : AppColors.ink600;

    return Container(
      width: 56,
      height: 56,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: isDark ? AppGlass.dFlatFill : AppGlass.lFlatFill,
        border: Border.all(
          color: isDark ? AppGlass.dBorderColor : AppGlass.lBorderColor,
          width: 1,
        ),
        boxShadow: isDark ? AppShadows.cardDark : AppShadows.cardLight,
      ),
      child: initials == null
          ? Icon(LucideIcons.user, size: AppIconSize.inline, color: fg)
          : Text(
              initials,
              style: theme.textTheme.titleSmall?.copyWith(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: fg,
              ),
            ),
    );
  }
}

/// "Meena Kulkarni" → "MK"; a single-word name → its first letter ("Lakshmi" →
/// "L"). Each initial is taken from the first RUNE of its word (never
/// `substring`), so an Indic or astral character is never split in half.
String? _initialsOf(String? name) {
  final trimmed = name?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;

  final words = trimmed
      .split(RegExp(r'\s+'))
      .where((word) => word.isNotEmpty)
      .take(2);

  final buffer = StringBuffer();
  for (final word in words) {
    buffer.write(String.fromCharCode(word.runes.first).toUpperCase());
  }
  final initials = buffer.toString();
  return initials.isEmpty ? null : initials;
}

// ----------------------------------------------------------- (b) plan & usage

/// Plan & usage. Watches [usageSummaryProvider] with its OWN loading / error /
/// data — the hub-wide auth gate lives on the profile read above, so a usage
/// hiccup while signed in degrades only this section, never the whole hub.
class _PlanUsageSection extends ConsumerWidget {
  const _PlanUsageSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final usage = ref.watch(usageSummaryProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        EditorialSectionHeader(l10n.mePlanUsageTitle),
        const SizedBox(height: AppSpacing.space4),
        usage.when(
          loading: () => const AppCard(child: AppSkeleton(lines: 4)),
          error: (_, _) => AppCard(
            child: ErrorView(
              message: l10n.meUsageUnavailable,
              onRetry: () => ref.invalidate(usageSummaryProvider),
            ),
          ),
          data: (summary) => _UsageCard(summary: summary),
        ),
      ],
    );
  }
}

class _UsageCard extends StatelessWidget {
  const _UsageCard({required this.summary});

  final UsageSummary summary;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  l10n.mePlanUsageSubtitle,
                  style: text.bodyMedium
                      ?.copyWith(color: scheme.onSurfaceVariant),
                ),
              ),
              const SizedBox(width: AppSpacing.space3),
              AppBadge(
                label: _planLabel(l10n, summary.plan),
                icon: summary.plan.isPaid ? LucideIcons.sparkles : null,
                tone: summary.plan.isPaid
                    ? AppBadgeTone.accent
                    : AppBadgeTone.neutral,
                size: AppBadgeSize.small,
              ),
            ],
          ),
          for (final feature in summary.features) ...[
            const SizedBox(height: AppSpacing.space5),
            _UsageRow(
              key: ValueKey<String>('usage-row-${feature.feature}'),
              feature: feature,
            ),
          ],
        ],
      ),
    );
  }
}

/// One feature's line: its name, its `used / limit` (or "Unlimited"), and — only
/// when it is genuinely metered — the meter. The number is the non-colour
/// signifier that pairs with the bar (WCAG 1.4.1).
class _UsageRow extends StatelessWidget {
  const _UsageRow({super.key, required this.feature});

  final FeatureUsage feature;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final extras = AppTextExtras.of(context);

    final name = _featureLabel(l10n, feature.feature);
    final valueLabel = feature.isUnlimited
        ? l10n.meUsageUnlimited
        : l10n.meUsageValue(feature.used, feature.limit);

    // The bar is otherwise a silent decoration next to a bare number. Collapse
    // the whole row (name + value + meter) into ONE labelled node so a screen
    // reader announces "Lesson plans, 3 / 10" rather than reading the visual
    // fragments — or leaving the meter unspoken.
    return Semantics(
      container: true,
      label: '$name, $valueLabel',
      child: ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: Text(name, style: text.bodyLarge)),
                const SizedBox(width: AppSpacing.space3),
                Text(
                  valueLabel,
                  style: extras.dataMedium
                      .copyWith(color: scheme.onSurfaceVariant),
                ),
              ],
            ),
            if (feature.isMetered) ...[
              const SizedBox(height: AppSpacing.space2),
              _UsageMeter(
                key: ValueKey<String>('usage-meter-${feature.feature}'),
                fraction: feature.fraction,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// An honest usage bar: a track with a filled portion sized by [fraction]. No
/// `LinearProgressIndicator` styling hacks — a track [ColoredBox] under a
/// [FractionallySizedBox] fill, tokens only.
///
/// AA (WCAG 1.4.11, computed vs the ACTUAL fill): the fill is the saffron-text
/// token — `#AC4815` light / `#EB9447` dark — NOT the `#E0924D` brand FILL,
/// which is only ~2:1 on the track. Saffron-text on `surfaceContainerHigh` is
/// 4.7:1 (light) / 5.6:1 (dark), clearing the 3:1 non-text floor; and the
/// `used / limit` number carries the value non-colour too. Static (no sweep),
/// so it is reduce-motion safe by construction.
class _UsageMeter extends StatelessWidget {
  const _UsageMeter({super.key, required this.fraction});

  final double fraction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final fill = theme.brightness == Brightness.dark
        ? AppColors.dPrimaryText
        : AppColors.lPrimaryText;

    return SizedBox(
      height: AppSpacing.space2,
      child: DecoratedBox(
        // A 1px outline gives the track a visible extent on the white card: its
        // surfaceContainerHigh fill alone is only ~1.2:1 on white, so a nearly
        // empty bar would read as nothing. `outline` (not the lighter
        // `outlineVariant`, which sits ABOVE the track tone and would vanish)
        // draws the hairline.
        decoration: BoxDecoration(
          color: scheme.surfaceContainerHigh,
          borderRadius: AppRadius.rSm,
          border: Border.all(color: scheme.outline, width: 1),
        ),
        child: ClipRRect(
          borderRadius: AppRadius.rSm,
          child: Stack(
            fit: StackFit.expand,
            children: [
              FractionallySizedBox(
                alignment: AlignmentDirectional.centerStart,
                widthFactor: fraction.clamp(0.0, 1.0),
                child: ColoredBox(color: fill),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// --------------------------------------------------------------- (c) defaults

/// The defaults that shape the material SahayakAI makes: the education board
/// (a link into the editor, which owns the picker) and the app language (the
/// shared [LanguageSwitcher], which is also the AI `language` source of truth).
class _DefaultsSection extends StatelessWidget {
  const _DefaultsSection({required this.profile});

  final TeacherProfile profile;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final board = profile.settings.educationBoard;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        EditorialSectionHeader(l10n.meDefaultsTitle),
        const SizedBox(height: AppSpacing.space4),
        AppCard(
          padding: EdgeInsets.zero,
          child: _HubRow(
            icon: LucideIcons.landmark,
            label: l10n.settingsBoardLabel,
            value: board ?? l10n.settingsBoardNone,
            onTap: () => context.push(Routes.profile),
          ),
        ),
        const SizedBox(height: AppSpacing.space3),
        const AppCard(padding: EdgeInsets.zero, child: LanguageSwitcher()),
      ],
    );
  }
}

// ------------------------------------------------------- (d) privacy & settings

/// The account rows: Settings (the real screen — notifications, appearance,
/// teaching profile, delete account) and Sign out. Each links to something that
/// already exists; nothing here is a fabricated destination.
class _PrivacySettingsSection extends ConsumerWidget {
  const _PrivacySettingsSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final hand = ref.watch(
      vidyaOrbPlacementControllerProvider.select((p) => p.hand),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        EditorialSectionHeader(l10n.mePrivacyTitle),
        const SizedBox(height: AppSpacing.space4),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _HubRow(
                icon: LucideIcons.settings,
                label: l10n.settingsTitle,
                onTap: () => context.push(Routes.settings),
              ),
              // Bare Divider inherits DividerTheme (outline@0.6, 1px, space 1).
              const Divider(),
              _OrbHandRow(hand: hand),
              const Divider(),
              const _SignOutRow(),
            ],
          ),
        ),
      ],
    );
  }
}

/// v3 screen 16's "Orb on the left hand" line: which side VIDYA's floating orb
/// parks under, shown as its current value. It LINKS to Settings — which owns
/// the switch — rather than flipping it here, so one setting stays one control.
class _OrbHandRow extends StatelessWidget {
  const _OrbHandRow({required this.hand});

  final VidyaHand hand;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return _HubRow(
      icon: LucideIcons.hand,
      label: l10n.settingsOrbHandTitle,
      value: hand == VidyaHand.left
          ? l10n.onboardingHandLeft
          : l10n.onboardingHandRight,
      onTap: () => context.push(Routes.settings),
    );
  }
}

/// Sign out flips the auth state the router's redirect guard reads. No chevron:
/// it is an action, not a step into another screen.
class _SignOutRow extends ConsumerWidget {
  const _SignOutRow();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _HubRow(
      icon: LucideIcons.logOut,
      label: context.l10n.actionSignOut,
      showChevron: false,
      onTap: () => ref.read(authControllerProvider.notifier).signOut(),
    );
  }
}

/// One hub row: a shared [IconWell] (which floors the row past 48dp), a label,
/// an optional value line, and (for navigation) a chevron. A [ListTile] so it
/// carries the M3 ripple, semantics and the >=48dp target for free.
class _HubRow extends StatelessWidget {
  const _HubRow({
    required this.icon,
    required this.label,
    required this.onTap,
    this.value,
    this.showChevron = true,
  });

  final IconData icon;
  final String label;
  final String? value;
  final VoidCallback onTap;
  final bool showChevron;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return ListTile(
      onTap: onTap,
      shape: const RoundedRectangleBorder(borderRadius: AppRadius.rRow),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.space4,
        vertical: AppSpacing.space3,
      ),
      leading: IconWell(icon: icon),
      title: Text(label, style: text.titleMedium),
      subtitle: value == null
          ? null
          : Text(
              value!,
              style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
            ),
      trailing: showChevron
          ? Icon(
              LucideIcons.chevronRight,
              size: AppIconSize.inline,
              color: scheme.onSurfaceVariant,
            )
          : null,
    );
  }
}

/// The signed-out hub: a sign-in prompt, no faked identity. Mirrors the editor's
/// and Settings' signed-out card so all three account surfaces answer "you are
/// signed out" identically.
class _SignedOutCard extends StatelessWidget {
  const _SignedOutCard();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return AppCard(
      accentBar: true,
      child: EmptyView(
        icon: LucideIcons.logIn,
        title: l10n.profileSignedOutTitle,
        message: l10n.profileSignedOutBody,
        action: FilledButton(
          onPressed: () => context.go(Routes.loginWithReturnTo(Routes.settings)),
          child: Text(l10n.settingsSignIn),
        ),
      ),
    );
  }
}

// ------------------------------------------------------------------- labels

/// Exhaustive on purpose: a new tier will not compile until it has copy. Reuses
/// the existing `profilePlan*` strings so the badge here reads identically to
/// the identity badge.
String _planLabel(AppLocalizations l10n, PlanBadge plan) {
  return switch (plan) {
    PlanBadge.free => l10n.profilePlanFree,
    PlanBadge.pro => l10n.profilePlanPro,
    PlanBadge.gold => l10n.profilePlanGold,
    PlanBadge.premium => l10n.profilePlanPremium,
    PlanBadge.unknown => l10n.profilePlanUnknown,
  };
}

/// Shares the editor's role wording — it is the same question.
String _roleLabel(AppLocalizations l10n, AdministrativeRole role) {
  return switch (role) {
    AdministrativeRole.hod => l10n.settingsRoleHod,
    AdministrativeRole.coordinator => l10n.settingsRoleCoordinator,
    AdministrativeRole.examController => l10n.settingsRoleExamController,
    AdministrativeRole.vicePrincipal => l10n.settingsRoleVicePrincipal,
    AdministrativeRole.principal => l10n.settingsRolePrincipal,
    AdministrativeRole.none => l10n.settingsRoleNone,
  };
}

/// A feature's teacher-facing name. Reuses the existing tool titles for every
/// feature that IS a tool (one name, one place to translate it) and adds copy
/// only for the three capabilities that are not tools. An unknown server key
/// humanizes rather than crashing the render.
String _featureLabel(AppLocalizations l10n, String feature) {
  return switch (feature) {
    'lesson-plan' => l10n.lessonPlanTitle,
    'quiz' => l10n.quizTitle,
    'worksheet' => l10n.worksheetTitle,
    'rubric' => l10n.rubricTitle,
    'instant-answer' => l10n.instantAnswerTitle,
    'teacher-training' => l10n.teacherTrainingTitle,
    'virtual-field-trip' => l10n.virtualFieldTripTitle,
    'visual-aid' => l10n.visualAidTitle,
    'exam-paper' => l10n.examPaperTitle,
    'assess-assignment' => l10n.assessTitle,
    'assessment-scanner' => l10n.assessmentScannerTitle,
    'parent-message' => l10n.parentMessageTitle,
    'avatar' => l10n.usageFeatureAvatar,
    'voice-to-text' => l10n.usageFeatureVoiceToText,
    'assistant' => l10n.usageFeatureAssistant,
    _ => _humanize(feature),
  };
}

String _humanize(String key) => key
    .split('-')
    .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
    .join(' ');
