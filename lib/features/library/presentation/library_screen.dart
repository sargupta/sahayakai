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
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/library_item_row.dart' show typeLabel;
import '../../../shared/widgets/map_card.dart';
import '../../../shared/widgets/map_chip.dart';
import '../../../shared/widgets/map_icon_tile.dart';
import '../../../shared/widgets/offline_view.dart';
import '../../../shared/widgets/secondary_button.dart';
import '../../vidya/presentation/widgets/inline_field_mic.dart';

/// My work: the teacher's own saved work, drawn to the UX map's Library screen
/// (App board E1). A large title, a voice-friendly search pill, leaf filter
/// chips, one card of rows (type tile, title, meta, sync state) and "Make
/// something new".
///
/// It reads the SAME `GET /api/content/list` that feeds the dashboard, through
/// the same provider. Search and the type filter are CLIENT-SIDE over the
/// newest 20 that shared read already holds: a re-query per chip would fire a
/// second request on a rural connection and break the one-shared-read
/// invariant (`AppShell` builds every tab at startup). Only types actually
/// present are offered, so no chip filters to nothing.
class LibraryScreen extends ConsumerStatefulWidget {
  const LibraryScreen({super.key});

  @override
  ConsumerState<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends ConsumerState<LibraryScreen> {
  final TextEditingController _search = TextEditingController();

  /// The selected type filter, or null for "All".
  ContentType? _filter;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final items = ref.watch(libraryItemsProvider);

    // The wash comes from AppBackground (app.dart), as on Home.
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () => ref.read(libraryItemsProvider.notifier).refresh(),
          child: ListView(
            // The map's screen padding: 18 at the sides, and room at the
            // bottom for the floating tab bar.
            padding: const EdgeInsets.fromLTRB(
              _MapGeometry.gutter,
              AppSpacing.space4,
              _MapGeometry.gutter,
              _MapGeometry.bottomClearance,
            ),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              Semantics(
                header: true,
                child: Text(
                  l10n.libraryMyWork,
                  style: Theme.of(context).textTheme.displayLarge?.copyWith(
                    fontSize: 27,
                    color: AppColors.textStrong,
                  ),
                ),
              ),
              const SizedBox(height: _MapGeometry.stackGap),
              _AskBar(controller: _search, onChanged: () => setState(() {})),
              const SizedBox(height: _MapGeometry.stackGap),
              items.when(
                // A shaped shimmer of the rows that are coming, never a bare
                // spinner (DESIGN_RUBRIC §6).
                loading: () => const _LibrarySkeleton(),
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
                        query: _search.text,
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

/// The UX map's measurements for this screen, in one place.
abstract final class _MapGeometry {
  static const double gutter = 18;
  static const double stackGap = 12; // `.stack` gap
  static const double bottomClearance = 130; // `.scr` bottom padding
  static const double cardPad = 14;
  static const double rowPad = 11; // `.list > *` vertical padding
  static const double chipGap = 7;
  static const double buttonHeight = 52; // `.btn`
}

/// The search pill: "Find your work, like “water cycle”", with the field mic
/// so a teacher can say it instead (the map's ask bar is voice-friendly).
class _AskBar extends StatelessWidget {
  const _AskBar({required this.controller, required this.onChanged});

  final TextEditingController controller;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surfaceAskBar,
        borderRadius: AppRadius.rPill,
        border: Border.all(color: AppColors.borderAskBar),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.only(start: AppSpacing.space4),
        child: Row(
          children: [
            const Icon(
              LucideIcons.search,
              size: 17,
              color: AppColors.textMuted,
            ),
            const SizedBox(width: AppSpacing.space2),
            Expanded(
              child: TextField(
                controller: controller,
                onChanged: (_) => onChanged(),
                textInputAction: TextInputAction.search,
                style: text.bodyLarge?.copyWith(color: AppColors.textStrong),
                decoration: InputDecoration(
                  hintText: l10n.librarySearchHint,
                  hintStyle: text.bodyMedium?.copyWith(
                    color: AppColors.textMuted,
                  ),
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  filled: false,
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(
                    vertical: AppSpacing.space3,
                  ),
                ),
              ),
            ),
            if (controller.text.isNotEmpty)
              IconButton(
                icon: const Icon(LucideIcons.x, size: AppIconSize.inline),
                color: AppColors.textMuted,
                tooltip: MaterialLocalizations.of(context).deleteButtonTooltip,
                onPressed: () {
                  controller.clear();
                  onChanged();
                },
              )
            else
              InlineFieldMic(
                expectedLanguage: Localizations.localeOf(context).languageCode,
                onResult: (said) {
                  controller.text = said;
                  onChanged();
                },
              ),
          ],
        ),
      ),
    );
  }
}

/// The loaded library: the filter chips (when they earn their place), one card
/// of rows, the newest-20 note and "Make something new".
class _LibraryLoaded extends ConsumerStatefulWidget {
  const _LibraryLoaded({
    required this.all,
    required this.filter,
    required this.query,
    required this.onFilter,
  });

