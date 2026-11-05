import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/domain/picker_options.dart';
import '../../../shared/domain/tool_prefill.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/voice/tts_speaker.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/map_card.dart';
import '../../../shared/widgets/map_option.dart';
import '../../../shared/widgets/map_select.dart';
import '../../../shared/widgets/result_view.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../../vidya/domain/deliverable.dart';
import '../../vidya/presentation/widgets/inline_field_mic.dart';
import '../domain/instant_answer.dart';
import 'instant_answer_controller.dart';
import 'widgets/instant_answer_error_view.dart';
import 'widgets/instant_answer_result_view.dart';
import 'widgets/instant_answer_skeleton.dart';

/// P0.6 — Instant Answer. The fastest tool in the app: one question in, one
/// grade-tailored answer out. A capped, scrolling form + a sticky submit
/// button ([ToolScaffold]), driven by an AsyncNotifier and rendered through
/// [ResultView] (loading / empty / error / data).
///
/// Only `question` is required; grade, subject and language are optional
/// because the flow back-fills them from the teacher's profile.
class InstantAnswerScreen extends ConsumerStatefulWidget {
  const InstantAnswerScreen({super.key, this.prefill});

  /// Optional seed from a VIDYA NAVIGATE_AND_FILL directive — the spoken topic
  /// becomes the question. Defaults to null, so existing call sites and tests
  /// open the blank form unchanged.
  final ToolPrefill? prefill;

  @override
  ConsumerState<InstantAnswerScreen> createState() =>
      _InstantAnswerScreenState();
}

class _InstantAnswerScreenState extends ConsumerState<InstantAnswerScreen> {
  final _formKey = GlobalKey<FormState>();
  final _questionController = TextEditingController();

  /// Anchors the auto-scroll: the result region's top, which for a successful
  /// ask is the DocumentSheet masthead.
  final _resultKey = GlobalKey();

  /// The question as it was submitted — the masthead title of the answer that
  /// comes back. Held separately so editing the field afterwards does not
  /// retitle the answer already on screen.
  String? _submittedQuestion;

  String? _grade;
  String? _subject;
  late AppLocale _language;

  /// Part-B once-guard: the voice-path spoken summary fires at most once, when
  /// the first voice-originated result lands (VOICE_FIRST_GAP §5.6).
  bool _spokeVoiceSummary = false;

  /// The request behind the answer currently on screen. "Save to Library" needs
  /// the question / grade / language the model output does not carry, so the
  /// result view is handed the request that produced it. Null until the first
  /// ask, which is exactly when there is nothing to save.
  InstantAnswerRequest? _lastRequest;

