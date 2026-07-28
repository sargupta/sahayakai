import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/glass_app_bar.dart';
import '../../../shared/widgets/icon_well.dart';
import '../../../shared/widgets/inline_error.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/language_switcher.dart';
import '../../../shared/widgets/offline_view.dart';
import '../../../shared/widgets/primary_button.dart';
import '../domain/board_category.dart';
import '../domain/profile_validators.dart';
import '../domain/teacher_profile.dart';
import 'profile_controller.dart';
import 'widgets/plan_badge_chip.dart';

/// P0.8 — Profile (Me).
///
/// SHELL CHOICE: `Scaffold` + `AppBar` + a page-padded `ListView` of [AppCard]
/// sections — the same shell Settings and Library use, not `ToolScaffold`.
/// ToolScaffold's grammar is "form -> one AI request -> one ResultView"; this
/// screen has no request and no result, it edits a document. Card grammar,
/// spacing and tokens are unchanged, so it still reads as the same app.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileControllerProvider);

    return Scaffold(
      appBar: GlassAppBar(
        title: Text(context.l10n.profileTitle),
        actions: [
          // Settings (P0.7) is reached from the Me tab's app bar — the
          // conventional home for it, and the only tab that is about the
          // teacher rather than their work.
          IconButton(
            onPressed: () => context.push(Routes.settings),
            icon: const Icon(LucideIcons.settings),
            tooltip: context.l10n.settingsTitle,
          ),
        ],
      ),
      body: SafeArea(
        child: profile.when(
          loading: () => const Padding(
            padding: AppSpacing.pagePadding,
            child: AppSkeleton(lines: 6),
          ),
          error: (error, _) => _ProfileError(
            error: error,
            onRetry: () =>
                ref.read(profileControllerProvider.notifier).refresh(),
          ),
          // A brand-new teacher has no document, which reads as an empty
          // profile rather than an error — the production onboarding gate is
          // OFF, so arriving here with nothing saved is a supported path.
          data: (data) => _ProfileForm(
            // Keyed on the loaded value so a refresh rebuilds the text
            // controllers from the new document instead of stranding the
            // teacher's fields on stale text.
            key: ValueKey<TeacherProfile>(data),
            initial: data,
          ),
        ),
      ),
    );
  }
}

