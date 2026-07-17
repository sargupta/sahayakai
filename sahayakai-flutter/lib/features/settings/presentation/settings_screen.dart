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
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/language_switcher.dart';
import '../../profile/domain/profile_settings.dart';
import '../data/notification_prefs_provider.dart';
import 'settings_controller.dart';
import 'widgets/delete_account_dialog.dart';

/// P0.7 — Settings.
///
/// SHELL CHOICE: a plain `Scaffold` + `AppBar`, NOT [ToolScaffold].
/// ToolScaffold's grammar is "capped scrolling form + sticky submit button +
/// ResultView underneath" — it exists because every AI tool is one request with
/// one result. Settings has no request and no result: it is a list of
/// independent controls, most of which commit the instant they are touched
/// (theme, language, notifications). A sticky global submit would be a lie
/// about what saves when, and the ResultView slot would sit empty forever. So
/// this uses the app's other, equally-established shell — the one
/// `ProfileScreen` and `LibraryScreen` already use: `Scaffold` + `AppBar` + a
/// page-padded `ListView` of [AppCard] sections. Card grammar, spacing and
/// tokens are unchanged, so it still reads as the same app.
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
  // Local form state for the profile slice. There is no profile READ wired yet
  // (that is P0.8 + Firebase), so these start empty rather than pretending to
  // hydrate from a doc we cannot fetch.
  ProfileSettings _profile = const ProfileSettings();

  Future<void> _saveProfile() async {
    FocusScope.of(context).unfocus();
    final saved =
        await ref.read(profileSaveControllerProvider.notifier).save(_profile);
    if (!mounted) return;
    if (saved) _snack(context.l10n.settingsProfileSaved);
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

    return Scaffold(
      appBar: AppBar(title: Text(l10n.settingsTitle)),
      body: SafeArea(
        child: ListView(
          padding: AppSpacing.pagePadding,
          children: [
            const _ThemeSection(),
            const SizedBox(height: AppSpacing.space6),
            const _LanguageSection(),
            const SizedBox(height: AppSpacing.space6),
            const _NotificationSection(),
            const SizedBox(height: AppSpacing.space6),
            if (signedIn) ...[
              _profileSection(l10n),
              const SizedBox(height: AppSpacing.space6),
              _dangerSection(l10n),
            ] else
              const _SignedOutCard(),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------- profile

  Widget _profileSection(AppLocalizations l10n) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final saveState = ref.watch(profileSaveControllerProvider);

    return _Section(
      title: l10n.settingsProfileTitle,
      icon: LucideIcons.graduationCap,
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              l10n.settingsProfileHint,
              style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
            ),
            const SizedBox(height: AppSpacing.space6),
            _boardField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _qualificationsField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _adminRoleField(l10n),
            if (saveState.hasError) ...[
              const SizedBox(height: AppSpacing.space4),
              _InlineError(message: _saveErrorText(l10n, saveState.error)),
            ],
            const SizedBox(height: AppSpacing.space6),
            FilledButton(
              onPressed: saveState.isLoading ? null : _saveProfile,
              child: saveState.isLoading
                  ? const _ButtonSpinner()
                  : Text(l10n.settingsSaveProfile),
            ),
          ],
        ),
      ),
    );
  }

  Widget _boardField(AppLocalizations l10n) {
    return _Field(
      label: l10n.settingsBoardLabel,
      child: DropdownButtonFormField<String?>(
        initialValue: _profile.educationBoard,
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
          () => _profile = _profile.copyWith(
            educationBoard: value,
            clearEducationBoard: value == null,
          ),
        ),
      ),
    );
  }

  Widget _qualificationsField(AppLocalizations l10n) {
    return _Field(
      label: l10n.settingsQualificationsLabel,
      hint: l10n.settingsQualificationsHint,
      child: Wrap(
        spacing: AppSpacing.space2,
        runSpacing: AppSpacing.space2,
        children: [
          for (final qualification in kQualifications)
            FilterChip(
              label: Text(qualification),
              selected: _profile.qualifications.contains(qualification),
              // Guarantees the >=48dp target the bare chip height misses.
              materialTapTargetSize: MaterialTapTargetSize.padded,
              onSelected: (selected) => _toggleQualification(
                qualification,
                selected: selected,
              ),
            ),
        ],
      ),
    );
  }

  void _toggleQualification(String qualification, {required bool selected}) {
    final next = [..._profile.qualifications];
    if (selected) {
      next.add(qualification);
    } else {
      next.remove(qualification);
    }
    setState(() => _profile = _profile.copyWith(qualifications: next));
  }

  Widget _adminRoleField(AppLocalizations l10n) {
    return _Field(
      label: l10n.settingsAdminRoleLabel,
      child: DropdownButtonFormField<AdministrativeRole?>(
        initialValue: _profile.administrativeRole,
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
          () => _profile = _profile.copyWith(
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

    return _Section(
      title: l10n.settingsDangerTitle,
      icon: LucideIcons.trash2,
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              scheduled ? l10n.settingsDeleteScheduled : l10n.settingsDangerBody,
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
                    : const Icon(LucideIcons.trash2, size: 18),
                label: Text(l10n.settingsDeleteAction),
              ),
            ],
          ],
        ),
      ),
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

    return _Section(
      title: l10n.settingsAppearanceTitle,
      icon: LucideIcons.palette,
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
                (ThemeMode.system, l10n.settingsThemeSystem, LucideIcons.monitor),
                (ThemeMode.light, l10n.settingsThemeLight, LucideIcons.sun),
                (ThemeMode.dark, l10n.settingsThemeDark, LucideIcons.moon),
              ])
                RadioListTile<ThemeMode>(
                  value: entry.$1,
                  title: Text(entry.$2),
                  secondary: Icon(entry.$3, size: 20),
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

    return _Section(
      title: l10n.languageLabel,
      icon: LucideIcons.languages,
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

    return _Section(
      title: l10n.settingsNotificationsTitle,
      icon: LucideIcons.bell,
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
              Icon(LucideIcons.logIn, size: 20, color: scheme.primary),
              const SizedBox(width: AppSpacing.space3),
              Expanded(
                child: Text(l10n.settingsSignedOutTitle, style: text.titleMedium),
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
    return _InlineError(
      title: isReauth ? l10n.settingsReauthTitle : null,
      message: isReauth ? l10n.settingsReauthBody : l10n.settingsDeleteFailed,
    );
  }
}

/// An error-toned block that sits inside a card, next to the control that
/// failed. Left-aligned, human copy, no raw exception strings (DESIGN_RUBRIC
/// §6) — and no centred-hero slop.
class _InlineError extends StatelessWidget {
  const _InlineError({required this.message, this.title});

  final String message;
  final String? title;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.error.withValues(alpha: 0.08),
        borderRadius: AppRadius.rMd,
        border: Border.all(color: scheme.error.withValues(alpha: 0.4)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.space3),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(LucideIcons.alertTriangle, size: 18, color: scheme.error),
            const SizedBox(width: AppSpacing.space3),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (title != null) ...[
                    Text(
                      title!,
                      style: text.titleSmall?.copyWith(color: scheme.error),
                    ),
                    const SizedBox(height: AppSpacing.space1),
                  ],
                  Text(message, style: text.bodyMedium),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A section header + its content. The header carries a Lucide glyph so the
/// list scans without emoji or decorative dividers.
class _Section extends StatelessWidget {
  const _Section({required this.title, required this.icon, required this.child});

  final String title;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.space3),
          child: Row(
            children: [
              Icon(icon, size: 18, color: scheme.onSurfaceVariant),
              const SizedBox(width: AppSpacing.space2),
              Expanded(
                child: Text(
                  title,
                  style: text.titleSmall?.copyWith(letterSpacing: 0.2),
                ),
              ),
            ],
          ),
        ),
        child,
      ],
    );
  }
}

/// A labelled form row: a weight-first label above its control, with optional
/// helper text. Mirrors the `_Field` in the lesson-plan and quiz forms.
class _Field extends StatelessWidget {
  const _Field({required this.label, required this.child, this.hint});

  final String label;
  final String? hint;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: text.titleSmall?.copyWith(letterSpacing: 0.2)),
        if (hint != null) ...[
          const SizedBox(height: AppSpacing.space1),
          Text(
            hint!,
            style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
          ),
        ],
        const SizedBox(height: AppSpacing.space3),
        child,
      ],
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
