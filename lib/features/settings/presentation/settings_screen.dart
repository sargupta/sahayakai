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
import '../../../shared/widgets/app_background.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/inline_error.dart';
import '../../../shared/widgets/language_switcher.dart';
import '../../../shared/widgets/map_card.dart';
import '../../../shared/widgets/map_chip.dart';
import '../../../shared/widgets/map_segmented.dart';
import '../../../shared/widgets/map_toggle.dart';
import '../../../shared/widgets/offline_view.dart';
import '../../profile/domain/profile_settings.dart';
import '../../profile/domain/teacher_profile.dart';
import '../../profile/presentation/profile_controller.dart';
import '../../vidya/presentation/vidya_orb_placement_controller.dart';
import '../data/notification_prefs_provider.dart';
import '../data/voice_mode_provider.dart';
import 'settings_controller.dart';
import 'widgets/account_deleted_dialog.dart';
import 'widgets/delete_account_dialog.dart';

/// Settings, drawn to the UX map's Settings screen: a back button and a large
/// title on the app wash, then small overline labels over map cards, in the
/// map's order: Language, Notifications, Voice mode (with the default input),
/// Floating assistant, Teaching profile, Save profile, Privacy for Teachers,
/// and Delete account as a quiet red link.
///
/// Device preferences (language, notifications, voice, VIDYA's side) commit the
/// instant they are touched and work signed out. The teaching profile needs an
/// identity: it shows quiet label/value rows, each opening a picker sheet, and
/// saves with one button. Signed out, it is replaced by a sign-in card.
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  /// The teacher's UNSAVED edits, or null when they have not touched the form.
  ///
  /// Deliberately an overlay rather than a copy seeded on load: the values come
  /// from [profileControllerProvider] (the ONE reader of `users/<uid>`, the
  /// same one Profile renders), and this only shadows it once there is
  /// something to shadow. A bare `ProfileSettings()` would tell a teacher "Not
  /// set" about their own answer.
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
    final deletion = state.value;
    if (state.hasError || deletion == null) return;

    // The delete succeeded. `authStateChanges()` can take up to an hour to
    // notice a server-side deletion, so waiting on it would leave the profile
    // form and its Save live against an account already scheduled for
    // removal. Show the one-time confirmation (with the export link when the
    // server sent one), then sign out locally and leave.
    await AccountDeletedDialog.show(context, deletion);
    if (!mounted) return;
    await ref.read(authControllerProvider.notifier).signOut();
    if (!mounted) return;
    // Deliberately bare: the account is GONE, so there is nothing to return to.
    context.go(Routes.login);
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

    // Every block, in the map's order. The account half (teaching profile,
    // save, delete) needs an identity; signed out it is one sign-in card.
    final blocks = <Widget>[
      const _LanguageSection(),
      const _NotificationSection(),
      const _VoiceModeSection(),
      const _OrbHandSection(),
      if (signedIn) _profileSection(l10n) else const _SignedOutCard(),
      const _PrivacyRow(),
      if (signedIn) _deleteSection(l10n),
    ];

    // The wash is painted here as well as app-wide, so the screen underneath
    // never shows through while this one slides in.
    return AppBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: SafeArea(
          bottom: false,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.mapGutter,
              AppSpacing.space2,
              AppSpacing.mapGutter,
              AppSpacing.space10,
            ),
            children: [
              const _BackButton(),
              const SizedBox(height: AppSpacing.space2),
              Semantics(
                header: true,
                child: Text(
                  l10n.settingsTitle,
                  style: Theme.of(context).textTheme.displayLarge?.copyWith(
                    fontSize: 27,
                    color: AppColors.textStrong,
                  ),
                ),
              ),
              for (final (index, block) in blocks.indexed) ...[
                const SizedBox(height: AppSpacing.space4),
                // The page inks in block by block; reduce-motion returns the
                // composed frame.
                inkSettle(context, block, index: index),
              ],
            ],
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------- profile

  Widget _profileSection(AppLocalizations l10n) {
    return _Section(
      title: l10n.settingsProfileTitle,
      // The form cannot be shown until the document is known: an empty one
      // over a failed read would say "Not set" about fields this build never
      // read, and saving it would send `qualifications: []`, a real and silent
      // wipe of what the teacher set on Profile.
      child: ref
          .watch(profileControllerProvider)
          .when(
            loading: () => const MapCard(child: AppSkeleton(lines: 4)),
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
    final saveState = ref.watch(profileSaveControllerProvider);
    final qualifications = profile.qualifications.isEmpty
        ? l10n.settingsBoardNone
        : profile.qualifications.join(', ');
    final role = profile.administrativeRole;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        MapCard(
          padding: const EdgeInsets.symmetric(vertical: 3),
          child: Column(
            children: [
              _ValueRow(
                label: l10n.settingsBoardLabel,
                value: profile.educationBoard ?? l10n.settingsBoardNone,
                onTap: () => _pickBoard(l10n, profile),
              ),
              const _RowDivider(),
              _ValueRow(
                label: l10n.settingsQualificationsLabel,
                value: qualifications,
                onTap: () => _pickQualifications(l10n, profile),
              ),
              const _RowDivider(),
              _ValueRow(
                label: l10n.settingsAdminRoleLabel,
                value: role == null
                    ? l10n.settingsAdminRoleNone
                    : _roleLabel(l10n, role),
                onTap: () => _pickRole(l10n, profile),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.space2),
        _Note(l10n.settingsProfileHint),
        if (saveState.hasError) ...[
          const SizedBox(height: AppSpacing.space3),
          InlineError(message: _saveErrorText(l10n, saveState.error)),
        ],
        const SizedBox(height: AppSpacing.space3),
        _WhiteButton(
          label: l10n.settingsSaveProfile,
          busy: saveState.isLoading,
          onPressed: saveState.isLoading ? null : () => _saveProfile(profile),
        ),
      ],
    );
  }

  Future<void> _pickBoard(
    AppLocalizations l10n,
    ProfileSettings profile,
  ) async {
    final picked = await _showChoiceSheet<String?>(
      context,
      title: l10n.settingsBoardLabel,
      selected: profile.educationBoard,
      options: [
        (null, l10n.settingsBoardNone),
        for (final board in kEducationBoards) (board, board),
      ],
    );
    if (picked == null || !mounted) return;
    setState(
      () => _edited = profile.copyWith(
        educationBoard: picked.value,
        clearEducationBoard: picked.value == null,
      ),
    );
  }

  Future<void> _pickRole(AppLocalizations l10n, ProfileSettings profile) async {
    final picked = await _showChoiceSheet<AdministrativeRole?>(
      context,
      title: l10n.settingsAdminRoleLabel,
      selected: profile.administrativeRole,
      options: [
        (null, l10n.settingsAdminRoleNone),
        for (final role in AdministrativeRole.values)
          (role, _roleLabel(l10n, role)),
      ],
    );
    if (picked == null || !mounted) return;
    setState(
      () => _edited = profile.copyWith(
        administrativeRole: picked.value,
        clearAdministrativeRole: picked.value == null,
      ),
    );
  }

  Future<void> _pickQualifications(
    AppLocalizations l10n,
    ProfileSettings profile,
  ) async {
    final picked = await showModalBottomSheet<List<String>>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) => _QualificationsSheet(
        initial: profile.qualifications,
        title: l10n.settingsQualificationsLabel,
        hint: l10n.settingsQualificationsHint,
        doneLabel: l10n.actionDone,
      ),
    );
    if (picked == null || !mounted) return;
    setState(() => _edited = profile.copyWith(qualifications: picked));
  }

  // ----------------------------------------------------------------- delete

  Widget _deleteSection(AppLocalizations l10n) {
    final deleteState = ref.watch(deleteAccountControllerProvider);
    final scheduled = !deleteState.hasError && deleteState.value != null;
    final text = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (scheduled)
          _Note(l10n.settingsDeleteScheduled)
        else
          // The map's quiet red link. The confirmation dialog carries the
          // full explanation before anything happens.
          TextButton(
            onPressed: deleteState.isLoading ? null : _deleteAccount,
            style: TextButton.styleFrom(
              foregroundColor: AppColors.danger,
              padding: EdgeInsets.zero,
              minimumSize: const Size(48, 48),
              alignment: AlignmentDirectional.centerStart,
              textStyle: text.bodyLarge?.copyWith(
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            child: deleteState.isLoading
                ? const _ButtonSpinner(color: AppColors.danger)
                : Text(l10n.settingsDeleteAction),
          ),
        if (deleteState.hasError) ...[
          const SizedBox(height: AppSpacing.space2),
          _ReauthOrErrorView(error: deleteState.error!),
        ],
      ],
    );
  }
}