/// The read failed. Which of the three states this is depends entirely on WHY,
/// so it branches on the typed [ApiException] kind rather than showing one
/// catch-all apology.
class _ProfileError extends StatelessWidget {
  const _ProfileError({required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final kind = error is ApiException ? (error as ApiException).kind : null;

    // No identity: today this is every runtime read, because the token
    // provider is the P0.2 stub. Offering "Try again" here would be a lie —
    // the fetch cannot succeed until the teacher signs in.
    if (kind == ApiErrorKind.unauthorized) {
      return const SingleChildScrollView(
        padding: AppSpacing.pagePadding,
        child: _SignedOutCard(),
      );
    }
    // Rural connectivity is intermittent: this is an expected failure, not an
    // exceptional one, and it gets its own copy and its own retry.
    if (kind == ApiErrorKind.network || kind == ApiErrorKind.timeout) {
      return SingleChildScrollView(
        padding: AppSpacing.pagePadding,
        child: OfflineView(onRetry: onRetry),
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

class _ProfileForm extends ConsumerStatefulWidget {
  const _ProfileForm({super.key, required this.initial});

  final TeacherProfile initial;

  @override
  ConsumerState<_ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends ConsumerState<_ProfileForm> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _name;
  late final TextEditingController _school;
  late final TextEditingController _district;
  late final TextEditingController _phone;
  late final TextEditingController _pincode;

  /// The edit buffer. Starts as the fetched document, so fields this screen
  /// does not render (qualifications, which Settings owns) are carried through
  /// a save untouched instead of being cleared by omission.
  late TeacherProfile _draft;

  /// UI-only, never persisted — see [BoardCategory]. Recovered from the stored
  /// board so a returning teacher lands on the right list.
  BoardCategory? _category;

  @override
  void initState() {
    super.initState();
    _draft = widget.initial;
    _name = TextEditingController(text: _draft.displayName ?? '');
    _school = TextEditingController(text: _draft.schoolName ?? '');
    _district = TextEditingController(text: _draft.district ?? '');
    _phone = TextEditingController(text: _draft.phoneNumber ?? '');
    _pincode = TextEditingController(text: _draft.pincode ?? '');
    _category = BoardCategory.ofBoard(_draft.settings.educationBoard);
  }

  @override
  void dispose() {
    _name.dispose();
    _school.dispose();
    _district.dispose();
    _phone.dispose();
    _pincode.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final profile = _draft.copyWith(
      displayName: _name.text.trim(),
      schoolName: _school.text.trim(),
      district: _district.text.trim(),
      phoneNumber: _phone.text.trim(),
      pincode: _pincode.text.trim(),
      // The app's single language source of truth. This screen does not own a
      // second one: the switcher below writes `LocaleController`, and the save
      // mirrors whatever it currently holds into the document.
      preferredLanguage: ref.read(localeControllerProvider),
    );

    // `widget.initial` is the loaded document. Passing it as `previous` lets the
    // save distinguish a field the teacher DELIBERATELY blanked (persist an
    // explicit clear) from one never filled in (leave the server untouched) —
    // without it, clearing a field reported "Saved" but the old value returned
    // on the next fetch.
    final saved = await ref
        .read(profileFormSaveControllerProvider.notifier)
        .save(profile, previous: widget.initial);
    if (!mounted) return;
    if (saved) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(content: Text(context.l10n.settingsProfileSaved)),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final saveState = ref.watch(profileFormSaveControllerProvider);

    // Every top-level block, in reading order. Each editorial group opens with
    // an EditorialSectionHeader (saffron eyebrow + hairline, §5) over an
    // AppCard, and the register inks in on a staggered entrance.
    final blocks = <Widget>[
      _IdentityCard(name: _draft.displayName, school: _draft.schoolName),
      if (widget.initial.isEmpty)
        AppCard(
          child: EmptyView(
            icon: LucideIcons.userCog,
            title: l10n.profileEmptyTitle,
            message: l10n.profileEmptyBody,
          ),
        ),
      _ProfileGroup(
        title: l10n.profileSectionAbout,
        child: AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              LabeledField(
                label: l10n.profileNameLabel,
                leadingIcon: LucideIcons.user,
                hint: l10n.profileNameHint,
                child: TextFormField(
                  controller: _name,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  validator: (value) =>
                      (value != null && value.trim().length > 100)
                      ? l10n.profileNameInvalid
                      : null,
                ),
              ),
              const SizedBox(height: AppSpacing.space6),
              LabeledField(
                label: l10n.profileSchoolLabel,
                leadingIcon: LucideIcons.school,
                child: TextFormField(
                  controller: _school,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  validator: (value) =>
                      (value != null && value.trim().length > 140)
                      ? l10n.profileNameInvalid
                      : null,
                ),
              ),
            ],
          ),
        ),
      ),
      _ProfileGroup(
        title: l10n.profileSectionTeaching,
        child: AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              _boardCategoryField(l10n),
              const SizedBox(height: AppSpacing.space6),
              _boardField(l10n),
              const SizedBox(height: AppSpacing.space6),
              _subjectsField(l10n),
              const SizedBox(height: AppSpacing.space6),
              _gradesField(l10n),
              const SizedBox(height: AppSpacing.space6),
              _adminRoleField(l10n),
            ],
          ),
        ),
      ),
      _ProfileGroup(
        title: l10n.profileSectionLocation,
        child: AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              _stateField(l10n),
              const SizedBox(height: AppSpacing.space6),
              LabeledField(
                label: l10n.profileDistrictLabel,
                leadingIcon: LucideIcons.map,
                hint: l10n.profileDistrictHint,
                child: TextFormField(
                  controller: _district,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                ),
              ),
              const SizedBox(height: AppSpacing.space6),
              LabeledField(
                label: l10n.profilePincodeLabel,
                leadingIcon: LucideIcons.hash,
                hint: l10n.profilePincodeHint,
                child: TextFormField(
                  controller: _pincode,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.next,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(6),
                  ],
                  validator: (value) => _validatePincode(l10n, value),
                ),
              ),
            ],
          ),
        ),
      ),
      _ProfileGroup(
        title: l10n.profileSectionContact,
        child: AppCard(
          child: LabeledField(
            label: l10n.profilePhoneLabel,
            leadingIcon: LucideIcons.phone,
            hint: l10n.profilePhoneHint,
            child: TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.done,
              validator: (value) => _validatePhone(l10n, value),
            ),
          ),
        ),
      ),
      _ProfileGroup(
        title: l10n.languageLabel,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            const AppCard(
              padding: EdgeInsets.zero,
              child: LanguageSwitcher(),
            ),
            const SizedBox(height: AppSpacing.space3),
            Text(
              l10n.profileLanguageHint,
              style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
      // Error + actions are ONE stable footer block: an inline save error
      // appears WITHIN it rather than as a new top-level block, so the block
      // count never changes and the staggered entrance never re-indexes the
      // lazy list beneath it (which would churn flutter_animate's delay timers).
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (saveState.hasError) ...[
            InlineError(message: _saveErrorText(l10n, saveState.error)),
            const SizedBox(height: AppSpacing.space4),
          ],
          PrimaryButton(
            label: l10n.settingsSaveProfile,
            icon: LucideIcons.save,
            isBusy: saveState.isLoading,
            onPressed: _save,
          ),
          const SizedBox(height: AppSpacing.space6),
          OutlinedButton.icon(
            onPressed: () =>
                ref.read(authControllerProvider.notifier).signOut(),
            icon: const Icon(LucideIcons.logOut, size: AppIconSize.inline),
            label: Text(l10n.actionSignOut),
          ),
        ],
      ),
    ];

    return Form(
      key: _formKey,
      child: ListView(
        padding: AppSpacing.pagePadding,
        children: [
          for (final (index, block) in blocks.indexed) ...[
            if (index > 0) const SizedBox(height: AppSpacing.space6),
            inkSettle(context, block, index: index),
          ],
        ],
      ),
    );
  }

  // ------------------------------------------------------------------ fields

  Widget _boardCategoryField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.profileBoardCategoryLabel,
      leadingIcon: LucideIcons.layers,
      hint: l10n.profileBoardCategoryHint,
      child: Wrap(
        spacing: AppSpacing.space2,
        runSpacing: AppSpacing.space2,
        children: [
          for (final category in BoardCategory.values)
            ChoiceChip(
              label: Text(_categoryLabel(l10n, category)),
              selected: _category == category,
              showCheckmark: false,
              // The bare chip is 32dp; this pads the tap target past 48dp.
              materialTapTargetSize: MaterialTapTargetSize.padded,
              onSelected: (selected) =>
                  _selectCategory(category, selected: selected),
            ),
        ],
      ),
    );
  }

  void _selectCategory(BoardCategory category, {required bool selected}) {
    setState(() {
      _category = selected ? category : null;
      // Switching family must not leave a board from the old family selected:
      // that would save a CBSE board under "State board" and quietly mislead
      // every AI call that reads it.
      final board = _draft.settings.educationBoard;
      if (board != null && BoardCategory.ofBoard(board) != _category) {
        _draft = _draft.copyWith(
          settings: _draft.settings.copyWith(clearEducationBoard: true),
        );
      }
    });
  }

  Widget _boardField(AppLocalizations l10n) {
    // Before a family is chosen, offer every board rather than an empty
    // dropdown: the category is a shortcut, not a gate.
    final boards = _category?.boards ?? kEducationBoards;
    return LabeledField(
      label: l10n.settingsBoardLabel,
      leadingIcon: LucideIcons.landmark,
      child: DropdownButtonFormField<String?>(
        initialValue: _draft.settings.educationBoard,
        isExpanded: true, // long board names ellipsize instead of overflowing
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.settingsBoardNone),
          ),
          for (final board in boards)
            DropdownMenuItem<String?>(value: board, child: Text(board)),
        ],
        onChanged: (value) => setState(() {
          _draft = _draft.copyWith(
            settings: _draft.settings.copyWith(
              educationBoard: value,
              clearEducationBoard: value == null,
            ),
          );
          _category = BoardCategory.ofBoard(value) ?? _category;
        }),
      ),
    );
  }

  Widget _subjectsField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.profileSubjectsLabel,
      leadingIcon: LucideIcons.bookOpen,
      hint: l10n.profileSubjectsHint,
      child: Wrap(
        spacing: AppSpacing.space2,
        runSpacing: AppSpacing.space2,
        children: [
          for (final subject in kSubjects)
            FilterChip(
              label: Text(subject),
              selected: _draft.subjects.contains(subject),
              showCheckmark: false,
              materialTapTargetSize: MaterialTapTargetSize.padded,
              onSelected: (selected) => setState(() {
                _draft = _draft.copyWith(
                  subjects: _toggled(
                    _draft.subjects,
                    subject,
                    selected: selected,
                  ),
                );
              }),
            ),
        ],
      ),
    );
  }

  Widget _gradesField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.profileGradesLabel,
      leadingIcon: LucideIcons.graduationCap,
      hint: l10n.profileGradesHint,
      child: Wrap(
        spacing: AppSpacing.space2,
        runSpacing: AppSpacing.space2,
        children: [
          for (final grade in kGradeLevels)
            FilterChip(
              label: Text(grade),
              selected: _draft.gradeLevels.contains(grade),
              showCheckmark: false,
              materialTapTargetSize: MaterialTapTargetSize.padded,
              onSelected: (selected) => setState(() {
                _draft = _draft.copyWith(
                  gradeLevels: _toggled(
                    _draft.gradeLevels,
                    grade,
                    selected: selected,
                  ),
                );
              }),
            ),
        ],
      ),
    );
  }

  Widget _stateField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.profileStateLabel,
      leadingIcon: LucideIcons.mapPin,
      child: DropdownButtonFormField<String?>(
        initialValue: _draft.state,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.profileStateNone),
          ),
          for (final state in kIndianStates)
            DropdownMenuItem<String?>(value: state, child: Text(state)),
        ],
        onChanged: (value) => setState(
          () =>
              _draft = _draft.copyWith(state: value, clearState: value == null),
        ),
      ),
    );
  }

  Widget _adminRoleField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.settingsAdminRoleLabel,
      leadingIcon: LucideIcons.briefcase,
      child: DropdownButtonFormField<AdministrativeRole?>(
        initialValue: _draft.settings.administrativeRole,
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
        onChanged: (value) => setState(() {
          _draft = _draft.copyWith(
            settings: _draft.settings.copyWith(
              administrativeRole: value,
              clearAdministrativeRole: value == null,
            ),
          );
        }),
      ),
    );
  }
}