  final List<LibraryItem> all;
  final ContentType? filter;
  final String query;
  final ValueChanged<ContentType?> onFilter;

  @override
  ConsumerState<_LibraryLoaded> createState() => _LibraryLoadedState();
}

class _LibraryLoadedState extends ConsumerState<_LibraryLoaded> {
  bool _selectionMode = false;
  final Set<String> _selected = <String>{};

  List<LibraryItem> get all => widget.all;

  /// Matches the title, subject, class or type name, ignoring case.
  bool _matches(LibraryItem item, String query) {
    if (query.isEmpty) return true;
    final l10n = context.l10n;
    final haystack = [
      item.title,
      item.subject ?? '',
      item.gradeLevel ?? '',
      typeLabel(l10n, item.type),
    ].join(' ').toLowerCase();
    return haystack.contains(query);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final query = widget.query.trim().toLowerCase();

    // The distinct types actually present, in the enum's stable order. A filter
    // bar for one type would be busywork, so it only appears at two or more.
    final present = <ContentType>[
      for (final type in ContentType.values)
        if (all.any((item) => item.type == type)) type,
    ];

    final visible = [
      for (final item in all)
        if ((widget.filter == null || item.type == widget.filter) &&
            _matches(item, query))
          item,
    ];

    // The route takes a limit and no cursor, so a full page IS the end of what
    // this build can show.
    final isCapped = all.length >= LibraryRepository.maxLimit;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (present.length >= 2) ...[
          _FilterChips(
            present: present,
            total: all.length,
            selected: widget.filter,
            onSelect: widget.onFilter,
          ),
          const SizedBox(height: AppSpacing.space1),
        ],
        if (_selectionMode) ...[
          _SelectionBar(
            count: _selected.length,
            onSelectAll: () => setState(() {
              _selected
                ..clear()
                ..addAll(visible.map((item) => item.id));
            }),
            onDelete: _selected.isEmpty ? null : _confirmDelete,
            onDone: () => setState(() {
              _selected.clear();
              _selectionMode = false;
            }),
          ),
          const SizedBox(height: _MapGeometry.stackGap),
        ],
        _MapCard(
          child: visible.isEmpty
              ? Padding(
                  padding: const EdgeInsets.symmetric(
                    vertical: _MapGeometry.rowPad,
                  ),
                  child: MapEmptyNote(
                    icon: query.isEmpty
                        ? LucideIcons.filter
                        : LucideIcons.search,
                    message: query.isEmpty
                        ? l10n.libraryFilterEmpty
                        : l10n.librarySearchEmpty,
                  ),
                )
              : Column(
                  children: [
                    for (final (index, item) in visible.indexed) ...[
                      if (index > 0)
                        const Divider(
                          height: 1,
                          thickness: 1,
                          color: AppColors.borderHairline,
                        ),
                      inkSettle(
                        context,
                        _dismissible(item, index),
                        index: index,
                      ),
                    ],
                  ],
                ),
        ),
        if (isCapped) ...[
          const SizedBox(height: _MapGeometry.stackGap),
          Text(
            l10n.libraryNewestOnly,
            style: text.bodyMedium?.copyWith(color: AppColors.textMuted),
          ),
        ],
        const SizedBox(height: _MapGeometry.stackGap),
        const _MakeNewButton(),
      ],
    );
  }

  Widget _dismissible(LibraryItem item, int index) {
    final l10n = context.l10n;
    return Dismissible(
      // Index is part of the key so a server that returns two rows with the
      // same id cannot crash the list with duplicate keys.
      key: ValueKey('lib-row-$index-${item.id}'),
      direction: _selectionMode
          ? DismissDirection.none
          : DismissDirection.endToStart,
      background: const Align(
        alignment: AlignmentDirectional.centerEnd,
        child: Icon(LucideIcons.trash2, color: AppColors.leaf700),
      ),
      onDismissed: (_) async {
        final messenger = ScaffoldMessenger.of(context);
        await ref.read(libraryItemsProvider.notifier).deleteOne(item.id);
        messenger.hideCurrentSnackBar();
        messenger.showSnackBar(
          SnackBar(
            content: Text(l10n.libraryDeleted),
            duration: const Duration(seconds: 5),
            action: SnackBarAction(
              label: l10n.libraryUndo,
              onPressed: () =>
                  ref.read(libraryItemsProvider.notifier).restoreOne(item.id),
            ),
          ),
        );
      },
      child: _WorkRow(
        item: item,
        selecting: _selectionMode,
        selected: _selected.contains(item.id),
        onTap: _selectionMode
            ? () => setState(() {
                if (!_selected.remove(item.id)) _selected.add(item.id);
              })
            : (item.id.isEmpty
                  ? null
                  : () => context.push(
                      Routes.libraryDetailPath(item.id),
                      extra: item,
                    )),
        onLongPress: _selectionMode
            ? null
            : () => setState(() {
                _selectionMode = true;
                _selected.add(item.id);
              }),
      ),
    );
  }

  Future<void> _confirmDelete() async {
    final l10n = context.l10n;
    final count = _selected.length;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.libraryDeleteTitle(count)),
        content: Text(l10n.libraryDeleteBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l10n.actionCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(l10n.libraryDelete),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await ref
        .read(libraryItemsProvider.notifier)
        .deleteMany(_selected.toList(growable: false));
    if (!mounted) return;
    setState(() {
      _selected.clear();
      _selectionMode = false;
    });
  }
}

