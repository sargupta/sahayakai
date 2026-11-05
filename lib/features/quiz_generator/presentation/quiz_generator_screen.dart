import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
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
import '../../../shared/widgets/map_option.dart';
import '../../../shared/widgets/map_select.dart';
import '../../../shared/widgets/result_view.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../../vidya/domain/deliverable.dart';
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
    final count = p.questionCount;
    if (count != null &&
        count >= kComposerMinQuestions &&
        count <= kMaxQuestions) {
      _numQuestions = count;
    }
    for (final difficulty in QuizDifficulty.values) {
      if (difficulty.name == p.difficulty) _targetDifficulty = difficulty;
    }
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

  /// The quiz on the Output screen as the deliver tray takes it, with no
  /// answers revealed. Keyed by the quiz instance, so a regeneration is a new
  /// deliverable. A quiz without variants is the empty state.
  Deliverable? _deliverableFor(Quiz? quiz, AppLocalizations l10n) {
    if (quiz == null || quiz.variants.isEmpty) return null;
    final heading = quiz.topic ?? quiz.variants.first.title;
    return Deliverable(
      id: 'quiz-${identityHashCode(quiz)}',
      title: heading.isEmpty ? l10n.quizTitle : heading,
      subtitle: heading.isEmpty ? null : heading,
      text: quizAsPlainText(quiz, l10n),
      shareSubject: heading.isEmpty ? null : heading,
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
      wash: AppGradients.washQuiz,
      title: l10n.quizComposerTitle,
      subtitle: l10n.quizComposerSubtitle,
      isBusy: state.isLoading,
      // Output screen (UX map Flow 4): the result replaces the form;
      // Edit brings the form back and keeps the result until a new one lands.
      hasResult: hasResult,
      deliverable: _deliverableFor(state.valueOrNull, l10n),
      onResubmit: _submit,
      submitLabel: l10n.quizGenerate,
      // Hide the sticky Generate button once a quiz with questions is on screen
      // — the document's own action bar (Regenerate / Copy) takes over. An
      // empty-variants result keeps it, so the empty state is never a dead end.
      onSubmit: (state.isLoading || hasResult) ? null : _submit,
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
              _topicField(l10n),
              const SizedBox(height: AppSpacing.space4),
              _questionTypesField(l10n),
              const SizedBox(height: AppSpacing.space4),
              _numQuestionsField(l10n),
              const SizedBox(height: AppSpacing.space3),
              _bloomsField(l10n),
              const SizedBox(height: AppSpacing.space3),
              MapMoreOptions(
                summary: _moreSummary(l10n),
                children: [
                  _classAndSubject(l10n),
                  _languageField(l10n),
                  _difficultyField(l10n),
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

  /// The map's topic card: the quiz topic on the card itself, with the small
  /// mic that dictates into this field only.
  Widget _topicField(AppLocalizations l10n) {
    return MapCard(
      child: LabeledField(
        label: l10n.quizTopicLabel,
        trailingBesideChild: true,
        trailing: InlineFieldMic(
          expectedLanguage: _language.code,
          onResult: (text) => _topicController.text = text,
        ),
        child: TextFormField(
          controller: _topicController,
          maxLength: 1000,
          maxLines: 4,
          minLines: 2,
          textInputAction: TextInputAction.newline,
          textCapitalization: TextCapitalization.sentences,
          decoration: mapBareInput(l10n.quizTopicHint),
          validator: (value) => (value == null || value.trim().isEmpty)
              ? l10n.quizTopicError
              : null,
        ),
      ),
    );
  }

  /// Question types: the map's two-column grid of option rows, each with a
  /// check when chosen. At least one is required.
  Widget _questionTypesField(AppLocalizations l10n) {
    return FormField<Set<QuestionType>>(
      initialValue: _types,
      validator: (value) =>
          (value == null || value.isEmpty) ? l10n.quizTypesError : null,
      builder: (field) {
        void toggle(QuestionType type) {
          setState(() {
            if (!_types.remove(type)) _types.add(type);
          });
          field.didChange(_types);
        }

        Widget option(QuestionType type) => MapOption(
          label: _typeLabel(l10n, type),
          selected: _types.contains(type),
          showCheck: true,
          onTap: () => toggle(type),
        );

        const types = QuestionType.values;
        return LabeledField(
          label: l10n.quizTypesLabel,
          errorText: field.errorText,
          child: Column(
            children: [
              for (var i = 0; i < types.length; i += 2) ...[
                if (i > 0) const SizedBox(height: 10),
                IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Expanded(child: option(types[i])),
                      const SizedBox(width: 10),
                      Expanded(
                        child: i + 1 < types.length
                            ? option(types[i + 1])
                            : const SizedBox.shrink(),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  /// The map's "Questions" slider (3 to 20), its value in saffron at the end
  /// of the label row.
  Widget _numQuestionsField(AppLocalizations l10n) {
    final text = Theme.of(context).textTheme;
    return LabeledField(
      label: l10n.quizQuestionsLabel,
      trailing: Text(
        '$_numQuestions',
        style: text.titleMedium?.copyWith(
          fontWeight: FontWeight.w700,
          color: AppColors.textEyebrow,
        ),
      ),
      child: SliderTheme(
        data: SliderTheme.of(context).copyWith(
          activeTrackColor: AppColors.accent,
          thumbColor: AppColors.accent,
          inactiveTrackColor: AppColors.mapToggleOff,
          overlayColor: AppColors.accentTint,
          tickMarkShape: SliderTickMarkShape.noTickMark,
        ),
        child: Slider(
          value: _numQuestions.toDouble(),
          min: kComposerMinQuestions.toDouble(),
          max: kMaxQuestions.toDouble(),
          divisions: kMaxQuestions - kComposerMinQuestions,
          label: '$_numQuestions',
          semanticFormatterCallback: (v) => l10n.quizQuestionCount(v.round()),
          onChanged: (v) => setState(() => _numQuestions = v.round()),
        ),
      ),
    );
  }

  /// Bloom's levels as the map's small saffron chips, then the strategy card
  /// saying what each chosen level asks of the students.
  Widget _bloomsField(AppLocalizations l10n) {
    final text = Theme.of(context).textTheme;
    final chosen = [
      for (final level in kBloomsTaxonomyLevels)
        if (_blooms.contains(level)) level,
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        LabeledField(
          label: l10n.quizBloomLevelsLabel,
          child: Wrap(
            spacing: 7,
            runSpacing: 7,
            children: [
              for (final level in kBloomsTaxonomyLevels)
                MapChip(
                  label: _bloomName(l10n, level),
                  selected: _blooms.contains(level),
                  selectedFill: AppColors.accentFill,
                  onTap: () => setState(() {
                    if (!_blooms.remove(level)) _blooms.add(level);
                  }),
                ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.space3),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.mapStrategyBg,
            borderRadius: AppRadius.rTile,
            border: Border.all(color: AppColors.mapStrategyBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              MapOverline(l10n.quizStrategyTitle, color: AppColors.saffron700),
              const SizedBox(height: AppSpacing.space1),
              if (chosen.isEmpty)
                Text(
                  l10n.quizStrategyEmpty,
                  style: text.bodySmall?.copyWith(color: AppColors.saffron700),
                )
              else
                for (final level in chosen)
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: '${_bloomName(l10n, level)}: ',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        TextSpan(text: _bloomHow(l10n, level)),
                      ],
                    ),
                    style: text.bodySmall?.copyWith(
                      fontSize: 12.5,
                      color: AppColors.saffron700,
                    ),
                  ),
            ],
          ),
        ),
      ],
    );
  }

  /// Class and Subject, side by side (inside More options).
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
            label: l10n.quizSubjectLabel,
            value: _subject,
            options: [
              (null, l10n.quizSubjectAny),
              for (final subject in kSubjects) (subject, subject),
            ],
            onChanged: (value) => setState(() => _subject = value),
          ),
        ),
      ],
    );
  }

  Widget _imageField(AppLocalizations l10n) {
    // Optional (unlike Worksheet, where the photo is required): a teacher may
    // photograph a textbook page to quiz straight from it.
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

  Widget _difficultyField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.quizDifficultyLabel,
      hint: l10n.quizDifficultyHint,
      child: AppSegmented<QuizDifficulty?>(
        value: _targetDifficulty,
        onChanged: (value) => setState(() => _targetDifficulty = value),
        segments: [
          AppSegment(value: null, label: l10n.quizDifficultyAll),
          for (final difficulty in QuizDifficulty.values)
            AppSegment(
              value: difficulty,
              label: _difficultyLabel(l10n, difficulty),
            ),
        ],
      ),
    );
  }

  /// What the closed "More options" card says is set.
  String _moreSummary(AppLocalizations l10n) => [
    _grade ?? l10n.toolAnyClass,
    _language.nativeLabel,
    _targetDifficulty == null
        ? l10n.quizDifficultyAll
        : _difficultyLabel(l10n, _targetDifficulty!),
  ].join(' · ');
}

/// The composer's smallest quiz: the UX map's slider starts at 3.
const int kComposerMinQuestions = 3;

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

/// A Bloom's level (the server's English wire value) in the teacher's
/// language.
String _bloomName(AppLocalizations l10n, String level) => switch (level) {
  'Remember' => l10n.quizBloomRemember,
  'Understand' => l10n.quizBloomUnderstand,
  'Apply' => l10n.quizBloomApply,
  'Analyze' => l10n.quizBloomAnalyze,
  'Evaluate' => l10n.quizBloomEvaluate,
  'Create' => l10n.quizBloomCreate,
  _ => level,
};

/// What a Bloom's level asks of the students, for the strategy card.
String _bloomHow(AppLocalizations l10n, String level) => switch (level) {
  'Remember' => l10n.quizBloomRememberHow,
  'Understand' => l10n.quizBloomUnderstandHow,
  'Apply' => l10n.quizBloomApplyHow,
  'Analyze' => l10n.quizBloomAnalyzeHow,
  'Evaluate' => l10n.quizBloomEvaluateHow,
  'Create' => l10n.quizBloomCreateHow,
  _ => '',
};