/// One premium profile group: an [EditorialSectionHeader] (saffron eyebrow +
/// hairline rule, §5) over its content. Replaces the muted `Section` grammar so
/// every group reads editorial rather than as a weak grey label (§7.4).
class _ProfileGroup extends StatelessWidget {
  const _ProfileGroup({required this.title, required this.child});

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

List<String> _toggled(
  List<String> current,
  String value, {
  required bool selected,
}) {
  final next = [...current];
  if (selected) {
    next.add(value);
  } else {
    next.remove(value);
  }
  return next;
}

/// The rules themselves live in `domain/profile_validators.dart`, shared with
/// onboarding (P0.2), which collects the same fields. These two functions only
/// attach this screen's copy to them.
String? _validatePhone(AppLocalizations l10n, String? value) {
  return isValidIndianMobile(value) ? null : l10n.profilePhoneInvalid;
}

String? _validatePincode(AppLocalizations l10n, String? value) {
  return isValidIndianPincode(value) ? null : l10n.profilePincodeInvalid;
}

String _categoryLabel(AppLocalizations l10n, BoardCategory category) {
  return switch (category) {
    // Proper nouns AND exact API enum values: not translated.
    BoardCategory.cbse => 'CBSE',
    BoardCategory.icse => 'ICSE / ISC',
    BoardCategory.stateBoard => l10n.profileBoardCategoryState,
  };
}

/// Exhaustive on purpose: adding a role to the enum will not compile until it
/// has copy. Shares Settings' wording, because it is the same question.
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
  if (error is ApiException && error.isAuth) return l10n.profileSaveSignIn;
  return l10n.settingsSaveFailed;
}

