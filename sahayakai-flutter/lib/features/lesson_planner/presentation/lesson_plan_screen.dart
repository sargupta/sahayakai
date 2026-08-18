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
import '../../../shared/widgets/app_segmented.dart';
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/result_view.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../../vidya/presentation/widgets/inline_field_mic.dart';
import '../domain/lesson_plan.dart';
import 'lesson_plan_controller.dart';
import 'widgets/lesson_plan_error_view.dart';
import 'widgets/lesson_plan_result_view.dart';
import 'widgets/lesson_plan_skeleton.dart';

/// P0.4 — the flagship Lesson Plan Generator, and the reference tool the rest
/// copy (PREMIUM_DESIGN_SPEC.md §6b U8). A capped, scrolling editorial form + a
/// sticky Generate button ([ToolScaffold]), driven by an AsyncNotifier and
/// rendered through [ResultView] (loading / empty / error / data). On success
/// the 5E plan is wrapped in a `DocumentSheet` (see [LessonPlanResultView]) and
/// the view auto-scrolls to its masthead.
class LessonPlanScreen extends ConsumerStatefulWidget {
  const LessonPlanScreen({super.key, this.prefill});

  /// Optional seed from a VIDYA NAVIGATE_AND_FILL directive ("plan a Class 10
  /// Maths lesson on fractions" → this form opens filled). Defaults to null, so
  /// every existing call site and test opens the blank form unchanged.
  final ToolPrefill? prefill;

  @override
  ConsumerState<LessonPlanScreen> createState() => _LessonPlanScreenState();
}

class _LessonPlanScreenState extends ConsumerState<LessonPlanScreen> {
  final _formKey = GlobalKey<FormState>();
  final _topicController = TextEditingController();

  /// Anchors the auto-scroll: the result region's top, which for a successful
  /// generation is the DocumentSheet masthead.
  final _resultKey = GlobalKey();

  final Set<String> _grades = <String>{};
  String? _subject;
  late AppLocale _language;
  ResourceLevel _resource = ResourceLevel.low;
  DifficultyLevel _difficulty = DifficultyLevel.standard;
  bool _useRuralContext = true;

  /// Optional textbook-page photo. When set, its data URI is sent as the flow's
  /// primary content (the rural "photograph the page" path); null otherwise.
  PickedImage? _image;

  /// Part-B once-guard: the voice-path spoken summary fires at most once, when
  /// the first voice-originated result lands (VOICE_FIRST_GAP §5.6).
  bool _spokeVoiceSummary = false;

  /// The request behind the plan on screen. "Save to Library" needs the topic,
  /// grade and language that the model output does not carry, so the submitted
  /// request is held here exactly as the worksheet screen holds its own.
  LessonPlanRequest? _lastRequest;

  @override
  void initState() {
    super.initState();
    _language = ref.read(localeControllerProvider);
    _applyPrefill(widget.prefill);
    // The voice path's RUN verb (VOICE_FIRST_GAP §4): a directive that arrives
    // with autoSubmit fires generation itself once its required field is filled,
    // turning "speak → filled form → tap Generate" into "speak → result". Gated
    // on a non-empty topic so a partial utterance ("plan a lesson") lands on the
    // form and waits rather than flashing a validation error on an empty submit.
    // Post-frame so the Form (and its GlobalKey) is mounted before _submit runs.
    if (widget.prefill?.autoSubmit == true &&
        _topicController.text.trim().isNotEmpty) {
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
    if (p.topic != null) _topicController.text = p.topic!;
    if (p.gradeLevel != null && kGradeLevels.contains(p.gradeLevel)) {
      _grades.add(p.gradeLevel!);
    }
    if (p.subject != null && kSubjects.contains(p.subject)) {
      _subject = p.subject;
    }
    final locale = prefillLocale(p.language);
    if (locale != null) _language = locale;
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
      imageDataUri: _image?.dataUri,
    );
    _lastRequest = request;
    ref.read(lessonPlanControllerProvider.notifier).generate(request);
  }

