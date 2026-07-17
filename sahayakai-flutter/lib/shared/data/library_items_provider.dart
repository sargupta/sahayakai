import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../domain/library_item.dart';
import 'library_repository.dart';

part 'library_items_provider.g.dart';

/// The teacher's saved generations — the ONE read of `GET /api/content/list`,
/// shared by the dashboard's Recent section and the Library tab.
///
/// Both surfaces show the same server-ordered list, so they share one provider
/// rather than each owning a fetch. That matters more than it looks: `AppShell`
/// puts every tab in an `IndexedStack`, which builds all of them at startup, so
/// two controllers would mean two near-identical requests on launch — on a rural
/// connection, twice the wait for the same rows. Instead the Library tab is
/// already warm by the time it is opened, and a retry on either surface fixes
/// both.
///
/// It fetches [LibraryRepository.maxLimit] (the most the route will accept) and
/// lets the dashboard cap its own display, because the dashboard's "5" is a
/// presentation choice, not a different query.
///
/// PAGINATION IS NOT WIRED. This is the newest 20 and there is no "load more":
/// the repository takes a limit and no cursor. A teacher with more than 20 saved
/// items sees their newest 20 — which is honest, and the Library screen says so
/// rather than implying it is the complete archive.
///
/// `AsyncValue` gives both surfaces their states directly:
///   - `AsyncLoading`                 -> the skeleton,
///   - `AsyncError`                   -> offline / sign-in / retry, branched on
///                                       the typed `ApiException` kind,
///   - `AsyncData` with an empty list -> the "nothing saved yet" state,
///   - `AsyncData`                    -> the rows.
@riverpod
class LibraryItems extends _$LibraryItems {
  @override
  Future<List<LibraryItem>> build() {
    return ref
        .watch(libraryRepositoryProvider)
        .fetchRecent(limit: LibraryRepository.maxLimit);
  }

  /// Re-runs the fetch behind the error state's retry.
  Future<void> refresh() async {
    state = const AsyncValue<List<LibraryItem>>.loading();
    state = await AsyncValue.guard(
      () => ref
          .read(libraryRepositoryProvider)
          .fetchRecent(limit: LibraryRepository.maxLimit),
    );
  }
}
