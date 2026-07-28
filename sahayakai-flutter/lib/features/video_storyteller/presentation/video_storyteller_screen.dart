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
import '../domain/video_storyteller.dart';
import 'video_storyteller_controller.dart';
import 'widgets/video_storyteller_error_view.dart';
import 'widgets/video_storyteller_result_view.dart';
import 'widgets/video_storyteller_skeleton.dart';

/// U-PD3 — Video Storyteller. A teacher picks a subject / class / topic and gets
/// curated educational YouTube videos, grouped into sections — a BROWSE result,
/// not a generated document. A capped, scrolling form + a sticky Find button
/// ([ToolScaffold]), driven by an AsyncNotifier and rendered through
/// [ResultView] (loading / empty / error / data).
///
/// Every input is optional: the endpoint back-fills subject/grade/language from
/// the teacher's profile, so even a blank browse returns curated content. The
/// Find button stays available after a result (unlike the one-shot document
/// tools) so a teacher can adjust the topic and search again.
class VideoStorytellerScreen extends ConsumerStatefulWidget {
  const VideoStorytellerScreen({super.key, this.prefill});

  /// Optional seed from a VIDYA NAVIGATE_AND_FILL directive — the spoken topic
  /// becomes the topic field. Defaults to null, so existing call sites and tests
  /// open the blank form unchanged.
  final ToolPrefill? prefill;

  @override
  ConsumerState<VideoStorytellerScreen> createState() =>
      _VideoStorytellerScreenState();
}

class _VideoStorytellerScreenState
    extends ConsumerState<VideoStorytellerScreen> {
  final _topicController = TextEditingController();

  /// Anchors the auto-scroll: the result region's top.
  final _resultKey = GlobalKey();

  String? _grade;
  String? _subject;
  late AppLocale _language;

  @override
  void initState() {
    super.initState();
    _language = ref.read(localeControllerProvider);
    _applyPrefill(widget.prefill);
    // The voice path's RUN verb (VOICE_FIRST_GAP §4): find the videos itself when
    // a voice directive named a topic — "speak → videos", no tap. This tool's
    // _submit tolerates an empty topic (subject/grade alone still search), but we
    // deliberately gate on the primary input so a fieldless utterance lands on the
    // form and waits rather than auto-firing a topic-less search the teacher
    // didn't intend. Post-frame so the widget is mounted before _submit runs.
    if (widget.prefill?.autoSubmit == true &&
        _topicController.text.trim().isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _submit();
      });
    }
  }

  /// Seeds the form from a VIDYA directive. The spoken topic becomes the topic
  /// field; grade/subject apply only when they are one of the picker options;
  /// the language falls back to the current one when it is not one of the 11.
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
  }

  @override
  void dispose() {
    _topicController.dispose();
    super.dispose();
  }

  void _submit() {
    FocusScope.of(context).unfocus();
    final topic = _topicController.text.trim();
    final request = VideoStorytellerRequest(
      subject: _subject,
      gradeLevel: _grade,
      topic: topic.isEmpty ? null : topic,
      language: _language.aiName,
    );
    ref.read(videoStorytellerControllerProvider.notifier).find(request);
  }

  /// Brings the result to the top of the viewport when fresh videos land.
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
    final state = ref.watch(videoStorytellerControllerProvider);

    // Auto-scroll to the result on a fresh success (loading -> data).
    ref.listen<AsyncValue<VideoRecommendations?>>(
        videoStorytellerControllerProvider, (prev, next) {
      final wasLoading = prev?.isLoading ?? false;
      final nowHasResult =
          !next.isLoading && next.hasValue && next.valueOrNull != null;
      if (wasLoading && nowHasResult) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToResult());
      }
    });

    final result = state.hasError
        ? VideoStorytellerErrorView(error: state.error!, onRetry: _submit)
        : ResultView<VideoRecommendations>(
            state: state,
            skeleton: const VideoStorytellerSkeleton(),
            emptyMessage: l10n.videoStorytellerEmpty,
            onData: (recommendations) => VideoStorytellerResultView(
              recommendations: recommendations,
            ),
          );

    return ToolScaffold(
      title: l10n.videoStorytellerTitle,
      isBusy: state.isLoading,
      submitLabel: l10n.videoStorytellerAction,
      // A browse re-searches, so the Find button stays available after a result
      // (only a live request suppresses it) — the teacher tweaks the topic and
      // searches again in place.
      onSubmit: state.isLoading ? null : _submit,
      result: KeyedSubtree(key: _resultKey, child: result),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          _topicField(l10n),
          const SizedBox(height: AppSpacing.space8),
          EditorialSectionHeader(l10n.sectionForYourClass),
          const SizedBox(height: AppSpacing.space4),
          _subjectField(l10n),
          const SizedBox(height: AppSpacing.space6),
          _gradeField(l10n),
          const SizedBox(height: AppSpacing.space6),
          _languageField(l10n),
        ],
      ),
    );
  }

  Widget _topicField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.videoStorytellerTopicLabel,
      optionalLabel: l10n.videoStorytellerOptional,
      leadingIcon: LucideIcons.search,
      trailing: InlineFieldMic(
        expectedLanguage: _language.code,
        onResult: (text) => _topicController.text = text,
      ),
      child: TextFormField(
        controller: _topicController,
        textInputAction: TextInputAction.search,
        textCapitalization: TextCapitalization.sentences,
        decoration: InputDecoration(hintText: l10n.videoStorytellerTopicHint),
        onFieldSubmitted: (_) => _submit(),
      ),
    );
  }

  Widget _subjectField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.videoStorytellerSubjectLabel,
      optionalLabel: l10n.videoStorytellerOptional,
      leadingIcon: LucideIcons.bookOpen,
      child: DropdownButtonFormField<String?>(
        initialValue: _subject,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.videoStorytellerSubjectAny),
          ),
          for (final subject in kSubjects)
            DropdownMenuItem<String?>(value: subject, child: Text(subject)),
        ],
        onChanged: (value) => setState(() => _subject = value),
      ),
    );
  }

  Widget _gradeField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.videoStorytellerGradeLabel,
      optionalLabel: l10n.videoStorytellerOptional,
      leadingIcon: LucideIcons.graduationCap,
      child: DropdownButtonFormField<String?>(
        initialValue: _grade,
        isExpanded: true,
        items: [
          DropdownMenuItem<String?>(
            value: null,
            child: Text(l10n.videoStorytellerGradeAny),
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
