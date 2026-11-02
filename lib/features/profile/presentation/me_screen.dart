import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/locale_provider.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/domain/picker_options.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/language_switcher.dart';
import '../../../shared/widgets/map_card.dart';
import '../../../shared/widgets/map_toggle.dart';
import '../../../shared/widgets/secondary_button.dart';
import '../../vidya/presentation/vidya_orb_placement_controller.dart';
import '../data/usage_repository.dart';
import '../domain/plan_badge.dart';
import '../domain/teacher_profile.dart';
import 'profile_controller.dart';

/// The Profile tab, drawn to the UX map's "Me" screen (VIDYA 16 · App board
/// E3): who the teacher is, what they made this month against their plan, the
/// settings they reach for, and Sign out.
///
/// COMPOSES what already exists rather than duplicating it: the identity and
/// the board come from the ONE profile reader ([profileControllerProvider],
/// shared with the full editor and Settings); the language row opens the
/// shared language picker; the orb toggle writes the same placement setting
/// Settings does; usage is [usageSummaryProvider] (`GET /api/usage`).
///
/// AUTH GATE: the hub is gated on the profile read, exactly as the editor and
/// Settings are. A 401 degrades the WHOLE hub to a sign-in prompt: no faked
/// identity, and the usage read is never fired (it is watched only inside the
/// data branch).
class MeScreen extends ConsumerWidget {
  const MeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileControllerProvider);

    // No app bar: the map opens on the teacher. The wash comes from
    // AppBackground (app.dart), as on the other tabs.
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        bottom: false,
        child: profile.when(
          loading: () => const Padding(
            padding: _frame,
            child: MapCard(child: AppSkeleton(lines: 6)),
          ),
          error: (error, _) => _MeError(
            error: error,
            onRetry: () =>
                ref.read(profileControllerProvider.notifier).refresh(),
          ),
          // A brand-new teacher has no document, which is an EMPTY profile: a
          // valid, supported hub, not an error.
          data: (data) => _MeHub(profile: data),
        ),
      ),
    );
  }
}

/// The map's screen frame.
const EdgeInsets _frame = EdgeInsets.fromLTRB(
  AppSpacing.mapGutter,
  AppSpacing.space4,
  AppSpacing.mapGutter,
  AppSpacing.mapBottomClearance,
);

