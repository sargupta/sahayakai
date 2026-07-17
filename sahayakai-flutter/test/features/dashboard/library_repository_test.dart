import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/dashboard/data/library_repository.dart';
import 'package:sahayakai/features/dashboard/domain/library_item.dart';

import '../../support/fake_api_client.dart';
import 'dashboard_fixtures.dart';

/// P0.3 — the `GET /api/content/list` contract.
///
/// Nothing here opens a socket: [FakeApiClient] stands in for the real client,
/// which really would reach production.
void main() {
  group('fetchRecent', () {
    test('calls the route the web calls', () async {
      final client = libraryClient();
      await LibraryRepository(client).fetchRecent();

      expect(client.gets, hasLength(1));
      expect(client.gets.single.path, '/api/content/list');
    });

    test('sends the requested limit', () async {
      final client = libraryClient();
      await LibraryRepository(client).fetchRecent(limit: 5);

      expect(client.gets.single.query, <String, dynamic>{'limit': 5});
    });

    test('clamps the limit to 20, because the route REJECTS more', () async {
      // THE TRAP. The route's own swagger comment says "Number of items to
      // return (max 50)", but its Zod schema is
      // `z.coerce.number().min(1).max(20).default(20)` — and `.max()` does not
      // clamp, it REJECTS. `?limit=50` returns 400 Invalid Query Parameters,
      // not 20 items. A client that trusted the documented maximum would break
      // its own library screen.
      final client = libraryClient();
      await LibraryRepository(client).fetchRecent(limit: 50);

      expect(client.gets.single.query, <String, dynamic>{'limit': 20});
      expect(LibraryRepository.maxLimit, 20);
    });

    test('clamps a nonsense limit up to the route\'s minimum of 1', () async {
      // The schema is `.min(1)`, so 0 is a 400 too.
      final client = libraryClient();
      await LibraryRepository(client).fetchRecent(limit: 0);

      expect(client.gets.single.query, <String, dynamic>{'limit': 1});
    });

    test('decodes the items', () async {
      final client = libraryClient(
        response: contentListResponse(
          items: [
            contentItem(),
            contentItem(overrides: {'type': 'quiz', 'title': 'Fractions quiz'}),
          ],
        ),
      );

      final items = await LibraryRepository(client).fetchRecent();

      expect(items, hasLength(2));
      expect(items.first.title, 'Photosynthesis for Class 6');
      expect(items.last.type, ContentType.quiz);
    });

    test('an empty library decodes to an empty list, not an error', () async {
      final client = libraryClient(response: contentListResponse(items: []));
      expect(await LibraryRepository(client).fetchRecent(), isEmpty);
    });

    test('a non-object body is an empty list, not a cast crash', () async {
      // A proxy, a captive portal or an error page: an empty list is a better
      // answer than a type error the teacher sees as a red screen.
      //
      // Constructed directly rather than through `libraryClient`, whose `??`
      // default would swallow the intentional null body.
      for (final body in <Object?>[null, 'not json', 42, <String>['a']]) {
        final client = FakeApiClient(getResponse: body);
        expect(
          await LibraryRepository(client).fetchRecent(),
          isEmpty,
          reason: 'a ${body.runtimeType} body must not throw',
        );
      }
    });

    test('a failure propagates as the typed exception the UI branches on',
        () async {
      // This route is NOT wrapped in withPlanCheck (it reads x-user-id directly
      // and meters nothing), so there is no 403 or 429 to model here — only
      // 401, 400 and 500. Reading your own work is not a metered feature.
      final client = libraryClient(error: kUnauthorized);

      expect(
        () => LibraryRepository(client).fetchRecent(),
        throwsA(same(kUnauthorized)),
      );
    });
  });
}
