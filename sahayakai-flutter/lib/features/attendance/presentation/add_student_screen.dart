import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/inline_error.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/note_banner.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../data/attendance_repository.dart';
import '../data/dto/attendance_dtos.dart';
import '../domain/attendance_class.dart';
import '../domain/attendance_write_result.dart';
import 'attendance_failure.dart';
import 'attendance_providers.dart';
import 'widgets/attendance_premium_card.dart';

/// Adds one student to a class.
///
/// TWO SERVER RULES THIS FORM ENFORCES BEFORE THE REQUEST EXISTS
///
/// 1. **Roll number 1-40, whole numbers only.** `ClassCapacity.checkRollNumber`
///    is the same check the service runs, including the `41.5` / `0.99` case
///    that exists because JS coerced them through a naive range test. The
///    field rejects them inline while the teacher is still looking at it;
///    `AddStudentRequestDto.build` would throw on one that got through, which
///    would be a programming error, not a teacher error.
/// 2. **Forty students.** The roster screen disables its "Add student" action
///    at the cap, so reaching this screen at 40 is only possible when the
///    count moved underneath. The server's transaction settles that race and
///    the failure is rendered with the class-full copy.
///
/// F9-001 AND THE DIRECTION OF A PHONE NUMBER
///
/// This form is the ONE place in the app that handles a parent's full number,
/// and it only ever sends it UP. What the masking rule forbids is the number
/// travelling back DOWN to the handset, which is why the roster projection
/// masks it and the roster decoder fails closed. The field is therefore
/// legitimate, and the note under it says plainly where the number goes and
/// that it does not come back.
class AddStudentScreen extends ConsumerStatefulWidget {
  const AddStudentScreen({
    super.key,
    required this.classId,
    this.attendanceClass,
  });

  final String classId;

  /// The class handed through `extra`, for the title.
  final AttendanceClass? attendanceClass;

  @override
  ConsumerState<AddStudentScreen> createState() => _AddStudentScreenState();
}

class _AddStudentScreenState extends ConsumerState<AddStudentScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  late final TextEditingController _rollController;

  AppLocale _language = AppLocale.hi;

  bool _isBusy = false;
  bool _blockedByPlan = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _rollController = TextEditingController(text: _prefilledRoll());
  }

  /// The lowest free roll number, when the roster is already in cache.
  ///
  /// Reads the CACHED value only — the roster provider is not autoDispose, so
  /// the screen that pushed this one has already resolved it. When that
  /// resolution was the masked-projection refusal there is no roster to read a
  /// gap from, so the field simply opens empty rather than guessing a number
  /// that might already be taken.
  String _prefilledRoll() {
    final roster = ref
        .read(attendanceRosterProvider(widget.classId))
        .valueOrNull;
    if (roster == null) return '';
    final free = ClassCapacity.firstFreeRollNumber(
      roster.map((s) => s.rollNumber),
    );
    return free?.toString() ?? '';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _rollController.dispose();
    super.dispose();
  }

  String? _validateRoll(String? value) {
    final l10n = context.l10n;
    final parsed = num.tryParse(value?.trim() ?? '');
    return ClassCapacity.isValidRollNumber(parsed)
        ? null
        : l10n.attendanceRollNumberInvalid;
  }

  /// The client half of the server's E.164 normalizer: ten digits, optionally
  /// carrying a `91` or `+91` country prefix, starting 6-9. The server stays
  /// the authority and re-normalizes; this only spares a round trip.
  String? _validatePhone(String? value) {
    final l10n = context.l10n;
    final raw = value?.trim() ?? '';
    if (raw.isEmpty) return l10n.attendanceParentPhoneRequired;
    final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
    final local = digits.length == 12 && digits.startsWith('91')
        ? digits.substring(2)
        : digits;
    final valid = local.length == 10 && RegExp(r'^[6-9]').hasMatch(local);
    return valid ? null : l10n.attendanceParentPhoneInvalid;
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final l10n = context.l10n;
    setState(() {
      _isBusy = true;
      _errorMessage = null;
    });

    try {
      final result = await ref
          .read(attendanceRepositoryProvider)
          .addStudent(
            widget.classId,
            AddStudentRequestDto.build(
              name: _nameController.text,
              rollNumber: num.parse(_rollController.text.trim()),
              parentPhone: _phoneController.text,
              parentLanguage: _language.aiName,
            ),
          );
      if (!mounted) return;

      switch (result) {
        case AttendanceWriteAccepted<String>():
          ref
            ..invalidate(attendanceRosterProvider(widget.classId))
            // The class list carries the studentCount the 40-cap is read
            // from, so it is stale the moment a student lands.
            ..invalidate(attendanceClassesProvider);
          ScaffoldMessenger.of(context)
            ..clearSnackBars()
            ..showSnackBar(
              SnackBar(content: Text(l10n.attendanceStudentAdded)),
            );
          Navigator.of(context).pop();
        case AttendanceWriteBlockedByPlan<String>():
          setState(() => _blockedByPlan = true);
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _errorMessage = attendanceFailureMessage(
          l10n,
          error,
          fallback: l10n.attendanceAddStudentFailed,
        );
      });
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final title = widget.attendanceClass?.name ?? l10n.attendanceAddStudent;

    if (_blockedByPlan) {
      return ToolScaffold(title: title, child: const AttendancePremiumCard());
    }

    return ToolScaffold(
      title: title,
      onSubmit: _isBusy ? null : () => unawaited(_submit()),
      submitLabel: l10n.attendanceAddStudent,
      isBusy: _isBusy,
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            LabeledField(
              label: l10n.attendanceStudentNameLabel,
              leadingIcon: LucideIcons.user,
              child: TextFormField(
                controller: _nameController,
                textCapitalization: TextCapitalization.words,
                validator: (value) => (value?.trim().isEmpty ?? true)
                    ? l10n.attendanceStudentNameRequired
                    : null,
              ),
            ),
            const SizedBox(height: AppSpacing.space6),
            LabeledField(
              label: l10n.attendanceRollNumberLabel,
              hint: l10n.attendanceRollNumberHint,
              leadingIcon: LucideIcons.hash,
              child: TextFormField(
                controller: _rollController,
                keyboardType: TextInputType.number,
                // Digits only: the server's own check exists because a
                // fractional value slipped through a naive range test, and the
                // cheapest place to make that impossible is the keyboard.
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                validator: _validateRoll,
              ),
            ),
            const SizedBox(height: AppSpacing.space6),
            LabeledField(
              label: l10n.attendanceParentPhoneLabel,
              hint: l10n.attendanceParentPhoneHint,
              leadingIcon: LucideIcons.phone,
              child: TextFormField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                validator: _validatePhone,
              ),
            ),
            const SizedBox(height: AppSpacing.space3),
            NoteBanner(
              icon: LucideIcons.shieldCheck,
              body: l10n.attendanceParentPhonePrivacy,
            ),
            const SizedBox(height: AppSpacing.space6),
            LabeledField(
              label: l10n.attendanceParentLanguageLabel,
              leadingIcon: LucideIcons.languages,
              child: DropdownButtonFormField<AppLocale>(
                initialValue: _language,
                isExpanded: true,
                items: [
                  for (final locale in AppLocale.values)
                    DropdownMenuItem<AppLocale>(
                      value: locale,
                      child: Text(locale.nativeLabel),
                    ),
                ],
                onChanged: (value) =>
                    setState(() => _language = value ?? _language),
              ),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: AppSpacing.space6),
              InlineError(
                title: l10n.attendanceAddStudentFailed,
                message: _errorMessage!,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