/// The map card, padded thin so each row's ink fills it edge to edge.
class _MapCard extends StatelessWidget {
  const _MapCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => MapCard(
    padding: const EdgeInsets.symmetric(
      vertical: _MapGeometry.cardPad - _MapGeometry.rowPad,
    ),
    child: child,
  );
}

/// One saved item: the type tile, the title over its meta, and "Synced".
class _WorkRow extends StatelessWidget {
  const _WorkRow({
    required this.item,
    required this.selecting,
    required this.selected,
    this.onTap,
    this.onLongPress,
  });

  final LibraryItem item;
  final bool selecting;
  final bool selected;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    // A document with no title still belongs to the teacher and still renders.
    final title = item.title.isNotEmpty ? item.title : l10n.dashboardUntitled;
    final meta = [
      typeLabel(l10n, item.type),
      if (item.gradeLevel != null) item.gradeLevel!,
      if (item.subject != null) item.subject!,
      if (item.createdAt != null)
        // MaterialLocalizations, not `intl`: its delegates are loaded for all
        // 11 locales, so no initializeDateFormatting call is needed.
        MaterialLocalizations.of(context).formatMediumDate(item.createdAt!),
    ].join(' · ');

    return Semantics(
      button: onTap != null,
      selected: selecting ? selected : null,
      child: InkWell(
        onTap: onTap,
        onLongPress: onLongPress,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: _MapGeometry.cardPad,
            vertical: _MapGeometry.rowPad,
          ),
          child: Row(
            children: [
              if (selecting) ...[
                Icon(
                  selected ? LucideIcons.checkCircle2 : LucideIcons.circle,
                  size: 22,
                  color: selected ? AppColors.leaf500 : AppColors.textFaint,
                ),
                const SizedBox(width: AppSpacing.space2),
              ],
              _TypeTile(type: item.type),
              const SizedBox(width: AppSpacing.space3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: text.bodyLarge?.copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textStrong,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      meta,
                      style: text.bodyMedium?.copyWith(
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.space2),
              // Everything listed came from the server, so it is synced; the
              // map's amber "Waiting" belongs to offline saves, which this
              // build does not make yet.
              Text(
                l10n.librarySynced,
                style: text.labelMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.leaf500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The type's icon in its content family's tint.
class _TypeTile extends StatelessWidget {
  const _TypeTile({required this.type});

  final ContentType type;

  MapTint get _tint => switch (type) {
    ContentType.worksheet ||
    ContentType.visualAid ||
    ContentType.virtualFieldTrip => MapTint.leaf,
    ContentType.quiz ||
    ContentType.examPaper ||
    ContentType.teacherTraining => MapTint.indigo,
    ContentType.rubric ||
    ContentType.assessment ||
    ContentType.assessmentSubmission => MapTint.amber,
    ContentType.lessonPlan ||
    ContentType.microLesson ||
    ContentType.instantAnswer ||
    ContentType.unknown => MapTint.saffron,
  };

  @override
  Widget build(BuildContext context) =>
      MapIconTile(icon: type.icon, tint: _tint);
}

/// The type filter: "All N" plus one small chip per present type, wrapping
/// (never sideways-scrolling at 360dp x textScale 1.3). The selected chip is
/// leaf, as in the map.
class _FilterChips extends StatelessWidget {
  const _FilterChips({
    required this.present,
    required this.total,
    required this.selected,
    required this.onSelect,
  });

  final List<ContentType> present;
  final int total;
  final ContentType? selected;
  final ValueChanged<ContentType?> onSelect;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Wrap(
      spacing: _MapGeometry.chipGap,
      children: [
        MapChip(
          label: '${l10n.libraryFilterAll} $total',
          selected: selected == null,
          onTap: () => onSelect(null),
        ),
        for (final type in present)
          MapChip(
            label: typeLabel(l10n, type),
            selected: selected == type,
            onTap: () => onSelect(type),
          ),
      ],
    );
  }
}

/// Multi-select: how many are picked, Select all, Delete, and a way out.
class _SelectionBar extends StatelessWidget {
  const _SelectionBar({
    required this.count,
    required this.onSelectAll,
    required this.onDelete,
    required this.onDone,
  });

  final int count;
  final VoidCallback onSelectAll;
  final VoidCallback? onDelete;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return _MapCard(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.space1),
        child: Row(
          children: [
            IconButton(
              icon: const Icon(LucideIcons.x, size: AppIconSize.inline),
              tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
              onPressed: onDone,
            ),
            Expanded(
              child: Text(
                l10n.librarySelectedCount(count),
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textStrong,
                ),
              ),
            ),
            TextButton(
              onPressed: onSelectAll,
              child: Text(l10n.librarySelectAll),
            ),
            TextButton(onPressed: onDelete, child: Text(l10n.libraryDelete)),
          ],
        ),
      ),
    );
  }
}

/// The map's primary button: a 52px saffron-600 pill that opens the tools.
class _MakeNewButton extends StatelessWidget {
  const _MakeNewButton();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        borderRadius: AppRadius.rPill,
        boxShadow: [AppShadows.mapButton],
      ),
      child: Material(
        color: AppColors.accentFill,
        shape: const StadiumBorder(),
        child: InkWell(
          customBorder: const StadiumBorder(),
          // The map's Make hub (Prepare · Assess · Explore · Parents), the
          // one place every tool starts from; it replaced the Create palette.
          onTap: () => context.push(Routes.prepDesk),
          child: SizedBox(
            height: _MapGeometry.buttonHeight,
            child: Center(
              child: Text(
                context.l10n.libraryMakeNew,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textOnAccent,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Nothing saved yet: the map's card with "Nothing here yet" copy, and the way
/// out right under it.
class _LibraryEmpty extends StatelessWidget {
  const _LibraryEmpty();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _MapCard(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: _MapGeometry.rowPad),
            child: MapEmptyNote(
              icon: LucideIcons.folder,
              message: context.l10n.libraryEmpty,
            ),
          ),
        ),
        const SizedBox(height: _MapGeometry.stackGap),
        const _MakeNewButton(),
      ],
    );
  }
}

/// Why the read failed decides what to show, so it branches on the typed
/// [ApiException] kind rather than one catch-all apology.
class _LibraryError extends StatelessWidget {
  const _LibraryError({required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final kind = error is ApiException ? (error as ApiException).kind : null;

    // No identity: a retry would fail the same way, so offer the way OUT.
    if (kind == ApiErrorKind.unauthorized) {
      return _MapCard(
        child: MapEmptyNote(
          icon: LucideIcons.logIn,
          message: l10n.librarySignedOut,
          action: SecondaryButton(
            label: l10n.actionSignIn,
            icon: LucideIcons.logIn,
            onPressed: () =>
                context.push(Routes.loginWithReturnTo(Routes.library)),
          ),
        ),
      );
    }
    // Rural connectivity is intermittent: an expected failure with its own
    // copy and its own retry.
    if (kind == ApiErrorKind.network || kind == ApiErrorKind.timeout) {
      return _MapCard(child: OfflineView(onRetry: onRetry));
    }
    return _MapCard(
      child: ErrorView(message: l10n.libraryLoadFailed, onRetry: onRetry),
    );
  }
}

/// Shape-matching skeleton: the map card with three rows of tile + two bars.
class _LibrarySkeleton extends AppSkeleton {
  const _LibrarySkeleton() : super(lines: 0);

  @override
  Widget build(BuildContext context) {
    return SkeletonShimmer(
      child: _MapCard(
        child: Column(
          children: [
            for (var i = 0; i < 3; i++) ...[
              if (i > 0)
                const Divider(
                  height: 1,
                  thickness: 1,
                  color: AppColors.borderHairline,
                ),
              const Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: _MapGeometry.cardPad,
                  vertical: _MapGeometry.rowPad,
                ),
                child: Row(
                  children: [
                    SkeletonMedia(width: 36, height: 36),
                    SizedBox(width: AppSpacing.space3),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SkeletonBar(
                            height: SkeletonBar.title,
                            widthFactor: 0.7,
                          ),
                          SizedBox(height: AppSpacing.space2),
                          SkeletonBar(widthFactor: 0.45),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
