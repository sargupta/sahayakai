import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/domain/picker_options.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/result_view.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../domain/parent_message.dart';
import 'parent_message_controller.dart';
import 'widgets/parent_message_error_view.dart';
import 'widgets/parent_message_result_view.dart';
import 'widgets/parent_message_skeleton.dart';

/// P1.5 — Parent Message. A teacher drafts an empathetic, ready-to-send message
/// to a student's parent, in the PARENT'S language (distinct from the app UI
/// language). A capped, scrolling form + a sticky action button
/// ([ToolScaffold]), driven by an AsyncNotifier and rendered through
/// [ResultView] (loading / empty / error / data).
///
/// Five fields are required by the endpoint (student, class, subject, reason,
/// parent's language) and the form validates all five before it can submit, so
/// the request can never trip the backend's 400. The remaining fields are
/// optional; the absent-days field appears only for an absence message.
class ParentMessageScreen extends ConsumerStatefulWidget {
  const ParentMessageScreen({super.key});

  @override
  ConsumerState<ParentMessageScreen> createState() =>
      _ParentMessageScreenState();
}

class _ParentMessageScreenState extends ConsumerState<ParentMessageScreen> {
  final _formKey = GlobalKey<FormState>();
  final _studentNameController = TextEditingController();
  final _classNameController = TextEditingController();
  final _reasonContextController = TextEditingController();
  final _teacherNoteController = TextEditingController();
  final _absentDaysController = TextEditingController();
  final _teacherNameController = TextEditingController();
  final _schoolNameController = TextEditingController();

  String? _subject;
  ParentMessageReason? _reason;

  /// The parent's language. Starts unset ON PURPOSE — it is required and drives
  /// the output language, so the teacher must choose it (the validator blocks
  /// submit until they do). It is NOT defaulted to the UI locale, which would
  /// silently draft in the wrong language for a parent who speaks another.
  AppLocale? _parentLanguage;

  @override
  void dispose() {
    _studentNameController.dispose();
    _classNameController.dispose();
    _reasonContextController.dispose();
    _teacherNoteController.dispose();
    _absentDaysController.dispose();
    _teacherNameController.dispose();
    _schoolNameController.dispose();
    super.dispose();
  }

