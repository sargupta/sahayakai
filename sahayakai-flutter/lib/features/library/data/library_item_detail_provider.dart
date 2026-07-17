import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../shared/data/library_repository.dart';
import '../../../shared/domain/library_item.dart';

part 'library_item_detail_provider.g.dart';

/// The per-item read behind tap-to-open, keyed by content id.
///
/// Separate from `libraryItemsProvider` (the ONE shared list read the dashboard
/// and the Library tab share) on purpose: this fetches a SINGLE document off
/// `GET /api/content/get?id=<id>`, only when a row is actually tapped, so it
/// never disturbs the list's single-request invariant.
///
/// It exposes an `AsyncValue<LibraryItem>` so `LibraryDetailScreen` gets its
/// states directly — loading -> skeleton, error -> signed-in / offline / gone /
/// retry (branched on the typed `ApiException`), data -> the opened item. On
/// today's stub auth it 401s (BUILT-PENDING-FIREBASE), which the detail screen
/// renders as the "sign in to open" state.
@riverpod
Future<LibraryItem> libraryItemDetail(Ref ref, String id) {
  return ref.watch(libraryRepositoryProvider).fetchItem(id);
}