/// The profile read failed. Which state this is depends on WHY, so it branches
/// on the typed [ApiException] kind: the same three answers the editor and
/// Settings give for the same read.
class _MeError extends StatelessWidget {
  const _MeError({required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final kind = error is ApiException ? (error as ApiException).kind : null;

    // No identity: the whole hub is a sign-in prompt. "Try again" would be a
    // lie; the read cannot succeed until the teacher signs in.
    if (kind == ApiErrorKind.unauthorized) {
      return const SingleChildScrollView(
        padding: _frame,
        child: _SignedOutCard(),
      );
    }
    // Rural connectivity is intermittent: an expected failure with its own
    // copy and retry (the map's saffron "Working offline" card).
    if (kind == ApiErrorKind.network || kind == ApiErrorKind.timeout) {
      return SingleChildScrollView(
        padding: _frame,
        child: _OfflineCard(onRetry: onRetry),
      );
    }
    return SingleChildScrollView(
      padding: _frame,
      child: MapCard(
        child: ErrorView(
          message: context.l10n.profileLoadFailed,
          onRetry: onRetry,
        ),
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
    final titleColor = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;
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

/// The composed hub, in the map's order: who, this month, settings, sign out.
class _MeHub extends StatelessWidget {
  const _MeHub({required this.profile});

  final TeacherProfile profile;

  @override
  Widget build(BuildContext context) {
    final blocks = <Widget>[
      _Identity(profile: profile),
      const _ThisMonthCard(),
      _SettingsCard(profile: profile),
      const _SignOutButton(),
    ];

    return ListView(
      padding: _frame,
      children: [
        for (final (index, block) in blocks.indexed) ...[
          if (index > 0) const SizedBox(height: AppSpacing.space3),
          inkSettle(context, block, index: index),
        ],
      ],
    );
  }
}

// ------------------------------------------------------------------ identity

/// The map's identity row: a 58px initials avatar, the name, and "role ·
/// school". The whole row opens the full profile editor; its chevron says so.
class _Identity extends StatelessWidget {
  const _Identity({required this.profile});

  final TeacherProfile profile;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final name = profile.displayName?.trim();
    final displayName = (name != null && name.isNotEmpty)
        ? name
        : l10n.profileNoName;

    return Semantics(
      button: true,
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: () => context.push(Routes.profile),
          borderRadius: AppRadius.rCard,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.space1),
            child: Row(
              children: [
                _InitialAvatar(name: name),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        displayName,
                        style: text.displayLarge?.copyWith(
                          fontSize: 19,
                          color: AppColors.textStrong,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _roleAndSchool(l10n, profile),
                        style: text.bodyLarge?.copyWith(
                          fontSize: 13,
                          color: AppColors.textBody,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.space2),
                const Icon(
                  LucideIcons.chevronRight,
                  size: AppIconSize.inline,
                  color: AppColors.textMuted,
                ),
              ],
            ),
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

/// The map's `.av.w` avatar: a 58px white disc with a hairline ring and the
/// teacher's initials, or the user glyph when they have no name yet.
class _InitialAvatar extends StatelessWidget {
  const _InitialAvatar({required this.name});

  final String? name;

  @override
  Widget build(BuildContext context) {
    final initials = _initialsOf(name);
    return Container(
      width: 58,
      height: 58,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white,
        border: Border.all(color: AppColors.borderHairline),
      ),
      child: initials == null
          ? const Icon(
              LucideIcons.user,
              size: AppIconSize.inline,
              color: AppColors.textBody,
            )
          : Text(
              initials,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.textBody,
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

// ---------------------------------------------------------------- this month

/// "This month": the plan pill, what the teacher made and how often they asked
/// VIDYA (both straight from `/api/usage`, never estimated), then one slim bar
/// per metered tool. Watches [usageSummaryProvider] with its OWN states, so a
/// usage hiccup degrades only this card, never the hub.
class _ThisMonthCard extends ConsumerWidget {
  const _ThisMonthCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final usage = ref.watch(usageSummaryProvider);
    return usage.when(
      loading: () => const MapCard(child: AppSkeleton(lines: 4)),
      error: (_, _) => MapCard(
        child: ErrorView(
          message: l10n.meUsageUnavailable,
          onRetry: () => ref.invalidate(usageSummaryProvider),
        ),
      ),
      data: (summary) => _UsageCard(summary: summary),
    );
  }
}

/// The features that are VIDYA conversation, not things made.
const Set<String> _voiceFeatures = {'voice-to-text', 'assistant'};

class _UsageCard extends StatelessWidget {
  const _UsageCard({required this.summary});

  final UsageSummary summary;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final made = summary.features
        .where((f) => !_voiceFeatures.contains(f.feature))
        .fold<int>(0, (sum, f) => sum + f.used);
    final asked = summary.features
        .where((f) => f.feature == 'assistant')
        .fold<int>(0, (sum, f) => sum + f.used);
    final metered = [
      for (final f in summary.features)
        if (f.isMetered) f,
    ];
    // The map's one bar: everything metered, used against everything allowed.
    final usedOfPlan = metered.fold<int>(0, (sum, f) => sum + f.used);
    final planLimit = metered.fold<int>(0, (sum, f) => sum + f.limit);
    // Per-tool detail only for tools actually used: eleven empty bars would
    // say nothing the overall bar does not.
    final used = [
      for (final f in metered)
        if (f.used > 0) f,
    ];

    return MapCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(child: MapOverline(l10n.meThisMonth)),
              _PlanPill(label: l10n.mePlanName(_planLabel(l10n, summary.plan))),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _Stat(value: '$made', label: l10n.meStatMade),
              ),
              Expanded(
                child: _Stat(value: '$asked', label: l10n.meStatAskedVidya),
              ),
            ],
          ),
          if (planLimit > 0) ...[
            const SizedBox(height: AppSpacing.space4),
            _UsageLine(
              key: const ValueKey<String>('usage-overall'),
              label: l10n.mePlanUsageSubtitle,
              used: usedOfPlan,
              limit: planLimit,
              muted: true,
            ),
          ],
          for (final feature in used) ...[
            const SizedBox(height: AppSpacing.space4),
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

/// The map's `.pill.p-sf`: the plan in a saffron tint.
class _PlanPill extends StatelessWidget {
  const _PlanPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 24,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: const ShapeDecoration(
        color: AppColors.tileSaffronBg,
        shape: StadiumBorder(),
      ),
      child: Center(
        widthFactor: 1,
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.accentFill,
          ),
        ),
      ),
    );
  }
}

/// One of the map's big numbers: the figure in the display face over its
/// muted label, read out as one phrase.
class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Semantics(
      container: true,
      label: '$value $label',
      child: ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: text.displayLarge?.copyWith(
                fontSize: 22,
                color: AppColors.textStrong,
              ),
            ),
            Text(
              label,
              style: text.bodyMedium?.copyWith(color: AppColors.textMuted),
            ),
          ],
        ),
      ),
    );
  }
}

