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
import '../domain/teacher_advice.dart';
import 'teacher_training_controller.dart';
import 'widgets/teacher_training_error_view.dart';
import 'widgets/teacher_training_result_view.dart';
import 'widgets/teacher_training_skeleton.dart';

/// P1.4 — the Teaching Coach. A teacher asks a professional-development question
/// and gets back pedagogically-grounded strategies. A capped, scrolling editorial
/// form + a sticky action button ([ToolScaffold]), driven by an AsyncNotifier and
/// rendered through [ResultView] (loading / empty / error / data). On success the
/// advice is wrapped in a `DocumentSheet` (see [TeacherTrainingResultView]) and
/// the view auto-scrolls to its masthead.
///
/// Only `question` is required; subject and language are optional because the
/// flow back-fills them from the teacher's profile. There is no grade field:
/// the endpoint's input schema has none.
class TeacherTrainingScreen extends ConsumerStatefulWidget {
  const TeacherTrainingScreen({super.key, this.prefill});

  /// Optional seed from a VIDYA NAVIGATE_AND_FILL directive — the spoken topic
  /// becomes the question. Defaults to null, so every existing call site and
  /// test opens the blank form unchanged. There is no grade to seed (this form
  /// offers none); a prefilled grade is simply ignored.
  final ToolPrefill? prefill;

  @override
  ConsumerState<TeacherTrainingScreen> createState() =>
      _TeacherTrainingScreenState();
}

class _TeacherTrainingScreenState extends ConsumerState<TeacherTrainingScreen> {
  final _formKey = GlobalKey<FormState>();
  final _questionController = TextEditingController();

  /// Anchors the auto-scroll: the result region's top, which for a successful
  /// generation is the DocumentSheet masthead.
  final _resultKey = GlobalKey();

  String? _subject;
  late AppLocale _language;

  @override
  void initState() {
    super.initState();
    _language = ref.read(localeControllerProvider);
    _applyPrefill(widget.prefill);
    // The voice path's RUN verb (VOICE_FIRST_GAP §4): answer the spoken coaching
    // question itself when a voice directive carried one — "speak → advice", no
    // tap. Gated on a non-empty question so a partial utterance lands and waits.
    // Post-frame so the Form (and its GlobalKey) is mounted before _submit runs.
    if (widget.prefill?.autoSubmit == true &&
        _questionController.text.trim().isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _submit();
      });
    }
  }

  /// Seeds the form from a VIDYA directive. The spoken topic becomes the
  /// question; subject applies only when this form offers it; the language
  /// falls back to the current one when it is not one of the 11. This form has
  /// no grade field, so a prefilled grade is deliberately never read.
  void _applyPrefill(ToolPrefill? p) {
    if (p == null) return;
    if (p.topic != null) _questionController.text = p.topic!;
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
    final request = TeacherTrainingRequest(
      question: _questionController.text,
      subject: _subject,
      language: _language.aiName,
    );
    ref.read(teacherTrainingControllerProvider.notifier).ask(request);
  }

  /// Brings the result masthead to the top of the viewport when fresh advice
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
    final state = ref.watch(teacherTrainingControllerProvider);

    // Auto-scroll to the result header on a fresh success (loading -> data).
    ref.listen<AsyncValue<TeacherAdvice?>>(teacherTrainingControllerProvider,
        (prev, next) {
      final wasLoading = prev?.isLoading ?? false;
      final nowHasAdvice =
          !next.isLoading && next.hasValue && next.valueOrNull != null;
      if (wasLoading && nowHasAdvice) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToResult());
      }
    });

    final hasResult = state.hasValue && state.valueOrNull != null;

    final result = state.hasError
        ? TeacherTrainingErrorView(error: state.error!, onRetry: _submit)
        : ResultView<TeacherAdvice>(
            state: state,
            skeleton: const TeacherTrainingSkeleton(),
            emptyMessage: l10n.teacherTrainingEmpty,
            onData: (advice) =>
                TeacherTrainingResultView(advice: advice, onRegenerate: _submit),
          );

    return ToolScaffold(
      title: l10n.teacherTrainingTitle,
      isBusy: state.isLoading,
      submitLabel: l10n.teacherTrainingAction,
      // Hide the sticky action button once advice is on screen — the document's
      // own action bar (Regenerate / Copy) takes over.
      onSubmit: (state.isLoading || hasResult) ? null : _submit,
      result: KeyedSubtree(key: _resultKey, child: result),
      child: Form(
        key: _formKey,
        autovalidateMode: AutovalidateMode.onUserInteraction,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            EditorialSectionHeader(l10n.teacherTrainingSectionQuestion),
            const SizedBox(height: AppSpacing.space4),
            _questionField(l10n),
            const SizedBox(height: AppSpacing.space8),
            EditorialSectionHeader(l10n.sectionForYourClass),
            const SizedBox(height: AppSpacing.space4),
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
      label: l10n.teacherTrainingQuestionLabel,
      hint: l10n.teacherTrainingQuestionHint,
      leadingIcon: LucideIcons.helpCircle,
      child: TextFormField(
        controller: _questionController,
        // The endpoint rejects anything longer, so stop it here with a counter
        // rather than let the request fail.
        maxLength: kMaxTeacherTrainingQuestionLength,
        maxLines: 5,
        minLines: 3,
        textInputAction: TextInputAction.newline,
        textCapitalization: TextCapitalization.sentences,
        keyboardType: TextInputType.multiline,
        decoration:
            InputDecoration(hintText: l10n.teacherTrainingQuestionPlaceholder),
        validator: (value) => (value == null || value.trim().isEmpty)
            ? l10n.teacherTrainingQuestionError
            : null,
      ),
    );
  }

  Widget _subjectField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.teacherTrainingSubjectLabel,
      optionalLabel: l10n.teacherTrainingOptional,
      leadingIcon: LucideIcons.bookOpen,
      child: DropdownButtonFormField<String?>(
        initialValue: _subject,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.teacherTrainingSubjectAny),
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
