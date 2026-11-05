import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/locale_provider.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/data/library_items_provider.dart';
import '../../../shared/domain/library_item.dart';
import '../../../shared/domain/picker_options.dart';
import '../../../shared/domain/tool_prefill.dart';
import '../../../shared/media/image_input.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/voice/tts_speaker.dart';
import '../../../shared/widgets/app_segmented.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/map_card.dart';
import '../../../shared/widgets/map_chip.dart';
import '../../../shared/widgets/map_more_options.dart';
import '../../../shared/widgets/map_select.dart';
import '../../../shared/widgets/map_toggle.dart';
import '../../../shared/widgets/result_view.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../../vidya/domain/deliverable.dart';
import '../../vidya/presentation/background_generation_controller.dart';
import '../../vidya/presentation/deliverables_controller.dart';
import '../../vidya/presentation/widgets/inline_field_mic.dart';
import '../data/lesson_plan_repository.dart';
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
  const LessonPlanScreen({super.key, this.prefill, this.taskId});

  /// Optional task id. When set, a "From your task: ..." tag is shown at the
  /// top. Defaults to null (normal entry, no tag).
  final String? taskId;

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

  String? _grade;
  final Set<LessonInclude> _includes = <LessonInclude>{};
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
    _topicController.dispose();
    super.dispose();
  }

  void _submit() {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final request = LessonPlanRequest(
      topic: _topicController.text,
      language: _language.aiName,
      gradeLevels: [?_grade],
      subject: _subject,
      resourceLevel: _resource,
      difficultyLevel: _difficulty,
      useRuralContext: _useRuralContext,
      imageDataUri: _image?.dataUri,
      includes: _includes,
    );
    _lastRequest = request;
    ref.read(lessonPlanControllerProvider.notifier).generate(request);
  }

  /// v3 screen 06 — hand the running generation to VIDYA and leave: she finishes
  /// it off-screen (the orb rides along, working) and drops the plan into the
  /// deliver tray when done (the orb turns green). Keeps the tool provider alive
  /// across the pop with a subscription, then resets it so a later visit starts
  /// on a blank form.
  void _minimise() {
    final l10n = context.l10n;
    final container = ProviderScope.containerOf(context, listen: false);
    final request = _lastRequest;
    final keepAlive = container.listen<AsyncValue<LessonPlan?>>(
      lessonPlanControllerProvider,
      (_, _) {},
    );
    // Fire-and-forget: it outlives this screen by design.
    unawaited(
      runMinimisedGeneration<LessonPlan>(
        controller: container.read(
          backgroundGenerationControllerProvider.notifier,
        ),
        deliverables: container.read(deliverablesControllerProvider.notifier),
        label: l10n.lessonPlanTitle,
        awaitResult: () => container.read(lessonPlanControllerProvider.future),
        toDeliverable: (plan) => Deliverable(
          id: 'bg-lesson-${DateTime.now().microsecondsSinceEpoch}',
          title: plan.title.isEmpty ? l10n.lessonPlanTitle : plan.title,
          subtitle: plan.title.isEmpty ? null : plan.title,
          text: lessonPlanAsPlainText(plan, l10n),
          shareSubject: plan.title.isEmpty ? null : plan.title,
          language: plan.language,
          onSave: (request != null && plan.raw != null)
              ? () => container
                    .read(lessonPlanRepositoryProvider)
                    .save(plan: plan, request: request)
              : null,
        ),
        keepAlive: keepAlive,
        onReset: () => container.invalidate(lessonPlanControllerProvider),
      ),
    );
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(Routes.home);
    }
  }

  /// Abandon the running generation and return to the form.
  void _stop() => ref.read(lessonPlanControllerProvider.notifier).clear();

  /// The plan on the Output screen as the deliver tray takes it. Keyed by the
  /// plan instance, so a regeneration is a new deliverable.
  Deliverable? _deliverableFor(LessonPlan? plan, AppLocalizations l10n) {
    if (plan == null) return null;
    return Deliverable(
      id: 'lesson-${identityHashCode(plan)}',
      title: plan.title.isEmpty ? l10n.lessonPlanTitle : plan.title,
      subtitle: plan.title.isEmpty ? null : plan.title,
      text: lessonPlanAsPlainText(plan, l10n),
      shareSubject: plan.title.isEmpty ? null : plan.title,
      language: plan.language,
    );
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
      wash: AppGradients.washComposer,
      title: l10n.lessonComposerTitle,
      subtitle: l10n.lessonComposerSubtitle,
      isBusy: state.isLoading,
      // Output screen (UX map Flow 4): the result replaces the form;
      // Edit brings the form back and keeps the result until a new one lands.
      hasResult: hasResult,
      onResubmit: _submit,
      deliverable: _deliverableFor(state.valueOrNull, l10n),
      submitLabel: l10n.lessonComposerGenerate,
      // Hide the sticky Generate button once a plan is on screen — the
      // document's own action bar (Regenerate / Copy) takes over.
      onSubmit: (state.isLoading || hasResult) ? null : _submit,
      // While generating, the busy button becomes "Minimise to orb / Stop"
      // (v3 06) so the teacher can leave and let VIDYA finish.
      onMinimise: _minimise,
      onStop: _stop,
      result: KeyedSubtree(
        key: _resultKey,
        child: AnimatedSwitcher(
          duration: AppMotion.small,
          switchInCurve: AppMotion.easeOutQuart,
          switchOutCurve: AppMotion.easeOutQuart,
          child: result,
        ),
      ),
      child: staggeredItem(
        context,
        Form(
          key: _formKey,
          autovalidateMode: AutovalidateMode.onUserInteraction,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (widget.taskId != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primaryContainer,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      'From your task: ${widget.taskId}',
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                  ),
                ),
              _topicField(l10n),
              const SizedBox(height: AppSpacing.space3),
              _classAndSubject(l10n),
              const SizedBox(height: AppSpacing.space4),
              _includeField(l10n),
              if (_grade != null) ...[
                const SizedBox(height: AppSpacing.space4),
                _ncertBanner(l10n, _grade!),
              ],
              _recentCard(l10n),
              const SizedBox(height: AppSpacing.space3),
              MapMoreOptions(
                summary: _moreSummary(l10n),
                children: [
                  _languageField(l10n),
                  _resourceField(l10n),
                  _difficultyField(l10n),
                  _ruralField(l10n),
                  _imageField(l10n),
                ],
              ),
            ],
          ),
        ),
        index: 0,
      ),
    );
  }

  /// The map's topic card: the saffron "Topic" overline, the small mic that
  /// dictates into this field only, and the topic in bold on the card itself.
  Widget _topicField(AppLocalizations l10n) {
    return MapCard(
      child: LabeledField(
        label: l10n.lessonPlanTopicLabel,
        trailingBesideChild: true,
        trailing: InlineFieldMic(
          expectedLanguage: _language.code,
          onResult: (text) => _topicController.text = text,
        ),
        child: TextFormField(
          controller: _topicController,
          maxLength: 1000,
          maxLines: 3,
          minLines: 1,
          textInputAction: TextInputAction.done,
          textCapitalization: TextCapitalization.sentences,
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: AppColors.textStrong,
          ),
          decoration: mapBareInput(l10n.lessonPlanTopicHint),
          validator: (value) => (value == null || value.trim().isEmpty)
              ? l10n.lessonPlanTopicError
              : null,
        ),
      ),
    );
  }

  /// Class and Subject, the map's two tap-to-change selectors side by side.
  Widget _classAndSubject(AppLocalizations l10n) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: MapSelect<String?>(
            label: l10n.toolClassLabel,
            value: _grade,
            options: [
              (null, l10n.toolAnyClass),
              for (final grade in kGradeLevels) (grade, grade),
            ],
            onChanged: (value) => setState(() => _grade = value),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: MapSelect<String?>(
            label: l10n.lessonPlanSubjectLabel,
            value: _subject,
            options: [
              (null, l10n.lessonPlanSubjectAny),
              for (final subject in kSubjects) (subject, subject),
            ],
            onChanged: (value) => setState(() => _subject = value),
          ),
        ),
      ],
    );
  }

  Widget _includeField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.lessonPlanIncludeLabel,
      child: Wrap(
        spacing: 7,
        runSpacing: 7,
        children: [
          for (final item in LessonInclude.values)
            MapChip(
              label: _includeLabel(l10n, item),
              selected: _includes.contains(item),
              onTap: () => setState(() {
                if (!_includes.remove(item)) _includes.add(item);
              }),
            ),
        ],
      ),
    );
  }

  String _includeLabel(AppLocalizations l10n, LessonInclude item) {
    switch (item) {
      case LessonInclude.activity:
        return l10n.lessonPlanIncludeActivity;
      case LessonInclude.boardWork:
        return l10n.lessonPlanIncludeBoardWork;
      case LessonInclude.homework:
        return l10n.lessonPlanIncludeHomework;
      case LessonInclude.storyHook:
        return l10n.lessonPlanIncludeStoryHook;
    }
  }

  /// The map's NCERT banner: an indigo "N" tile and the alignment promise for
  /// the chosen class, before anything is written. Honest: the plan really is
  /// checked against the NCERT syllabus for that class server-side; it never
  /// names a chapter the app has not been given.
  Widget _ncertBanner(AppLocalizations l10n, String grade) {
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.mapNcertBg,
        borderRadius: AppRadius.rCard,
        border: Border.all(color: AppColors.mapNcertBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: AppColors.indigo500,
              borderRadius: AppRadius.rRow,
            ),
            child: Text(
              'N',
              style: text.labelLarge?.copyWith(
                color: AppColors.textOnAccent,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  l10n.lessonPlanNcertTitle,
                  style: text.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.indigo500,
                  ),
                ),
                Text(
                  l10n.lessonPlanNcertBody(grade),
                  style: text.bodySmall?.copyWith(
                    color: AppColors.indigo500,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// The map's "Recent" card: the teacher's last three saved lessons, each
  /// reopening the saved plan. Drawn only when there are some.
  Widget _recentCard(AppLocalizations l10n) {
    final items = ref.watch(libraryItemsProvider).valueOrNull;
    final lessons = [
      for (final item in items ?? const <LibraryItem>[])
        if (item.type == ContentType.lessonPlan) item,
    ].take(3).toList(growable: false);
    if (lessons.isEmpty) return const SizedBox.shrink();
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.space3),
      child: MapCard(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              l10n.lessonComposerRecent,
              style: text.bodyLarge?.copyWith(
                fontWeight: FontWeight.w700,
                color: AppColors.textStrong,
              ),
            ),
            for (final (i, item) in lessons.indexed) ...[
              if (i > 0)
                const Divider(height: 1, color: AppColors.borderHairline),
              InkWell(
                onTap: () => context.push(Routes.libraryDetailPath(item.id)),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 48),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          [
                            item.title,
                            if (item.gradeLevel != null) item.gradeLevel!,
                          ].join(' · '),
                          style: text.bodySmall?.copyWith(
                            fontSize: 12.5,
                            color: AppColors.textBody,
                          ),
                        ),
                      ),
                      const Icon(
                        LucideIcons.chevronRight,
                        size: 14,
                        color: AppColors.textMuted,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// What the closed "More options" card says is set.
  String _moreSummary(AppLocalizations l10n) => [
    _language.nativeLabel,
    switch (_difficulty) {
      DifficultyLevel.remedial => l10n.lessonPlanDifficultyRemedial,
      DifficultyLevel.standard => l10n.lessonPlanDifficultyStandard,
      DifficultyLevel.advanced => l10n.lessonPlanDifficultyAdvanced,
    },
    if (_image != null) l10n.toolImageOptionalLabel,
  ].join(' · ');

  Widget _imageField(AppLocalizations l10n) {
    // Optional here (unlike Worksheet, where the photo is required): a teacher
    // may photograph a textbook page to plan straight from it.
    return LabeledField(
      label: l10n.toolImageOptionalLabel,
      hint: l10n.toolImageOptionalHint,
      child: ImageInput(
        value: _image,
        onChanged: (picked) => setState(() => _image = picked),
      ),
    );
  }

  Widget _languageField(AppLocalizations l10n) {
    return MapSelect<AppLocale>(
      label: l10n.languageLabel,
      value: _language,
      options: [
        for (final locale in AppLocale.values) (locale, locale.nativeLabel),
      ],
      onChanged: (value) => setState(() => _language = value),
    );
  }

  Widget _resourceField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.lessonPlanResourceLabel,
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

  /// "Use local, everyday examples": the map's toggle row.
  Widget _ruralField(AppLocalizations l10n) {
    final text = Theme.of(context).textTheme;
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                l10n.lessonPlanRuralLabel,
                style: text.bodyLarge?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppColors.textStrong,
                ),
              ),
              Text(
                l10n.lessonPlanRuralHint,
                style: text.bodySmall?.copyWith(color: AppColors.textMuted),
              ),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.space3),
        MapToggle(
          value: _useRuralContext,
          onChanged: (value) => setState(() => _useRuralContext = value),
          label: l10n.lessonPlanRuralLabel,
        ),
      ],
    );
  }
}
