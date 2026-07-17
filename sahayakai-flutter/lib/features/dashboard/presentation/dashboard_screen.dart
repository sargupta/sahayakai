import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/offline_view.dart';
import '../../profile/presentation/profile_controller.dart';
import '../domain/library_item.dart';
import 'recent_controller.dart';

/// P0.3 — Dashboard Home. The Home tab of the 4-tab shell (`AppShell`).
///
/// Left-aligned, and every row on it is real: the tools are the three that
/// exist in this build and each one deep-links to its live route, and the
/// recent list is the teacher's own saved work off `GET /api/content/list`.
/// Nothing here is a placeholder card holding space for a feature (DESIGN_RUBRIC
/// §11).
///
/// THE TOOL LIST IS FULL-WIDTH ROWS, NOT A 2-COLUMN GRID, deliberately. A grid
/// needs a fixed `childAspectRatio`, which is a fixed height for text — banned
/// by DESIGN_RUBRIC §7 and the first thing to clip at textScale 1.3 in
/// Malayalam. Rows carry the same `tool-icon-wrap` grammar as the web, wrap
/// instead of clipping, and read the same at 360dp and on a tablet.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.appTitle)),
      body: SafeArea(
        child: ListView(
          padding: AppSpacing.pagePadding,
          children: [
            const _Greeting(),
            const _SetupNudge(),
            const SizedBox(height: AppSpacing.space6),
            _SectionLabel(l10n.dashboardToolsTitle),
            const SizedBox(height: AppSpacing.space3),
            const _ToolList(),
            const SizedBox(height: AppSpacing.space8),
            _SectionLabel(l10n.dashboardRecentTitle),
            const SizedBox(height: AppSpacing.space3),
            const _RecentSection(),
          ],
        ),
      ),
    );
  }
}

/// "Welcome back" or "Welcome back, Lakshmi".
///
/// The name is a bonus, never a blocker: the profile read 401s on today's stub
/// auth and will fail on a rural connection tomorrow. Loading and error both
/// fall back to the unnamed greeting rather than putting a skeleton or an
/// apology at the top of the teacher's home screen. The recent section below
/// owns the honest reporting of a failed read.
class _Greeting extends ConsumerWidget {
  const _Greeting();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final name = ref.watch(
      profileControllerProvider.select(
        (profile) => profile.valueOrNull?.displayName,
      ),
    );
    final greeting = (name != null && name.trim().isNotEmpty)
        ? l10n.dashboardGreetingNamed(name.trim())
        : l10n.dashboardGreeting;

    return Text(greeting, style: text.headlineSmall);
  }
}

/// A NUDGE, NOT A GATE. Shown only once the profile has actually loaded and is
/// actually empty; it never blocks a single tool.
///
/// This is the shape the backend itself asks for. `/api/auth/profile-check`
/// carries a comment saying onboarding-completeness is "a SEPARATE check the
/// dashboard surfaces via a banner / nudge" — written after the 2026-06-08
/// incident where a hard middleware gate locked out the entire user base.
///
/// TODO: dismissal is session-scoped (it survives tab switches, because
/// `AppShell` keeps this screen alive in an IndexedStack, but not a restart).
/// Persisting it needs a shared_preferences-backed provider; the nudge stops
/// appearing for good once the profile is non-empty, which is the outcome that
/// matters.
class _SetupNudge extends ConsumerStatefulWidget {
  const _SetupNudge();

  @override
  ConsumerState<_SetupNudge> createState() => _SetupNudgeState();
}

class _SetupNudgeState extends ConsumerState<_SetupNudge> {
  bool _dismissed = false;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final profile = ref.watch(profileControllerProvider);

