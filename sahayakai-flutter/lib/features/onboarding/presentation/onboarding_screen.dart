import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/locale_provider.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/domain/picker_options.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../profile/domain/board_category.dart';
import '../../profile/domain/profile_validators.dart';
import '../../profile/domain/teacher_profile.dart';
import 'onboarding_controller.dart';

/// P0.2 — Onboarding.
///
/// THREE STEPS, NO GATE. Step 0 language, step 1 the teaching profile, step 2
/// what that profile bought them. Every step carries "Skip for now" and it
/// always lands on the dashboard.
///
/// THE NO-GATE RULE IS NOT A PREFERENCE, IT IS AN INCIDENT. The web shipped a
/// cookie-only onboarding gate in its middleware on 2026-06-08 and locked out
/// the ENTIRE existing user base: nobody held the cookie, so every
/// already-onboarded teacher was bounced to /onboarding and could not reach a
/// single generation tool. That gate is now default-off behind
/// `ONBOARDING_GATE_ENABLED` (see `src/middleware.ts`, which still carries the
/// incident note). This screen must never re-create it client-side:
///   - nothing redirects TO here; the dashboard nudges, the login screen
///     suggests, neither compels,
///   - skip is on every step, including while a save is failing,
///   - a save failure does not trap the teacher (see [_saveAndContinue]),
///   - `POST /api/profile/mark-complete` is deliberately NOT called. Its real
///     job is issuing the httpOnly cookie that feeds that middleware gate,
///     which a dio client neither receives usefully nor needs. It also 404s for
///     a teacher with no document yet and 422s below its 80% threshold — two
///     ways to fail at something this app is not trying to do.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  static const int stepCount = 3;

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _formKey = GlobalKey<FormState>();

  final _name = TextEditingController();
  final _school = TextEditingController();
  final _district = TextEditingController();
  final _phone = TextEditingController();
  final _pincode = TextEditingController();

  int _step = 0;

  /// The edit buffer. Starts empty: this is first-run setup, so there is no
  /// document to seed it from. It is not read from `ProfileController` on
  /// purpose — that read 401s today and would put a loading state in front of a
  /// form that needs none.
  TeacherProfile _draft = const TeacherProfile();

  /// UI-only, never persisted. `boardCategory` is written by nothing and stored
  /// by nothing on the backend (absent from `UserProfileSchema`, from the PATCH
  /// allowlist, from `PROFILE_WRITABLE_FIELDS` and from the adapter's
  /// `CLIENT_EDITABLE_USER_FIELDS`). SCREEN_INVENTORY P0.2 listing it as a
  /// profile field is wrong. It is a cascading-picker helper that shortens the
  /// 29-entry board list. See `BoardCategory`.
  BoardCategory? _category;

  @override
  void dispose() {
    _name.dispose();
    _school.dispose();
    _district.dispose();
    _phone.dispose();
    _pincode.dispose();
    super.dispose();
  }

  void _skip() => context.go(Routes.home);

  void _back() => setState(() => _step -= 1);

  void _next() => setState(() => _step += 1);

  /// Step 1's action. Validates, saves, and moves on.
  ///
  /// On failure it stays put and shows the reason inline — telling a teacher
  /// their profile is saved when it is not would be worse than the error. It
  /// does NOT trap them: "Skip for now" is still in the app bar, and the error
  /// copy says so in as many words.
  Future<void> _saveAndContinue() async {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final profile = _draft.copyWith(
      displayName: _name.text.trim(),
      schoolName: _school.text.trim(),
      district: _district.text.trim(),
      phoneNumber: _phone.text.trim(),
      pincode: _pincode.text.trim(),
      // The app's single language source of truth, chosen in step 0. This
      // screen does not own a second one.
      preferredLanguage: ref.read(localeControllerProvider),
    );
    setState(() => _draft = profile);

    final saved =
        await ref.read(onboardingSaveControllerProvider.notifier).save(profile);
    if (!mounted) return;
    if (saved) setState(() => _step += 1);
  }

  // NO "saved" SNACKBAR HERE, deliberately. Step 2 lists back the exact values
  // that were just written, so it already IS the confirmation — and a snackbar
  // floats over the bottom of the screen, which is precisely where this
  // screen's sticky footer keeps its primary action. It covered "Go to my
  // dashboard" for four seconds and swallowed the tap. A test caught it
  // ("the summary finishes on the dashboard"); a teacher would have just
  // thought the button was broken.

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final saveState = ref.watch(onboardingSaveControllerProvider);

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        leading: _step > 0
            ? IconButton(
                onPressed: _back,
                icon: const Icon(LucideIcons.arrowLeft),
                tooltip: l10n.onboardingBack,
              )
            : null,
        title: Text(l10n.onboardingTitle),
        actions: [
          // On EVERY step, including while a save is failing. This is the
          // no-gate guarantee, and it is pinned by a test.
          TextButton(onPressed: _skip, child: Text(l10n.onboardingSkip)),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            _StepProgress(step: _step, total: OnboardingScreen.stepCount),
            Expanded(child: _stepBody(l10n, saveState)),
            _Footer(
              child: PrimaryButton(
                label: _actionLabel(l10n),
                icon: _step == 1 ? LucideIcons.save : LucideIcons.arrowRight,
                isBusy: saveState.isLoading,
                onPressed: switch (_step) {
                  0 => _next,
                  1 => _saveAndContinue,
                  _ => _skip,
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _actionLabel(AppLocalizations l10n) {
    return switch (_step) {
      0 => l10n.onboardingNext,
      1 => l10n.onboardingSaveAndContinue,
      _ => l10n.onboardingFinish,
    };
  }

  Widget _stepBody(AppLocalizations l10n, AsyncValue<void> saveState) {
    return switch (_step) {
      0 => const _LanguageStep(),
      1 => _profileStep(l10n, saveState),
      _ => _ReadyStep(draft: _draft),
    };
  }

  // ------------------------------------------------------------------ step 1

  Widget _profileStep(AppLocalizations l10n, AsyncValue<void> saveState) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    return Form(
      key: _formKey,
      child: ListView(
        padding: AppSpacing.pagePadding,
        children: [
          Text(l10n.onboardingProfileTitle, style: text.headlineSmall),
          const SizedBox(height: AppSpacing.space2),
          Text(
            l10n.onboardingProfileBody,
            style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
          ),
          const SizedBox(height: AppSpacing.space6),
          _Section(
            title: l10n.profileSectionAbout,
            icon: LucideIcons.user,
            child: AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  _Field(
                    label: l10n.profileNameLabel,
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
                  _Field(
                    label: l10n.profileSchoolLabel,
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
          const SizedBox(height: AppSpacing.space6),
          _Section(
            title: l10n.profileSectionTeaching,
            icon: LucideIcons.graduationCap,
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
          const SizedBox(height: AppSpacing.space6),
          _Section(
            title: l10n.profileSectionLocation,
            icon: LucideIcons.mapPin,
            child: AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  _stateField(l10n),
                  const SizedBox(height: AppSpacing.space6),
                  _Field(
                    label: l10n.profileDistrictLabel,
                    hint: l10n.profileDistrictHint,
                    child: TextFormField(
                      controller: _district,
                      textCapitalization: TextCapitalization.words,
                      textInputAction: TextInputAction.next,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space6),
                  _Field(
                    label: l10n.profilePincodeLabel,
                    hint: l10n.profilePincodeHint,
                    child: TextFormField(
                      controller: _pincode,
                      keyboardType: TextInputType.number,
                      textInputAction: TextInputAction.next,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(6),
                      ],
                      validator: (value) => isValidIndianPincode(value)
                          ? null
                          : l10n.profilePincodeInvalid,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.space6),
          _Section(
            title: l10n.profileSectionContact,
            icon: LucideIcons.phone,
            child: AppCard(
              child: _Field(
                label: l10n.profilePhoneLabel,
                hint: l10n.profilePhoneHint,
                child: TextFormField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.done,
                  validator: (value) => isValidIndianMobile(value)
                      ? null
                      : l10n.profilePhoneInvalid,
                ),
              ),
            ),
          ),
          if (saveState.hasError) ...[
            const SizedBox(height: AppSpacing.space4),
            _InlineError(message: _saveErrorText(l10n, saveState.error)),
          ],
        ],
      ),
    );
  }

  Widget _boardCategoryField(AppLocalizations l10n) {
    return _Field(
      label: l10n.profileBoardCategoryLabel,
      hint: l10n.profileBoardCategoryHint,
      child: Wrap(
        spacing: AppSpacing.space2,
        runSpacing: AppSpacing.space2,
        children: [
          for (final category in BoardCategory.values)
            ChoiceChip(
              label: Text(_categoryLabel(l10n, category)),
              selected: _category == category,
              // The bare chip is 32dp; this pads the tap target past 48dp
              // (DESIGN_RUBRIC §2).
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
    return _Field(
      label: l10n.settingsBoardLabel,
      child: DropdownButtonFormField<String?>(
        initialValue: _draft.settings.educationBoard,
        // Long board names ellipsize instead of overflowing at 360dp.
        isExpanded: true,
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
    return _Field(
      label: l10n.profileSubjectsLabel,
      hint: l10n.profileSubjectsHint,
      child: Wrap(
        spacing: AppSpacing.space2,
        runSpacing: AppSpacing.space2,
        children: [
          for (final subject in kSubjects)
            FilterChip(
              label: Text(subject),
              selected: _draft.subjects.contains(subject),
              materialTapTargetSize: MaterialTapTargetSize.padded,
              onSelected: (selected) => setState(() {
                _draft = _draft.copyWith(
                  subjects:
                      _toggled(_draft.subjects, subject, selected: selected),
                );
              }),
            ),
        ],
      ),
    );
  }

  Widget _gradesField(AppLocalizations l10n) {
    return _Field(
      label: l10n.profileGradesLabel,
      hint: l10n.profileGradesHint,
      child: Wrap(
        spacing: AppSpacing.space2,
        runSpacing: AppSpacing.space2,
        children: [
          for (final grade in kGradeLevels)
            FilterChip(
              label: Text(grade),
              selected: _draft.gradeLevels.contains(grade),
              materialTapTargetSize: MaterialTapTargetSize.padded,
              onSelected: (selected) => setState(() {
                _draft = _draft.copyWith(
                  gradeLevels:
                      _toggled(_draft.gradeLevels, grade, selected: selected),
                );
              }),
            ),
        ],
      ),
    );
  }

  Widget _stateField(AppLocalizations l10n) {
    return _Field(
      label: l10n.profileStateLabel,
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
          () => _draft =
              _draft.copyWith(state: value, clearState: value == null),
        ),
      ),
    );
  }

  Widget _adminRoleField(AppLocalizations l10n) {
    return _Field(
      label: l10n.settingsAdminRoleLabel,
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

/// Step 0. All ELEVEN languages, inline and each in its own script.
///
/// Inline rather than behind the shared `LanguageSwitcher` sheet on purpose:
/// this is the first screen of the app a teacher ever reads, and a teacher who
/// reads Odia should SEE Odia, not a row labelled "English" they must tap to
/// discover their language exists. Never Hindi-only (DESIGN_RUBRIC §10).
///
/// It writes the one [AppLocale], so this single choice sets the UI language
/// AND the `language` param every AI endpoint is called with.
class _LanguageStep extends ConsumerWidget {
  const _LanguageStep();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final current = ref.watch(localeControllerProvider);

    return ListView(
      padding: AppSpacing.pagePadding,
      children: [
        Text(l10n.onboardingLanguageTitle, style: text.headlineSmall),
        const SizedBox(height: AppSpacing.space2),
        Text(
          l10n.onboardingLanguageBody,
          style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
        ),
        const SizedBox(height: AppSpacing.space6),
        AppCard(
          padding: EdgeInsets.zero,
          child: RadioGroup<AppLocale>(
            groupValue: current,
            onChanged: (value) {
              if (value != null) {
                ref.read(localeControllerProvider.notifier).set(value);
              }
            },
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final locale in AppLocale.values)
                  // RadioListTile is >=56dp tall, so the tap target clears
                  // 48dp without help.
                  RadioListTile<AppLocale>(
                    value: locale,
                    title: Text(locale.nativeLabel),
                    subtitle: Text(locale.aiName),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Step 2. What the teacher just told us, reflected back.
///
/// Not a congratulations screen: it lists the actual values the AI will now be
/// called with, so the setup visibly bought something. A teacher who skipped
/// every field sees that honestly, and is told where to change it later.
class _ReadyStep extends ConsumerWidget {
  const _ReadyStep({required this.draft});

  final TeacherProfile draft;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final locale = ref.watch(localeControllerProvider);

    final rows = <(String, String)>[
      // Always present: a language is always selected, even if only the default.
      (l10n.languageLabel, locale.nativeLabel),
      if (draft.settings.educationBoard != null)
        (l10n.settingsBoardLabel, draft.settings.educationBoard!),
      if (draft.gradeLevels.isNotEmpty)
        (l10n.profileGradesLabel, draft.gradeLevels.join(', ')),
      if (draft.subjects.isNotEmpty)
        (l10n.profileSubjectsLabel, draft.subjects.join(', ')),
      if (draft.state != null) (l10n.profileStateLabel, draft.state!),
    ];

    return ListView(
      padding: AppSpacing.pagePadding,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(LucideIcons.checkCircle, size: 24, color: scheme.secondary),
            const SizedBox(width: AppSpacing.space3),
            Expanded(
              child: Text(l10n.onboardingReadyTitle, style: text.headlineSmall),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.space2),
        Text(
          l10n.onboardingReadyBody,
          style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
        ),
        const SizedBox(height: AppSpacing.space6),
        AppCard(
          accentBar: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final (index, row) in rows.indexed) ...[
                if (index > 0) const SizedBox(height: AppSpacing.space3),
                _SummaryRow(label: row.$1, value: row.$2),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// One `label / value` line of the step-2 summary. A Column and not a Row: at
/// textScale 1.3 in Malayalam a label and five joined subject names cannot
/// share a 360dp line.
class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
        ),
        const SizedBox(height: AppSpacing.space1),
        Text(value, style: text.bodyMedium),
      ],
    );
  }
}

/// "Step 2 of 3" plus a progress bar. Sizes to its content rather than taking a
/// fixed height, so it does not clip at textScale 1.3.
class _StepProgress extends StatelessWidget {
  const _StepProgress({required this.step, required this.total});

  final int step;
  final int total;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.space4,
        AppSpacing.space3,
        AppSpacing.space4,
        AppSpacing.space3,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            context.l10n.onboardingStepLabel(step + 1, total),
            style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
          ),
          const SizedBox(height: AppSpacing.space2),
          ClipRRect(
            borderRadius: AppRadius.rSm,
            child: LinearProgressIndicator(
              value: (step + 1) / total,
              minHeight: 4,
              backgroundColor: scheme.surfaceContainerHigh,
            ),
          ),
        ],
      ),
    );
  }
}

/// The sticky action bar. Inside the body's [SafeArea], so it clears the
/// gesture-nav inset (DESIGN_RUBRIC §9).
class _Footer extends StatelessWidget {
  const _Footer({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surfaceContainerLowest,
        border: Border(top: BorderSide(color: scheme.outline)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.space4),
        child: child,
      ),
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

String _categoryLabel(AppLocalizations l10n, BoardCategory category) {
  return switch (category) {
    // Proper nouns AND exact API enum values: not translated.
    BoardCategory.cbse => 'CBSE',
    BoardCategory.icse => 'ICSE / ISC',
    BoardCategory.stateBoard => l10n.profileBoardCategoryState,
  };
}

/// Exhaustive on purpose: adding a role to the enum will not compile until it
/// has copy. Shares Profile's and Settings' wording, because it is the same
/// question.
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

/// Both messages end by telling the teacher they can continue anyway, because
/// they can: skip is one tap away in the app bar.
String _saveErrorText(AppLocalizations l10n, Object? error) {
  if (error is ApiException && error.isAuth) return l10n.onboardingSaveSignIn;
  return l10n.onboardingSaveFailed;
}

/// An error-toned block next to the control that failed. Left aligned, human
/// copy, no raw exception strings (DESIGN_RUBRIC §6). Mirrors Profile's.
class _InlineError extends StatelessWidget {
  const _InlineError({required this.message});

  final String message;

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
            Expanded(child: Text(message, style: text.bodyMedium)),
          ],
        ),
      ),
    );
  }
}

/// A section header + its content. Mirrors Profile's and Settings' `_Section` —
/// the per-screen private field widget is this codebase's established pattern
/// (see the note on `ProfileScreen._Field`); the SHARED things are the domain,
/// the DTOs and the repository, which onboarding reuses rather than forks.
class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.icon,
    required this.child,
  });

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
/// helper text.
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