// ------------------------------------------------------------- page pieces

/// The map's back control: a 40px white disc with a hairline ring, in a 48dp
/// touch cell.
class _BackButton extends StatelessWidget {
  const _BackButton();

  @override
  Widget build(BuildContext context) {
    void back() {
      if (context.canPop()) {
        context.pop();
      } else {
        context.go(Routes.home);
      }
    }

    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: Semantics(
        button: true,
        label: MaterialLocalizations.of(context).backButtonTooltip,
        excludeSemantics: true,
        onTap: back,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: back,
          child: SizedBox.square(
            dimension: 48,
            child: Center(
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.surfaceMapCard,
                  border: Border.all(color: AppColors.borderHairline),
                ),
                child: const Icon(
                  LucideIcons.arrowLeft,
                  size: 18,
                  color: AppColors.textStrong,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// One group: the map's overline over its card.
class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        MapOverline(title, color: AppColors.textEyebrow),
        const SizedBox(height: AppSpacing.space2),
        child,
      ],
    );
  }
}

/// The map's settings card: a bold title over a muted line, with a trailing
/// control (a toggle or a chevron). With [onTap] the whole card is the target.
class _SettingCard extends StatelessWidget {
  const _SettingCard({
    required this.title,
    required this.subtitle,
    required this.trailing,
    this.onTap,
  });

