import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/domain/picker_options.dart';
import '../../../shared/media/image_input.dart';
import '../../../shared/motion/animated_entrance.dart';
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

  /// Batch mode (v3 Screen 11): reopen the camera after every capture so a
  /// stack scans back-to-back. Lives here so the header's page pill and the
  /// capture cap stay in sync.
  bool _batch = false;

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
      assessmentScannerControllerProvider,
      (prev, next) {
        final wasLoading = prev?.isLoading ?? false;
        final nowHasResult =
            !next.isLoading && next.hasValue && next.valueOrNull != null;
        if (wasLoading && nowHasResult) {
          WidgetsBinding.instance.addPostFrameCallback(
            (_) => _scrollToResult(),
          );
        }
      },
    );

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
      // Screen 11 (capture) wears the solid dark scanner surface; Screen 12
      // (results) wears its own warm light wash — the design's phase flip.
      wash: hasResult ? AppGradients.washScanResults : AppGradients.washScanner,
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
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
          // v3 Screen 11/12's header line: the test context + the page pill.
          _HeaderRow(
            contextLine: _contextLine(l10n),
            pages: _pages.length,
            maxPages: kAssessmentMaxPages,
          ),
          // The form is the CAPTURE phase (Screen 11). Once a scorecard is on
          // screen the design shows results only (Screen 12), but the form
          // stays mounted Offstage so its state — and the Form validation
          // Regenerate relies on — survive the flip.
          Offstage(
            offstage: hasResult,
            child: Form(
              key: _formKey,
              autovalidateMode: AutovalidateMode.onUserInteraction,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(height: AppSpacing.space6),
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
          ),
        ],
      ),
      index: 0,
      ),
    );
  }

  /// The header line under the app bar: `grade · subject` once chosen (the
  /// design's "Class 7 · Maths test"), falling back to the tool subtitle, plus
  /// the `N / max` page pill on the right.
  String _contextLine(AppLocalizations l10n) {
    final parts = <String>[
      if (_grade != null && _grade!.isNotEmpty) _grade!,
      if (_subject != null && _subject!.isNotEmpty) _subject!,
    ];
    return parts.isEmpty ? l10n.assessmentScannerSubtitle : parts.join(' · ');
  }

  Widget _pagesField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.assessmentScannerPagesLabel,
      hint: l10n.assessmentScannerPagesHint,
      leadingIcon: LucideIcons.scanLine,
      child: PageCapture(
        pages: _pages,
        batch: _batch,
        onToggleBatch: () => setState(() => _batch = !_batch),
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
        decoration: InputDecoration(
          hintText: l10n.assessmentScannerAnswerKeyPlaceholder,
        ),
      ),
    );
  }
}

/// v3 Screen 11/12's content header line: the live test context on the left
/// (the design's "Class 7 · Maths test") and the `N / max` pages pill on the
/// right (the design's "12 / 34"). The screen title itself lives in the app
/// bar, so this line never duplicates it.
class _HeaderRow extends StatelessWidget {
  const _HeaderRow({
    required this.contextLine,
    required this.pages,
    required this.maxPages,
  });

  final String contextLine;
  final int pages;
  final int maxPages;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Text(
            contextLine,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            // Theme role: legible on the dark capture surface AND on Screen
            // 12's light wash once the phase flips.
            style: text.bodySmall?.copyWith(
              fontSize: 12,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.space3),
        // The page pill: milk ground, ink text — high contrast on both phases.
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
          decoration: const BoxDecoration(
            color: AppColors.milk50,
            borderRadius: BorderRadius.all(Radius.circular(9999)),
          ),
          child: Text(
            '$pages / $maxPages',
            style: text.labelSmall?.copyWith(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.ink900,
            ),
          ),
        ),
      ],
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
