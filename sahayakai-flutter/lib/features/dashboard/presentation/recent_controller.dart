import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/library_repository.dart';
import '../domain/library_item.dart';

part 'recent_controller.g.dart';

/// How many saved items the dashboard shows. Small on purpose: this is a
/// glance-and-resume surface, not the library (P1.7 owns the full list). Well
/// under the route's max of 20, so the clamp never engages here.
const int kRecentItemCount = 5;

/// Reads the teacher's most recent saved generations for the dashboard.
///
/// `AsyncValue` gives the section its states directly:
///   - `AsyncLoading`               -> the skeleton,
///   - `AsyncError`                 -> offline / sign-in / retry, branched on
///                                     the typed `ApiException` kind,
///   - `AsyncData` with an empty list -> the "nothing saved yet" state,
///   - `AsyncData`                  -> the rows.
@riverpod
class RecentItemsController extends _$RecentItemsController {
  @override
  Future<List<LibraryItem>> build() {
    return ref
        .watch(libraryRepositoryProvider)
        .fetchRecent(limit: kRecentItemCount);
  }

  /// Re-runs the fetch behind the error state's retry.
  Future<void> refresh() async {
    state = const AsyncValue<List<LibraryItem>>.loading();
    state = await AsyncValue.guard(
      () => ref
          .read(libraryRepositoryProvider)
          .fetchRecent(limit: kRecentItemCount),
    );
  }
}
