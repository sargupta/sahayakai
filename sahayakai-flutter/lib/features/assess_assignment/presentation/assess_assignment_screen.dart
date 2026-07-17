import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/media/image_input.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/result_view.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../domain/assessment.dart';
import 'assess_assignment_controller.dart';
import 'widgets/assess_assignment_error_view.dart';
import 'widgets/assess_assignment_result_view.dart';
import 'widgets/assess_assignment_skeleton.dart';

/// P1.6 — Assess Assignment. Grade a student's handwritten work from a photo.
///
/// A capped, scrolling form + a sticky Assess button ([ToolScaffold]), driven
/// by an AsyncNotifier and rendered through [ResultView] (loading / empty /
/// error / data). It REQUIRES a student-work photo (captured through the shared
/// [ImageInput] and sent as a base64 data URI) and offers a mode selector:
/// grade the work, read it only, or score a corrected transcript. The backend
/// strips the student's name and this form never collects one — grading needs
/// no PII.
class AssessAssignmentScreen extends ConsumerStatefulWidget {
  const AssessAssignmentScreen({super.key});

  @override
  ConsumerState<AssessAssignmentScreen> createState() =>
      _AssessAssignmentScreenState();
}

class _AssessAssignmentScreenState
    extends ConsumerState<AssessAssignmentScreen> {
  final _formKey = GlobalKey<FormState>();
  final _transcriptController = TextEditingController();

  PickedImage? _image;
  AssessmentMode _mode = AssessmentMode.full;
  late AppLocale _language;

  @override
  void initState() {
    super.initState();
    _language = ref.read(localeControllerProvider);
  }

  @override
  void dispose() {
    _transcriptController.dispose();
    super.dispose();
  }

  void _submit() {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    // The image is validated by its FormField, so it is non-null here.
    final request = AssessAssignmentRequest(
      imageDataUri: _image!.dataUri,
      mode: _mode,
      language: _language.aiName,
      // Only sent in `score` mode; the DTO omits it when blank.
      editedTranscript: _mode == AssessmentMode.score
          ? _transcriptController.text
          : null,
    );
    ref.read(assessAssignmentControllerProvider.notifier).assess(request);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = ref.watch(assessAssignmentControllerProvider);

    final result = state.hasError
        ? AssessAssignmentErrorView(error: state.error!, onRetry: _submit)
        : ResultView<Assessment>(
            state: state,
            skeleton: const AssessAssignmentSkeleton(),
            emptyMessage: l10n.assessEmpty,
            onData: (assessment) =>
                AssessAssignmentResultView(assessment: assessment),
          );

    return ToolScaffold(
      title: l10n.assessTitle,
      isBusy: state.isLoading,
      submitLabel: l10n.assessSubmit,
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
            _modeField(l10n),
            if (_mode == AssessmentMode.score) ...[
              const SizedBox(height: AppSpacing.space6),
              _transcriptField(l10n),
            ],
            const SizedBox(height: AppSpacing.space6),
            _languageField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _RubricNote(l10n: l10n),
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
      validator: (value) => value == null ? l10n.assessImageError : null,
      builder: (field) {
        return LabeledField(
          label: l10n.assessImageLabel,
          hint: l10n.assessImageHint,
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

  Widget _modeField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.assessModeLabel,
      hint: l10n.assessModeHint,
      child: _ModeChoiceRow(
        selected: _mode,
        labelOf: (mode) => _modeLabel(l10n, mode),
        onSelected: (mode) => setState(() => _mode = mode),
      ),
    );
  }

  Widget _transcriptField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.assessTranscriptLabel,
      optionalLabel: l10n.assessOptional,
      hint: l10n.assessTranscriptHint,
      child: TextFormField(
        controller: _transcriptController,
        maxLength: 50000,
        maxLines: 6,
        minLines: 3,
        textInputAction: TextInputAction.newline,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(hintText: l10n.assessTranscriptPlaceholder),
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

String _modeLabel(AppLocalizations l10n, AssessmentMode mode) => switch (mode) {
      AssessmentMode.full => l10n.assessModeFull,
      AssessmentMode.transcribe => l10n.assessModeTranscribe,
      AssessmentMode.score => l10n.assessModeScore,
    };

/// A single-select group of the three modes rendered as wrapping
/// [ChoiceChip]s. Wrapping (not a fixed-width SegmentedButton) guarantees no
/// horizontal overflow at 360dp or textScale 1.3, while keeping >=48dp targets.
class _ModeChoiceRow extends StatelessWidget {
  const _ModeChoiceRow({
    required this.selected,
    required this.labelOf,
    required this.onSelected,
  });

  final AssessmentMode selected;
  final String Function(AssessmentMode value) labelOf;
  final ValueChanged<AssessmentMode> onSelected;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.space2,
      runSpacing: AppSpacing.space2,
      children: [
        for (final mode in AssessmentMode.values)
          ChoiceChip(
            label: Text(labelOf(mode)),
            selected: mode == selected,
            materialTapTargetSize: MaterialTapTargetSize.padded,
            onSelected: (isSelected) {
              if (isSelected) onSelected(mode);
            },
          ),
      ],
    );
  }
}

/// A quiet note explaining what the work is graded against when no rubric is
/// attached (there is no saved-rubric picker yet — see docs/flutter/HANDOFF.md)
/// and that the student's name is never sent. Dignified, not a warning.
class _RubricNote extends StatelessWidget {
  const _RubricNote({required this.l10n});

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.space4),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHigh,
        borderRadius: AppRadius.rLg,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            LucideIcons.info,
            size: AppIconSize.inline,
            color: scheme.onSurfaceVariant,
          ),
          const SizedBox(width: AppSpacing.space3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  l10n.assessRubricNote,
                  style: text.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: AppSpacing.space2),
                Text(
                  l10n.assessPrivacyNote,
                  style: text.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