    // A failed or in-flight read is not evidence that the profile is empty.
    // Nudging a teacher whose profile is complete but unreadable would be the
    // gate incident in miniature.
    final isEmpty = profile.valueOrNull?.isEmpty ?? false;
    if (_dismissed || !isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.space4),
      child: AppCard(
        accentBar: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(LucideIcons.userCog, size: 20, color: scheme.primary),
                const SizedBox(width: AppSpacing.space3),
                Expanded(
                  child: Text(l10n.dashboardSetupTitle, style: text.titleMedium),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.space2),
            Text(
              l10n.dashboardSetupBody,
              style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
            ),
            const SizedBox(height: AppSpacing.space4),
            // Wrap, not Row: two buttons with Malayalam labels at textScale 1.3
            // do not share a 360dp line (DESIGN_RUBRIC §8).
            Wrap(
              spacing: AppSpacing.space2,
              runSpacing: AppSpacing.space2,
              children: [
                FilledButton(
                  onPressed: () => context.push(Routes.onboarding),
                  child: Text(l10n.dashboardSetupAction),
                ),
                TextButton(
                  onPressed: () => setState(() => _dismissed = true),
                  child: Text(l10n.dashboardSetupDismiss),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// The three tools that exist in this build, each deep-linking to its real
/// route. No dead tiles: a tool with no screen yet is not listed, because a tile
/// that does nothing is worse than an absent one.
class _ToolList extends StatelessWidget {
  const _ToolList();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tools = <_Tool>[
      _Tool(
        l10n.lessonPlanTitle,
        l10n.lessonPlanSubtitle,
        LucideIcons.bookOpen,
        Routes.lessonPlan,
      ),
      _Tool(
        l10n.quizTitle,
        l10n.quizSubtitle,
        LucideIcons.clipboardList,
        Routes.quizGenerator,
      ),
      _Tool(
        l10n.instantAnswerTitle,
        l10n.instantAnswerSubtitle,
        LucideIcons.messageSquare,
        Routes.instantAnswer,
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final (index, tool) in tools.indexed) ...[
          if (index > 0) const SizedBox(height: AppSpacing.space3),
          _ToolRow(tool: tool),
        ],
      ],
    );
  }
}

class _Tool {
  const _Tool(this.title, this.subtitle, this.icon, this.route);
  final String title;
  final String subtitle;
  final IconData icon;
  final String route;
}

class _ToolRow extends StatelessWidget {
  const _ToolRow({required this.tool});

  final _Tool tool;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return AppCard(
      // The whole card is the target, so it is far past 48dp.
      onTap: () => context.push(tool.route),
      child: Row(
        children: [
          _IconWrap(icon: tool.icon),
          const SizedBox(width: AppSpacing.space4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(tool.title, style: text.titleMedium),
                const SizedBox(height: AppSpacing.space1),
                Text(
                  tool.subtitle,
                  style: text.bodyMedium?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.space2),
          Icon(
            LucideIcons.chevronRight,
            size: 20,
            color: scheme.onSurfaceVariant,
          ),
        ],
      ),
    );
  }
}

/// The teacher's most recent saved work, with all four states.
class _RecentSection extends ConsumerWidget {
  const _RecentSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recent = ref.watch(recentItemsControllerProvider);

    return recent.when(
      // A shaped shimmer of the rows that are coming, never a bare spinner
      // (DESIGN_RUBRIC §6).
      loading: () => const AppSkeleton(lines: 2),
      error: (error, _) => _RecentError(
        error: error,
        onRetry: () =>
            ref.read(recentItemsControllerProvider.notifier).refresh(),
      ),
      data: (items) {
        if (items.isEmpty) {
          return AppCard(
            child: EmptyView(
              icon: LucideIcons.inbox,
              message: context.l10n.dashboardRecentEmpty,
            ),
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final (index, item) in items.indexed) ...[
              if (index > 0) const SizedBox(height: AppSpacing.space3),
              _RecentRow(item: item),
            ],
          ],
        );
      },
    );
  }
}

/// Why the read failed decides what to show, so it branches on the typed
/// [ApiException] kind rather than showing one catch-all apology. Mirrors
/// Profile's `_ProfileError`.
class _RecentError extends StatelessWidget {
  const _RecentError({required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final kind = error is ApiException ? (error as ApiException).kind : null;

    // No identity: today this is every runtime read, because the token provider
    // is the P0.2 stub. A retry here would be a lie, so it is not offered.
    if (kind == ApiErrorKind.unauthorized) {
      return AppCard(
        child: EmptyView(
          icon: LucideIcons.logIn,
          message: l10n.dashboardRecentSignedOut,
        ),
      );
    }
    // Rural connectivity is intermittent: an expected failure, not an
    // exceptional one, and it gets its own copy and its own retry.
    if (kind == ApiErrorKind.network || kind == ApiErrorKind.timeout) {
      return AppCard(child: OfflineView(onRetry: onRetry));
    }
    return AppCard(
      child: ErrorView(message: l10n.dashboardRecentFailed, onRetry: onRetry),
    );
  }
}

/// One saved item.
///
/// NOT TAPPABLE, on purpose. There is no screen in this build that can open a
/// saved generation — rendering one back into its tool's result view is P1.7,
/// which owns `GET /api/content/get`. Wiring this row to the tool's empty form
/// would look like "open my lesson plan" and deliver a blank page instead, which
/// is worse than no affordance at all.
class _RecentRow extends StatelessWidget {
  const _RecentRow({required this.item});

