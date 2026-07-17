import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../core/network/api_client.dart';
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
}

@riverpod
LibraryRepository libraryRepository(Ref ref) {
  return LibraryRepository(ref.watch(apiClientProvider));
}
