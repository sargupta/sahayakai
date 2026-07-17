import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/domain/picker_options.dart';
import '../../../shared/media/image_input.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/result_view.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../domain/worksheet.dart';
import 'worksheet_controller.dart';
import 'widgets/worksheet_error_view.dart';
import 'widgets/worksheet_result_view.dart';
import 'widgets/worksheet_skeleton.dart';

/// P1.1 — the Worksheet Wizard. A capped, scrolling form + a sticky Generate
/// button ([ToolScaffold]), driven by an AsyncNotifier and rendered through
/// [ResultView] (loading / empty / error / data). Unlike the text tools, the
/// worksheet REQUIRES a textbook-page photo, captured through the shared
/// [ImageInput] and sent as a base64 data URI.
class WorksheetWizardScreen extends ConsumerStatefulWidget {
  const WorksheetWizardScreen({super.key});

  @override
  ConsumerState<WorksheetWizardScreen> createState() =>
      _WorksheetWizardScreenState();
}

class _WorksheetWizardScreenState extends ConsumerState<WorksheetWizardScreen> {
  final _formKey = GlobalKey<FormState>();
  final _promptController = TextEditingController();

  PickedImage? _image;
  String? _grade;
  String? _subject;
  late AppLocale _language;

  @override
  void initState() {
    super.initState();
    _language = ref.read(localeControllerProvider);
  }

  @override
  void dispose() {
    _promptController.dispose();
    super.dispose();
  }

  void _submit() {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    // The image is validated by its FormField above, so it is non-null here.
    final request = WorksheetRequest(
      imageDataUri: _image!.dataUri,
      prompt: _promptController.text,
      gradeLevel: _grade,
      subject: _subject,
      language: _language.aiName,
    );
    ref.read(worksheetControllerProvider.notifier).generate(request);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = ref.watch(worksheetControllerProvider);

    final result = state.hasError
        ? WorksheetErrorView(error: state.error!, onRetry: _submit)
        : ResultView<Worksheet>(
            state: state,
            skeleton: const WorksheetSkeleton(),
            emptyMessage: l10n.worksheetEmpty,
            onData: (worksheet) => WorksheetResultView(worksheet: worksheet),
          );

    return ToolScaffold(
      title: l10n.worksheetTitle,
      isBusy: state.isLoading,
      submitLabel: l10n.actionGenerate,
      onSubmit: state.isLoading ? null : _submit,
      result: result,
      child: Form(
        key: _formKey,
        autovalidateMode: AutovalidateMode.onUserInteraction,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            _imageField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _promptField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _gradeField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _subjectField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _languageField(l10n),
          ],
        ),
      ),
    );
  }

  /// The image is required by the endpoint, so it is a real [FormField]: its
  /// "required" error joins the form's own validation pass and clears the
  /// moment a photo is picked.
  Widget _imageField(AppLocalizations l10n) {
    return FormField<PickedImage>(
      initialValue: _image,
      validator: (value) => value == null ? l10n.worksheetImageError : null,
      builder: (field) {
        return LabeledField(
          label: l10n.worksheetImageLabel,
          hint: l10n.worksheetImageHint,
          child: ImageInput(
            value: _image,
            errorText: field.errorText,
            onChanged: (picked) {
              setState(() => _image = picked);
              field.didChange(picked);
            },
          ),
        );
      },
    );
  }

  Widget _promptField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.worksheetPromptLabel,
      child: TextFormField(
        controller: _promptController,
        maxLength: 2000,
        maxLines: 4,
        minLines: 2,
        textInputAction: TextInputAction.newline,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(hintText: l10n.worksheetPromptHint),
        validator: (value) => (value == null || value.trim().isEmpty)
            ? l10n.worksheetPromptError
            : null,
      ),
    );
  }

  Widget _gradeField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.worksheetGradeLabel,
      optionalLabel: l10n.worksheetOptional,
      child: DropdownButtonFormField<String?>(
        initialValue: _grade,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.worksheetGradeAny),
          ),
          for (final grade in kGradeLevels)
            DropdownMenuItem<String?>(value: grade, child: Text(grade)),
        ],
        onChanged: (value) => setState(() => _grade = value),
      ),
    );
  }

  Widget _subjectField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.worksheetSubjectLabel,
      optionalLabel: l10n.worksheetOptional,
      child: DropdownButtonFormField<String?>(
        initialValue: _subject,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.worksheetSubjectAny),
          ),
          for (final subject in kSubjects)
            DropdownMenuItem<String?>(value: subject, child: Text(subject)),
        ],
        onChanged: (value) => setState(() => _subject = value),
      ),
    );
  }

  Widget _languageField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.languageLabel,
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
        onChanged: (value) => setState(() => _language = value ?? _language),
      ),
    );
  }
}
