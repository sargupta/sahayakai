import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/i18n/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/domain/picker_options.dart';
import '../../../shared/media/image_input.dart';
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/widgets/map_more_options.dart';
import '../../../shared/widgets/map_select.dart';
import '../../../shared/widgets/result_view.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../../vidya/domain/deliverable.dart';
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
  const AssessmentScannerScreen({super.key, this.taskDescription});

  /// Optional human-readable task description. When set, a
  /// "From your task: ..." tag is shown at the top of the screen. Defaults to
  /// null (normal entry, no tag). Raw IDs are never shown.
  final String? taskDescription;

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

  /// Set by the first Finish tap, so a missing class or subject shows its
  /// error then, not before the teacher has tried.
  bool _tried = false;

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
    setState(() => _tried = true);
    if (_subject == null || _grade == null) return;
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

  /// The scorecard on the Output screen as the deliver tray takes it. Keyed by
  /// the result instance, so a re-grade is a new deliverable.
  Deliverable? _deliverableFor(
    AssessmentResult? result,
    AppLocalizations l10n,
  ) {
    if (result == null) return null;
    return Deliverable(
      id: 'assessment-scanner-${identityHashCode(result)}',
      title: l10n.assessmentScannerResultTitle,
      text: assessmentResultAsPlainText(result, l10n),
      shareSubject: l10n.assessmentScannerResultTitle,
    );
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
      title: l10n.scannerComposerTitle,
      // The map's "Class 7 · Maths test" once chosen.
      subtitle: _contextLine(l10n),
      headerTrailing: hasResult
          ? null
          : _PagePill(pages: _pages.length, maxPages: kAssessmentMaxPages),
      isBusy: state.isLoading,
      // Output screen (UX map Flow 4): the result replaces the form;
      // Edit brings the form back and keeps the result until a new one lands.
      hasResult: hasResult,
      onResubmit: _submit,
      deliverable: _deliverableFor(state.valueOrNull, l10n),
      submitLabel: l10n.scannerFinish,
      onSubmit: (state.isLoading || hasResult) ? null : _submit,
      canSubmit: canSubmit,
      // Light like the rest of the app: a warm wash while capturing, the
      // results wash once graded.
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
            if (widget.taskDescription != null &&
                widget.taskDescription!.trim().isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  'From your task: ${widget.taskDescription}',
                  style: Theme.of(
                    context,
                  ).textTheme.labelSmall?.copyWith(color: AppColors.textMuted),
                ),
              ),
            // The form is the capture phase. Once a scorecard is on screen it
            // stays mounted Offstage, so its state survives the flip.
            Offstage(
              offstage: hasResult,
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    PageCapture(
                      pages: _pages,
                      batch: _batch,
                      onToggleBatch: () => setState(() => _batch = !_batch),
                      onChanged: (pages) => setState(() {
                        _pages
                          ..clear()
                          ..addAll(pages);
                      }),
                    ),
                    const SizedBox(height: AppSpacing.space4),
                    // The grade is tuned to the class and the subject; the
                    // server needs both.
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: MapSelect<String?>(
                            label: l10n.toolClassLabel,
                            value: _grade,
                            options: [
                              (null, l10n.assessmentScannerGradePlaceholder),
                              for (final grade in kGradeLevels) (grade, grade),
                            ],
                            onChanged: (value) =>
                                setState(() => _grade = value),
                            errorText: _tried && _grade == null
                                ? l10n.assessmentScannerGradeError
                                : null,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: MapSelect<String?>(
                            label: l10n.assessmentScannerSubjectLabel,
                            value: _subject,
                            options: [
                              (null, l10n.assessmentScannerSubjectPlaceholder),
                              for (final subject in kAssessmentSubjects)
                                (subject, subject),
                            ],
                            onChanged: (value) =>
                                setState(() => _subject = value),
                            errorText: _tried && _subject == null
                                ? l10n.assessmentScannerSubjectError
                                : null,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.space3),
                    MapMoreOptions(
                      summary: _language.nativeLabel,
                      children: [
                        MapSelect<AppLocale>(
                          label: l10n.languageLabel,
                          value: _language,
                          options: [
                            for (final locale in AppLocale.values)
                              (locale, locale.nativeLabel),
                          ],
                          onChanged: (value) =>
                              setState(() => _language = value),
                        ),
                        _answerKeyField(l10n),
                        Text(
                          l10n.assessmentScannerPrivacyNote,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: AppColors.textMuted),
                        ),
                      ],
                    ),
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

  /// The muted line under the title: `class · subject` once chosen (the map's
  /// "Class 7 · Maths test"), else what the tool does.
  String _contextLine(AppLocalizations l10n) {
    final parts = <String>[
      if (_grade != null && _grade!.isNotEmpty) _grade!,
      if (_subject != null && _subject!.isNotEmpty) _subject!,
    ];
    return parts.isEmpty ? l10n.assessmentScannerSubtitle : parts.join(' · ');
  }

  Widget _answerKeyField(AppLocalizations l10n) {
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          l10n.assessmentScannerAnswerKeyLabel,
          style: text.bodyLarge?.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.textStrong,
          ),
        ),
        Text(
          l10n.assessmentScannerAnswerKeyHint,
          style: text.bodySmall?.copyWith(color: AppColors.textMuted),
        ),
        const SizedBox(height: AppSpacing.space2),
        // The theme's input field, as on every other tool form.
        TextFormField(
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
      ],
    );
  }
}

/// The header's page count ("1 / 3"), a light pill with a hairline ring.
class _PagePill extends StatelessWidget {
  const _PagePill({required this.pages, required this.maxPages});

  final int pages;
  final int maxPages;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Semantics(
      label: l10n.assessmentScannerPageCounter(pages, maxPages),
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: const ShapeDecoration(
          color: AppColors.surfaceCard,
          shape: StadiumBorder(
            side: BorderSide(color: AppColors.borderHairline),
          ),
        ),
        child: Text(
          '$pages / $maxPages',
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: AppColors.textStrong,
          ),
        ),
      ),
    );
  }
}
