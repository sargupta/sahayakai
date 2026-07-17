import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/icon_well.dart';
import '../../../shared/data/library_items_provider.dart';
import '../../../shared/widgets/library_item_row.dart';
import '../../../shared/widgets/offline_view.dart';
import '../../../shared/widgets/section_label.dart';
import '../../profile/presentation/profile_controller.dart';

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
            SectionLabel(l10n.dashboardToolsTitle),
            const SizedBox(height: AppSpacing.space3),
            const _ToolList(),
            const SizedBox(height: AppSpacing.space8),
            SectionLabel(l10n.dashboardRecentTitle),
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
                Icon(LucideIcons.userCog, size: AppIconSize.inline, color: scheme.primary),
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
      _Tool(
        l10n.worksheetTitle,
        l10n.worksheetSubtitle,
        LucideIcons.fileText,
        Routes.worksheetWizard,
      ),
      _Tool(
        l10n.rubricTitle,
        l10n.rubricSubtitle,
        LucideIcons.clipboardCheck,
        Routes.rubricGenerator,
      ),
      _Tool(
        l10n.examPaperTitle,
        l10n.examPaperSubtitle,
        LucideIcons.scrollText,
        Routes.examPaper,
      ),
      _Tool(
        l10n.teacherTrainingTitle,
        l10n.teacherTrainingSubtitle,
        LucideIcons.compass,
        Routes.teacherTraining,
      ),
      _Tool(
        l10n.parentMessageTitle,
        l10n.parentMessageSubtitle,
        LucideIcons.messageCircle,
        Routes.parentMessage,
      ),
      _Tool(
        l10n.assessTitle,
        l10n.assessSubtitle,
        LucideIcons.scanLine,
        Routes.assessAssignment,
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
          IconWell(icon: tool.icon),
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
            size: AppIconSize.inline,
            color: scheme.onSurfaceVariant,
          ),
        ],
      ),
    );
  }
}

/// How many saved items the dashboard shows. Small on purpose: this is a
/// glance-and-resume surface, not the library — the Library tab shows the same
/// list in full, off the same provider and the same single request.
const int kRecentItemCount = 5;

/// The teacher's most recent saved work, with all four states.
class _RecentSection extends ConsumerWidget {
  const _RecentSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recent = ref.watch(libraryItemsProvider);

    return recent.when(
      // A shaped shimmer of the rows that are coming, never a bare spinner
      // (DESIGN_RUBRIC §6).
      loading: () => const AppSkeleton(lines: 2),
      error: (error, _) => _RecentError(
        error: error,
        onRetry: () => ref.read(libraryItemsProvider.notifier).refresh(),
      ),
      data: (all) {
        // The dashboard is a glance-and-resume surface, so it caps its own
        // display. The Library tab shows the same list in full — same provider,
        // same fetch, one request.
        final items = all.take(kRecentItemCount).toList();
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
              LibraryItemRow(
                item: item,
                // Same tap-to-open as the Library tab: a recent row opens the
                // item's detail. A document with no id cannot be fetched.
                onTap: item.id.isEmpty
                    ? null
                    : () => context.push(
                          Routes.libraryDetailPath(item.id),
                          extra: item,
                        ),
              ),
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
