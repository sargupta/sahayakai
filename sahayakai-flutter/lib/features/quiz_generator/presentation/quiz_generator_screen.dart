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
  const QuizGeneratorScreen({super.key, this.prefill});

  /// Optional seed from a VIDYA NAVIGATE_AND_FILL directive. Defaults to null,
  /// so existing call sites and tests open the blank form unchanged.
  final ToolPrefill? prefill;

  @override
  ConsumerState<QuizGeneratorScreen> createState() =>
      _QuizGeneratorScreenState();
}

class _QuizGeneratorScreenState extends ConsumerState<QuizGeneratorScreen> {
  final _formKey = GlobalKey<FormState>();
  final _topicController = TextEditingController();

  /// Anchors the auto-scroll: the result region's top, which for a successful
  /// generation is the DocumentSheet masthead.
  final _resultKey = GlobalKey();

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

  /// Optional textbook-page photo. When set, its data URI is sent as the quiz's
  /// primary context; null otherwise.
  PickedImage? _image;

  /// Part-B once-guard: the voice-path spoken summary fires at most once, when
  /// the first voice-originated result lands (VOICE_FIRST_GAP §5.6).
  bool _spokeVoiceSummary = false;

  /// The request behind the quiz currently on screen. "Save to Library" needs
  /// the topic / grade / language the model output does not carry, so the
  /// result view is handed the request that produced it. Null until the first
  /// generation, which is exactly when there is nothing to save.
  QuizRequest? _lastRequest;

  @override
  void initState() {
    super.initState();
    _language = ref.read(localeControllerProvider);
    _applyPrefill(widget.prefill);
    // The voice path's RUN verb (VOICE_FIRST_GAP §4): fire generation itself when
    // a voice directive brought a topic, so "speak → filled form → tap Generate"
    // becomes "speak → result". Gated on a non-empty topic so a partial utterance
    // ("make a quiz") lands on the form and waits. The question-type / Bloom's
    // defaults are already non-empty, so validation passes on auto-run.
    // Post-frame so the Form (and its GlobalKey) is mounted before _submit runs.
    if (widget.prefill?.autoSubmit == true &&
        _topicController.text.trim().isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _submit();
      });
    }
  }

  /// Seeds the form from a VIDYA directive. Grade/subject apply only when this
  /// form offers them; the language falls back to the current one when it is not
  /// one of the 11.
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
    final request = QuizRequest(
      topic: _topicController.text,
      questionTypes: _types.toList(growable: false),
      numQuestions: _numQuestions,
      gradeLevel: _grade,
      subject: _subject,
      language: _language.aiName,
      targetDifficulty: _targetDifficulty,
      bloomsTaxonomyLevels: _blooms.toList(growable: false),
      imageDataUri: _image?.dataUri,
    );
    _lastRequest = request;
    ref.read(quizControllerProvider.notifier).generate(request);
  }

  /// Brings the result masthead to the top of the viewport when a fresh quiz
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
  /// long finished by the time generation lands, so this is a single,
  /// non-overlapping utterance.
  void _maybeSpeakVoiceSummary(AppLocalizations l10n) {
    if (_spokeVoiceSummary || widget.prefill?.autoSubmit != true) return;
    _spokeVoiceSummary = true;
    final topic = widget.prefill?.topic?.trim();
    final summary = (topic == null || topic.isEmpty)
        ? l10n.voiceResultReady(l10n.quizTitle)
        : l10n.voiceResultReadyWithTopic(l10n.quizTitle, topic);
    speakResultSummary(
      ref.read(ttsSpeakerProvider),
      summary,
      language: _language.aiName,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = ref.watch(quizControllerProvider);

    // Auto-scroll to the result header on a fresh success (loading -> data).
    ref.listen<AsyncValue<Quiz?>>(quizControllerProvider, (prev, next) {
      final wasLoading = prev?.isLoading ?? false;
      final nowHasQuiz =
          !next.isLoading && next.hasValue && next.valueOrNull != null;
      if (wasLoading && nowHasQuiz) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToResult());
        _maybeSpeakVoiceSummary(l10n);
      }
    });

    // A quiz only "takes over" the sticky button when it actually carries
    // variants. An empty-variants quiz (the backend schema allows one) is a
    // by-design empty state — the result view early-returns an EmptyView with no
    // footer — so the sticky Generate button must stay visible to offer a retry
    // rather than stranding the teacher.
    final hasResult =
        state.hasValue && (state.valueOrNull?.variants.isNotEmpty ?? false);

    final result = state.hasError
        ? QuizErrorView(error: state.error!, onRetry: _submit)
        : ResultView<Quiz>(
            state: state,
            skeleton: const QuizSkeleton(),
            emptyMessage: l10n.quizEmpty,
            onData: (quiz) => QuizResultView(
              quiz: quiz,
              onRegenerate: _submit,
              saveRequest: _lastRequest,
            ),
          );

    return ToolScaffold(
      title: l10n.quizTitle,
      isBusy: state.isLoading,
      submitLabel: l10n.actionGenerate,
      // Hide the sticky Generate button once a quiz with questions is on screen
      // — the document's own action bar (Regenerate / Copy) takes over. An
      // empty-variants result keeps it, so the empty state is never a dead end.
      onSubmit: (state.isLoading || hasResult) ? null : _submit,
      result: KeyedSubtree(key: _resultKey, child: result),
      child: Form(
        key: _formKey,
        autovalidateMode: AutovalidateMode.onUserInteraction,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            EditorialSectionHeader(l10n.quizSectionQuiz),
            const SizedBox(height: AppSpacing.space4),
            _topicField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _numQuestionsField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _questionTypesField(l10n),
            const SizedBox(height: AppSpacing.space8),
            EditorialSectionHeader(l10n.sectionForYourClass),
            const SizedBox(height: AppSpacing.space4),
            _gradeField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _subjectField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _imageField(l10n),
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
      leadingIcon: LucideIcons.hash,
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
          leadingIcon: LucideIcons.listChecks,
          errorText: field.errorText,
          child: Wrap(
            spacing: AppSpacing.space2,
            runSpacing: AppSpacing.space2,
            children: [
              for (final type in QuestionType.values)
                FilterChip(
                  label: Text(_typeLabel(l10n, type)),
                  selected: _types.contains(type),
                  showCheckmark: false,
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
      leadingIcon: LucideIcons.graduationCap,
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
      leadingIcon: LucideIcons.bookOpen,
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

  Widget _imageField(AppLocalizations l10n) {
    // Optional (unlike Worksheet, where the photo is required): a teacher may
    // photograph a textbook page so the quiz is generated from it, or leave it
    // blank and the form behaves exactly as before.
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

  Widget _difficultyField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.quizDifficultyLabel,
      leadingIcon: LucideIcons.gauge,
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
      leadingIcon: LucideIcons.brain,
      hint: l10n.quizBloomsHint,
      child: Wrap(
        spacing: AppSpacing.space2,
        runSpacing: AppSpacing.space2,
        children: [
          for (final level in kBloomsTaxonomyLevels)
            FilterChip(
              label: Text(level),
              selected: _blooms.contains(level),
              showCheckmark: false,
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
