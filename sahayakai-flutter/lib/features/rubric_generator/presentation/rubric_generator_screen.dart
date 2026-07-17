import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/domain/picker_options.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/result_view.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../domain/rubric.dart';
import 'rubric_controller.dart';
import 'widgets/rubric_error_view.dart';
import 'widgets/rubric_result_view.dart';
import 'widgets/rubric_skeleton.dart';

/// P1.2 — the Rubric Generator. A capped, scrolling form + a sticky Generate
/// button ([ToolScaffold]), driven by an AsyncNotifier and rendered through
/// [ResultView] (loading / empty / error / data). The result is a criteria x
/// performance-levels grid that scrolls horizontally inside its own box
/// (see [RubricResultView] / RubricGrid), so the page never scrolls sideways.
class RubricGeneratorScreen extends ConsumerStatefulWidget {
  const RubricGeneratorScreen({super.key});

  @override
  ConsumerState<RubricGeneratorScreen> createState() =>
      _RubricGeneratorScreenState();
}

class _RubricGeneratorScreenState extends ConsumerState<RubricGeneratorScreen> {
  final _formKey = GlobalKey<FormState>();
  final _assignmentController = TextEditingController();

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
    _assignmentController.dispose();
    super.dispose();
  }

  void _submit() {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final request = RubricRequest(
      assignmentDescription: _assignmentController.text,
      gradeLevel: _grade,
      subject: _subject,
      language: _language.aiName,
    );
    ref.read(rubricControllerProvider.notifier).generate(request);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = ref.watch(rubricControllerProvider);

    final result = state.hasError
        ? RubricErrorView(error: state.error!, onRetry: _submit)
        : ResultView<Rubric>(
            state: state,
            skeleton: const RubricSkeleton(),
            emptyMessage: l10n.rubricEmpty,
            onData: (rubric) => RubricResultView(rubric: rubric),
          );

    return ToolScaffold(
      title: l10n.rubricTitle,
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
            _assignmentField(l10n),
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

  Widget _assignmentField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.rubricAssignmentLabel,
      hint: l10n.rubricAssignmentHint,
      child: TextFormField(
        controller: _assignmentController,
        maxLength: 2000,
        maxLines: 5,
        minLines: 3,
        textInputAction: TextInputAction.newline,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(hintText: l10n.rubricAssignmentPlaceholder),
        validator: (value) => (value == null || value.trim().isEmpty)
            ? l10n.rubricAssignmentError
            : null,
      ),
    );
  }

  Widget _gradeField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.rubricGradeLabel,
      optionalLabel: l10n.rubricOptional,
      child: DropdownButtonFormField<String?>(
        initialValue: _grade,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.rubricGradeAny),
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
      label: l10n.rubricSubjectLabel,
      optionalLabel: l10n.rubricOptional,
      child: DropdownButtonFormField<String?>(
        initialValue: _subject,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.rubricSubjectAny),
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
