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
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/result_view.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../domain/worksheet.dart';
import 'worksheet_controller.dart';
import 'widgets/worksheet_error_view.dart';
import 'widgets/worksheet_result_view.dart';
import 'widgets/worksheet_skeleton.dart';

/// P1.1 — the Worksheet Wizard. A capped, scrolling editorial form + a sticky
/// Generate button ([ToolScaffold]), driven by an AsyncNotifier and rendered
/// through [ResultView] (loading / empty / error / data). Unlike the text tools,
/// the worksheet REQUIRES a textbook-page photo, captured through the shared
/// [ImageInput] and sent as a base64 data URI. On success the worksheet is
/// wrapped in a `DocumentSheet` (see [WorksheetResultView]) and the view
/// auto-scrolls to its masthead.
class WorksheetWizardScreen extends ConsumerStatefulWidget {
  const WorksheetWizardScreen({super.key});

  @override
  ConsumerState<WorksheetWizardScreen> createState() =>
      _WorksheetWizardScreenState();
}

class _WorksheetWizardScreenState extends ConsumerState<WorksheetWizardScreen> {
  final _formKey = GlobalKey<FormState>();
  final _promptController = TextEditingController();

  /// Anchors the auto-scroll: the result region's top, which for a successful
  /// generation is the DocumentSheet masthead.
  final _resultKey = GlobalKey();

  PickedImage? _image;
  String? _grade;
  String? _subject;
  late AppLocale _language;

  /// The request that produced the worksheet on screen, held so its Save action
  /// can build the `content/save` body (which needs the prompt / language the
  /// model output alone does not carry).
  WorksheetRequest? _lastRequest;

  @override
  void initState() {
    super.initState();
    _language = ref.read(localeControllerProvider);
  }

  @override
  void dispose() {
    _promptController.dispose();
    super.dispose();
  }

  void _submit() {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;
    // The image is validated by its FormField above, so it is non-null here.
    final request = WorksheetRequest(
      imageDataUri: _image!.dataUri,
      prompt: _promptController.text,
      gradeLevel: _grade,
      subject: _subject,
      language: _language.aiName,
    );
    _lastRequest = request;
    // A fresh generation starts a fresh save state, so the previous worksheet's
    // "Saved" badge does not carry over onto the new result.
    ref.read(worksheetSaveControllerProvider.notifier).reset();
    ref.read(worksheetControllerProvider.notifier).generate(request);
  }

  /// Brings the result masthead to the top of the viewport when a fresh
  /// worksheet lands. Honours reduce-motion by jumping (no scroll tween).
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
    final state = ref.watch(worksheetControllerProvider);

    // Auto-scroll to the result header on a fresh success (loading -> data).
    ref.listen<AsyncValue<Worksheet?>>(worksheetControllerProvider,
        (prev, next) {
      final wasLoading = prev?.isLoading ?? false;
      final nowHasWorksheet =
          !next.isLoading && next.hasValue && next.valueOrNull != null;
      if (wasLoading && nowHasWorksheet) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToResult());
      }
    });

    final hasResult = state.hasValue && state.valueOrNull != null;

    final result = state.hasError
        ? WorksheetErrorView(error: state.error!, onRetry: _submit)
        : ResultView<Worksheet>(
            state: state,
            skeleton: const WorksheetSkeleton(),
            emptyMessage: l10n.worksheetEmpty,
            onData: (worksheet) => WorksheetResultView(
              worksheet: worksheet,
              onRegenerate: _submit,
              saveRequest: _lastRequest,
            ),
          );

    return ToolScaffold(
      title: l10n.worksheetTitle,
      isBusy: state.isLoading,
      submitLabel: l10n.actionGenerate,
      // Hide the sticky Generate button once a worksheet is on screen — the
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
            EditorialSectionHeader(l10n.worksheetSectionWorksheet),
            const SizedBox(height: AppSpacing.space4),
            _imageField(l10n),
            const SizedBox(height: AppSpacing.space6),
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

  /// The image is required by the endpoint, so it is a real [FormField]: its
  /// "required" error joins the form's own validation pass and clears the
  /// moment a photo is picked.
  Widget _imageField(AppLocalizations l10n) {
    return FormField<PickedImage>(
      initialValue: _image,
      validator: (value) => value == null ? l10n.worksheetImageError : null,
      builder: (field) {
        return LabeledField(
          label: l10n.worksheetImageLabel,
          hint: l10n.worksheetImageHint,
          leadingIcon: LucideIcons.image,
          child: ImageInput(
            value: _image,
            errorText: field.errorText,
            onChanged: (picked) {
              setState(() => _image = picked);
              field.didChange(picked);
            },
          ),
        );
      },
    );
  }

  Widget _promptField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.worksheetPromptLabel,
      leadingIcon: LucideIcons.fileText,
      child: TextFormField(
        controller: _promptController,
        maxLength: 2000,
        maxLines: 4,
        minLines: 2,
        textInputAction: TextInputAction.newline,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(hintText: l10n.worksheetPromptHint),
        validator: (value) => (value == null || value.trim().isEmpty)
            ? l10n.worksheetPromptError
            : null,
      ),
    );
  }

  Widget _gradeField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.worksheetGradeLabel,
      optionalLabel: l10n.worksheetOptional,
      leadingIcon: LucideIcons.graduationCap,
      child: DropdownButtonFormField<String?>(
        initialValue: _grade,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.worksheetGradeAny),
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
      label: l10n.worksheetSubjectLabel,
      optionalLabel: l10n.worksheetOptional,
      leadingIcon: LucideIcons.bookOpen,
      child: DropdownButtonFormField<String?>(
        initialValue: _subject,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.worksheetSubjectAny),
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
