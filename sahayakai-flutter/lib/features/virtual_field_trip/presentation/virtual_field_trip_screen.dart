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
import '../domain/virtual_field_trip.dart';
import 'virtual_field_trip_controller.dart';
import 'widgets/virtual_field_trip_error_view.dart';
import 'widgets/virtual_field_trip_pending_view.dart';
import 'widgets/virtual_field_trip_result_view.dart';
import 'widgets/virtual_field_trip_skeleton.dart';

/// U-PD4 — Virtual Field Trip. A teacher enters a topic and gets a curated
/// itinerary of Google-Earth stops — a generated DOCUMENT, rendered through a
/// `DocumentSheet` like the lesson plan, not a browse. A capped, scrolling form +
/// a sticky "Plan the trip" button ([ToolScaffold]), driven by an AsyncNotifier
/// and rendered through [ResultView].
///
/// The state machine has one extra branch over the other document tools: the
/// benign 202 `still_generating` outcome ([FieldTripStillGenerating]) resolves to
/// a calm "check My Library" panel, NOT the red error view — the teacher's trip
/// is being saved server-side.
class VirtualFieldTripScreen extends ConsumerStatefulWidget {
  const VirtualFieldTripScreen({super.key, this.prefill});

  /// Optional seed from a VIDYA NAVIGATE_AND_FILL directive — the spoken topic
  /// becomes the topic field. Defaults to null, so existing call sites and
  /// tests open the blank form unchanged.
  final ToolPrefill? prefill;

  @override
  ConsumerState<VirtualFieldTripScreen> createState() =>
      _VirtualFieldTripScreenState();
}

class _VirtualFieldTripScreenState
    extends ConsumerState<VirtualFieldTripScreen> {
  final _formKey = GlobalKey<FormState>();
  final _topicController = TextEditingController();

  /// Anchors the auto-scroll: the result region's top (the DocumentSheet
  /// masthead on a success, the calm panel on a 202).
  final _resultKey = GlobalKey();

  String? _grade;
  late AppLocale _language;

  @override
  void initState() {
    super.initState();
    _language = ref.read(localeControllerProvider);
    _applyPrefill(widget.prefill);
  }

  /// Seeds the form from a VIDYA directive. The spoken topic becomes the
  /// topic field; grade applies only when it's one of the offered levels;
  /// the language falls back to the current one when it is not one of the 11.
  /// This screen has no subject field, unlike its Visual Aid sibling.
  void _applyPrefill(ToolPrefill? p) {
    if (p == null) return;
    if (p.topic != null) _topicController.text = p.topic!;
    if (p.gradeLevel != null && kGradeLevels.contains(p.gradeLevel)) {
      _grade = p.gradeLevel;
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
    final request = VirtualFieldTripRequest(
      topic: _topicController.text,
      gradeLevel: _grade,
      language: _language.aiName,
    );
    ref.read(virtualFieldTripControllerProvider.notifier).plan(request);
  }

  /// The footer's Done action: dismiss the itinerary back to the pristine form.
  void _done() =>
      ref.read(virtualFieldTripControllerProvider.notifier).clear();

  /// Brings the result to the top of the viewport when a fresh outcome lands.
  /// Honours reduce-motion by jumping (no scroll tween).
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
    final state = ref.watch(virtualFieldTripControllerProvider);

    // Auto-scroll to the result on a fresh outcome (loading -> data), whether
    // that is an itinerary or the calm still-generating panel.
    ref.listen<AsyncValue<FieldTripOutcome?>>(
        virtualFieldTripControllerProvider, (prev, next) {
      final wasLoading = prev?.isLoading ?? false;
      final nowHasOutcome =
          !next.isLoading && next.hasValue && next.valueOrNull != null;
      if (wasLoading && nowHasOutcome) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToResult());
      }
    });

    // Only a rendered itinerary hands its actions to the footer and hides the
    // sticky button. The idle, loading and still-generating states keep "Plan
    // the trip" available so a teacher can plan another trip or try again.
    final hasTrip = state.valueOrNull is FieldTripResult;

    final result = state.hasError
        ? VirtualFieldTripErrorView(error: state.error!, onRetry: _submit)
        : ResultView<FieldTripOutcome>(
            state: state,
            skeleton: const VirtualFieldTripSkeleton(),
            emptyMessage: l10n.virtualFieldTripEmpty,
            onData: (outcome) => switch (outcome) {
              FieldTripResult(:final trip) => VirtualFieldTripResultView(
                  trip: trip,
                  onRegenerate: _submit,
                  onDone: _done,
                ),
              FieldTripStillGenerating() => const VirtualFieldTripPendingView(),
            },
          );

    return ToolScaffold(
      title: l10n.virtualFieldTripTitle,
      isBusy: state.isLoading,
      submitLabel: l10n.virtualFieldTripAction,
      onSubmit: (state.isLoading || hasTrip) ? null : _submit,
      result: KeyedSubtree(key: _resultKey, child: result),
      child: Form(
        key: _formKey,
        autovalidateMode: AutovalidateMode.onUserInteraction,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            _topicField(l10n),
            const SizedBox(height: AppSpacing.space8),
            EditorialSectionHeader(l10n.sectionForYourClass),
            const SizedBox(height: AppSpacing.space4),
            _gradeField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _languageField(l10n),
          ],
        ),
      ),
    );
  }

  Widget _topicField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.virtualFieldTripTopicLabel,
      leadingIcon: LucideIcons.globe,
      child: TextFormField(
        controller: _topicController,
        maxLength: 1000,
        maxLines: 2,
        minLines: 1,
        textInputAction: TextInputAction.done,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(hintText: l10n.virtualFieldTripTopicHint),
        validator: (value) => (value == null || value.trim().isEmpty)
            ? l10n.virtualFieldTripTopicError
            : null,
      ),
    );
  }

  Widget _gradeField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.virtualFieldTripGradeLabel,
      optionalLabel: l10n.virtualFieldTripOptional,
      leadingIcon: LucideIcons.graduationCap,
      child: DropdownButtonFormField<String?>(
        initialValue: _grade,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.virtualFieldTripGradeAny),
          ),
          for (final grade in kGradeLevels)
            DropdownMenuItem<String?>(value: grade, child: Text(grade)),
        ],
        onChanged: (value) => setState(() => _grade = value),
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
