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
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/result_view.dart';
import '../../../shared/widgets/tool_scaffold.dart';
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
    ref.read(instantAnswerControllerProvider.notifier).ask(request);
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

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final state = ref.watch(instantAnswerControllerProvider);

    // Auto-scroll to the result header on a fresh success (loading -> data).
    ref.listen<AsyncValue<InstantAnswer?>>(instantAnswerControllerProvider,
        (prev, next) {
      final wasLoading = prev?.isLoading ?? false;
      final nowHasAnswer =
          !next.isLoading && next.hasValue && next.valueOrNull != null;
      if (wasLoading && nowHasAnswer) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToResult());
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
            ),
          );

    return ToolScaffold(
      title: l10n.instantAnswerTitle,
      isBusy: state.isLoading,
      submitLabel: l10n.instantAnswerAction,
      // Hide the sticky submit button once an answer is on screen — the
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
            _questionField(l10n),
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

  Widget _questionField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.instantAnswerQuestionLabel,
      leadingIcon: LucideIcons.helpCircle,
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
        decoration: InputDecoration(hintText: l10n.instantAnswerQuestionHint),
        validator: (value) => (value == null || value.trim().isEmpty)
            ? l10n.instantAnswerQuestionError
            : null,
      ),
    );
  }

  Widget _gradeField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.instantAnswerGradeLabel,
      optionalLabel: l10n.instantAnswerOptional,
      leadingIcon: LucideIcons.graduationCap,
      child: DropdownButtonFormField<String?>(
        initialValue: _grade,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.instantAnswerGradeAny),
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
      label: l10n.instantAnswerSubjectLabel,
      optionalLabel: l10n.instantAnswerOptional,
      leadingIcon: LucideIcons.bookOpen,
      child: DropdownButtonFormField<String?>(
        initialValue: _subject,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.instantAnswerSubjectAny),
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

/// A labelled form row: a weight-first label (with an optional "Optional"
/// marker) and its control. On the 4dp grid throughout. Mirrors the quiz and
/// lesson-plan forms.
