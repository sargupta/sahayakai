import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/domain/picker_options.dart';
import '../../../shared/domain/tool_prefill.dart';
import '../../../shared/media/image_input.dart';
import '../../../shared/voice/tts_speaker.dart';
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/result_view.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../../vidya/presentation/widgets/inline_field_mic.dart';
import '../domain/worksheet.dart';
import 'widgets/worksheet_error_view.dart';
import 'widgets/worksheet_result_view.dart';
import 'widgets/worksheet_skeleton.dart';
import 'worksheet_controller.dart';

/// P1.1 — the Worksheet Wizard. A capped, scrolling editorial form + a sticky
/// Generate button ([ToolScaffold]), driven by an AsyncNotifier and rendered
/// through [ResultView] (loading / empty / error / data). Unlike the text tools,
/// the worksheet REQUIRES a textbook-page photo, captured through the shared
/// [ImageInput] and sent as a base64 data URI. On success the worksheet is
/// wrapped in a `DocumentSheet` (see [WorksheetResultView]) and the view
/// auto-scrolls to its masthead.
class WorksheetWizardScreen extends ConsumerStatefulWidget {
  const WorksheetWizardScreen({super.key, this.prefill});

  /// Optional seed from a VIDYA NAVIGATE_AND_FILL directive ("make a Class 6
  /// worksheet on fractions" → this form opens with the prompt/grade/subject
  /// filled). Defaults to null, so every existing call site and test opens the
  /// blank form unchanged. NOTE: the worksheet REQUIRES a textbook photo, which
  /// the voice path structurally cannot supply, so a voice open lands on a
  /// pre-filled form and WAITS for the teacher to add the photo — it never
  /// completes "speak → result" on its own (see [_applyPrefill] / initState).
  final ToolPrefill? prefill;

  @override
  ConsumerState<WorksheetWizardScreen> createState() =>
      _WorksheetWizardScreenState();
}

class _WorksheetWizardScreenState extends ConsumerState<WorksheetWizardScreen> {
  final _formKey = GlobalKey<FormState>();
  final _promptController = TextEditingController();

  /// Anchors the auto-scroll: the result region's top, which for a successful
  /// generation is the DocumentSheet masthead.
  final _resultKey = GlobalKey();

  PickedImage? _image;
  String? _grade;
  String? _subject;
  late AppLocale _language;

  /// The request that produced the worksheet on screen, held so its Save action
  /// can build the `content/save` body (which needs the prompt / language the
  /// model output alone does not carry).
  WorksheetRequest? _lastRequest;

  /// Part-B once-guard: the voice-path spoken summary fires at most once, when
  /// the first voice-originated result lands (VOICE_FIRST_GAP §5.6).
  bool _spokeVoiceSummary = false;