  void _submit() {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final request = ParentMessageRequest(
      studentName: _studentNameController.text,
      className: _classNameController.text,
      subject: _subject!,
      reason: _reason!,
      parentLanguage: _parentLanguage!.aiName,
      reasonContext: _reasonContextController.text,
      teacherNote: _teacherNoteController.text,
      consecutiveAbsentDays: int.tryParse(_absentDaysController.text.trim()),
      teacherName: _teacherNameController.text,
      schoolName: _schoolNameController.text,
    );
    ref.read(parentMessageControllerProvider.notifier).draft(request);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = ref.watch(parentMessageControllerProvider);

    final result = state.hasError
        ? ParentMessageErrorView(error: state.error!, onRetry: _submit)
        : ResultView<ParentMessage>(
            state: state,
            skeleton: const ParentMessageSkeleton(),
            emptyMessage: l10n.parentMessageEmpty,
            onData: (message) => ParentMessageResultView(message: message),
          );

    return ToolScaffold(
      title: l10n.parentMessageTitle,
      isBusy: state.isLoading,
      submitLabel: l10n.parentMessageAction,
      onSubmit: state.isLoading ? null : _submit,
      result: result,
      child: Form(
        key: _formKey,
        autovalidateMode: AutovalidateMode.onUserInteraction,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            _studentNameField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _classNameField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _subjectField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _reasonField(l10n),
            if (_reason?.isAbsence ?? false) ...[
              const SizedBox(height: AppSpacing.space6),
              _absentDaysField(l10n),
            ],
            const SizedBox(height: AppSpacing.space6),
            _parentLanguageField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _reasonContextField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _teacherNoteField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _teacherNameField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _schoolNameField(l10n),
          ],
        ),
      ),
    );
  }

  Widget _studentNameField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.parentMessageStudentLabel,
      child: TextFormField(
        controller: _studentNameController,
        textCapitalization: TextCapitalization.words,
        textInputAction: TextInputAction.next,
        decoration:
            InputDecoration(hintText: l10n.parentMessageStudentPlaceholder),
        validator: (value) => (value == null || value.trim().isEmpty)
            ? l10n.parentMessageStudentError
            : null,
      ),
    );
  }

  Widget _classNameField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.parentMessageClassLabel,
      child: TextFormField(
        controller: _classNameController,
        textCapitalization: TextCapitalization.characters,
        textInputAction: TextInputAction.next,
        decoration:
            InputDecoration(hintText: l10n.parentMessageClassPlaceholder),
        validator: (value) => (value == null || value.trim().isEmpty)
            ? l10n.parentMessageClassError
            : null,
      ),
    );
  }

  Widget _subjectField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.parentMessageSubjectLabel,
      child: DropdownButtonFormField<String>(
        initialValue: _subject,
        isExpanded: true,
        hint: Text(l10n.parentMessageSubjectHint),
        items: [
          for (final subject in kSubjects)
            DropdownMenuItem<String>(value: subject, child: Text(subject)),
        ],
        onChanged: (value) => setState(() => _subject = value),
        validator: (value) =>
            value == null ? l10n.parentMessageSubjectError : null,
      ),
    );
  }

  Widget _reasonField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.parentMessageReasonLabel,
      child: DropdownButtonFormField<ParentMessageReason>(
        initialValue: _reason,
        isExpanded: true,
        hint: Text(l10n.parentMessageReasonHint),
        items: [
          for (final reason in ParentMessageReason.values)
            DropdownMenuItem<ParentMessageReason>(
              value: reason,
              child: Text(_reasonLabel(l10n, reason)),
            ),
        ],
        onChanged: (value) => setState(() => _reason = value),
        validator: (value) =>
            value == null ? l10n.parentMessageReasonError : null,
      ),
    );
  }

  Widget _absentDaysField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.parentMessageAbsentDaysLabel,
      optionalLabel: l10n.parentMessageOptional,
      hint: l10n.parentMessageAbsentDaysHint,
      child: TextFormField(
        controller: _absentDaysController,
        keyboardType: TextInputType.number,
        textInputAction: TextInputAction.next,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        decoration:
            InputDecoration(hintText: l10n.parentMessageAbsentDaysPlaceholder),
      ),
    );
  }

  Widget _parentLanguageField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.parentMessageParentLanguageLabel,
      hint: l10n.parentMessageParentLanguageHint,
      child: DropdownButtonFormField<AppLocale>(
        initialValue: _parentLanguage,
        isExpanded: true,
        hint: Text(l10n.parentMessageParentLanguagePlaceholder),
        items: [
          for (final locale in AppLocale.values)
            DropdownMenuItem<AppLocale>(
              value: locale,
              child: Text(locale.nativeLabel),
            ),
        ],
        onChanged: (value) => setState(() => _parentLanguage = value),
        validator: (value) =>
            value == null ? l10n.parentMessageParentLanguageError : null,
      ),
    );
  }

  Widget _reasonContextField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.parentMessageContextLabel,
      optionalLabel: l10n.parentMessageOptional,
      hint: l10n.parentMessageContextHint,
      child: TextFormField(
        controller: _reasonContextController,
        maxLines: 3,
        minLines: 2,
        textCapitalization: TextCapitalization.sentences,
        keyboardType: TextInputType.multiline,
        decoration:
            InputDecoration(hintText: l10n.parentMessageContextPlaceholder),
      ),
    );
  }

  Widget _teacherNoteField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.parentMessageNoteLabel,
      optionalLabel: l10n.parentMessageOptional,
      hint: l10n.parentMessageNoteHint,
      child: TextFormField(
        controller: _teacherNoteController,
        maxLines: 3,
        minLines: 2,
        textCapitalization: TextCapitalization.sentences,
        keyboardType: TextInputType.multiline,
        decoration:
            InputDecoration(hintText: l10n.parentMessageNotePlaceholder),
      ),
    );
  }

  Widget _teacherNameField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.parentMessageTeacherNameLabel,
      optionalLabel: l10n.parentMessageOptional,
      hint: l10n.parentMessageTeacherNameHint,
      child: TextFormField(
        controller: _teacherNameController,
        textCapitalization: TextCapitalization.words,
        textInputAction: TextInputAction.next,
        decoration:
            InputDecoration(hintText: l10n.parentMessageTeacherNamePlaceholder),
      ),
    );
  }

  Widget _schoolNameField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.parentMessageSchoolNameLabel,
      optionalLabel: l10n.parentMessageOptional,
      child: TextFormField(
        controller: _schoolNameController,
        textCapitalization: TextCapitalization.words,
        textInputAction: TextInputAction.done,
        decoration:
            InputDecoration(hintText: l10n.parentMessageSchoolNamePlaceholder),
      ),
    );
  }

  String _reasonLabel(AppLocalizations l10n, ParentMessageReason reason) {
    switch (reason) {
      case ParentMessageReason.consecutiveAbsences:
        return l10n.parentMessageReasonAbsences;
      case ParentMessageReason.poorPerformance:
        return l10n.parentMessageReasonPerformance;
      case ParentMessageReason.behavioralConcern:
        return l10n.parentMessageReasonBehavior;
      case ParentMessageReason.positiveFeedback:
        return l10n.parentMessageReasonPositive;
    }
  }
}
