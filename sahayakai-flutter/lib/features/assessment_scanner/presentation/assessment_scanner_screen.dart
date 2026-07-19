import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/media/image_input.dart';
import '../../../shared/domain/picker_options.dart';
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/note_banner.dart';
import '../../../shared/widgets/result_view.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../domain/assessment_scan.dart';
import 'assessment_scanner_controller.dart';
import 'widgets/assessment_scanner_error_view.dart';
import 'widgets/assessment_scanner_result_view.dart';
import 'widgets/assessment_scanner_skeleton.dart';
import 'widgets/page_capture.dart';

/// U-PD5 — Assessment Scanner. Photograph a student's answer sheet (up to 3
/// pages) and get it graded question-by-question with subject-aware rubrics: a
/// per-question marks + feedback list, an overall score gauge, and next steps.
///
/// A capped, scrolling editorial form + a sticky Grade button ([ToolScaffold]),
/// driven by an AsyncNotifier and rendered through [ResultView] (loading /
/// empty / error / data). It REQUIRES at least one page photo (captured through
/// the shared image-picker seam via [PageCapture]) plus a subject and a grade
/// (both validated against the backend's allow-lists); the language defaults to
/// the teacher's, and an answer key is optional. On success the scorecard is
/// wrapped in a `DocumentSheet` (see [AssessmentScannerResultView]) and the view
/// auto-scrolls to its masthead.
class AssessmentScannerScreen extends ConsumerStatefulWidget {
  const AssessmentScannerScreen({super.key});

  @override
  ConsumerState<AssessmentScannerScreen> createState() =>
      _AssessmentScannerScreenState();
}