  @override
  void initState() {
    super.initState();
    _language = ref.read(localeControllerProvider);
    _applyPrefill(widget.prefill);
    // The voice path's RUN verb (VOICE_FIRST_GAP §4): a directive that arrives
    // with autoSubmit fires generation itself once every required field is
    // present. The worksheet's blocking required field is the textbook photo,
    // which the classifier can never resolve from speech — so this guard holds
    // and the form waits for the teacher to add the photo rather than flashing
    // an "add a photo" error on open. The prompt/grade/subject are already
    // seeded, so all that is left is the one tap the voice path cannot do for
    // them. (The guard is kept parallel to the eight fully voice-driven tools
    // so it "just works" the day a prefill can carry an image.)
    if (widget.prefill?.autoSubmit == true &&
        _image != null &&
        _promptController.text.trim().isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _submit();
      });
    }
  }

  /// Seeds the form from a VIDYA directive. The spoken description becomes the
  /// prompt; grade/subject are applied only when they are values this form
  /// actually offers, so an unrecognised classifier value never lands in a
  /// strict dropdown; the language falls back to the current one when it is not
  /// one of the 11. The image is deliberately untouched — voice cannot carry a
  /// photo, so the teacher supplies it on the pre-filled form.
  void _applyPrefill(ToolPrefill? p) {
    if (p == null) return;
    if (p.topic != null) _promptController.text = p.topic!;
    if (p.gradeLevel != null && kGradeLevels.contains(p.gradeLevel)) {
      _grade = p.gradeLevel;
    }
    if (p.subject != null && kSubjects.contains(p.subject)) {
      _subject = p.subject;
    }
    final locale = prefillLocale(p.language);
    if (locale != null) _language = locale;
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
    _lastRequest = request;
    // A fresh generation starts a fresh save state — the previous worksheet's
    // "Saved" badge must not carry over onto the new result. That reset now
    // rides on the result itself: `ResultActionsBar.saveResetKey` is the
    // rendered Worksheet, and a new generation is a new instance.
    ref.read(worksheetControllerProvider.notifier).generate(request);
  }

  /// Part B — closes "speak → generate → hear". When the landed worksheet was
  /// voice-originated (VIDYA's RUN verb set `autoSubmit`), auto-speak a short
  /// "your … is ready" summary in the result's language, once. A manual open
  /// (tapped Generate, or a tile open with no auto-submit) never speaks. Because
  /// the worksheet needs a photo the teacher adds by hand, this fires when they
  /// finish that photo and tap Generate — still the voice-loop close, just after
  /// the one tap voice could not do for them.
  void _maybeSpeakVoiceSummary(AppLocalizations l10n) {
    if (_spokeVoiceSummary || widget.prefill?.autoSubmit != true) return;
    _spokeVoiceSummary = true;
    final topic = widget.prefill?.topic?.trim();
    final summary = (topic == null || topic.isEmpty)
        ? l10n.voiceResultReady(l10n.worksheetTitle)
        : l10n.voiceResultReadyWithTopic(l10n.worksheetTitle, topic);
    speakResultSummary(
      ref.read(ttsSpeakerProvider),
      summary,
      language: _language.aiName,
    );
  }

  /// Brings the result masthead to the top of the viewport when a fresh
  /// worksheet lands. Honours reduce-motion by jumping (no scroll tween).
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
    final state = ref.watch(worksheetControllerProvider);

    // Auto-scroll to the result header on a fresh success (loading -> data).
    ref.listen<AsyncValue<Worksheet?>>(worksheetControllerProvider, (
      prev,
      next,
    ) {
      final wasLoading = prev?.isLoading ?? false;
      final nowHasWorksheet =
          !next.isLoading && next.hasValue && next.valueOrNull != null;
      if (wasLoading && nowHasWorksheet) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToResult());
        _maybeSpeakVoiceSummary(l10n);
      }
    });

    final hasResult = state.hasValue && state.valueOrNull != null;

    final result = state.hasError
        ? WorksheetErrorView(error: state.error!, onRetry: _submit)
        : ResultView<Worksheet>(
            state: state,
            skeleton: const WorksheetSkeleton(),
            emptyMessage: l10n.worksheetEmpty,
            onData: (worksheet) => WorksheetResultView(
              worksheet: worksheet,
              onRegenerate: _submit,
              saveRequest: _lastRequest,
            ),
          );

    return ToolScaffold(
      title: l10n.worksheetTitle,
      isBusy: state.isLoading,
      submitLabel: l10n.actionGenerate,
      // Hide the sticky Generate button once a worksheet is on screen — the
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
            EditorialSectionHeader(l10n.worksheetSectionWorksheet),
            const SizedBox(height: AppSpacing.space4),
            _imageField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _promptField(l10n),
            const SizedBox(height: AppSpacing.space8),
            EditorialSectionHeader(l10n.sectionForYourClass),
            const SizedBox(height: AppSpacing.space4),
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

  Widget _promptField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.worksheetPromptLabel,
      leadingIcon: LucideIcons.fileText,
      // Voice-first: dictate the worksheet instructions instead of typing them.
      trailing: InlineFieldMic(
        expectedLanguage: _language.code,
        onResult: (text) => _promptController.text = text,
      ),
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
      leadingIcon: LucideIcons.graduationCap,
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
      leadingIcon: LucideIcons.bookOpen,
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
