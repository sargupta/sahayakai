import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../core/network/api_client.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/api_providers.dart';
import '../domain/library_item.dart';
import 'library_dtos.dart';

part 'library_repository.g.dart';

/// Reads the teacher's saved generations from `GET /api/content/list`.
///
/// UNLIKE EVERY AI ENDPOINT, this route is NOT wrapped in `withPlanCheck`
/// (verified in `src/app/api/content/list/route.ts`: it reads `x-user-id`
/// directly and meters nothing). So there is no 403 `PLAN_UPGRADE_REQUIRED` and
/// no 429 `USAGE_LIMIT_REACHED` to handle here — only 401 (no identity), 400
/// (bad query), and 500. Reading your own work is not a metered feature.
///
/// BUILT-PENDING-FIREBASE. `tokenProvider` is the P0.2 stub and returns null,
/// so no `Authorization: Bearer` header is attached, middleware injects no
/// `x-user-id`, and this 401s at runtime today. The decode, the states and the
/// tests are complete; only the token waits.
class LibraryRepository {
  const LibraryRepository(this._client);

  final ApiClient _client;

  static const String _listPath = '/api/content/list';

  /// The per-item read behind tap-to-open (`GET /api/content/get?id=<id>`),
  /// verified against `src/app/api/content/get/route.ts`. Like [_listPath] it
  /// reads `x-user-id` directly and is NOT wrapped in `withPlanCheck` — reading
  /// your own work is not a metered feature — so the only failures are 401 (no
  /// identity), 400 (missing id), 404 (not found / soft-deleted) and 500.
  ///
  /// It returns the FULL stored document: the same `BaseContent` metadata the
  /// list carries, PLUS a `data` payload typed `z.any()` server-side. See
  /// [fetchItem] for why this repository decodes only the metadata.
  static const String _getPath = '/api/content/get';

  /// The route's Zod schema is `z.coerce.number().min(1).max(20).default(20)`.
  ///
  /// TRAP (verified, and the reason this constant exists): the route's OWN
  /// swagger comment says "Number of items to return (max 50)". It is wrong.
  /// `.max(20)` does not clamp — Zod REJECTS, so `?limit=50` returns **400
  /// Invalid Query Parameters**, not 20 items. A client that trusted the
  /// documented maximum would break its own library screen. Requests are
  /// clamped to this value instead of trusting the caller.
  static const int maxLimit = 20;

  /// The newest [limit] items, already ordered `createdAt desc` server-side.
  ///
  /// Soft-deleted documents are filtered out by the route, so nothing here has
  /// to know about `deletedAt`.
  ///
  /// There is no cursor parameter: the route accepts `limit` only, so [maxLimit]
  /// is the most this build can ever show. The Library screen discloses that
  /// rather than implying a complete archive.
  Future<List<LibraryItem>> fetchRecent({int limit = 5}) {
    return _client.get<List<LibraryItem>>(
      _listPath,
      query: <String, dynamic>{'limit': limit.clamp(1, maxLimit)},
      decode: (json) {
        // The envelope is always a JSON object; anything else is a proxy or an
        // error page, and an empty list is a better answer than a cast crash.
        if (json is! Map<String, dynamic>) return const <LibraryItem>[];
        return LibraryListDto.fromJson(json).toDomain();
      },
    );
  }

  /// Opens one saved generation by id (`GET /api/content/get?id=<id>`).
  ///
  /// Decodes the item's metadata AND the `data` payload (through the same
  /// [LibraryItemDto] the list uses — [LibraryItem.data] is simply null on a
  /// list row, which never carries it). The stored `data` is `z.any()`
  /// (`SaveContentSchema`) server-side, so this repository still hands it back
  /// undecoded; `library_result_mapper.dart` (Library's own `data` layer) is
  /// where it gets reshaped into each tool's render model, verified per-type
  /// against the `sahayakai-main` flow that actually persists it. That used to
  /// be documented here as a divergence too deep to bridge (a saved `quiz`
  /// assumed single-variant, a saved `worksheet` assumed markdown) — verifying
  /// against the actual `dbAdapter.saveContent` calls found every one of the 8
  /// mapped types saves the flow's own output object verbatim, which is either
  /// identical to or a superset of what the live generate endpoint already
  /// returns, so the app's existing `*ResponseDto`s decode it correctly.
  ///
  /// The read is still Firebase-gated exactly like the list — on today's stub
  /// auth it 401s — so the detail screen is BUILT-PENDING-FIREBASE and shows
  /// the metadata the item carries plus a clear "sign in to open" state until
  /// that lands.
  ///
  /// A non-object 200 body (a proxy or an error page) is a failure to open the
  /// item, not an empty item, so it surfaces as a typed [ApiException] the
  /// detail view can report — unlike the list, where an empty list is the
  /// better answer.
  Future<LibraryItem> fetchItem(String id) {
    return _client.get<LibraryItem>(
      _getPath,
      query: <String, dynamic>{'id': id},
      decode: (json) {
        if (json is! Map<String, dynamic>) {
          throw const ApiException(
            ApiErrorKind.badResponse,
            'Unexpected response.',
          );
        }
        return LibraryItemDto.fromJson(json).toDomain();
      },
    );
  }
}

@riverpod
LibraryRepository libraryRepository(Ref ref) {
  return LibraryRepository(ref.watch(apiClientProvider));
}
