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
import '../../../shared/voice/tts_speaker.dart';
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/result_view.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../../vidya/presentation/widgets/inline_field_mic.dart';
import '../domain/rubric.dart';
import 'rubric_controller.dart';
import 'widgets/rubric_error_view.dart';
import 'widgets/rubric_result_view.dart';
import 'widgets/rubric_skeleton.dart';

/// P1.2 — the Rubric Generator. A capped, scrolling editorial form + a sticky
/// Generate button ([ToolScaffold]), driven by an AsyncNotifier and rendered
/// through [ResultView] (loading / empty / error / data). On success the result
/// is a criteria x performance-levels grid wrapped in a `DocumentSheet`; the
/// grid scrolls horizontally inside its own box (see [RubricResultView] /
/// RubricGrid), so the page never scrolls sideways, and the view auto-scrolls
/// to the document masthead.
class RubricGeneratorScreen extends ConsumerStatefulWidget {
  const RubricGeneratorScreen({super.key, this.prefill});

  /// Optional seed from a VIDYA NAVIGATE_AND_FILL directive — the spoken topic
  /// becomes the assignment description. Defaults to null, so every existing
  /// call site and test opens the blank form unchanged.
  final ToolPrefill? prefill;

  @override
  ConsumerState<RubricGeneratorScreen> createState() =>
      _RubricGeneratorScreenState();
}

class _RubricGeneratorScreenState extends ConsumerState<RubricGeneratorScreen> {
  final _formKey = GlobalKey<FormState>();
  final _assignmentController = TextEditingController();

  /// Anchors the auto-scroll: the result region's top, which for a successful
  /// generation is the DocumentSheet masthead.
  final _resultKey = GlobalKey();

  String? _grade;
  String? _subject;
  late AppLocale _language;

  /// Part-B once-guard: the voice-path spoken summary fires at most once, when
  /// the first voice-originated result lands (VOICE_FIRST_GAP §5.6).
  bool _spokeVoiceSummary = false;

  /// The request behind the rubric currently on screen. "Save to Library" needs
  /// the assignment description / grade / language the model output does not
  /// carry, so the result view is handed the request that produced it. Null
  /// until the first generation, which is exactly when there is nothing to save.
  RubricRequest? _lastRequest;

  @override
  void initState() {
    super.initState();
    _language = ref.read(localeControllerProvider);
    _applyPrefill(widget.prefill);
    // The voice path's RUN verb (VOICE_FIRST_GAP §4): build the rubric itself when
    // a voice directive described the assignment — "speak → rubric", no tap. Gated
    // on a non-empty assignment so a partial utterance lands on the form and waits.
    // Post-frame so the Form (and its GlobalKey) is mounted before _submit runs.
    if (widget.prefill?.autoSubmit == true &&
        _assignmentController.text.trim().isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _submit();
      });
    }
  }

  /// Seeds the form from a VIDYA directive. Grade/subject are applied only when
  /// they are values this form actually offers, so an unrecognised classifier
  /// value never lands in a strict dropdown; the language falls back to the
  /// current one when it is not one of the 11.
  void _applyPrefill(ToolPrefill? p) {
    if (p == null) return;
    if (p.topic != null) _assignmentController.text = p.topic!;
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
    _lastRequest = request;
    ref.read(rubricControllerProvider.notifier).generate(request);
  }

  /// Brings the result masthead to the top of the viewport when a fresh rubric
  /// lands. Honours reduce-motion by jumping (no scroll tween).
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

  /// Part B — closes "speak → generate → hear". When the landed result was
  /// voice-originated (VIDYA's RUN verb set `autoSubmit`), auto-speak a short
  /// "your … is ready" summary in the result's language, once. A manual open
  /// never speaks. The short VIDYA confirmation spoken before navigation has
  /// long finished by the time the rubric lands, so this is a single,
  /// non-overlapping utterance.
  void _maybeSpeakVoiceSummary(AppLocalizations l10n) {
    if (_spokeVoiceSummary || widget.prefill?.autoSubmit != true) return;
    _spokeVoiceSummary = true;
    final topic = widget.prefill?.topic?.trim();
    final summary = (topic == null || topic.isEmpty)
        ? l10n.voiceResultReady(l10n.rubricTitle)
        : l10n.voiceResultReadyWithTopic(l10n.rubricTitle, topic);
    speakResultSummary(
      ref.read(ttsSpeakerProvider),
      summary,
      language: _language.aiName,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = ref.watch(rubricControllerProvider);

    // Auto-scroll to the result header on a fresh success (loading -> data).
    ref.listen<AsyncValue<Rubric?>>(rubricControllerProvider, (prev, next) {
      final wasLoading = prev?.isLoading ?? false;
      final nowHasRubric =
          !next.isLoading && next.hasValue && next.valueOrNull != null;
      if (wasLoading && nowHasRubric) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToResult());
        _maybeSpeakVoiceSummary(l10n);
      }
    });

    final hasResult = state.hasValue && state.valueOrNull != null;

    final result = state.hasError
        ? RubricErrorView(error: state.error!, onRetry: _submit)
        : ResultView<Rubric>(
            state: state,
            skeleton: const RubricSkeleton(),
            emptyMessage: l10n.rubricEmpty,
            onData: (rubric) => RubricResultView(
              rubric: rubric,
              onRegenerate: _submit,
              saveRequest: _lastRequest,
            ),
          );

    return ToolScaffold(
      title: l10n.rubricTitle,
      isBusy: state.isLoading,
      submitLabel: l10n.actionGenerate,
      // Hide the sticky Generate button once a rubric is on screen — the
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
            EditorialSectionHeader(l10n.rubricSectionAssignment),
            const SizedBox(height: AppSpacing.space4),
            _assignmentField(l10n),
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

  Widget _assignmentField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.rubricAssignmentLabel,
      hint: l10n.rubricAssignmentHint,
      leadingIcon: LucideIcons.clipboardList,
      // Voice-first: dictate the assignment description instead of typing it.
      trailing: InlineFieldMic(
        expectedLanguage: _language.code,
        onResult: (text) => _assignmentController.text = text,
      ),
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
      leadingIcon: LucideIcons.graduationCap,
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
      leadingIcon: LucideIcons.bookOpen,
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
