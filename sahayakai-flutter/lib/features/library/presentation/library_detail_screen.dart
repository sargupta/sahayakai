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
import '../../../shared/widgets/icon_well.dart';
import '../../../shared/widgets/library_item_row.dart';
import '../../../shared/widgets/offline_view.dart';
import '../data/library_item_detail_provider.dart';

/// One saved generation, opened from a Library (or dashboard Recent) row.
///
/// BUILT-PENDING-FIREBASE. The per-item read `GET /api/content/get?id=<id>` is
/// wired (see [LibraryItemDetailProvider]) but 401s on today's stub auth, so at
/// runtime this shows the item's metadata plus a "sign in to open" state. The
/// metadata header paints immediately from the [item] the row handed through
/// `extra`; the read below enriches / reports.
///
/// It deliberately does NOT re-render the saved output through its owning tool's
/// result view. The stored `data` payload is `z.any()` server-side and its
/// per-type saved shape diverges from this app's result-view models (a saved
/// quiz is single-variant, a saved worksheet is markdown), so a faithful
/// re-render would need per-type reshaping the backend does not guarantee. See
/// `LibraryRepository.fetchItem` and HANDOFF.
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
      appBar: AppBar(title: Text(appBarTitle)),
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

    return AppCard(
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
