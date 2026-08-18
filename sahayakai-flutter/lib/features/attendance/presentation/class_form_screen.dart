import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/domain/picker_options.dart';
import '../../../shared/widgets/inline_error.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../data/attendance_repository.dart';
import '../data/dto/attendance_dtos.dart';
import '../domain/attendance_date.dart';
import '../domain/attendance_write_result.dart';
import 'attendance_failure.dart';
import 'attendance_providers.dart';
import 'widgets/attendance_premium_card.dart';

/// Creates a class.
///
/// **There is no edit path, and its absence is deliberate.** The repository
/// binds the ten attendance routes that are shipped, and none of them updates
/// a class: there is a `POST classes` and a `GET classes/{id}`, and nothing in
/// between. A form that looked editable and silently discarded the change, or
/// a `PATCH` invented against a route that may not exist, would both be worse
/// than this screen only doing the thing the server can actually do. When an
/// update route lands, this same form takes an existing `AttendanceClass` and
/// becomes the edit path; nothing here would need re-designing.
///
/// The write is premium-gated. A 403 `PREMIUM_REQUIRED` arrives as the VALUE
/// `AttendanceWriteBlockedByPlan`, so it replaces the form with
/// [AttendancePremiumCard] instead of raising an error — see
/// `domain/attendance_write_result.dart`.
class ClassFormScreen extends ConsumerStatefulWidget {
  const ClassFormScreen({super.key});

  @override
  ConsumerState<ClassFormScreen> createState() => _ClassFormScreenState();
}

class _ClassFormScreenState extends ConsumerState<ClassFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _sectionController = TextEditingController();
  late final TextEditingController _yearController;

  String _subject = kSubjects.first;
  String _grade = kGradeLevels.first;

  bool _isBusy = false;

  /// The plan gate fired. The form is replaced by the upsell; nothing about
  /// this is an error, so no [InlineError] is shown alongside it.
  bool _blockedByPlan = false;

  /// A failed create, already mapped to localized copy.
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    // Seeded from the IST window, never from the device clock: a teacher
    // opening this at 00:30 IST is still in the same academic year the server
    // is, and `AttendanceWindow` is the one place "today" is decided.
    _yearController = TextEditingController(
      text: _academicYearFor(ref.read(attendanceWindowProvider).today),
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _sectionController.dispose();
    _yearController.dispose();
    super.dispose();
  }

  /// The Indian academic year containing [today], as `2026-27`. Sessions run
  /// April to March, so January to March still belongs to the year that
  /// started the previous April.
  static String _academicYearFor(AttendanceDate today) {
    final startYear = today.month >= 4 ? today.year : today.year - 1;
    final endShort = (startYear + 1) % 100;
    return '$startYear-${endShort.toString().padLeft(2, '0')}';
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
          .createClass(
            CreateClassRequestDto.build(
              name: _nameController.text,
              subject: _subject,
              gradeLevel: _grade,
              academicYear: _yearController.text,
              section: _sectionController.text,
            ),
          );
      if (!mounted) return;

      switch (result) {
        case AttendanceWriteAccepted<String>():
          // The list below this route is still mounted, so invalidating makes
          // it refetch and the new class is there when the pop lands.
          ref.invalidate(attendanceClassesProvider);
          ScaffoldMessenger.of(context)
            ..clearSnackBars()
            ..showSnackBar(
              SnackBar(content: Text(l10n.attendanceClassCreated)),
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
          fallback: l10n.attendanceCreateClassFailed,
        );
      });
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    if (_blockedByPlan) {
      return ToolScaffold(
        title: l10n.attendanceNewClass,
        child: const AttendancePremiumCard(),
      );
    }

    return ToolScaffold(
      title: l10n.attendanceNewClass,
      onSubmit: _isBusy ? null : () => unawaited(_submit()),
      submitLabel: l10n.attendanceCreateClassSubmit,
      isBusy: _isBusy,
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            LabeledField(
              label: l10n.attendanceClassNameLabel,
              hint: l10n.attendanceClassNameHint,
              leadingIcon: LucideIcons.users,
              child: TextFormField(
                controller: _nameController,
                textCapitalization: TextCapitalization.words,
                validator: (value) => (value?.trim().isEmpty ?? true)
                    ? l10n.attendanceClassNameRequired
                    : null,
              ),
            ),
            const SizedBox(height: AppSpacing.space6),
            LabeledField(
              label: l10n.attendanceSubjectLabel,
              leadingIcon: LucideIcons.bookOpen,
              child: DropdownButtonFormField<String>(
                initialValue: _subject,
                isExpanded: true,
                items: [
                  for (final subject in kSubjects)
                    DropdownMenuItem<String>(
                      value: subject,
                      child: Text(subject),
                    ),
                ],
                onChanged: (value) =>
                    setState(() => _subject = value ?? _subject),
              ),
            ),
            const SizedBox(height: AppSpacing.space6),
            LabeledField(
              label: l10n.attendanceGradeLabel,
              leadingIcon: LucideIcons.graduationCap,
              child: DropdownButtonFormField<String>(
                initialValue: _grade,
                isExpanded: true,
                items: [
                  for (final grade in kGradeLevels)
                    DropdownMenuItem<String>(value: grade, child: Text(grade)),
                ],
                onChanged: (value) => setState(() => _grade = value ?? _grade),
              ),
            ),
            const SizedBox(height: AppSpacing.space6),
            LabeledField(
              label: l10n.attendanceAcademicYearLabel,
              hint: l10n.attendanceAcademicYearHint,
              leadingIcon: LucideIcons.calendar,
              child: TextFormField(
                controller: _yearController,
                validator: (value) => (value?.trim().isEmpty ?? true)
                    ? l10n.attendanceAcademicYearRequired
                    : null,
              ),
            ),
            const SizedBox(height: AppSpacing.space6),
            LabeledField(
              label: l10n.attendanceSectionLabel,
              optionalLabel: l10n.parentMessageOptional,
              hint: l10n.attendanceSectionHint,
              leadingIcon: LucideIcons.tag,
              child: TextFormField(
                controller: _sectionController,
                textCapitalization: TextCapitalization.characters,
              ),
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: AppSpacing.space6),
              InlineError(
                title: l10n.attendanceCreateClassFailed,
                message: _errorMessage!,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
