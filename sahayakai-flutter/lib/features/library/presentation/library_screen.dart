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
import '../../../shared/motion/animated_entrance.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/editorial_section_header.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/glass_app_bar.dart';
import '../../../shared/widgets/library_item_row.dart';
import '../../../shared/widgets/offline_view.dart';

/// My Library — the teacher's own saved work.
///
/// It reads the SAME `GET /api/content/list` that feeds the dashboard's Recent
/// section, through the same provider — so the list needs no new endpoint, only
/// the states, the type filter and tap-to-open.
///
/// The type filter is CLIENT-SIDE, over the newest 20 the shared read already
/// holds — deliberately, not for want of a server filter (the route DOES accept
/// `?type=`, verified in `route.ts`). Re-querying per chip would fire a second
/// request and break the one-shared-read invariant the dashboard depends on
/// (`AppShell` builds every tab at startup; two controllers would mean two
/// near-identical requests on a rural connection). Filtering the loaded list
/// keeps that invariant, adds zero network, and is consistent with the newest-20
/// cap this build already discloses. Only types actually present are offered, so
/// no chip ever filters to nothing.
class LibraryScreen extends ConsumerStatefulWidget {
  const LibraryScreen({super.key});

  @override
  ConsumerState<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends ConsumerState<LibraryScreen> {
  /// The selected type filter, or null for "All".
  ContentType? _filter;

  @override
  Widget build(BuildContext context) {
    final items = ref.watch(libraryItemsProvider);

    return Scaffold(
      appBar: GlassAppBar(title: Text(context.l10n.libraryTitle)),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => ref.read(libraryItemsProvider.notifier).refresh(),
          child: ListView(
            // `pagePadding` like every other screen (16 horizontal), consistent
            // with the dashboard and the tools.
            padding: AppSpacing.pagePadding,
            // Always scrollable, so pull-to-refresh still works on the empty and
            // error states — the states a teacher most wants to retry from.
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
                data: (list) => list.isEmpty
                    ? const _LibraryEmpty()
                    : _LibraryLoaded(
                        all: list,
                        filter: _filter,
                        onFilter: (type) => setState(() => _filter = type),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The loaded library: the type-filter bar (when it earns its place), the
/// filtered rows, and the newest-20 disclosure.
class _LibraryLoaded extends StatelessWidget {
  const _LibraryLoaded({
    required this.all,
    required this.filter,
    required this.onFilter,
  });

  final List<LibraryItem> all;
  final ContentType? filter;
  final ValueChanged<ContentType?> onFilter;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    // The distinct types actually present, in the enum's stable order. A filter
    // bar for one type would be busywork, so it only appears at two or more.
    final present = <ContentType>[
      for (final type in ContentType.values)
        if (all.any((item) => item.type == type)) type,
    ];
    final showFilters = present.length >= 2;

    final visible =
        filter == null ? all : all.where((i) => i.type == filter).toList();

    // The route takes a limit and no cursor, so a full page IS the end of what
    // this build can show. This is about the whole read, not the filter.
    final isCapped = all.length >= LibraryRepository.maxLimit;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        // The editorial register: a saffron eyebrow + hairline rule over the
        // saved-work group (§5), the same grammar the dashboard's Recent section
        // opens with.
        EditorialSectionHeader(l10n.librarySectionSaved),
        const SizedBox(height: AppSpacing.space4),
        if (showFilters) ...[
          _TypeFilterBar(
            present: present,
            selected: filter,
            onSelect: onFilter,
          ),
          const SizedBox(height: AppSpacing.space4),
        ],
        // Defensive: with present-only chips this cannot happen from a tap, but
        // a refresh could drop the filtered type between builds. Offer a way
        // back rather than a blank column.
        if (visible.isEmpty)
          AppCard(
            child: EmptyView(
              icon: LucideIcons.filter,
              message: l10n.libraryFilterEmpty,
            ),
          )
        else
          for (final (index, item) in visible.indexed) ...[
            if (index > 0) const SizedBox(height: AppSpacing.space3),
            // The saved rows ink in on a staggered entrance (§4); reduce-motion
            // returns the static composed frame. These live in an eager Column,
            // so the client-side filter narrows them without a lazy re-index.
            inkSettle(
              context,
              LibraryItemRow(
                item: item,
                // A document with no id cannot be fetched, so it does not open.
                onTap: item.id.isEmpty
                    ? null
                    : () => context.push(
                          Routes.libraryDetailPath(item.id),
                          extra: item,
                        ),
              ),
              index: index,
            ),
          ],
        if (isCapped) ...[
          const SizedBox(height: AppSpacing.space4),
          Text(
            l10n.libraryNewestOnly,
            style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
          ),
        ],
      ],
    );
  }
}

/// The type filter as a wrap of pills — "All" plus one per present type. A
/// [Wrap], not a horizontal scroller, so nothing scrolls sideways at 360dp x
/// textScale 1.3 (DESIGN_RUBRIC §8).
class _TypeFilterBar extends StatelessWidget {
  const _TypeFilterBar({
    required this.present,
    required this.selected,
    required this.onSelect,
  });

  final List<ContentType> present;
  final ContentType? selected;
  final ValueChanged<ContentType?> onSelect;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Wrap(
      spacing: AppSpacing.space2,
      runSpacing: AppSpacing.space2,
      children: [
        _FilterChip(
          label: l10n.libraryFilterAll,
          selected: selected == null,
          onSelected: () => onSelect(null),
        ),
        for (final type in present)
          _FilterChip(
            label: typeLabel(l10n, type),
            icon: type.icon,
            selected: selected == type,
            onSelected: () => onSelect(type),
          ),
      ],
    );
  }
}

/// One filter pill. A [ChoiceChip] in the app's badge grammar (THEME_SPEC §5.4:
/// StadiumBorder, saffron accent when selected), sized to a ≥48dp tap target.
class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onSelected,
    this.icon,
  });

  final String label;
  final bool selected;
  final VoidCallback onSelected;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final fg = selected ? scheme.primary : scheme.onSurfaceVariant;

    return ChoiceChip(
      selected: selected,
      onSelected: (_) => onSelected(),
      showCheckmark: false,
      avatar: icon == null
          ? null
          : Icon(icon, size: AppIconSize.inline, color: fg),
      label: Text(label),
      labelStyle: text.labelMedium?.copyWith(
        color: fg,
        fontWeight: selected ? FontWeight.w600 : null,
      ),
      backgroundColor: scheme.surfaceContainerHigh,
      selectedColor: scheme.primary.withValues(alpha: 0.12),
      side: BorderSide(
        color: selected ? scheme.primary.withValues(alpha: 0.5) : scheme.outline,
      ),
      shape: const StadiumBorder(),
      // Gives the chip a 48dp minimum hit area (rural, thumb-first §2).
      materialTapTargetSize: MaterialTapTargetSize.padded,
    );
  }
}

/// Nothing saved yet — and, unlike a dead tab, a way out of it. The action opens
/// the lesson planner, a tool that exists in this build and the most likely
/// first thing a teacher saves.
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
