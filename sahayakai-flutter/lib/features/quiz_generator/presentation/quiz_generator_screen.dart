import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/domain/picker_options.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/result_view.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../domain/quiz.dart';
import '../domain/quiz_options.dart';
import 'quiz_controller.dart';
import 'widgets/quiz_error_view.dart';
import 'widgets/quiz_result_view.dart';
import 'widgets/quiz_skeleton.dart';

/// P0.5 — the Quiz Generator. A capped, scrolling form + a sticky Generate
/// button ([ToolScaffold]), driven by an AsyncNotifier and rendered through
/// [ResultView] (loading / empty / error / data). The result is up to three
/// difficulty variants, each on its own tab.
class QuizGeneratorScreen extends ConsumerStatefulWidget {
  const QuizGeneratorScreen({super.key});

  @override
  ConsumerState<QuizGeneratorScreen> createState() =>
      _QuizGeneratorScreenState();
}

class _QuizGeneratorScreenState extends ConsumerState<QuizGeneratorScreen> {
  final _formKey = GlobalKey<FormState>();
  final _topicController = TextEditingController();

  int _numQuestions = kDefaultQuestions;
  // Mirrors the web form's defaults so the two clients start a teacher off in
  // the same place.
  final Set<QuestionType> _types = <QuestionType>{
    QuestionType.multipleChoice,
    QuestionType.shortAnswer,
  };
  final Set<String> _blooms = <String>{...kDefaultBloomsTaxonomyLevels};
  String? _grade;
  String? _subject;
  late AppLocale _language;

  /// `null` means "no target" — the endpoint then returns all three variants,
  /// which is the useful default for a teacher planning a mixed class.
  QuizDifficulty? _targetDifficulty;

  @override
  void initState() {
    super.initState();
    _language = ref.read(localeControllerProvider);
  }

  @override
  void dispose() {
    _topicController.dispose();
    super.dispose();
  }

