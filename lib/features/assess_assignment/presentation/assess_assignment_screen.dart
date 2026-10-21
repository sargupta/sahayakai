import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/media/image_input.dart';
import '../../../shared/widgets/app_segmented.dart';
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/note_banner.dart';
import '../../../shared/widgets/result_view.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../../vidya/presentation/widgets/inline_field_mic.dart';
import '../domain/assessment.dart';
import 'assess_assignment_controller.dart';
import 'widgets/assess_assignment_error_view.dart';
import 'widgets/assess_assignment_result_view.dart';
import 'widgets/assess_assignment_skeleton.dart';

/// P1.6 — Assess Assignment. Grade a student's handwritten work from a photo.
///
/// A capped, scrolling editorial form + a sticky Assess button ([ToolScaffold]),
/// driven by an AsyncNotifier and rendered through [ResultView] (loading /
/// empty / error / data). It REQUIRES a student-work photo (captured through the
/// shared [ImageInput] and sent as a base64 data URI) and offers a mode selector
/// ([AppSegmented], three modes): grade the work, read it only, or score a
/// corrected transcript. The backend strips the student's name and this form
/// never collects one — grading needs no PII. On success the scorecard is
/// wrapped in a `DocumentSheet` (see [AssessAssignmentResultView]) and the view
/// auto-scrolls to its masthead.
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

  /// Anchors the auto-scroll: the result region's top, which for a successful
  /// assessment is the DocumentSheet masthead.
  final _resultKey = GlobalKey();

  PickedImage? _image;
  AssessmentMode _mode = AssessmentMode.full;

  /// The mode that produced the scorecard on screen, captured at assess time so
  /// changing the selector afterwards never silently re-labels the result. The
  /// result view uses it to hide the score-side sections in "Read only" mode.
  AssessmentMode _resultMode = AssessmentMode.full;
  late AppLocale _language;

  /// The request behind the scorecard currently on screen. "Save to Library"
  /// needs the language the model output does not reliably carry, so the result
  /// view is handed the request that produced it. Null until the first run,
  /// which is exactly when there is nothing to save.
  AssessAssignmentRequest? _lastRequest;

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
    _resultMode = _mode;
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
    _lastRequest = request;
    ref.read(assessAssignmentControllerProvider.notifier).assess(request);
  }

  /// Brings the result masthead to the top of the viewport when a fresh
  /// assessment lands. Honours reduce-motion by jumping (no scroll tween).
  void _scrollToResult() {
    if (!mounted) return;
    final ctx = _resultKey.currentContext;
    if (ctx == null) return;
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    Scrollable.ensureVisible(
      ctx,
      duration: reduce ? Duration.zero : AppMotion.medium,
      curve: AppMotion.emphasized,
      alignment: 0.0,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = ref.watch(assessAssignmentControllerProvider);

    // Auto-scroll to the result header on a fresh success (loading -> data).
    ref.listen<AsyncValue<Assessment?>>(assessAssignmentControllerProvider, (
      prev,
      next,
    ) {
      final wasLoading = prev?.isLoading ?? false;
      final nowHasAssessment =
          !next.isLoading && next.hasValue && next.valueOrNull != null;
      if (wasLoading && nowHasAssessment) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToResult());
      }
    });

    final hasResult = state.hasValue && state.valueOrNull != null;

    final result = state.hasError
        ? AssessAssignmentErrorView(error: state.error!, onRetry: _submit)
        : ResultView<Assessment>(
            state: state,
            skeleton: const AssessAssignmentSkeleton(),
            emptyMessage: l10n.assessEmpty,
            onData: (assessment) => AssessAssignmentResultView(
              assessment: assessment,
              onRegenerate: _submit,
              mode: _resultMode,
              saveRequest: _lastRequest,
            ),
          );

    return ToolScaffold(
      title: l10n.assessTitle,
      isBusy: state.isLoading,
      submitLabel: l10n.assessSubmit,
      // Hide the sticky Assess button once a scorecard is on screen — the
      // document's own action bar (Regenerate / Copy) takes over.
      onSubmit: (state.isLoading || hasResult) ? null : _submit,
      result: KeyedSubtree(key: _resultKey, child: result),
      child: Form(
        key: _formKey,
        autovalidateMode: AutovalidateMode.onUserInteraction,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            EditorialSectionHeader(l10n.assessSectionWork),
            const SizedBox(height: AppSpacing.space4),
            _imageField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _modeField(l10n),
            if (_mode == AssessmentMode.score) ...[
              const SizedBox(height: AppSpacing.space6),
              _transcriptField(l10n),
            ],
            const SizedBox(height: AppSpacing.space8),
            EditorialSectionHeader(l10n.sectionForYourClass),
            const SizedBox(height: AppSpacing.space4),
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
          leadingIcon: LucideIcons.image,
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
      leadingIcon: LucideIcons.listChecks,
      // Three modes -> AppSegmented. The longest label ("Score a transcript")
      // exceeds the track's length budget, so it falls back to a wrapping chip
      // row (>=48dp, never clips a translated label).
      child: AppSegmented<AssessmentMode>(
        value: _mode,
        onChanged: (mode) => setState(() => _mode = mode),
        segments: [
          AppSegment(value: AssessmentMode.full, label: l10n.assessModeFull),
          AppSegment(
            value: AssessmentMode.transcribe,
            label: l10n.assessModeTranscribe,
          ),
          AppSegment(value: AssessmentMode.score, label: l10n.assessModeScore),
        ],
      ),
    );
  }

  Widget _transcriptField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.assessTranscriptLabel,
      optionalLabel: l10n.assessOptional,
      hint: l10n.assessTranscriptHint,
      leadingIcon: LucideIcons.fileText,
      // Voice-first: dictate the student's answer transcript instead of typing.
      trailing: InlineFieldMic(
        expectedLanguage: _language.code,
        onResult: (text) => _transcriptController.text = text,
      ),
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
        onChanged: (value) => setState(() => _language = value ?? _language),
      ),
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
    final noteStyle = text.bodySmall?.copyWith(
      color: scheme.onSurfaceVariant,
      height: 1.5,
    );
    return NoteBanner.custom(
      icon: LucideIcons.info,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(l10n.assessRubricNote, style: noteStyle),
          const SizedBox(height: AppSpacing.space2),
          Text(l10n.assessPrivacyNote, style: noteStyle),
        ],
      ),
    );
  }
}