/// One metered tool, as a [_UsageLine] named for the tool.
class _UsageRow extends StatelessWidget {
  const _UsageRow({super.key, required this.feature});

  final FeatureUsage feature;

  @override
  Widget build(BuildContext context) => _UsageLine(
    label: _featureLabel(context.l10n, feature.feature),
    used: feature.used,
    limit: feature.limit,
    meterKey: ValueKey<String>('usage-meter-${feature.feature}'),
  );
}

/// A label and its `used / limit` over the map's 8px bar. The number is the
/// non-colour signifier that pairs with the bar (WCAG 1.4.1), and the line
/// reads as one phrase ("Lesson plans, 3 / 10").
class _UsageLine extends StatelessWidget {
  const _UsageLine({
    super.key,
    required this.label,
    required this.used,
    required this.limit,
    this.muted = false,
    this.meterKey,
  });

  final String label;
  final int used;
  final int limit;

  /// The overall line's label is muted copy, not a tool name.
  final bool muted;
  final Key? meterKey;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final valueLabel = context.l10n.meUsageValue(used, limit);

    return Semantics(
      container: true,
      label: '$label, $valueLabel',
      child: ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    label,
                    style: text.bodyMedium?.copyWith(
                      color: muted ? AppColors.textMuted : AppColors.textStrong,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.space3),
                Text(
                  valueLabel,
                  style: text.bodyMedium?.copyWith(color: AppColors.textMuted),
                ),
              ],
            ),
            const SizedBox(height: 6),
            _UsageBar(key: meterKey, fraction: limit <= 0 ? 0 : used / limit),
          ],
        ),
      ),
    );
  }
}

/// The map's `.bar`: an 8px pill track with a saffron fill sized by
/// [fraction]. The fill is the saffron-text token, legible against the track
/// as a non-text indicator; static, so reduce-motion safe by construction.
class _UsageBar extends StatelessWidget {
  const _UsageBar({super.key, required this.fraction});

