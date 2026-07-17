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
import '../domain/teacher_advice.dart';
import 'teacher_training_controller.dart';
import 'widgets/teacher_training_error_view.dart';
import 'widgets/teacher_training_result_view.dart';
import 'widgets/teacher_training_skeleton.dart';

/// P1.4 — the Teaching Coach. A teacher asks a professional-development question
/// and gets back pedagogically-grounded strategies. A capped, scrolling form + a
/// sticky action button ([ToolScaffold]), driven by an AsyncNotifier and
/// rendered through [ResultView] (loading / empty / error / data).
///
/// Only `question` is required; subject and language are optional because the
/// flow back-fills them from the teacher's profile. There is no grade field:
/// the endpoint's input schema has none.
class TeacherTrainingScreen extends ConsumerStatefulWidget {
  const TeacherTrainingScreen({super.key});

  @override
  ConsumerState<TeacherTrainingScreen> createState() =>
      _TeacherTrainingScreenState();
}

class _TeacherTrainingScreenState extends ConsumerState<TeacherTrainingScreen> {
  final _formKey = GlobalKey<FormState>();
  final _questionController = TextEditingController();

  String? _subject;
  late AppLocale _language;

  @override
  void initState() {
    super.initState();
    _language = ref.read(localeControllerProvider);
  }

  @override
  void dispose() {
    _questionController.dispose();
    super.dispose();
  }

  void _submit() {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final request = TeacherTrainingRequest(
      question: _questionController.text,
      subject: _subject,
      language: _language.aiName,
    );
    ref.read(teacherTrainingControllerProvider.notifier).ask(request);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = ref.watch(teacherTrainingControllerProvider);

    final result = state.hasError
        ? TeacherTrainingErrorView(error: state.error!, onRetry: _submit)
        : ResultView<TeacherAdvice>(
            state: state,
            skeleton: const TeacherTrainingSkeleton(),
            emptyMessage: l10n.teacherTrainingEmpty,
            onData: (advice) => TeacherTrainingResultView(advice: advice),
          );

    return ToolScaffold(
      title: l10n.teacherTrainingTitle,
      isBusy: state.isLoading,
      submitLabel: l10n.teacherTrainingAction,
      onSubmit: state.isLoading ? null : _submit,
      result: result,
      child: Form(
        key: _formKey,
        autovalidateMode: AutovalidateMode.onUserInteraction,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            _questionField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _subjectField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _languageField(l10n),
          ],
        ),
      ),
    );
  }

  Widget _questionField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.teacherTrainingQuestionLabel,
      hint: l10n.teacherTrainingQuestionHint,
      child: TextFormField(
        controller: _questionController,
        // The endpoint rejects anything longer, so stop it here with a counter
        // rather than let the request fail.
        maxLength: kMaxTeacherTrainingQuestionLength,
        maxLines: 5,
        minLines: 3,
        textInputAction: TextInputAction.newline,
        textCapitalization: TextCapitalization.sentences,
        keyboardType: TextInputType.multiline,
        decoration:
            InputDecoration(hintText: l10n.teacherTrainingQuestionPlaceholder),
        validator: (value) => (value == null || value.trim().isEmpty)
            ? l10n.teacherTrainingQuestionError
            : null,
      ),
    );
  }

  Widget _subjectField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.teacherTrainingSubjectLabel,
      optionalLabel: l10n.teacherTrainingOptional,
      child: DropdownButtonFormField<String?>(
        initialValue: _subject,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.teacherTrainingSubjectAny),
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
