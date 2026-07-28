import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/domain/library_item.dart';
import '../../../shared/widgets/app_badge.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/glass_app_bar.dart';
import '../../../shared/widgets/icon_well.dart';
import '../../../shared/widgets/library_item_row.dart';
import '../../../shared/widgets/offline_view.dart';
import '../../assess_assignment/presentation/widgets/assess_assignment_result_view.dart';
import '../../assessment_scanner/presentation/widgets/assessment_scanner_result_view.dart';
import '../../exam_paper/presentation/widgets/exam_paper_result_view.dart';
import '../../instant_answer/presentation/widgets/instant_answer_result_view.dart';
import '../../lesson_planner/presentation/widgets/lesson_plan_result_view.dart';
import '../../quiz_generator/presentation/widgets/quiz_result_view.dart';
import '../../rubric_generator/presentation/widgets/rubric_result_view.dart';
import '../../teacher_training/presentation/widgets/teacher_training_result_view.dart';
import '../../visual_aid/presentation/widgets/visual_aid_result_view.dart';
import '../../worksheet_wizard/presentation/widgets/worksheet_result_view.dart';
import '../data/library_item_detail_provider.dart';
import '../data/library_result_mapper.dart';

/// One saved generation, opened from a Library (or dashboard Recent) row.
///
/// BUILT-PENDING-FIREBASE. The per-item read `GET /api/content/get?id=<id>` is
/// wired (see [LibraryItemDetailProvider]) but 401s on today's stub auth, so at
/// runtime this shows the item's metadata plus a "sign in to open" state. The
/// metadata header paints immediately from the [item] the row handed through
/// `extra`; the read below enriches / reports.
///
/// It re-renders the saved output through its owning tool's OWN
/// `*_result_view.dart` widget wherever `library_result_mapper.dart` can
/// confidently reshape the saved `data` payload into that widget's render
/// model (verified against the `sahayakai-main` flow that actually persists
/// each content type — see that file). For anything the mapper cannot
/// confidently reshape (no saved `data`, a decode that fails, or a content
/// type with no mobile tool screen yet), this falls back to the honest
/// "Ready" state rather than guessing at a shape and rendering something
/// wrong or garbled. See `LibraryRepository.fetchItem` and HANDOFF.
class LibraryDetailScreen extends ConsumerWidget {
  const LibraryDetailScreen({super.key, required this.id, this.item});

  /// The content id (path param) — authoritative for the read.
  final String id;

  /// The list row's item, passed via `extra` for an instant header. Null on a
  /// deep link, in which case the header waits for the read.
  final LibraryItem? item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final fetched = ref.watch(libraryItemDetailProvider(id));
    // Prefer the row's item (instant); fall back to the fetched one on a deep
    // link where there was no `extra`.
    final header = item ?? fetched.valueOrNull;
    final appBarTitle = (header != null && header.title.isNotEmpty)
        ? header.title
        : l10n.libraryDetailTitle;

    return Scaffold(
      appBar: GlassAppBar(title: Text(appBarTitle)),
      body: SafeArea(
        child: ListView(
          padding: AppSpacing.pagePadding,
          children: [
            if (header != null) ...[
              _DetailHeader(item: header),
              const SizedBox(height: AppSpacing.space6),
            ],
            _DetailBody(
              state: fetched,
              type: header?.type,
              onRetry: () => ref.invalidate(libraryItemDetailProvider(id)),
            ),
          ],
        ),
      ),
    );
  }
}

/// The saved item's identity: its type well and title, then the metadata it
/// carries as neutral badges, then the date it was saved. Everything here comes
/// from the item itself, so it renders even while (or after) the read fails.
class _DetailHeader extends StatelessWidget {
  const _DetailHeader({required this.item});

  final LibraryItem item;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final title = item.title.isNotEmpty ? item.title : l10n.dashboardUntitled;

    final meta = <String>[
      if (item.gradeLevel != null) item.gradeLevel!,
      if (item.subject != null) item.subject!,
      if (item.topic != null) item.topic!,
      if (item.language != null) item.language!,
    ];

    // The saved item's masthead is the one focal card on this screen, so it
    // sits a clear step higher than the flat state cards below it (§7.2): an
    // elevated AppCard (e2, no border) with the serif titleLarge title.
    return AppCard(
      variant: AppCardVariant.elevated,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              IconWell(icon: item.type.icon),
              const SizedBox(width: AppSpacing.space4),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(title, style: text.titleLarge),
                    const SizedBox(height: AppSpacing.space2),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: AppBadge(
                        label: typeLabel(l10n, item.type),
                        tone: AppBadgeTone.accent,
                        size: AppBadgeSize.small,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (meta.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.space4),
            Wrap(
              spacing: AppSpacing.space2,
              runSpacing: AppSpacing.space2,
              children: [
                for (final value in meta)
                  AppBadge(label: value, size: AppBadgeSize.small),
              ],
            ),
          ],
          if (item.createdAt != null) ...[
            const SizedBox(height: AppSpacing.space3),
            Text(
              l10n.libraryDetailSavedOn(
                // MaterialLocalizations, not intl's DateFormat: the delegates
                // are already loaded for all 11 locales, so this cannot throw on
                // a locale whose date symbols were never initialized.
                MaterialLocalizations.of(context).formatMediumDate(item.createdAt!),
              ),
              style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
            ),
          ],
        ],
      ),
    );
  }
}

/// The per-item read's state, branched on the typed [ApiException] like every
/// other read in the app.
class _DetailBody extends StatelessWidget {
  const _DetailBody({required this.state, required this.onRetry, this.type});