  @override
  void initState() {
    super.initState();
    _language = ref.read(localeControllerProvider);
    _applyPrefill(widget.prefill);
    // The voice path's RUN verb (VOICE_FIRST_GAP §4): answer the spoken question
    // itself when a voice directive carried one — "speak → answer", no tap. Gated
    // on a non-empty question so a partial utterance lands on the form and waits.
    // Post-frame so the Form (and its GlobalKey) is mounted before _submit runs.
    if (widget.prefill?.autoSubmit == true &&
        _questionController.text.trim().isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _submit();
      });
    }
  }

  /// Seeds the form from a VIDYA directive. The spoken topic becomes the
  /// question; grade/subject apply only when this form offers them; the language
  /// falls back to the current one when it is not one of the 11.
  void _applyPrefill(ToolPrefill? p) {
    if (p == null) return;
    if (p.topic != null) _questionController.text = p.topic!;
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
    _questionController.dispose();
    super.dispose();
  }

  void _submit() {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    _submittedQuestion = _questionController.text;
    final request = InstantAnswerRequest(
      question: _questionController.text,
      gradeLevel: _grade,
      subject: _subject,
      language: _language.aiName,
    );
    _lastRequest = request;
    ref.read(instantAnswerControllerProvider.notifier).ask(request);
  }

  /// The answer on the Output screen as the deliver tray takes it. Keyed by the
  /// answer instance, so a regeneration is a new deliverable. The question is
  /// trimmed and dropped when blank, exactly as the result view titles it.
  Deliverable? _deliverableFor(InstantAnswer? answer, AppLocalizations l10n) {
    if (answer == null) return null;
    final asked = _submittedQuestion?.trim();
    final question = (asked == null || asked.isEmpty) ? null : asked;
    return Deliverable(
      id: 'instant-answer-${identityHashCode(answer)}',
      title: question ?? l10n.instantAnswerTitle,
      subtitle: question,
      text: instantAnswerAsPlainText(answer, question: question),
      shareSubject: question,
    );
  }

  /// Brings the result masthead to the top of the viewport when a fresh answer
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
  /// long finished by the time the answer lands, so this is a single,
  /// non-overlapping utterance.
  void _maybeSpeakVoiceSummary(AppLocalizations l10n) {
    if (_spokeVoiceSummary || widget.prefill?.autoSubmit != true) return;
    _spokeVoiceSummary = true;
    final topic = widget.prefill?.topic?.trim();
    final summary = (topic == null || topic.isEmpty)
        ? l10n.voiceResultReady(l10n.instantAnswerTitle)
        : l10n.voiceResultReadyWithTopic(l10n.instantAnswerTitle, topic);
    speakResultSummary(
      ref.read(ttsSpeakerProvider),
      summary,
      language: _language.aiName,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = ref.watch(instantAnswerControllerProvider);

    // Auto-scroll to the result header on a fresh success (loading -> data).
    ref.listen<AsyncValue<InstantAnswer?>>(instantAnswerControllerProvider, (
      prev,
      next,
    ) {
      final wasLoading = prev?.isLoading ?? false;
      final nowHasAnswer =
          !next.isLoading && next.hasValue && next.valueOrNull != null;
      if (wasLoading && nowHasAnswer) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToResult());
        _maybeSpeakVoiceSummary(l10n);
      }
    });

    final hasResult = state.hasValue && state.valueOrNull != null;

    final result = state.hasError
        ? InstantAnswerErrorView(error: state.error!, onRetry: _submit)
        : ResultView<InstantAnswer>(
            state: state,
            skeleton: const InstantAnswerSkeleton(),
            emptyMessage: l10n.instantAnswerEmpty,
            onData: (answer) => InstantAnswerResultView(
              answer: answer,
              question: _submittedQuestion,
              onRegenerate: _submit,
              saveRequest: _lastRequest,
            ),
          );

    return ToolScaffold(
      title: l10n.instantAnswerTitle,
      subtitle: l10n.instantComposerSubtitle,
      inkSubmit: true,
      isBusy: state.isLoading,
      // Output screen (UX map Flow 4): the result replaces the form;
      // Edit brings the form back and keeps the result until a new one lands.
      hasResult: hasResult,
      onResubmit: _submit,
      deliverable: _deliverableFor(state.valueOrNull, l10n),
      submitLabel: l10n.instantGenerate,
      // Hide the sticky submit button once an answer is on screen — the
      // document's own action bar (Regenerate / Copy) takes over.
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
              _questionField(l10n),
              const SizedBox(height: AppSpacing.space4),
              _suggestions(l10n),
              const SizedBox(height: AppSpacing.space4),
              _classSubjectLanguage(l10n),
              const SizedBox(height: AppSpacing.space3),
              _sourceNote(l10n),
            ],
          ),
        ),
        index: 0,
      ),
    );
  }

  /// The map's question card: the question on the card itself, with the small
  /// mic that dictates into this field only.
  Widget _questionField(AppLocalizations l10n) {
    return MapCard(
      child: LabeledField(
        label: l10n.instantAnswerQuestionLabel,
        trailingBesideChild: true,
        trailing: InlineFieldMic(
          expectedLanguage: _language.code,
          onResult: (text) => _questionController.text = text,
        ),
        child: TextFormField(
          controller: _questionController,
          // The flow rejects anything longer, so stop it here with a counter
          // rather than let the request fail.
          maxLength: kMaxQuestionLength,
          maxLines: 4,
          minLines: 3,
          textInputAction: TextInputAction.newline,
          textCapitalization: TextCapitalization.sentences,
          keyboardType: TextInputType.multiline,
          decoration: mapBareInput(l10n.instantAnswerQuestionHint),
          validator: (value) => (value == null || value.trim().isEmpty)
              ? l10n.instantAnswerQuestionError
              : null,
        ),
      ),
    );
  }

  /// "Try one of these": what a good question looks like. A tap fills the
  /// question box.
  Widget _suggestions(AppLocalizations l10n) {
    final suggestions = [
      l10n.instantSuggest1,
      l10n.instantSuggest2,
      l10n.instantSuggest3,
      l10n.instantSuggest4,
      l10n.instantSuggest5,
      l10n.instantSuggest6,
    ];
    return LabeledField(
      label: l10n.instantTryOne,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, q) in suggestions.indexed) ...[
            if (i > 0) const SizedBox(height: 7),
            MapOption(
              label: q,
              selected: _questionController.text == q,
              onTap: () => setState(() => _questionController.text = q),
            ),
          ],
        ],
      ),
    );
  }

  /// Class, Subject and Language: the map's three selectors in a row.
  Widget _classSubjectLanguage(AppLocalizations l10n) {
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
        const SizedBox(width: 8),
        Expanded(
          child: MapSelect<String?>(
            label: l10n.instantAnswerSubjectLabel,
            value: _subject,
            options: [
              (null, l10n.instantAnswerSubjectAny),
              for (final subject in kSubjects) (subject, subject),
            ],
            onChanged: (value) => setState(() => _subject = value),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: MapSelect<AppLocale>(
            label: l10n.languageLabel,
            value: _language,
            options: [
              for (final locale in AppLocale.values)
                (locale, locale.nativeLabel),
            ],
            onChanged: (value) => setState(() => _language = value),
          ),
        ),
      ],
    );
  }

  /// The map's source note: answers come from Sahayak's own knowledge, so
  /// the teacher checks the facts first. (The app runs no web check, so it
  /// never promises one.)
  Widget _sourceNote(AppLocalizations l10n) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
      decoration: const BoxDecoration(
        color: AppColors.mapNoteBg,
        borderRadius: AppRadius.rField,
      ),
      child: Text(
        l10n.instantSourceNote,
        style: Theme.of(
          context,
        ).textTheme.bodySmall?.copyWith(color: AppColors.saffron700),
      ),
    );
  }
}

/// A labelled form row: a weight-first label (with an optional "Optional"
/// marker) and its control. On the 4dp grid throughout. Mirrors the quiz and
/// lesson-plan forms.
