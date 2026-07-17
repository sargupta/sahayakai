import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/domain/picker_options.dart';
import '../../../shared/widgets/result_view.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../domain/instant_answer.dart';
import 'instant_answer_controller.dart';
import 'widgets/instant_answer_error_view.dart';
import 'widgets/instant_answer_result_view.dart';
import 'widgets/instant_answer_skeleton.dart';

/// P0.6 — Instant Answer. The fastest tool in the app: one question in, one
/// grade-tailored answer out. A capped, scrolling form + a sticky submit
/// button ([ToolScaffold]), driven by an AsyncNotifier and rendered through
/// [ResultView] (loading / empty / error / data).
///
/// Only `question` is required; grade, subject and language are optional
/// because the flow back-fills them from the teacher's profile.
class InstantAnswerScreen extends ConsumerStatefulWidget {
  const InstantAnswerScreen({super.key});

  @override
  ConsumerState<InstantAnswerScreen> createState() =>
      _InstantAnswerScreenState();
}

class _InstantAnswerScreenState extends ConsumerState<InstantAnswerScreen> {
  final _formKey = GlobalKey<FormState>();
  final _questionController = TextEditingController();

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
    _questionController.dispose();
    super.dispose();
  }

  void _submit() {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final request = InstantAnswerRequest(
      question: _questionController.text,
      gradeLevel: _grade,
      subject: _subject,
      language: _language.aiName,
    );
    ref.read(instantAnswerControllerProvider.notifier).ask(request);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = ref.watch(instantAnswerControllerProvider);

    final result = state.hasError
        ? InstantAnswerErrorView(error: state.error!, onRetry: _submit)
        : ResultView<InstantAnswer>(
            state: state,
            skeleton: const InstantAnswerSkeleton(),
            emptyMessage: l10n.instantAnswerEmpty,
            onData: (answer) => InstantAnswerResultView(answer: answer),
          );

    return ToolScaffold(
      title: l10n.instantAnswerTitle,
      isBusy: state.isLoading,
      submitLabel: l10n.instantAnswerAction,
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

  Widget _questionField(AppLocalizations l10n) {
    return _Field(
      label: l10n.instantAnswerQuestionLabel,
      child: TextFormField(
        controller: _questionController,
        // The flow rejects anything longer, so stop it here with a counter
        // rather than let the request fail.
        maxLength: kMaxQuestionLength,
        maxLines: 4,
        minLines: 3,
        textInputAction: TextInputAction.newline,
        textCapitalization: TextCapitalization.sentences,
        keyboardType: TextInputType.multiline,
        decoration: InputDecoration(hintText: l10n.instantAnswerQuestionHint),
        validator: (value) => (value == null || value.trim().isEmpty)
            ? l10n.instantAnswerQuestionError
            : null,
      ),
    );
  }

  Widget _gradeField(AppLocalizations l10n) {
    return _Field(
      label: l10n.instantAnswerGradeLabel,
      optionalLabel: l10n.instantAnswerOptional,
      child: DropdownButtonFormField<String?>(
        initialValue: _grade,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.instantAnswerGradeAny),
          ),
          for (final grade in kGradeLevels)
            DropdownMenuItem<String?>(value: grade, child: Text(grade)),
        ],
        onChanged: (value) => setState(() => _grade = value),
      ),
    );
  }

  Widget _subjectField(AppLocalizations l10n) {
    return _Field(
      label: l10n.instantAnswerSubjectLabel,
      optionalLabel: l10n.instantAnswerOptional,
      child: DropdownButtonFormField<String?>(
        initialValue: _subject,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.instantAnswerSubjectAny),
          ),
          for (final subject in kSubjects)
            DropdownMenuItem<String?>(value: subject, child: Text(subject)),
        ],
        onChanged: (value) => setState(() => _subject = value),
      ),
    );
  }

  Widget _languageField(AppLocalizations l10n) {
    return _Field(
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

/// A labelled form row: a weight-first label (with an optional "Optional"
/// marker) and its control. On the 4dp grid throughout. Mirrors the quiz and
/// lesson-plan forms.
class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.child,
    this.optionalLabel,
  });

  final String label;
  final String? optionalLabel;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Flexible(
              child: Text(
                label,
                style: text.titleSmall?.copyWith(letterSpacing: 0.2),
              ),
            ),
            if (optionalLabel != null) ...[
              const SizedBox(width: AppSpacing.space2),
              Text(
                optionalLabel!,
                style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
              ),
            ],
          ],
        ),
        const SizedBox(height: AppSpacing.space3),
        child,
      ],
    );
  }
}
