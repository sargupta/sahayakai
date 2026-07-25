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
import '../../../core/theme/theme_mode_provider.dart';
import '../../../shared/domain/picker_options.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/glass_app_bar.dart';
import '../../../shared/widgets/inline_error.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/language_switcher.dart';
import '../../../shared/widgets/offline_view.dart';
import '../../profile/domain/profile_settings.dart';
import '../../profile/domain/teacher_profile.dart';
import '../../profile/presentation/profile_controller.dart';
import '../data/notification_prefs_provider.dart';
import 'settings_controller.dart';
import 'widgets/delete_account_dialog.dart';

/// P0.7 — Settings, re-skinned to the Ledger premium system (U11).
///
/// SHELL CHOICE: a plain `Scaffold` + `AppBar`, NOT [ToolScaffold].
/// ToolScaffold's grammar is "capped scrolling form + sticky submit button +
/// ResultView underneath" — it exists because every AI tool is one request with
/// one result. Settings has no request and no result: it is a list of
/// independent controls, most of which commit the instant they are touched
/// (theme, language, notifications). A sticky global submit would be a lie
/// about what saves when, and the ResultView slot would sit empty forever. So
/// this uses the app's other, equally-established shell — the one
/// `ProfileScreen` and `LibraryScreen` use: `Scaffold` + `AppBar` + a
/// page-padded `ListView` of premium groups. Each group opens with an
/// [EditorialSectionHeader] (a saffron tracked eyebrow + a hairline rule, §5)
/// over an [AppCard], and the register inks in on a staggered entrance.
///
/// Sections are ordered by who can use them: appearance, language and
/// notifications are device preferences that work signed out, so they come
/// first and always render. The account sections (teaching profile, delete
/// account) need an identity, so they are replaced by a sign-in prompt card
/// when signed out.
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  /// The teacher's UNSAVED edits, or null when they have not touched the form.
  ///
  /// Deliberately an overlay rather than a copy seeded on load: the form's
  /// values come from [profileControllerProvider] — the ONE reader of
  /// `users/<uid>`, the same one Profile renders — and this only shadows it once
  /// there is something to shadow. Settings used to hold a bare
  /// `ProfileSettings()` and never read the document at all, so a teacher who
  /// set their board on Profile opened Settings and was told "Not set" about
  /// their own answer.
  ProfileSettings? _edited;

  /// What the form is showing: the teacher's edits if any, else the document.
  ProfileSettings _effective(TeacherProfile doc) => _edited ?? doc.settings;

  Future<void> _saveProfile(ProfileSettings settings) async {
    FocusScope.of(context).unfocus();
    final saved = await ref
        .read(profileSaveControllerProvider.notifier)
        .save(settings);
    if (!mounted) return;
    if (saved) {
      // The shared read has adopted this slice, so drop the overlay and let the
      // form derive from the document again.
      setState(() => _edited = null);
      _snack(context.l10n.settingsProfileSaved);
    }
  }

  Future<void> _deleteAccount() async {
    final confirmed = await DeleteAccountDialog.show(context);
    if (confirmed != true || !mounted) return;
    await ref.read(deleteAccountControllerProvider.notifier).confirmDelete();
    if (!mounted) return;
    final state = ref.read(deleteAccountControllerProvider);
    if (!state.hasError && state.value != null) {
      _snack(context.l10n.settingsDeleteScheduled);
    }
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final signedIn = ref.watch(isSignedInProvider);

    // Every top-level group, in reading order. Device preferences first (they
    // work signed out); the account half is either the profile + danger
    // sections or, with no identity, the sign-in prompt card.
    final groups = <Widget>[
      const _ThemeSection(),
      const _LanguageSection(),
      const _NotificationSection(),
      if (signedIn) ...[
        _profileSection(l10n),
        _dangerSection(l10n),
      ] else
        const _SignedOutCard(),
    ];

    return Scaffold(
      appBar: GlassAppBar(title: Text(l10n.settingsTitle)),
      body: SafeArea(
        child: ListView(
          padding: AppSpacing.pagePadding,
          children: [
            for (final (index, group) in groups.indexed) ...[
              if (index > 0) const SizedBox(height: AppSpacing.space8),
              // The register inks in block-by-block (§4); reduce-motion returns
              // the static composed frame.
              inkSettle(context, group, index: index),
            ],
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------- profile

  Widget _profileSection(AppLocalizations l10n) {
    return _SettingsGroup(
      title: l10n.settingsProfileTitle,
      // The form cannot be shown until the document is known. Rendering an
      // empty one over a failed read would repeat the original bug in a new
      // place: it would say "Not set" about a field this build never read, and
      // a Save from it would send `qualifications: []` — a real, silent wipe of
      // whatever the teacher had set on Profile, because an empty list is a
      // meaningful value on the wire (see ProfileSettingsPatchDto).
      child: ref
          .watch(profileControllerProvider)
          .when(
            loading: () => const AppCard(child: AppSkeleton(lines: 4)),
            error: (error, _) => _ProfileReadError(
              error: error,
              onRetry: () =>
                  ref.read(profileControllerProvider.notifier).refresh(),
            ),
            data: (doc) => _profileForm(l10n, _effective(doc)),
          ),
    );
  }

  Widget _profileForm(AppLocalizations l10n, ProfileSettings profile) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final saveState = ref.watch(profileSaveControllerProvider);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            l10n.settingsProfileHint,
            style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
          ),
          const SizedBox(height: AppSpacing.space6),
          _boardField(l10n, profile),
          const SizedBox(height: AppSpacing.space6),
          _qualificationsField(l10n, profile),
          const SizedBox(height: AppSpacing.space6),
          _adminRoleField(l10n, profile),
          if (saveState.hasError) ...[
            const SizedBox(height: AppSpacing.space4),
            InlineError(message: _saveErrorText(l10n, saveState.error)),
          ],
          const SizedBox(height: AppSpacing.space6),
          FilledButton(
            onPressed: saveState.isLoading ? null : () => _saveProfile(profile),
            child: saveState.isLoading
                ? const _ButtonSpinner()
                : Text(l10n.settingsSaveProfile),
          ),
        ],
      ),
    );
  }

  Widget _boardField(AppLocalizations l10n, ProfileSettings profile) {
    return LabeledField(
      label: l10n.settingsBoardLabel,
      leadingIcon: LucideIcons.landmark,
      child: DropdownButtonFormField<String?>(
        // Keyed on the value so a hydrate (or a refresh) rebuilds the field
        // from the document instead of stranding it on the initial value.
        key: ValueKey<String?>(profile.educationBoard),
        initialValue: profile.educationBoard,
        isExpanded: true, // long board names ellipsize instead of overflowing
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.settingsBoardNone),
          ),
          for (final board in kEducationBoards)
            DropdownMenuItem<String?>(value: board, child: Text(board)),
        ],
        onChanged: (value) => setState(
          () => _edited = profile.copyWith(
            educationBoard: value,
            clearEducationBoard: value == null,
          ),
        ),
      ),
    );
  }

  Widget _qualificationsField(AppLocalizations l10n, ProfileSettings profile) {
    return LabeledField(
      label: l10n.settingsQualificationsLabel,
      leadingIcon: LucideIcons.award,
      hint: l10n.settingsQualificationsHint,
      child: Wrap(
        spacing: AppSpacing.space2,
        runSpacing: AppSpacing.space2,
        children: [
          for (final qualification in kQualifications)
            FilterChip(
              label: Text(qualification),
              selected: profile.qualifications.contains(qualification),
              showCheckmark: false,
              // Guarantees the >=48dp target the bare chip height misses.
              materialTapTargetSize: MaterialTapTargetSize.padded,
              onSelected: (selected) => _toggleQualification(
                profile,
                qualification,
                selected: selected,
              ),
            ),
        ],
      ),
    );
  }

  void _toggleQualification(
    ProfileSettings profile,
    String qualification, {
    required bool selected,
  }) {
    final next = [...profile.qualifications];
    if (selected) {
      next.add(qualification);
    } else {
      next.remove(qualification);
    }
    setState(() => _edited = profile.copyWith(qualifications: next));
  }

  Widget _adminRoleField(AppLocalizations l10n, ProfileSettings profile) {
    return LabeledField(
      label: l10n.settingsAdminRoleLabel,
      leadingIcon: LucideIcons.briefcase,
      child: DropdownButtonFormField<AdministrativeRole?>(
        key: ValueKey<AdministrativeRole?>(profile.administrativeRole),
        initialValue: profile.administrativeRole,
        isExpanded: true,
        items: [
          DropdownMenuItem<AdministrativeRole?>(
            value: null,
            child: Text(l10n.settingsAdminRoleNone),
          ),
          for (final role in AdministrativeRole.values)
            DropdownMenuItem<AdministrativeRole?>(
              value: role,
              child: Text(_roleLabel(l10n, role)),
            ),
        ],
        onChanged: (value) => setState(
          () => _edited = profile.copyWith(
            administrativeRole: value,
            clearAdministrativeRole: value == null,
          ),
        ),
      ),
    );
  }

  // ----------------------------------------------------------------- danger

  Widget _dangerSection(AppLocalizations l10n) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final deleteState = ref.watch(deleteAccountControllerProvider);
    final scheduled = !deleteState.hasError && deleteState.value != null;

    return _SettingsGroup(
      title: l10n.settingsDangerTitle,
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              scheduled
                  ? l10n.settingsDeleteScheduled
                  : l10n.settingsDangerBody,
              style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
            ),
            if (deleteState.hasError) ...[
              const SizedBox(height: AppSpacing.space4),
              _ReauthOrErrorView(error: deleteState.error!),
            ],
            if (!scheduled) ...[
              const SizedBox(height: AppSpacing.space6),
              OutlinedButton.icon(
                // Destructive, so it is outlined-in-error rather than a filled
                // error block: it must read as dangerous without competing with
                // the saffron accent or inviting a tap.
                style: OutlinedButton.styleFrom(
                  foregroundColor: scheme.error,
                  side: BorderSide(color: scheme.error, width: 1),
                ),
                onPressed: deleteState.isLoading ? null : _deleteAccount,
                icon: deleteState.isLoading
                    ? const _ButtonSpinner()
                    : const Icon(LucideIcons.trash2, size: AppIconSize.inline),
                label: Text(l10n.settingsDeleteAction),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// One premium settings group: an [EditorialSectionHeader] (saffron eyebrow +
/// hairline rule, §5) over its content. Replaces the muted `Section` grammar so
/// every group reads editorial rather than as a weak grey label (§7.4).
class _SettingsGroup extends StatelessWidget {
  const _SettingsGroup({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        EditorialSectionHeader(title),
        const SizedBox(height: AppSpacing.space4),
        child,
      ],
    );
  }
}

/// Maps a role to its localized, teacher-facing label. Exhaustive on purpose:
/// adding a role to the enum will not compile until it has copy.
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

String _saveErrorText(AppLocalizations l10n, Object? error) {
  if (error is ApiException && error.isAuth) return l10n.instantAnswerSignIn;
  return l10n.settingsSaveFailed;
}

/// Appearance: a live theme switch. Radio rows rather than a SegmentedButton —
/// a full-width row wraps its label vertically, so three localized labels at
/// textScale 1.3 can never overflow a 360dp screen, and every row clears 48dp.
class _ThemeSection extends ConsumerWidget {
  const _ThemeSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final mode = ref.watch(themeModeControllerProvider);

    return _SettingsGroup(
      title: l10n.settingsAppearanceTitle,
      child: AppCard(
        padding: EdgeInsets.zero,
        child: RadioGroup<ThemeMode>(
          groupValue: mode,
          onChanged: (value) {
            if (value != null) {
              ref.read(themeModeControllerProvider.notifier).set(value);
            }
          },
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final entry in <(ThemeMode, String, IconData)>[
                (
                  ThemeMode.system,
                  l10n.settingsThemeSystem,
                  LucideIcons.monitor,
                ),
                (ThemeMode.light, l10n.settingsThemeLight, LucideIcons.sun),
                (ThemeMode.dark, l10n.settingsThemeDark, LucideIcons.moon),
              ])
                RadioListTile<ThemeMode>(
                  value: entry.$1,
                  title: Text(entry.$2),
                  secondary: Icon(entry.$3, size: AppIconSize.inline),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Language: reuses the shared [LanguageSwitcher] rather than growing a second
/// picker. One switcher, two consumers — picking a language flips the UI locale
/// AND the AI `language` param (via `AppLocale.aiName`) through the single
/// `LocaleController`. All 11 languages, native labels, never Hindi-only.
class _LanguageSection extends StatelessWidget {
  const _LanguageSection();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return _SettingsGroup(
      title: l10n.languageLabel,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          const AppCard(padding: EdgeInsets.zero, child: LanguageSwitcher()),
          const SizedBox(height: AppSpacing.space3),
          Text(
            l10n.settingsLanguageHint,
            style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

class _NotificationSection extends ConsumerWidget {
  const _NotificationSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final enabled = ref.watch(notificationPrefsControllerProvider);

    return _SettingsGroup(
      title: l10n.settingsNotificationsTitle,
      child: AppCard(
        padding: EdgeInsets.zero,
        child: SwitchListTile.adaptive(
          value: enabled,
          onChanged: (value) => ref
              .read(notificationPrefsControllerProvider.notifier)
              .set(enabled: value),
          title: Text(l10n.settingsNotificationsLabel, style: text.bodyLarge),
          subtitle: Text(
            l10n.settingsNotificationsHint,
            style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
          ),
        ),
      ),
    );
  }
}

/// Shown in place of the account sections when there is no identity. The device
/// preferences above stay usable, which is why this replaces only the account
/// half of the screen.
class _SignedOutCard extends StatelessWidget {
  const _SignedOutCard();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return AppCard(
      accentBar: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(
                LucideIcons.logIn,
                size: AppIconSize.inline,
                color: scheme.primary,
              ),
              const SizedBox(width: AppSpacing.space3),
              Expanded(
                child: Text(
                  l10n.settingsSignedOutTitle,
                  style: text.titleMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.space3),
          Text(
            l10n.settingsSignedOutBody,
            style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
          ),
          const SizedBox(height: AppSpacing.space6),
          FilledButton(
            onPressed: () => context.go(Routes.login),
            child: Text(l10n.settingsSignIn),
          ),
        ],
      ),
    );
  }
}

/// The `users/<uid>` read failed, so Settings cannot show the teaching-profile
/// form. Which state this is depends entirely on WHY, so it branches on the
/// typed [ApiException] kind rather than showing one catch-all apology —
/// exactly as `ProfileScreen._ProfileError` does for the same read.
class _ProfileReadError extends StatelessWidget {
  const _ProfileReadError({required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final kind = error is ApiException ? (error as ApiException).kind : null;

    // No identity: today this is every runtime read, because the token provider
    // is the P0.2 stub. Offering "Try again" here would be a lie.
    if (kind == ApiErrorKind.unauthorized) return const _SignedOutCard();

    if (kind == ApiErrorKind.network || kind == ApiErrorKind.timeout) {
      return AppCard(child: OfflineView(onRetry: onRetry));
    }
    return AppCard(
      child: ErrorView(
        message: context.l10n.profileLoadFailed,
        onRetry: onRetry,
      ),
    );
  }
}

/// A 401 from delete-account means `reauth_required`, which is a first-class
/// instruction ("sign in again, then retry within five minutes"), not a
/// failure. Anything else is a plain error. The route never returns 403 or 429
/// for this call, so there is nothing else to branch on.
class _ReauthOrErrorView extends StatelessWidget {
  const _ReauthOrErrorView({required this.error});

  final Object error;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isReauth = error is ApiException && (error as ApiException).isAuth;
    return InlineError(
      title: isReauth ? l10n.settingsReauthTitle : null,
      message: isReauth ? l10n.settingsReauthBody : l10n.settingsDeleteFailed,
    );
  }
}

/// A spinner sized to sit inside a button without changing its height.
class _ButtonSpinner extends StatelessWidget {
  const _ButtonSpinner();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 18,
      height: 18,
      child: CircularProgressIndicator(strokeWidth: 2),
    );
  }
}
