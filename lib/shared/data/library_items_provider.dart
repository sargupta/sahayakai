import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
const String _kDeletedLibraryIdsKey = 'deleted_library_ids';

Future<Set<String>> _loadDeletedLibraryIds() async {
  // Soft-delete state is a local convenience: if the prefs store is
  // unavailable (tests, first-run plugin hiccup), treat it as "nothing
  // hidden" rather than failing the whole library read.
  try {
    final prefs = await SharedPreferences.getInstance();
    return (prefs.getStringList(_kDeletedLibraryIdsKey) ?? <String>[]).toSet();
  } catch (_) {
    return <String>{};
  }
}

Future<void> _storeDeletedLibraryIds(Set<String> ids) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(
      _kDeletedLibraryIdsKey,
      ids.toList(growable: false),
    );
  } catch (_) {
    // Best-effort: the in-memory hide still applies for this session.
  }
}

@riverpod
class LibraryItems extends _$LibraryItems {
  @override
  Future<List<LibraryItem>> build() async {
    final items = await ref
        .watch(libraryRepositoryProvider)
        .fetchRecent(limit: LibraryRepository.maxLimit);
    final deleted = await _loadDeletedLibraryIds();
    return items
        .where((item) => !deleted.contains(item.id))
        .toList(growable: false);
  }

  Future<void> deleteOne(String id) => deleteMany(<String>[id]);

  Future<void> deleteMany(List<String> ids) async {
    final deleted = await _loadDeletedLibraryIds();
    deleted.addAll(ids);
    await _storeDeletedLibraryIds(deleted);
    final current = state.valueOrNull ?? const <LibraryItem>[];
    state = AsyncData(
      current.where((item) => !ids.contains(item.id)).toList(growable: false),
    );
  }

  Future<void> restoreOne(String id) async {
    final deleted = await _loadDeletedLibraryIds();
    deleted.remove(id);
    await _storeDeletedLibraryIds(deleted);
    state = await AsyncValue.guard(() async {
      final fetched = await ref
          .read(libraryRepositoryProvider)
          .fetchRecent(limit: LibraryRepository.maxLimit);
      final deletedNow = await _loadDeletedLibraryIds();
      return fetched
          .where((item) => !deletedNow.contains(item.id))
          .toList(growable: false);
    });
  }

  /// Re-runs the fetch behind the error state's retry.
  Future<void> refresh() async {
    state = const AsyncValue<List<LibraryItem>>.loading();
    try {
      final fetched = await ref
          .read(libraryRepositoryProvider)
          .fetchRecent(limit: LibraryRepository.maxLimit);
      final deleted = await _loadDeletedLibraryIds();
      state = AsyncData(
        fetched
            .where((item) => !deleted.contains(item.id))
            .toList(growable: false),
      );
    } catch (error, stack) {
      state = AsyncError(error, stack);
    }
  }
}
