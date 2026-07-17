import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/data/library_items_provider.dart';
import '../../../shared/data/library_repository.dart';
import '../../../shared/domain/library_item.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/library_item_row.dart';
import '../../../shared/widgets/offline_view.dart';

/// My Library — the teacher's own saved work.
///
/// This tab used to be a permanent [EmptyView] with no action: a dead tab that
/// said "your saved work will appear here" and could never show any, which
/// DESIGN_RUBRIC §11 forbids. It reads the SAME `GET /api/content/list` that
/// already feeds the dashboard's Recent section, through the same provider — so
/// wiring it needed no new endpoint, only the states.
///
/// Rows are not tappable; see [LibraryItemRow] for why.
class LibraryScreen extends ConsumerWidget {
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(libraryItemsProvider);

    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.libraryTitle)),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => ref.read(libraryItemsProvider.notifier).refresh(),
          child: ListView(
            // `pagePadding` like every other screen. This was the only one at
            // 24dp, because its EmptyView used to supply the inset itself.
            padding: AppSpacing.pagePadding,
            // Always scrollable, so pull-to-refresh still works on the empty
            // and error states — the states a teacher most wants to retry from.
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              items.when(
                // A shaped shimmer of the rows that are coming, never a bare
                // spinner (DESIGN_RUBRIC §6).
                loading: () => const AppSkeleton(lines: 3),
                error: (error, _) => _LibraryError(
                  error: error,
                  onRetry: () =>
                      ref.read(libraryItemsProvider.notifier).refresh(),
                ),
                data: (list) =>
                    list.isEmpty ? const _LibraryEmpty() : _LibraryList(items: list),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LibraryList extends StatelessWidget {
  const _LibraryList({required this.items});

  final List<LibraryItem> items;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    // The route takes a limit and no cursor, so a full page IS the end of what
    // this build can show. Saying so is better than letting a teacher with 40
    // saved items believe 20 is all they have.
    final isCapped = items.length >= LibraryRepository.maxLimit;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final (index, item) in items.indexed) ...[
          if (index > 0) const SizedBox(height: AppSpacing.space3),
          LibraryItemRow(item: item),
        ],
        if (isCapped) ...[
          const SizedBox(height: AppSpacing.space4),
          Text(
            context.l10n.libraryNewestOnly,
            style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
          ),
        ],
      ],
    );
  }
}

/// Nothing saved yet — and, unlike before, a way out of it. The action opens
/// the lesson planner, which is a tool that exists in this build and is the
/// most likely first thing a teacher saves.
class _LibraryEmpty extends StatelessWidget {
  const _LibraryEmpty();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AppCard(
      child: EmptyView(
        icon: LucideIcons.library,
        message: l10n.libraryEmpty,
        action: FilledButton.icon(
          onPressed: () => context.push(Routes.lessonPlan),
          icon: const Icon(LucideIcons.bookOpen, size: AppIconSize.inline),
          label: Text(l10n.libraryEmptyAction),
        ),
      ),
    );
  }
}

/// Why the read failed decides what to show, so it branches on the typed
/// [ApiException] kind rather than showing one catch-all apology. Mirrors the
/// dashboard's `_RecentError` and the tools' own error views.
class _LibraryError extends StatelessWidget {
  const _LibraryError({required this.error, required this.onRetry});

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
          message: l10n.librarySignedOut,
        ),
      );
    }
    // Rural connectivity is intermittent: an expected failure, not an
    // exceptional one, and it gets its own copy and its own retry.
    if (kind == ApiErrorKind.network || kind == ApiErrorKind.timeout) {
      return AppCard(child: OfflineView(onRetry: onRetry));
    }
    return AppCard(
      child: ErrorView(message: l10n.libraryLoadFailed, onRetry: onRetry),
    );
  }
}