  final String title;
  final String subtitle;
  final Widget trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final body = Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedSwitcher(
                duration: context.motionEnabled
                    ? AppMotion.small
                    : Duration.zero,
                layoutBuilder: (current, previous) => Stack(
                  alignment: AlignmentDirectional.centerStart,
                  children: [...previous, ?current],
                ),
                child: Text(
                  title,
                  key: ValueKey<String>(title),
                  style: text.bodyLarge?.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textStrong,
                  ),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: text.bodyLarge?.copyWith(
                  fontSize: 13,
                  color: AppColors.textBody,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.space2),
        trailing,
      ],
    );
    return Semantics(
      button: onTap != null,
      child: MapCard(
        onTap: onTap,
        padding: const EdgeInsetsDirectional.fromSTEB(14, 12, 10, 12),
        child: body,
      ),
    );
  }
}

/// A teaching-profile row: the label muted, the value bold, a small chevron
/// saying it opens a picker.
class _ValueRow extends StatelessWidget {
  const _ValueRow({
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Semantics(
      button: true,
      child: InkWell(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(14, 11, 10, 11),
            child: Row(
              children: [
                Text(
                  label,
                  style: text.bodyLarge?.copyWith(
                    fontSize: 14,
                    color: AppColors.textMuted,
                  ),
                ),
                const SizedBox(width: AppSpacing.space3),
                Expanded(
                  child: Text(
                    value,
                    textAlign: TextAlign.end,
                    style: text.bodyLarge?.copyWith(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textStrong,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.space1),
                const Icon(
                  LucideIcons.chevronRight,
                  size: 16,
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

class _RowDivider extends StatelessWidget {
  const _RowDivider();

  @override
  Widget build(BuildContext context) => const Divider(
    height: 1,
    thickness: 1,
    indent: 14,
    endIndent: 14,
    color: AppColors.borderHairline,
  );
}

/// The map's small muted note under a card.
class _Note extends StatelessWidget {
  const _Note(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(
        context,
      ).textTheme.bodyMedium?.copyWith(color: AppColors.textMuted),
    );
  }
}

/// The map's white button (`.btn.w`): a 52px pill with a hairline.
class _WhiteButton extends StatelessWidget {
  const _WhiteButton({
    required this.label,
    required this.onPressed,
    this.busy = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: const StadiumBorder(
        side: BorderSide(color: AppColors.borderHairline),
      ),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onPressed,
        child: SizedBox(
          height: 52,
          child: Center(
            child: busy
                ? const _ButtonSpinner(color: AppColors.textStrong)
                : Text(
                    label,
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

// ---------------------------------------------------------- device sections

/// Language: the map's card (Language over the current language's own name)
/// opening the ONE shared picker, then the note on what it changes.
class _LanguageSection extends ConsumerWidget {
  const _LanguageSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final current = ref.watch(localeControllerProvider);
    return _Section(
      title: l10n.languageLabel,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          _SettingCard(
            title: l10n.languageLabel,
            subtitle: current.nativeLabel,
            trailing: const _Chevron(),
            onTap: () => showLanguagePickerSheet(context, ref),
          ),
          const SizedBox(height: AppSpacing.space2),
          _Note(l10n.settingsLanguageHint),
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
    final enabled = ref.watch(notificationPrefsControllerProvider);
    void set(bool value) => ref
        .read(notificationPrefsControllerProvider.notifier)
        .set(enabled: value);
    return _Section(
      title: l10n.settingsNotificationsTitle,
      child: _SettingCard(
        title: l10n.settingsNotificationsLabel,
        subtitle: l10n.settingsNotificationsHint,
        onTap: () => set(!enabled),
        trailing: MapToggle(
          value: enabled,
          label: l10n.settingsNotificationsLabel,
          onChanged: set,
        ),
      ),
    );
  }
}

/// Voice mode: the VIDYA engine switch (Live, real-time, opt-in; otherwise one
/// turn at a time), the map's segmented default input, and whether VIDYA keeps
/// the conversation going after each reply.
class _VoiceModeSection extends ConsumerWidget {
  const _VoiceModeSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final mode = ref.watch(voiceModeControllerProvider);
    final defaultInput = ref.watch(defaultInputControllerProvider);
    final keepListening = ref.watch(keepListeningControllerProvider);
    void setKeepListening(bool value) => ref
        .read(keepListeningControllerProvider.notifier)
        .set(keepListening: value);
    void setLive(bool live) => ref
        .read(voiceModeControllerProvider.notifier)
        .set(live ? VoiceMode.live : VoiceMode.turnBased);

    return _Section(
      title: l10n.settingsVoiceModeTitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          _SettingCard(
            title: l10n.settingsVoiceModeLabel,
            subtitle: l10n.settingsVoiceModeHint,
            onTap: () => setLive(mode != VoiceMode.live),
            trailing: MapToggle(
              value: mode == VoiceMode.live,
              label: l10n.settingsVoiceModeLabel,
              onChanged: setLive,
            ),
          ),
          const SizedBox(height: AppSpacing.space2),
          MapSegmented<VidyaDefaultInput>(
            value: defaultInput,
            onChanged: (value) =>
                ref.read(defaultInputControllerProvider.notifier).set(value),
            segments: [
              MapSegment(
                value: VidyaDefaultInput.voice,
                label: l10n.settingsDefaultVoice,
              ),
              MapSegment(
                value: VidyaDefaultInput.text,
                label: l10n.settingsDefaultText,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.space2),
          _SettingCard(
            title: l10n.settingsKeepListeningLabel,
            subtitle: l10n.settingsKeepListeningHint,
            onTap: () => setKeepListening(!keepListening),
            trailing: MapToggle(
              value: keepListening,
              label: l10n.settingsKeepListeningLabel,
              onChanged: setKeepListening,
            ),
          ),
        ],
      ),
    );
  }
}

/// Which side VIDYA sits on: the tab bar and the floating orb follow it. The
/// title says where she is now.
class _OrbHandSection extends ConsumerWidget {
  const _OrbHandSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final hand = ref.watch(
      vidyaOrbPlacementControllerProvider.select((p) => p.hand),
    );
    void setLeft(bool left) => ref
        .read(vidyaOrbPlacementControllerProvider.notifier)
        .setHand(left ? VidyaHand.left : VidyaHand.right);

    return _Section(
      title: l10n.settingsOrbHandTitle,
      child: _SettingCard(
        title: hand == VidyaHand.left
            ? l10n.vidyaSideLeft
            : l10n.vidyaSideRight,
        subtitle: l10n.settingsOrbHandHint,
        onTap: () => setLeft(hand != VidyaHand.left),
        trailing: MapToggle(
          value: hand == VidyaHand.left,
          label: l10n.vidyaSideLeft,
          onChanged: setLeft,
        ),
      ),
    );
  }
}

/// The privacy explainer, as the map's plain card row.
class _PrivacyRow extends StatelessWidget {
  const _PrivacyRow();

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Semantics(
      button: true,
      child: MapCard(
        onTap: () => context.push(Routes.privacyForTeachers),
        padding: const EdgeInsetsDirectional.fromSTEB(14, 14, 10, 14),
        child: Row(
          children: [
            Expanded(
              child: Text(
                context.l10n.mePrivacyForTeachers,
                style: text.bodyLarge?.copyWith(
                  fontSize: 14,
                  color: AppColors.textStrong,
                ),
              ),
            ),
            const _Chevron(),
          ],
        ),
      ),
    );
  }
}

class _Chevron extends StatelessWidget {
  const _Chevron();

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsetsDirectional.only(end: 4),
    child: Icon(LucideIcons.chevronRight, size: 16, color: AppColors.textMuted),
  );
}

// ------------------------------------------------------------ picker sheets

/// A picked option. Wrapped so "Not set" (a null value) is distinguishable
/// from dismissing the sheet (a null result).
class _Choice<T> {
  const _Choice(this.value);

  final T value;
}

/// One choice from a list, as a bottom sheet of rows with a leaf check on the
/// current one.
Future<_Choice<T>?> _showChoiceSheet<T>(
  BuildContext context, {
  required String title,
  required T selected,
  required List<(T, String)> options,
}) {
  return showModalBottomSheet<_Choice<T>>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (sheetContext) {
      final text = Theme.of(sheetContext).textTheme;
      return SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.mapGutter,
                0,
                AppSpacing.mapGutter,
                AppSpacing.space2,
              ),
              child: Text(
                title,
                style: text.displayLarge?.copyWith(
                  fontSize: 19,
                  color: AppColors.textStrong,
                ),
              ),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                padding: const EdgeInsets.only(bottom: AppSpacing.space4),
                children: [
                  for (final (value, label) in options)
                    Semantics(
                      button: true,
                      selected: value == selected,
                      child: InkWell(
                        onTap: () =>
                            Navigator.of(sheetContext).pop(_Choice<T>(value)),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(minHeight: 48),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.mapGutter,
                              vertical: AppSpacing.space3,
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    label,
                                    style: text.bodyLarge?.copyWith(
                                      fontSize: 14,
                                      fontWeight: value == selected
                                          ? FontWeight.w700
                                          : FontWeight.w400,
                                      color: AppColors.textStrong,
                                    ),
                                  ),
                                ),
                                if (value == selected)
                                  const Icon(
                                    LucideIcons.check,
                                    size: 18,
                                    color: AppColors.leaf500,
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      );
    },
  );
}

/// Qualifications: several at once, as the map's leaf chips, then Done.
class _QualificationsSheet extends StatefulWidget {
  const _QualificationsSheet({
    required this.initial,
    required this.title,
    required this.hint,
    required this.doneLabel,
  });

  final List<String> initial;
  final String title;
  final String hint;
  final String doneLabel;

  @override
  State<_QualificationsSheet> createState() => _QualificationsSheetState();
}

class _QualificationsSheetState extends State<_QualificationsSheet> {
  late final List<String> _picked = [...widget.initial];

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.mapGutter,
          0,
          AppSpacing.mapGutter,
          AppSpacing.space4,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.title,
              style: text.displayLarge?.copyWith(
                fontSize: 19,
                color: AppColors.textStrong,
              ),
            ),
            const SizedBox(height: AppSpacing.space1),
            _Note(widget.hint),
            const SizedBox(height: AppSpacing.space2),
            Wrap(
              spacing: 7,
              children: [
                for (final qualification in kQualifications)
                  MapChip(
                    label: qualification,
                    selected: _picked.contains(qualification),
                    onTap: () => setState(() {
                      if (!_picked.remove(qualification)) {
                        _picked.add(qualification);
                      }
                    }),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.space4),
            _WhiteButton(
              label: widget.doneLabel,
              onPressed: () => Navigator.of(context).pop(_picked),
            ),
          ],
        ),
      ),
    );
  }
}

// ------------------------------------------------------------ account states

/// Shown in place of the teaching profile when there is no identity. The
/// device preferences stay usable, which is why only this half is replaced.
class _SignedOutCard extends StatelessWidget {
  const _SignedOutCard();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return MapCard(
      child: MapEmptyNote(
        icon: LucideIcons.logIn,
        title: l10n.settingsSignedOutTitle,
        message: l10n.settingsSignedOutBody,
        action: FilledButton(
          onPressed: () =>
              context.go(Routes.loginWithReturnTo(Routes.settings)),
          child: Text(l10n.settingsSignIn),
        ),
      ),
    );
  }
}

/// The `users/<uid>` read failed, so the teaching profile cannot be shown.
/// Which state this is depends on WHY, so it branches on the typed
/// [ApiException] kind, exactly as Profile does for the same read.
class _ProfileReadError extends StatelessWidget {
  const _ProfileReadError({required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final kind = error is ApiException ? (error as ApiException).kind : null;

    // No identity: offering "Try again" here would be a lie.
    if (kind == ApiErrorKind.unauthorized) return const _SignedOutCard();

    if (kind == ApiErrorKind.network || kind == ApiErrorKind.timeout) {
      return MapCard(child: OfflineView(onRetry: onRetry));
    }
    return MapCard(
      child: ErrorView(
        message: context.l10n.profileLoadFailed,
        onRetry: onRetry,
      ),
    );
  }
}

/// A 401 from delete-account means `reauth_required`, a first-class
/// instruction ("sign in again, then retry within five minutes"), not a
/// failure. Anything else is a plain error.
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
  const _ButtonSpinner({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 18,
      height: 18,
      child: CircularProgressIndicator(strokeWidth: 2, color: color),
    );
  }
}

// ------------------------------------------------------------------- labels

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