  final AsyncValue<LibraryItem> state;
  final VoidCallback onRetry;
  final ContentType? type;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return state.when(
      loading: () => const AppCard(child: _DetailLoading()),
      error: (error, _) {
        final kind = error is ApiException ? error.kind : null;

        // No identity: today this is every runtime read (the token provider is
        // the P0.2 stub). A retry would be a lie, so it is not offered — this is
        // the BUILT-PENDING-FIREBASE state.
        if (kind == ApiErrorKind.unauthorized) {
          return AppCard(
            child: EmptyView(
              icon: LucideIcons.logIn,
              message: l10n.libraryDetailSignedOut,
            ),
          );
        }
        // Rural connectivity is intermittent: expected, not exceptional.
        if (kind == ApiErrorKind.network || kind == ApiErrorKind.timeout) {
          return AppCard(child: OfflineView(onRetry: onRetry));
        }
        // 404: the item was deleted (or its 30-day soft-delete TTL elapsed). A
        // retry cannot bring it back, so none is offered.
        if (kind == ApiErrorKind.notFound) {
          return AppCard(
            child: EmptyView(
              icon: LucideIcons.fileQuestion,
              message: l10n.libraryDetailNotFound,
            ),
          );
        }
        return AppCard(
          child: ErrorView(
            message: l10n.libraryDetailLoadFailed,
            onRetry: onRetry,
          ),
        );
      },
      data: (full) {
        final rendered = _savedResultView(full);
        if (rendered != null) return rendered;

        final scheme = Theme.of(context).colorScheme;
        final text = Theme.of(context).textTheme;
        // Green is the "saved / success" role (DESIGN_RUBRIC §4).
        return AppCard(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                LucideIcons.checkCircle,
                color: scheme.secondary,
                size: AppIconSize.standalone,
              ),
              const SizedBox(width: AppSpacing.space3),
              Expanded(
                child: Text(
                  l10n.libraryDetailReady(typeLabel(l10n, type ?? full.type)),
                  style: text.bodyLarge,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Reshapes [full]'s saved `data` (via `library_result_mapper.dart`) and, on
/// success, renders it through its owning tool's OWN result-view widget — the
/// same widget that tool's live generate screen uses. Null when there is
/// nothing saved to show (no `data`, a decode that failed, a structurally
/// empty result, or a content type with no mobile tool screen yet), so the
/// caller falls back to the honest "Ready" state instead of guessing.
///
/// Switches on `full.type` (the fetched document's own type), not the header
/// row's [ContentType] — `full` is the record that actually owns `data`, so
/// its type is the authoritative one for deciding how to reshape it.
///
/// Every embedded result view is handed `onRegenerate: null` (or simply
/// omitted, for the tools where it already defaults to null): there is no
/// live controller behind a saved item on this screen, so the "Regenerate"
/// action every tool's footer normally offers is correctly absent here — see
/// each widget's own doc comment for that null-omits-the-footer contract.
Widget? _savedResultView(LibraryItem full) {
  switch (full.type) {
    case ContentType.lessonPlan:
      final plan = mapSavedLessonPlan(full.data);
      return plan == null ? null : LessonPlanResultView(plan: plan);

    case ContentType.quiz:
      final quiz = mapSavedQuiz(full.data);
      return quiz == null ? null : QuizResultView(quiz: quiz);

    case ContentType.worksheet:
      final worksheet = mapSavedWorksheet(full.data);
      return worksheet == null
          ? null
          : WorksheetResultView(worksheet: worksheet);

    case ContentType.rubric:
      final rubric = mapSavedRubric(full.data);
      return rubric == null ? null : RubricResultView(rubric: rubric);

    case ContentType.instantAnswer:
      final answer = mapSavedInstantAnswer(full.data);
      return answer == null
          ? null
          : InstantAnswerResultView(
              answer: answer,
              question: full.title.isEmpty ? null : full.title,
            );

    case ContentType.teacherTraining:
      final advice = mapSavedTeacherAdvice(full.data);
      return advice == null
          ? null
          : TeacherTrainingResultView(advice: advice);

    case ContentType.examPaper:
      final ready = mapSavedExamPaper(full.data);
      return ready == null ? null : ExamPaperResultView(ready: ready);

    case ContentType.assessment:
      final assessment = mapSavedAssessment(full.data);
      return assessment == null
          ? null
          : AssessAssignmentResultView(assessment: assessment);

    case ContentType.visualAid:
      final aid = mapSavedVisualAid(full.data);
      return aid == null
          ? null
          : VisualAidResultView(
              aid: aid,
              prompt: full.title.isEmpty ? null : full.title,
              gradeLevel: full.gradeLevel,
            );

    case ContentType.assessmentSubmission:
      final result = mapSavedAssessmentScanner(full.data);
      return result == null
          ? null
          : AssessmentScannerResultView(result: result);

    // No mobile tool screen yet for these two — see library_result_mapper.dart.
    case ContentType.microLesson:
    case ContentType.virtualFieldTrip:
    case ContentType.unknown:
      return null;
  }
}

/// A shaped shimmer while the item opens — never a bare spinner (DESIGN_RUBRIC
/// §6). Sized to a couple of body lines, since the header already carries the
/// item's shape above it.
class _DetailLoading extends StatelessWidget {
  const _DetailLoading();

  @override
  Widget build(BuildContext context) {
    return const SkeletonShimmer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          SkeletonBar(height: SkeletonBar.subtitle, widthFactor: 0.5),
          SizedBox(height: AppSpacing.space3),
          SkeletonBar(),
          SizedBox(height: AppSpacing.space2),
          SkeletonBar(widthFactor: 0.8),
        ],
      ),
    );
  }
}