  final double fraction;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: AppRadius.rPill,
      child: SizedBox(
        height: 8,
        child: ColoredBox(
          color: AppColors.mapBarTrack,
          child: FractionallySizedBox(
            alignment: AlignmentDirectional.centerStart,
            widthFactor: fraction.clamp(0.0, 1.0),
            child: const DecoratedBox(
              decoration: BoxDecoration(
                color: AppColors.accentFill,
                borderRadius: AppRadius.rPill,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ------------------------------------------------------------------ settings

/// The map's settings card: plain rows over hairlines. Every row leads to
/// something that exists; the orb toggle writes the same setting Settings does.
class _SettingsCard extends ConsumerWidget {
  const _SettingsCard({required this.profile});

  final TeacherProfile profile;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final language = ref.watch(localeControllerProvider);
    final hand = ref.watch(
      vidyaOrbPlacementControllerProvider.select((p) => p.hand),
    );
    final board = profile.settings.educationBoard;

    final rows = <Widget>[
      _SettingsRow(
        label: '${l10n.languageLabel} · ${language.nativeLabel}',
        trailing: _ChangeLink(label: l10n.meChange),
        onTap: () => showLanguagePickerSheet(context, ref),
      ),
      _SettingsRow(
        label:
            '${l10n.settingsBoardLabel} · ${board ?? l10n.settingsBoardNone}',
        trailing: _ChangeLink(label: l10n.meChange),
        onTap: () => context.push(Routes.profile),
      ),
      _SettingsRow(
        label: l10n.meOrbLeftHand,
        // The toggle's 48dp cell overhangs its 44px track; pull it in so its
        // edge lines up with the chevrons and links above and below.
        trailing: Padding(
          padding: const EdgeInsetsDirectional.only(end: 4),
          child: MapToggle(
            value: hand == VidyaHand.left,
            label: l10n.meOrbLeftHand,
            onChanged: (left) => ref
                .read(vidyaOrbPlacementControllerProvider.notifier)
                .setHand(left ? VidyaHand.left : VidyaHand.right),
          ),
        ),
      ),
      _SettingsRow(
        label: l10n.settingsTitle,
        trailing: const _Chevron(),
        onTap: () => context.push(Routes.settings),
      ),
      _SettingsRow(
        label: l10n.mePrivacyForTeachers,
        trailing: const _Chevron(),
        onTap: () => context.push(Routes.privacyForTeachers),
      ),
    ];

    return MapCard(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Column(
        children: [
          for (final (index, row) in rows.indexed) ...[
            if (index > 0)
              const Divider(
                height: 1,
                thickness: 1,
                indent: 14,
                endIndent: 14,
                color: AppColors.borderHairline,
              ),
            row,
          ],
        ],
      ),
    );
  }
}

/// One settings row: the label and its trailing control. With [onTap] the
/// whole row is the target; without it the trailing control is.
class _SettingsRow extends StatelessWidget {
  const _SettingsRow({required this.label, required this.trailing, this.onTap});

  final String label;
  final Widget trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final row = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 48),
      child: Padding(
        padding: const EdgeInsetsDirectional.only(start: 14, end: 8),
        child: Row(
          children: [
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 11),
                child: Text(
                  label,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    fontSize: 14,
                    color: AppColors.textStrong,
                  ),
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.space2),
            trailing,
          ],
        ),
      ),
    );
    if (onTap == null) return row;
    return Semantics(
      button: true,
      child: InkWell(onTap: onTap, child: row),
    );
  }
}

/// The map's `.link`: saffron, 13px, semibold. The row carries the tap.
class _ChangeLink extends StatelessWidget {
  const _ChangeLink({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.only(end: 6),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: AppColors.textLink,
        ),
      ),
    );
  }
}

class _Chevron extends StatelessWidget {
  const _Chevron();

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsetsDirectional.only(end: 6),
    child: Icon(
      LucideIcons.chevronRight,
      size: AppIconSize.inline,
      color: AppColors.textMuted,
    ),
  );
}

// ------------------------------------------------------------------ sign out

/// The map's white button (`.btn.w`): a 52px pill with a hairline. Sign out
/// flips the auth state the router's redirect guard reads.
class _SignOutButton extends ConsumerWidget {
  const _SignOutButton();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Material(
      color: Colors.white,
      shape: const StadiumBorder(
        side: BorderSide(color: AppColors.borderHairline),
      ),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: () => ref.read(authControllerProvider.notifier).signOut(),
        child: SizedBox(
          height: 52,
          child: Center(
            child: Text(
              context.l10n.actionSignOut,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.textStrong,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The signed-out hub: a sign-in prompt, no faked identity. Mirrors the
/// editor's and Settings' answer to "you are signed out".
class _SignedOutCard extends StatelessWidget {
  const _SignedOutCard();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return MapCard(
      child: MapEmptyNote(
        icon: LucideIcons.logIn,
        title: l10n.profileSignedOutTitle,
        message: l10n.profileSignedOutBody,
        action: FilledButton(
          onPressed: () =>
              context.go(Routes.loginWithReturnTo(Routes.settings)),
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