  /// Brings the result masthead to the top of the viewport when a fresh plan
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
  /// (tapped Generate, or a tile open with no auto-submit) never speaks. The
  /// short VIDYA confirmation spoken before navigation has long finished by the
  /// time generation lands, so this is a single, non-overlapping utterance.
  void _maybeSpeakVoiceSummary(AppLocalizations l10n) {
    if (_spokeVoiceSummary || widget.prefill?.autoSubmit != true) return;
    _spokeVoiceSummary = true;
    final topic = widget.prefill?.topic?.trim();
    final summary = (topic == null || topic.isEmpty)
        ? l10n.voiceResultReady(l10n.lessonPlanTitle)
        : l10n.voiceResultReadyWithTopic(l10n.lessonPlanTitle, topic);
    speakResultSummary(
      ref.read(ttsSpeakerProvider),
      summary,
      language: _language.aiName,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = ref.watch(lessonPlanControllerProvider);

    // Auto-scroll to the result header on a fresh success (loading -> data).
    ref.listen<AsyncValue<LessonPlan?>>(lessonPlanControllerProvider, (
      prev,
      next,
    ) {
      final wasLoading = prev?.isLoading ?? false;
      final nowHasPlan =
          !next.isLoading && next.hasValue && next.valueOrNull != null;
      if (wasLoading && nowHasPlan) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToResult());
        _maybeSpeakVoiceSummary(l10n);
      }
    });

    final hasResult = state.hasValue && state.valueOrNull != null;

    final result = state.hasError
        ? LessonPlanErrorView(error: state.error!, onRetry: _submit)
        : ResultView<LessonPlan>(
            state: state,
            skeleton: const LessonPlanSkeleton(),
            emptyMessage: l10n.lessonPlanEmpty,
            onData: (plan) => LessonPlanResultView(
              plan: plan,
              onRegenerate: _submit,
              saveRequest: _lastRequest,
            ),
          );

    return ToolScaffold(
      title: l10n.lessonPlanTitle,
      isBusy: state.isLoading,
      submitLabel: l10n.actionGenerate,
      // Hide the sticky Generate button once a plan is on screen — the
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
            EditorialSectionHeader(l10n.lessonPlanSectionLesson),
            const SizedBox(height: AppSpacing.space4),
            _topicField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _gradeField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _subjectField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _imageField(l10n),
            const SizedBox(height: AppSpacing.space8),
            EditorialSectionHeader(l10n.lessonPlanSectionApproach),
            const SizedBox(height: AppSpacing.space4),
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
      leadingIcon: LucideIcons.lightbulb,
      trailing: InlineFieldMic(
        expectedLanguage: _language.code,
        onResult: (text) => _topicController.text = text,
      ),
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
      leadingIcon: LucideIcons.graduationCap,
      child: Wrap(
        spacing: AppSpacing.space2,
        runSpacing: AppSpacing.space2,
        children: [
          for (final grade in kGradeLevels)
            FilterChip(
              label: Text(grade),
              selected: _grades.contains(grade),
              showCheckmark: false,
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
      leadingIcon: LucideIcons.bookOpen,
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

  Widget _imageField(AppLocalizations l10n) {
    // Optional here (unlike Worksheet, where the photo is required and gated by
    // a FormField validator): a teacher may photograph a textbook page to plan
    // straight from it, or leave it blank and the form works exactly as before.
    return LabeledField(
      label: l10n.toolImageOptionalLabel,
      hint: l10n.toolImageOptionalHint,
      leadingIcon: LucideIcons.image,
      child: ImageInput(
        value: _image,
        onChanged: (picked) => setState(() => _image = picked),
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

  Widget _resourceField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.lessonPlanResourceLabel,
      leadingIcon: LucideIcons.layers,
      child: AppSegmented<ResourceLevel>(
        value: _resource,
        onChanged: (value) => setState(() => _resource = value),
        segments: [
          AppSegment(
            value: ResourceLevel.low,
            label: l10n.lessonPlanResourceLow,
          ),
          AppSegment(
            value: ResourceLevel.medium,
            label: l10n.lessonPlanResourceMedium,
          ),
          AppSegment(
            value: ResourceLevel.high,
            label: l10n.lessonPlanResourceHigh,
          ),
        ],
      ),
    );
  }

  Widget _difficultyField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.lessonPlanDifficultyLabel,
      leadingIcon: LucideIcons.gauge,
      child: AppSegmented<DifficultyLevel>(
        value: _difficulty,
        onChanged: (value) => setState(() => _difficulty = value),
        segments: [
          AppSegment(
            value: DifficultyLevel.remedial,
            label: l10n.lessonPlanDifficultyRemedial,
          ),
          AppSegment(
            value: DifficultyLevel.standard,
            label: l10n.lessonPlanDifficultyStandard,
          ),
          AppSegment(
            value: DifficultyLevel.advanced,
            label: l10n.lessonPlanDifficultyAdvanced,
          ),
        ],
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
      secondary: Icon(
        LucideIcons.sprout,
        size: AppIconSize.inline,
        color: scheme.onSurfaceVariant,
      ),
      title: Text(l10n.lessonPlanRuralLabel, style: text.bodyLarge),
      subtitle: Text(
        l10n.lessonPlanRuralHint,
        style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
      ),
    );
  }
}