class _AssessmentScannerScreenState
    extends ConsumerState<AssessmentScannerScreen> {
  final _formKey = GlobalKey<FormState>();
  final _answerKeyController = TextEditingController();

  /// Anchors the auto-scroll: the result region's top, which for a successful
  /// grade is the DocumentSheet masthead.
  final _resultKey = GlobalKey();

  final List<PickedImage> _pages = <PickedImage>[];
  String? _subject;
  String? _grade;
  late AppLocale _language;

  @override
  void initState() {
    super.initState();
    _language = ref.read(localeControllerProvider);
  }

  @override
  void dispose() {
    _answerKeyController.dispose();
    super.dispose();
  }

  void _submit() {
    FocusScope.of(context).unfocus();
    // The button is disabled until a page is added, so `_pages` is non-empty
    // here; the subject/grade validators own the rest of the gate.
    if (_pages.isEmpty) return;
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final request = AssessmentScanRequest(
      // A fresh idempotency key per grade — Regenerate must NOT be served the
      // cached result for the previous id.
      assessmentId: newAssessmentId(),
      pageDataUris: _pages.map((p) => p.dataUri).toList(growable: false),
      subject: _subject!,
      gradeLevel: _grade!,
      language: _language.aiName,
      teacherAnswerKeyText: _answerKeyController.text,
    );
    ref.read(assessmentScannerControllerProvider.notifier).grade(request);
  }

  /// Brings the result masthead to the top of the viewport when a fresh grade
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
    final state = ref.watch(assessmentScannerControllerProvider);

    // Auto-scroll to the result header on a fresh success (loading -> data).
    ref.listen<AsyncValue<AssessmentResult?>>(
        assessmentScannerControllerProvider, (prev, next) {
      final wasLoading = prev?.isLoading ?? false;
      final nowHasResult =
          !next.isLoading && next.hasValue && next.valueOrNull != null;
      if (wasLoading && nowHasResult) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToResult());
      }
    });

    final hasResult = state.hasValue && state.valueOrNull != null;

    final result = state.hasError
        ? AssessmentScannerErrorView(error: state.error!, onRetry: _submit)
        : ResultView<AssessmentResult>(
            state: state,
            skeleton: const AssessmentScannerSkeleton(),
            emptyMessage: l10n.assessmentScannerEmpty,
            onData: (result) => AssessmentScannerResultView(
              result: result,
              onRegenerate: _submit,
            ),
          );

    // The Grade button stays disabled until at least one page is captured, and
    // is hidden once a scorecard is on screen (the document's own action bar
    // takes over).
    final canSubmit = _pages.isNotEmpty && !state.isLoading && !hasResult;

    return ToolScaffold(
      title: l10n.assessmentScannerTitle,
      isBusy: state.isLoading,
      submitLabel: l10n.assessmentScannerSubmit,
      onSubmit: canSubmit ? _submit : null,
      result: KeyedSubtree(key: _resultKey, child: result),
      child: Form(
        key: _formKey,
        autovalidateMode: AutovalidateMode.onUserInteraction,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            EditorialSectionHeader(l10n.assessmentScannerSectionSheet),
            const SizedBox(height: AppSpacing.space4),
            _pagesField(l10n),
            const SizedBox(height: AppSpacing.space8),
            EditorialSectionHeader(l10n.sectionForYourClass),
            const SizedBox(height: AppSpacing.space4),
            _subjectField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _gradeField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _languageField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _answerKeyField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _PrivacyNote(l10n: l10n),
          ],
        ),
      ),
    );
  }

  Widget _pagesField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.assessmentScannerPagesLabel,
      hint: l10n.assessmentScannerPagesHint,
      leadingIcon: LucideIcons.scanLine,
      child: PageCapture(
        pages: _pages,
        onChanged: (pages) => setState(() {
          _pages
            ..clear()
            ..addAll(pages);
        }),
      ),
    );
  }

  Widget _subjectField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.assessmentScannerSubjectLabel,
      hint: l10n.assessmentScannerSubjectHint,
      leadingIcon: LucideIcons.bookOpen,
      child: DropdownButtonFormField<String>(
        initialValue: _subject,
        isExpanded: true,
        hint: Text(l10n.assessmentScannerSubjectPlaceholder),
        items: [
          for (final subject in kAssessmentSubjects)
            DropdownMenuItem<String>(value: subject, child: Text(subject)),
        ],
        onChanged: (value) => setState(() => _subject = value),
        validator: (value) =>
            value == null ? l10n.assessmentScannerSubjectError : null,
      ),
    );
  }

  Widget _gradeField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.assessmentScannerGradeLabel,
      leadingIcon: LucideIcons.graduationCap,
      child: DropdownButtonFormField<String>(
        initialValue: _grade,
        isExpanded: true,
        hint: Text(l10n.assessmentScannerGradePlaceholder),
        items: [
          for (final grade in kGradeLevels)
            DropdownMenuItem<String>(value: grade, child: Text(grade)),
        ],
        onChanged: (value) => setState(() => _grade = value),
        validator: (value) =>
            value == null ? l10n.assessmentScannerGradeError : null,
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

  Widget _answerKeyField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.assessmentScannerAnswerKeyLabel,
      optionalLabel: l10n.assessmentScannerOptional,
      hint: l10n.assessmentScannerAnswerKeyHint,
      leadingIcon: LucideIcons.listChecks,
      child: TextFormField(
        controller: _answerKeyController,
        maxLength: 20000,
        maxLines: 6,
        minLines: 2,
        textInputAction: TextInputAction.newline,
        textCapitalization: TextCapitalization.sentences,
        decoration:
            InputDecoration(hintText: l10n.assessmentScannerAnswerKeyPlaceholder),
      ),
    );
  }
}

/// A quiet note that the student's name is never sent for grading. Dignified,
/// not a warning.
class _PrivacyNote extends StatelessWidget {
  const _PrivacyNote({required this.l10n});

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    // Full ink (default AiText onSurface), matching the sibling _QualityCard:
    // NoteBanner's surfaceContainerHigh fill makes the muted body only ~3.86:1.
    return NoteBanner(
      icon: LucideIcons.info,
      body: l10n.assessmentScannerPrivacyNote,
    );
  }
}