/// Name, school and plan: the one card here that is about who the teacher IS
/// rather than what they can change.
class _IdentityCard extends StatelessWidget {
  const _IdentityCard({this.name, this.school});

  final String? name;
  final String? school;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final displayName = (name != null && name!.trim().isNotEmpty)
        ? name!.trim()
        : l10n.profileNoName;

    return AppCard(
      accentBar: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const IconWell(icon: LucideIcons.user),
          const SizedBox(width: AppSpacing.space4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(displayName, style: text.titleMedium),
                if (school != null && school!.trim().isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.space1),
                  Text(
                    school!.trim(),
                    style: text.bodyMedium?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.space3),
                // Wrap, not Row: at textScale 1.3 in Malayalam the label and
                // the badge cannot share a line on a 360dp screen.
                Wrap(
                  spacing: AppSpacing.space2,
                  runSpacing: AppSpacing.space2,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      l10n.profilePlanLabel,
                      style: text.bodySmall?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                    const PlanBadgeChip(),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Shown when the profile read comes back 401. Mirrors Settings' signed-out
/// card so the two account screens answer "you are signed out" identically.
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
                  l10n.profileSignedOutTitle,
                  style: text.titleMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.space3),
          Text(
            l10n.profileSignedOutBody,
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

/// An error-toned block that sits next to the control that failed. Left
/// aligned, human copy, no raw exception strings (DESIGN_RUBRIC §6).
