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
import '../domain/visual_aid.dart';
import 'visual_aid_controller.dart';
import 'widgets/visual_aid_error_view.dart';
import 'widgets/visual_aid_result_view.dart';
import 'widgets/visual_aid_skeleton.dart';

/// U-PD1 — Visual Aid Designer. One prompt in, one grade-tailored teaching
/// illustration (an IMAGE) out. A capped, scrolling form + a sticky Create
/// button ([ToolScaffold]), driven by an AsyncNotifier and rendered through
/// [ResultView] (loading / empty / error / data).
///
/// Only `prompt` is required; grade, subject and language are optional because
/// the flow back-fills them from the teacher's profile.
class VisualAidScreen extends ConsumerStatefulWidget {
  const VisualAidScreen({super.key, this.prefill});

  /// Optional seed from a VIDYA NAVIGATE_AND_FILL directive — the spoken topic
  /// becomes the prompt. Defaults to null, so existing call sites and tests open
  /// the blank form unchanged.
  final ToolPrefill? prefill;

  @override
  ConsumerState<VisualAidScreen> createState() => _VisualAidScreenState();
}

class _VisualAidScreenState extends ConsumerState<VisualAidScreen> {
  final _formKey = GlobalKey<FormState>();
  final _promptController = TextEditingController();

  /// Anchors the auto-scroll: the result region's top, which for a successful
  /// generation is the DocumentSheet masthead.
  final _resultKey = GlobalKey();

  /// The prompt as it was submitted — the masthead title of the drawing that
  /// comes back. Held separately so editing the field afterwards does not
  /// retitle the drawing already on screen.
  String? _submittedPrompt;

  /// The grade as it was submitted — the masthead badge (the endpoint does not
  /// echo grade back, so it is carried from the form).
  String? _submittedGrade;

  String? _grade;
  String? _subject;
  late AppLocale _language;

  @override
  void initState() {
    super.initState();
    _language = ref.read(localeControllerProvider);
    _applyPrefill(widget.prefill);
  }

  /// Seeds the form from a VIDYA directive. The spoken topic becomes the prompt;
  /// grade/subject apply only when this form offers them; the language falls
  /// back to the current one when it is not one of the 11.
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
    _submittedPrompt = _promptController.text;
    _submittedGrade = _grade;
    final request = VisualAidRequest(
      prompt: _promptController.text,
      gradeLevel: _grade,
      subject: _subject,
      language: _language.aiName,
    );
    ref.read(visualAidControllerProvider.notifier).generate(request);
  }

  /// Brings the result masthead to the top of the viewport when a fresh drawing
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
    final state = ref.watch(visualAidControllerProvider);

    // Auto-scroll to the result header on a fresh success (loading -> data).
    ref.listen<AsyncValue<VisualAid?>>(visualAidControllerProvider,
        (prev, next) {
      final wasLoading = prev?.isLoading ?? false;
      final nowHasResult =
          !next.isLoading && next.hasValue && next.valueOrNull != null;
      if (wasLoading && nowHasResult) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToResult());
      }
    });

    final hasResult = state.hasValue && state.valueOrNull != null;

    final result = state.hasError
        ? VisualAidErrorView(error: state.error!, onRetry: _submit)
        : ResultView<VisualAid>(
            state: state,
            skeleton: const VisualAidSkeleton(),
            emptyMessage: l10n.visualAidEmpty,
            onData: (aid) => VisualAidResultView(
              aid: aid,
              prompt: _submittedPrompt,
              gradeLevel: _submittedGrade,
              onRegenerate: _submit,
            ),
          );

    return ToolScaffold(
      title: l10n.visualAidTitle,
      isBusy: state.isLoading,
      submitLabel: l10n.visualAidAction,
      // Hide the sticky submit button once a drawing is on screen — the
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

  Widget _promptField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.visualAidPromptLabel,
      leadingIcon: LucideIcons.image,
      trailing: InlineFieldMic(
        expectedLanguage: _language.code,
        onResult: (text) => _promptController.text = text,
      ),
      child: TextFormField(
        controller: _promptController,
        // The flow rejects anything longer, so stop it here with a counter
        // rather than let the request fail.
        maxLength: kMaxVisualAidPromptLength,
        maxLines: 4,
        minLines: 3,
        textInputAction: TextInputAction.newline,
        textCapitalization: TextCapitalization.sentences,
        keyboardType: TextInputType.multiline,
        decoration: InputDecoration(hintText: l10n.visualAidPromptHint),
        validator: (value) => (value == null || value.trim().isEmpty)
            ? l10n.visualAidPromptError
            : null,
      ),
    );
  }

  Widget _gradeField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.visualAidGradeLabel,
      optionalLabel: l10n.visualAidOptional,
      leadingIcon: LucideIcons.graduationCap,
      child: DropdownButtonFormField<String?>(
        initialValue: _grade,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.visualAidGradeAny),
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
      label: l10n.visualAidSubjectLabel,
      optionalLabel: l10n.visualAidOptional,
      leadingIcon: LucideIcons.bookOpen,
      child: DropdownButtonFormField<String?>(
        initialValue: _subject,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.visualAidSubjectAny),
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
