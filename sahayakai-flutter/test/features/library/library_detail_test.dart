import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/library/presentation/library_detail_screen.dart';
import 'package:sahayakai/shared/data/library_repository.dart';
import 'package:sahayakai/shared/domain/library_item.dart';
import 'package:sahayakai/shared/widgets/error_view.dart';
import 'package:sahayakai/shared/widgets/offline_view.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import '../dashboard/dashboard_fixtures.dart';

/// P1.7 — opening a saved item (`GET /api/content/get?id=<id>`).
///
/// The endpoint is real and now wired, but Firebase-gated exactly like the list
/// (stub auth 401s), so the screen is BUILT-PENDING-FIREBASE: it shows the item's
/// metadata plus a clear "sign in to open" state at runtime, and its data state
/// is reachable here (and once the token lands) through the fake client.

/// A 404 from the per-item read — the item was deleted or its soft-delete TTL
/// elapsed.
const ApiException _kNotFound = ApiException(
  ApiErrorKind.notFound,
  'Not found.',
  statusCode: 404,
);

/// Boots the library, then taps a row to open its detail. [client] holds the
/// list; [itemResponse] / [itemError] answer the per-item read that fires on the
/// tap.
Future<void> _openDetail(
  WidgetTester tester, {
  required FakeApiClient client,
  Object? itemResponse,
  Object? itemError,
  String rowText = 'Photosynthesis for Class 6',
  Brightness? brightness,
  double textScale = 1.0,
  Locale? locale,
  Size surface = kTallSurface,
}) async {
  await pumpDashboard(
    tester,
    client: client,
    brightness: brightness,
    textScale: textScale,
    locale: locale,
    surface: surface,
  );
  await tester.tap(find.text('Library'));
  await tester.pumpAndSettle();

  // The list has loaded; now answer the per-item GET.
  if (itemError != null) client.error = itemError;
  if (itemResponse != null) client.getResponse = itemResponse;

  final row = find.text(rowText).first;
  await tester.ensureVisible(row);
  await tester.pumpAndSettle();
  await tester.tap(row);
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('LibraryRepository.fetchItem', () {
    test('reads GET /api/content/get with the id', () async {
      final client = FakeApiClient(getResponse: contentItem());
      final item = await LibraryRepository(client).fetchItem('abc123');

      expect(client.gets.single.path, '/api/content/get');
      expect(client.gets.single.query, <String, dynamic>{'id': 'abc123'});
      expect(item.id, '3f2a1b4c-0000-4000-8000-000000000001');
      expect(item.type, ContentType.lessonPlan);
      expect(item.title, 'Photosynthesis for Class 6');
    });

    test('a 401 propagates as the typed exception the UI branches on', () {
      final client = FakeApiClient(error: kUnauthorized);
      expect(
        () => LibraryRepository(client).fetchItem('abc123'),
        throwsA(same(kUnauthorized)),
      );
    });

    test('a 404 propagates as notFound', () {
      final client = FakeApiClient(error: _kNotFound);
      expect(
        () => LibraryRepository(client).fetchItem('gone'),
        throwsA(isA<ApiException>()
            .having((e) => e.kind, 'kind', ApiErrorKind.notFound)),
      );
    });

    test('a non-object body is a typed error, not an empty item', () {
      // A proxy or an error page on a 200: for a single item this is a failure
      // to open it, unlike the list where an empty list is the better answer.
      final client = FakeApiClient(getResponse: 'not json');
      expect(
        () => LibraryRepository(client).fetchItem('abc123'),
        throwsA(isA<ApiException>()
            .having((e) => e.kind, 'kind', ApiErrorKind.badResponse)),
      );
    });
  });

  group('detail screen', () {
    testWidgets('renders the item metadata from the tapped row', (tester) async {
      await _openDetail(
        tester,
        client: libraryClient(),
        itemResponse: contentItem(),
      );

      expect(find.byType(LibraryDetailScreen), findsOneWidget);
      // The type label, and the metadata the item carries.
      expect(find.text('Lesson plan'), findsOneWidget);
      expect(find.text('Class 6'), findsOneWidget);
      expect(find.text('Science'), findsOneWidget);
      expect(find.text('Photosynthesis'), findsOneWidget);
    });

    testWidgets('a successful read confirms the opened item', (tester) async {
      await _openDetail(
        tester,
        client: libraryClient(),
        itemResponse: contentItem(),
      );

      expect(
        find.text('You are viewing your saved Lesson plan.'),
        findsOneWidget,
      );
    });

    testWidgets('no identity asks for sign-in, with no retry that cannot work',
        (tester) async {
      await _openDetail(
        tester,
        client: libraryClient(),
        itemError: kUnauthorized,
      );

      expect(find.byType(LibraryDetailScreen), findsOneWidget);
      expect(find.text('Sign in to open your saved work.'), findsOneWidget);
      expect(find.text('Try again'), findsNothing);
    });

    testWidgets('offline gets its own copy and a retry', (tester) async {
      await _openDetail(
        tester,
        client: libraryClient(),
        itemError: kOffline,
      );

      expect(find.byType(OfflineView), findsOneWidget);
      expect(find.byType(ErrorView), findsNothing);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('a retry re-reads and recovers', (tester) async {
      final client = libraryClient();
      await _openDetail(tester, client: client, itemError: kOffline);
      expect(find.byType(OfflineView), findsOneWidget);

      // The connection comes back between the failure and the retry.
      client.error = null;
      client.getResponse = contentItem();
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();

      expect(find.byType(OfflineView), findsNothing);
      expect(
        find.text('You are viewing your saved Lesson plan.'),
        findsOneWidget,
      );
    });

    testWidgets('a deleted item says so, and offers no dead retry',
        (tester) async {
      await _openDetail(
        tester,
        client: libraryClient(),
        itemError: _kNotFound,
      );

      expect(
        find.text('This item is no longer in your library.'),
        findsOneWidget,
      );
      expect(find.text('Try again'), findsNothing);
    });

    testWidgets('a server error offers a retry, with no raw exception',
        (tester) async {
      await _openDetail(
        tester,
        client: libraryClient(),
        itemError: kServerError,
      );

      expect(find.byType(ErrorView), findsOneWidget);
      expect(
        find.text('We could not open this saved item. Please try again.'),
        findsOneWidget,
      );
      expect(find.textContaining('our side'), findsNothing);
    });
  });

  group('detail overflow gates (DESIGN_RUBRIC §12.9 / §12.10 / §12.11)', () {
    for (final brightness in Brightness.values) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 in ${brightness.name}',
        (tester) async {
          await _openDetail(
            tester,
            brightness: brightness,
            textScale: 1.3,
            surface: kNarrowPhone,
            // A long compound word stresses the header title wrap.
            client: libraryClient(
              response: contentListResponse(
                items: [contentItem(overrides: {'title': kLongWord})],
              ),
            ),
            rowText: kLongWord,
            itemResponse: contentItem(overrides: {'title': kLongWord}),
          );

          expect(tester.takeException(), isNull);
          expect(find.byType(LibraryDetailScreen), findsOneWidget);
        },
      );
    }

    for (final locale in const [Locale('bn'), Locale('ta'), Locale('ml')]) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 in ${locale.languageCode}',
        (tester) async {
          await _openDetail(
            tester,
            locale: locale,
            textScale: 1.3,
            surface: kNarrowPhone,
            client: libraryClient(
              response: contentListResponse(
                items: [contentItem(overrides: {'title': kTa})],
              ),
            ),
            rowText: kTa,
            itemResponse: contentItem(overrides: {'title': kTa}),
          );

          expect(tester.takeException(), isNull);
          expect(find.byType(LibraryDetailScreen), findsOneWidget);
        },
      );
    }
  });
}
