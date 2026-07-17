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
import '../domain/lesson_plan.dart';
import 'lesson_plan_controller.dart';
import 'widgets/lesson_plan_error_view.dart';
import 'widgets/lesson_plan_result_view.dart';
import 'widgets/lesson_plan_skeleton.dart';

/// P0.4 — the flagship Lesson Plan Generator. A capped, scrolling form + a
/// sticky Generate button ([ToolScaffold]), driven by an AsyncNotifier and
/// rendered through [ResultView] (loading / empty / error / data).
class LessonPlanScreen extends ConsumerStatefulWidget {
  const LessonPlanScreen({super.key});

  @override
  ConsumerState<LessonPlanScreen> createState() => _LessonPlanScreenState();
}

class _LessonPlanScreenState extends ConsumerState<LessonPlanScreen> {
  final _formKey = GlobalKey<FormState>();
  final _topicController = TextEditingController();

  final Set<String> _grades = <String>{};
  String? _subject;
  late AppLocale _language;
  ResourceLevel _resource = ResourceLevel.low;
  DifficultyLevel _difficulty = DifficultyLevel.standard;
  bool _useRuralContext = true;

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
    final request = LessonPlanRequest(
      topic: _topicController.text,
      language: _language.aiName,
      gradeLevels: _grades.toList(growable: false),
      subject: _subject,
      resourceLevel: _resource,
      difficultyLevel: _difficulty,
      useRuralContext: _useRuralContext,
    );
    ref.read(lessonPlanControllerProvider.notifier).generate(request);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = ref.watch(lessonPlanControllerProvider);

    final result = state.hasError
        ? LessonPlanErrorView(error: state.error!, onRetry: _submit)
        : ResultView<LessonPlan>(
            state: state,
            skeleton: const LessonPlanSkeleton(),
            emptyMessage: l10n.lessonPlanEmpty,
            onData: (plan) => LessonPlanResultView(plan: plan),
          );

    return ToolScaffold(
      title: l10n.lessonPlanTitle,
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
            _gradeField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _subjectField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _languageField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _resourceField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _difficultyField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _ruralField(l10n),
          ],
        ),
      ),
    );
  }

  Widget _topicField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.lessonPlanTopicLabel,
      child: TextFormField(
        controller: _topicController,
        maxLength: 1000,
        maxLines: 2,
        minLines: 1,
        textInputAction: TextInputAction.done,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(hintText: l10n.lessonPlanTopicHint),
        validator: (value) => (value == null || value.trim().isEmpty)
            ? l10n.lessonPlanTopicError
            : null,
      ),
    );
  }

  Widget _gradeField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.lessonPlanGradeLabel,
      optionalLabel: l10n.lessonPlanOptional,
      child: Wrap(
        spacing: AppSpacing.space2,
        runSpacing: AppSpacing.space2,
        children: [
          for (final grade in kGradeLevels)
            FilterChip(
              label: Text(grade),
              selected: _grades.contains(grade),
              materialTapTargetSize: MaterialTapTargetSize.padded,
              onSelected: (selected) => setState(() {
                if (selected) {
                  _grades.add(grade);
                } else {
                  _grades.remove(grade);
                }
              }),
            ),
        ],
      ),
    );
  }

  Widget _subjectField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.lessonPlanSubjectLabel,
      optionalLabel: l10n.lessonPlanOptional,
      child: DropdownButtonFormField<String?>(
        initialValue: _subject,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.lessonPlanSubjectAny),
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

  Widget _resourceField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.lessonPlanResourceLabel,
      child: _ChoiceRow<ResourceLevel>(
        values: ResourceLevel.values,
        selected: _resource,
        labelOf: (value) => switch (value) {
          ResourceLevel.low => l10n.lessonPlanResourceLow,
          ResourceLevel.medium => l10n.lessonPlanResourceMedium,
          ResourceLevel.high => l10n.lessonPlanResourceHigh,
        },
        onSelected: (value) => setState(() => _resource = value),
      ),
    );
  }

  Widget _difficultyField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.lessonPlanDifficultyLabel,
      child: _ChoiceRow<DifficultyLevel>(
        values: DifficultyLevel.values,
        selected: _difficulty,
        labelOf: (value) => switch (value) {
          DifficultyLevel.remedial => l10n.lessonPlanDifficultyRemedial,
          DifficultyLevel.standard => l10n.lessonPlanDifficultyStandard,
          DifficultyLevel.advanced => l10n.lessonPlanDifficultyAdvanced,
        },
        onSelected: (value) => setState(() => _difficulty = value),
      ),
    );
  }

  Widget _ruralField(AppLocalizations l10n) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return SwitchListTile.adaptive(
      value: _useRuralContext,
      onChanged: (value) => setState(() => _useRuralContext = value),
      contentPadding: EdgeInsets.zero,
      title: Text(l10n.lessonPlanRuralLabel, style: text.bodyLarge),
      subtitle: Text(
        l10n.lessonPlanRuralHint,
        style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
      ),
    );
  }
}

/// A labelled form row: a weight-first label (with an optional "Optional"
/// marker) above its control, on the 4dp grid.

/// A single-select group rendered as wrapping [ChoiceChip]s. Wrapping (instead
/// of a fixed-width SegmentedButton) guarantees no horizontal overflow at
/// 360dp width or textScale 1.3, while keeping >=48dp tap targets.
class _ChoiceRow<T> extends StatelessWidget {
  const _ChoiceRow({
    required this.values,
    required this.selected,
    required this.labelOf,
    required this.onSelected,
  });

  final List<T> values;
  final T selected;
  final String Function(T value) labelOf;
  final ValueChanged<T> onSelected;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.space2,
      runSpacing: AppSpacing.space2,
      children: [
        for (final value in values)
          ChoiceChip(
            label: Text(labelOf(value)),
            selected: value == selected,
            materialTapTargetSize: MaterialTapTargetSize.padded,
            onSelected: (isSelected) {
              if (isSelected) onSelected(value);
            },
          ),
      ],
    );
  }
}
