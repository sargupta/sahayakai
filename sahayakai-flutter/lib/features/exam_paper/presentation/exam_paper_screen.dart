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
import '../../../shared/voice/tts_speaker.dart';
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/labeled_field.dart';
import '../../../shared/widgets/result_view.dart';
import '../../../shared/widgets/tool_scaffold.dart';
import '../domain/exam_paper.dart';
import 'exam_paper_controller.dart';
import 'widgets/exam_paper_error_view.dart';
import 'widgets/exam_paper_in_progress_view.dart';
import 'widgets/exam_paper_result_view.dart';
import 'widgets/exam_paper_skeleton.dart';

/// P1.3 — the Exam Paper Generator. A capped, scrolling form + a sticky Generate
/// button ([ToolScaffold]), driven by an AsyncNotifier and rendered through
/// [ResultView] (loading / empty / error / data). The success payload can be a
/// full board paper — rendered as a plain vertical column of section/question
/// cards ([ExamPaperResultView]) — or the distinct **202** in-progress state; a
/// failed generation branches into upgrade / limit / sign-in / busy and, for
/// **422**, a "try fewer chapters" guidance (see [ExamPaperErrorView]).
class ExamPaperScreen extends ConsumerStatefulWidget {
  const ExamPaperScreen({super.key, this.prefill});

  /// Optional seed from a VIDYA NAVIGATE_AND_FILL directive ("make a Class 10
  /// Maths board paper on quadratic equations" → this form opens with the
  /// grade/subject/chapter filled). Defaults to null, so every existing call
  /// site and test opens the blank form unchanged. NOTE: the paper REQUIRES a
  /// board, and the classifier's params carry no board field, so a voice open
  /// lands on a pre-filled form and WAITS for the teacher to pick the board — it
  /// never completes "speak → result" on its own (see [_applyPrefill] /
  /// initState).
  final ToolPrefill? prefill;

  @override
  ConsumerState<ExamPaperScreen> createState() => _ExamPaperScreenState();
}

class _ExamPaperScreenState extends ConsumerState<ExamPaperScreen> {
  final _formKey = GlobalKey<FormState>();
  final _chapterController = TextEditingController();
  final _otherSubjectController = TextEditingController();

  /// Anchors the auto-scroll: the result region's top, which for a rendered
  /// paper is the DocumentSheet masthead.
  final _resultKey = GlobalKey();

  /// Sentinel dropdown value that reveals the free-text subject field. Not a
  /// real subject, so it never leaves the client — [_effectiveSubject] resolves
  /// it to whatever the teacher typed.
  static const String _otherSubjectValue = '__other__';

  String? _board;
  String? _grade;
  String? _subject;
  final List<String> _chapters = <String>[];
  ExamDifficulty _difficulty = ExamDifficulty.mixed;
  late AppLocale _language;
  bool _includeAnswerKey = true;
  bool _includeMarkingScheme = true;

  /// Part-B once-guard: the voice-path spoken summary fires at most once, when
  /// the first voice-originated result lands (VOICE_FIRST_GAP §5.6).
  bool _spokeVoiceSummary = false;