  void _submit() {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final request = QuizRequest(
      topic: _topicController.text,
      questionTypes: _types.toList(growable: false),
      numQuestions: _numQuestions,
      gradeLevel: _grade,
      subject: _subject,
      language: _language.aiName,
      targetDifficulty: _targetDifficulty,
      bloomsTaxonomyLevels: _blooms.toList(growable: false),
    );
    ref.read(quizControllerProvider.notifier).generate(request);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = ref.watch(quizControllerProvider);

    final result = state.hasError
        ? QuizErrorView(error: state.error!, onRetry: _submit)
        : ResultView<Quiz>(
            state: state,
            skeleton: const QuizSkeleton(),
            emptyMessage: l10n.quizEmpty,
            onData: (quiz) => QuizResultView(quiz: quiz),
          );

    return ToolScaffold(
      title: l10n.quizTitle,
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
            _topicField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _numQuestionsField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _questionTypesField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _gradeField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _subjectField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _languageField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _difficultyField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _bloomsField(l10n),
          ],
        ),
      ),
    );
  }

  Widget _topicField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.quizTopicLabel,
      child: TextFormField(
        controller: _topicController,
        maxLength: 1000,
        maxLines: 2,
        minLines: 1,
        textInputAction: TextInputAction.done,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(hintText: l10n.quizTopicHint),
        validator: (value) => (value == null || value.trim().isEmpty)
            ? l10n.quizTopicError
            : null,
      ),
    );
  }

  Widget _numQuestionsField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.quizNumQuestionsLabel,
      child: _Stepper(
        value: _numQuestions,
        min: kMinQuestions,
        max: kMaxQuestions,
        decrementTooltip: l10n.quizFewerQuestions,
        incrementTooltip: l10n.quizMoreQuestions,
        onChanged: (value) => setState(() => _numQuestions = value),
      ),
    );
  }

  /// At least one type is required by the endpoint, so this is a real
  /// [FormField] and its error sits in the form's own validation pass.
  Widget _questionTypesField(AppLocalizations l10n) {
    return FormField<Set<QuestionType>>(
      initialValue: _types,
      validator: (value) =>
          (value == null || value.isEmpty) ? l10n.quizTypesError : null,
      builder: (field) {
        return LabeledField(
          label: l10n.quizTypesLabel,
          errorText: field.errorText,
          child: Wrap(
            spacing: AppSpacing.space2,
            runSpacing: AppSpacing.space2,
            children: [
              for (final type in QuestionType.values)
                FilterChip(
                  label: Text(_typeLabel(l10n, type)),
                  selected: _types.contains(type),
                  materialTapTargetSize: MaterialTapTargetSize.padded,
                  onSelected: (selected) {
                    setState(() {
                      if (selected) {
                        _types.add(type);
                      } else {
                        _types.remove(type);
                      }
                    });
                    field.didChange(_types);
                  },
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _gradeField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.quizGradeLabel,
      optionalLabel: l10n.quizOptional,
      child: DropdownButtonFormField<String?>(
        initialValue: _grade,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.quizGradeAny),
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
      label: l10n.quizSubjectLabel,
      optionalLabel: l10n.quizOptional,
      child: DropdownButtonFormField<String?>(
        initialValue: _subject,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.quizSubjectAny),
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

  Widget _difficultyField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.quizDifficultyLabel,
      hint: l10n.quizDifficultyHint,
      child: Wrap(
        spacing: AppSpacing.space2,
        runSpacing: AppSpacing.space2,
        children: [
          ChoiceChip(
            label: Text(l10n.quizDifficultyAll),
            selected: _targetDifficulty == null,
            materialTapTargetSize: MaterialTapTargetSize.padded,
            onSelected: (selected) {
              if (selected) setState(() => _targetDifficulty = null);
            },
          ),
          for (final difficulty in QuizDifficulty.values)
            ChoiceChip(
              label: Text(_difficultyLabel(l10n, difficulty)),
              selected: _targetDifficulty == difficulty,
              materialTapTargetSize: MaterialTapTargetSize.padded,
              onSelected: (selected) {
                if (selected) setState(() => _targetDifficulty = difficulty);
              },
            ),
        ],
      ),
    );
  }

  Widget _bloomsField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.quizBloomsLabel,
      optionalLabel: l10n.quizOptional,
      hint: l10n.quizBloomsHint,
      child: Wrap(
        spacing: AppSpacing.space2,
        runSpacing: AppSpacing.space2,
        children: [
          for (final level in kBloomsTaxonomyLevels)
            FilterChip(
              label: Text(level),
              selected: _blooms.contains(level),
              materialTapTargetSize: MaterialTapTargetSize.padded,
              onSelected: (selected) => setState(() {
                if (selected) {
                  _blooms.add(level);
                } else {
                  _blooms.remove(level);
                }
              }),
            ),
        ],
      ),
    );
  }
}

/// A labelled form row: a weight-first label (with an optional "Optional"
/// marker), an optional hint, its control, and an optional error line. On the
/// 4dp grid throughout.

/// A -/+ counter. Both buttons are full 48dp targets and the value sits between
/// them, so the control reads at a glance and never overflows at 360dp.
class _Stepper extends StatelessWidget {
  const _Stepper({
    required this.value,
    required this.min,
    required this.max,
    required this.onChanged,
    required this.decrementTooltip,
    required this.incrementTooltip,
  });

  final int value;
  final int min;
  final int max;
  final ValueChanged<int> onChanged;
  final String decrementTooltip;
  final String incrementTooltip;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Row(
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: AppRadius.rMd,
            border: Border.all(color: scheme.outline),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                onPressed: value > min ? () => onChanged(value - 1) : null,
                tooltip: decrementTooltip,
                icon: const Icon(LucideIcons.minus, size: AppIconSize.inline),
              ),
              ConstrainedBox(
                constraints: const BoxConstraints(minWidth: 40),
                child: Text(
                  '$value',
                  textAlign: TextAlign.center,
                  style: text.titleMedium,
                ),
              ),
              IconButton(
                onPressed: value < max ? () => onChanged(value + 1) : null,
                tooltip: incrementTooltip,
                icon: const Icon(LucideIcons.plus, size: AppIconSize.inline),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

String _difficultyLabel(AppLocalizations l10n, QuizDifficulty difficulty) =>
    switch (difficulty) {
      QuizDifficulty.easy => l10n.quizDifficultyEasy,
      QuizDifficulty.medium => l10n.quizDifficultyMedium,
      QuizDifficulty.hard => l10n.quizDifficultyHard,
    };

String _typeLabel(AppLocalizations l10n, QuestionType type) => switch (type) {
  QuestionType.multipleChoice => l10n.quizTypeMultipleChoice,
  QuestionType.fillInTheBlanks => l10n.quizTypeFillInTheBlanks,
  QuestionType.shortAnswer => l10n.quizTypeShortAnswer,
  QuestionType.trueFalse => l10n.quizTypeTrueFalse,
};