  final LibraryItem item;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    // A document with no title still belongs to the teacher and still renders.
    final title = item.title.isNotEmpty ? item.title : l10n.dashboardUntitled;

    final meta = <String>[
      typeLabel(l10n, item.type),
      if (item.gradeLevel != null) item.gradeLevel!,
      if (item.subject != null) item.subject!,
      if (item.createdAt != null)
        // MaterialLocalizations, not `intl`'s DateFormat: the delegates are
        // already loaded for all 11 locales, so this needs no
        // `initializeDateFormatting` call and cannot throw on a locale whose
        // date symbols were never initialized.
        MaterialLocalizations.of(context).formatMediumDate(item.createdAt!),
    ].join(' · ');

    return AppCard(
      child: Row(
        children: [
          _IconWrap(icon: item.type.icon),
          const SizedBox(width: AppSpacing.space4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(title, style: text.titleMedium),
                const SizedBox(height: AppSpacing.space1),
                Text(
                  meta,
                  style: text.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The web's `tool-icon-wrap`: a 48x48 rounded-12 well, `primary/10` fill,
/// `primary` glyph. Saffron as accent, never a surface flood (DESIGN_RUBRIC §4,
/// §5).
class _IconWrap extends StatelessWidget {
  const _IconWrap({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: scheme.primary.withValues(alpha: 0.1),
        borderRadius: AppRadius.rLg,
      ),
      alignment: Alignment.center,
      child: Icon(icon, size: 20, color: scheme.primary),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Text(
      label,
      style: text.titleSmall?.copyWith(
        color: scheme.onSurfaceVariant,
        letterSpacing: 0.6,
      ),
    );
  }
}

/// Exhaustive on purpose: a new [ContentType] will not compile until it has
/// copy, which is what keeps `unknown` from quietly becoming the label for a
/// type someone forgot to name.
@visibleForTesting
String typeLabel(AppLocalizations l10n, ContentType type) {
  return switch (type) {
    ContentType.lessonPlan => l10n.contentTypeLessonPlan,
    ContentType.quiz => l10n.contentTypeQuiz,
    ContentType.worksheet => l10n.contentTypeWorksheet,
    ContentType.visualAid => l10n.contentTypeVisualAid,
    ContentType.rubric => l10n.contentTypeRubric,
    ContentType.microLesson => l10n.contentTypeMicroLesson,
    ContentType.virtualFieldTrip => l10n.contentTypeVirtualFieldTrip,
    ContentType.instantAnswer => l10n.contentTypeInstantAnswer,
    ContentType.teacherTraining => l10n.contentTypeTeacherTraining,
    ContentType.examPaper => l10n.contentTypeExamPaper,
    ContentType.assessment => l10n.contentTypeAssessment,
    ContentType.unknown => l10n.contentTypeUnknown,
  };
}