  @override
  void initState() {
    super.initState();
    _language = ref.read(localeControllerProvider);
    _applyPrefill(widget.prefill);
    // The voice path's RUN verb (VOICE_FIRST_GAP §4): a directive that arrives
    // with autoSubmit fires generation itself once every required field is
    // present. The paper's blocking required field is the board, which the
    // classifier's params never carry — so this guard holds and the form waits
    // for the teacher to pick the board rather than flashing a "choose a board"
    // error on open. Grade/subject/chapter are already seeded, so all that is
    // left is the one tap the voice path cannot do for them. (The guard is kept
    // parallel to the eight fully voice-driven tools so it "just works" the day
    // a prefill can carry a board.)
    if (widget.prefill?.autoSubmit == true && _readyToSubmit) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _submit();
      });
    }
  }

  /// Seeds the form from a VIDYA directive. Grade is applied only when it is a
  /// value this form offers; the subject slots straight in when it is a known
  /// subject, otherwise the "Other" free-text escape hatch carries it (so a
  /// Commerce/Humanities subject the fixed list omits is still honoured); the
  /// spoken topic becomes a first chapter; the language falls back to the
  /// current one when it is not one of the 11. The board is deliberately
  /// untouched — the classifier resolves no board, so the teacher picks it on
  /// the pre-filled form.
  void _applyPrefill(ToolPrefill? p) {
    if (p == null) return;
    if (p.gradeLevel != null && kGradeLevels.contains(p.gradeLevel)) {
      _grade = p.gradeLevel;
    }
    final subject = p.subject;
    if (subject != null) {
      if (kSubjects.contains(subject)) {
        _subject = subject;
      } else {
        _subject = _otherSubjectValue;
        _otherSubjectController.text = subject;
      }
    }
    final topic = p.topic?.trim();
    if (topic != null && topic.isNotEmpty) _chapters.add(topic);
    final locale = prefillLocale(p.language);
    if (locale != null) _language = locale;
  }

  /// Whether the required fields the validators guard are all present, so a
  /// programmatic [_submit] would fire the request rather than surface a
  /// validation error. Mirrors the board/grade/subject validators plus the
  /// conditional-chapters rule ([examPaperNeedsChapters]).
  bool get _readyToSubmit {
    if (_board == null || _grade == null || _effectiveSubject == null) {
      return false;
    }
    if (examPaperNeedsChapters(_board, _grade, _subject) && _chapters.isEmpty) {
      return false;
    }
    return true;
  }

  @override
  void dispose() {
    _chapterController.dispose();
    _otherSubjectController.dispose();
    super.dispose();
  }

  /// The subject the request carries: the typed value when "Other" is chosen,
  /// otherwise the selected dropdown value. Null when nothing usable is set (the
  /// validators block a submit in that case).
  String? get _effectiveSubject {
    if (_subject == _otherSubjectValue) {
      final typed = _otherSubjectController.text.trim();
      return typed.isEmpty ? null : typed;
    }
    return _subject;
  }

  void _addChapter() {
    final value = _chapterController.text.trim();
    if (value.isEmpty) return;
    // Case-insensitive de-dupe so "Triangles" and "triangles" are not both added.
    final exists =
        _chapters.any((c) => c.toLowerCase() == value.toLowerCase());
    if (!exists) {
      setState(() => _chapters.add(value));
    }
    _chapterController.clear();
  }

  void _removeChapter(String chapter) {
    setState(() => _chapters.remove(chapter));
  }

  void _submit() {
    FocusScope.of(context).unfocus();
    // Fold a chapter still sitting unsubmitted in the text field into the list,
    // so a teacher who typed one and tapped Generate does not lose it.
    if (_chapterController.text.trim().isNotEmpty) {
      _addChapter();
    }
    if (!(_formKey.currentState?.validate() ?? false)) return;

    // A fresh generation starts a fresh save state, so the previous paper's
    // "Saved" badge does not carry over onto the new result.
    ref.read(examPaperSaveControllerProvider.notifier).reset();

    final request = ExamPaperRequest(
      board: _board!,
      gradeLevel: _grade!,
      subject: _effectiveSubject!,
      chapters: List<String>.of(_chapters),
      difficulty: _difficulty,
      language: _language.aiName,
      includeAnswerKey: _includeAnswerKey,
      includeMarkingScheme: _includeMarkingScheme,
    );
    ref.read(examPaperControllerProvider.notifier).generate(request);
  }

  /// Part B — closes "speak → generate → hear". When the landed paper was
  /// voice-originated (VIDYA's RUN verb set `autoSubmit`), auto-speak a short
  /// "your … is ready" summary in the result's language, once. A manual open
  /// (tapped Generate, or a tile open with no auto-submit) never speaks. Because
  /// the paper needs a board the teacher picks by hand, this fires when they
  /// finish that pick and tap Generate — still the voice-loop close, just after
  /// the one tap voice could not do for them. The summary names the subject
  /// (the paper's natural "on X"), falling back to the spoken topic.
  void _maybeSpeakVoiceSummary(AppLocalizations l10n) {
    if (_spokeVoiceSummary || widget.prefill?.autoSubmit != true) return;
    _spokeVoiceSummary = true;
    final topic = widget.prefill?.subject?.trim().isNotEmpty == true
        ? widget.prefill!.subject!.trim()
        : widget.prefill?.topic?.trim();
    final summary = (topic == null || topic.isEmpty)
        ? l10n.voiceResultReady(l10n.examPaperTitle)
        : l10n.voiceResultReadyWithTopic(l10n.examPaperTitle, topic);
    speakResultSummary(
      ref.read(ttsSpeakerProvider),
      summary,
      language: _language.aiName,
    );
  }

  /// Brings the result masthead to the top of the viewport when a fresh paper
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
    final state = ref.watch(examPaperControllerProvider);

    // Auto-scroll to the masthead on a fresh rendered paper (loading -> Ready).
    // The 202 in-progress card and errors keep the sticky Generate button, so
    // only a Ready paper triggers the scroll.
    ref.listen<AsyncValue<ExamPaperResult?>>(examPaperControllerProvider,
        (prev, next) {
      final wasLoading = prev?.isLoading ?? false;
      final nowReady = !next.isLoading && next.valueOrNull is ExamPaperReady;
      if (wasLoading && nowReady) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToResult());
        _maybeSpeakVoiceSummary(l10n);
      }
    });

    // A rendered paper carries its own footer action bar (Save / Regenerate /
    // Copy), so the sticky Generate button steps aside for it. The 202 and
    // error states keep the sticky button so the teacher can try again.
    final hasReadyPaper = state.valueOrNull is ExamPaperReady;

    final result = state.hasError
        ? ExamPaperErrorView(error: state.error!, onRetry: _submit)
        : ResultView<ExamPaperResult>(
            state: state,
            skeleton: const ExamPaperSkeleton(),
            emptyMessage: l10n.examPaperEmpty,
            onData: (data) => switch (data) {
              ExamPaperReady() =>
                ExamPaperResultView(ready: data, onRegenerate: _submit),
              ExamPaperInProgress(:final message) =>
                ExamPaperInProgressView(message: message),
            },
          );

    return ToolScaffold(
      title: l10n.examPaperTitle,
      isBusy: state.isLoading,
      submitLabel: l10n.actionGenerate,
      onSubmit: (state.isLoading || hasReadyPaper) ? null : _submit,
      result: KeyedSubtree(key: _resultKey, child: result),
      child: Form(
        key: _formKey,
        autovalidateMode: AutovalidateMode.onUserInteraction,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            EditorialSectionHeader(l10n.examPaperSectionPaper),
            const SizedBox(height: AppSpacing.space4),
            _boardField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _gradeField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _subjectField(l10n),
            if (_subject == _otherSubjectValue) ...[
              const SizedBox(height: AppSpacing.space6),
              _otherSubjectField(l10n),
            ],
            const SizedBox(height: AppSpacing.space6),
            _chaptersField(l10n),
            const SizedBox(height: AppSpacing.space8),
            EditorialSectionHeader(l10n.examPaperSectionFormat),
            const SizedBox(height: AppSpacing.space4),
            _difficultyField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _languageField(l10n),
            const SizedBox(height: AppSpacing.space6),
            _answerKeyToggle(l10n),
            const SizedBox(height: AppSpacing.space4),
            _markingSchemeToggle(l10n),
          ],
        ),
      ),
    );
  }

  Widget _boardField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.examPaperBoardLabel,
      leadingIcon: LucideIcons.scrollText,
      child: DropdownButtonFormField<String?>(
        initialValue: _board,
        isExpanded: true,
        hint: Text(l10n.examPaperBoardHint),
        items: [
          for (final board in kEducationBoards)
            DropdownMenuItem<String?>(value: board, child: Text(board)),
        ],
        validator: (value) =>
            value == null ? l10n.examPaperBoardError : null,
        onChanged: (value) => setState(() => _board = value),
      ),
    );
  }

  Widget _gradeField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.examPaperGradeLabel,
      leadingIcon: LucideIcons.graduationCap,
      child: DropdownButtonFormField<String?>(
        initialValue: _grade,
        isExpanded: true,
        hint: Text(l10n.examPaperGradeHint),
        items: [
          for (final grade in kGradeLevels)
            DropdownMenuItem<String?>(value: grade, child: Text(grade)),
        ],
        validator: (value) =>
            value == null ? l10n.examPaperGradeError : null,
        onChanged: (value) => setState(() => _grade = value),
      ),
    );
  }

  Widget _subjectField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.examPaperSubjectLabel,
      leadingIcon: LucideIcons.bookOpen,
      child: DropdownButtonFormField<String?>(
        initialValue: _subject,
        isExpanded: true,
        hint: Text(l10n.examPaperSubjectHint),
        items: [
          for (final subject in kSubjects)
            DropdownMenuItem<String?>(value: subject, child: Text(subject)),
          // Escape hatch for Commerce/Humanities subjects the fixed list omits
          // (Economics, Business Studies, Political Science, …). Selecting it
          // reveals a free-text field so any subject can be entered.
          DropdownMenuItem<String?>(
            value: _otherSubjectValue,
            child: Text(l10n.examPaperSubjectOther),
          ),
        ],
        validator: (value) =>
            value == null ? l10n.examPaperSubjectError : null,
        onChanged: (value) => setState(() => _subject = value),
      ),
    );
  }

  /// The free-text subject field, shown only when "Other" is chosen. A real
  /// [TextFormField] so its "required" error joins the form's own validation
  /// pass; its value flows into the request through [_effectiveSubject].
  Widget _otherSubjectField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.examPaperSubjectOtherLabel,
      leadingIcon: LucideIcons.pencil,
      child: TextFormField(
        controller: _otherSubjectController,
        maxLength: 60,
        textInputAction: TextInputAction.done,
        textCapitalization: TextCapitalization.words,
        decoration: InputDecoration(hintText: l10n.examPaperSubjectOtherHint),
        validator: (value) => (value == null || value.trim().isEmpty)
            ? l10n.examPaperSubjectOtherError
            : null,
      ),
    );
  }

  /// The add-chip chapter list. It is a real [FormField] because the endpoint
  /// requires >= 1 chapter for a board/grade/subject with NO official blueprint
  /// (else it 400s); [examPaperNeedsChapters] mirrors the server rule and the
  /// validator surfaces it before the request is fired. Blueprinted combos
  /// (CBSE Class 9/10 Maths/Science) accept an empty list as "all chapters".
  Widget _chaptersField(AppLocalizations l10n) {
    return FormField<List<String>>(
      initialValue: _chapters,
      validator: (_) {
        if (examPaperNeedsChapters(_board, _grade, _subject) &&
            _chapters.isEmpty) {
          return l10n.examPaperChaptersError;
        }
        return null;
      },
      builder: (field) {
        return LabeledField(
          label: l10n.examPaperChaptersLabel,
          hint: l10n.examPaperChaptersHint,
          leadingIcon: LucideIcons.bookMarked,
          errorText: field.errorText,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: _chapterController,
                textInputAction: TextInputAction.done,
                textCapitalization: TextCapitalization.sentences,
                onChanged: (_) => field.didChange(_chapters),
                onSubmitted: (_) {
                  _addChapter();
                  field.didChange(_chapters);
                },
                decoration: InputDecoration(
                  hintText: l10n.examPaperChaptersPlaceholder,
                  suffixIcon: IconButton(
                    tooltip: l10n.examPaperChaptersAdd,
                    icon: const Icon(
                      LucideIcons.plus,
                      size: AppIconSize.inline,
                    ),
                    onPressed: () {
                      _addChapter();
                      field.didChange(_chapters);
                    },
                  ),
                ),
              ),
              if (_chapters.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.space3),
                Wrap(
                  spacing: AppSpacing.space2,
                  runSpacing: AppSpacing.space2,
                  children: [
                    for (final chapter in _chapters)
                      InputChip(
                        label: Text(chapter),
                        materialTapTargetSize: MaterialTapTargetSize.padded,
                        deleteIcon:
                            const Icon(LucideIcons.x, size: AppIconSize.inline),
                        onDeleted: () {
                          _removeChapter(chapter);
                          field.didChange(_chapters);
                        },
                      ),
                  ],
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _difficultyField(AppLocalizations l10n) {
    return LabeledField(
      label: l10n.examPaperDifficultyLabel,
      leadingIcon: LucideIcons.gauge,
      child: Wrap(
        spacing: AppSpacing.space2,
        runSpacing: AppSpacing.space2,
        children: [
          for (final difficulty in ExamDifficulty.values)
            ChoiceChip(
              label: Text(_difficultyLabel(l10n, difficulty)),
              selected: _difficulty == difficulty,
              materialTapTargetSize: MaterialTapTargetSize.padded,
              onSelected: (selected) {
                if (selected) setState(() => _difficulty = difficulty);
              },
            ),
        ],
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

  Widget _answerKeyToggle(AppLocalizations l10n) {
    return _ToggleRow(
      label: l10n.examPaperIncludeAnswerKey,
      value: _includeAnswerKey,
      onChanged: (value) => setState(() => _includeAnswerKey = value),
    );
  }

  Widget _markingSchemeToggle(AppLocalizations l10n) {
    return _ToggleRow(
      label: l10n.examPaperIncludeMarkingScheme,
      value: _includeMarkingScheme,
      onChanged: (value) => setState(() => _includeMarkingScheme = value),
    );
  }
}

/// A labelled on/off row: the label wraps ([Expanded]) so a long Indic string at
/// textScale 1.3 never shares — and overflows — a 360dp line with the switch.
class _ToggleRow extends StatelessWidget {
  const _ToggleRow({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: text.titleSmall?.copyWith(letterSpacing: 0.2, height: 1.4),
          ),
        ),
        const SizedBox(width: AppSpacing.space3),
        Switch(value: value, onChanged: onChanged),
      ],
    );
  }
}

String _difficultyLabel(AppLocalizations l10n, ExamDifficulty difficulty) =>
    switch (difficulty) {
      ExamDifficulty.easy => l10n.examPaperDifficultyEasy,
      ExamDifficulty.moderate => l10n.examPaperDifficultyModerate,
      ExamDifficulty.hard => l10n.examPaperDifficultyHard,
      ExamDifficulty.mixed => l10n.examPaperDifficultyMixed,
    };
