import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/virtual_field_trip/data/virtual_field_trip_repository.dart';
import 'package:sahayakai/features/virtual_field_trip/domain/virtual_field_trip.dart';
import 'package:sahayakai/features/virtual_field_trip/presentation/virtual_field_trip_controller.dart';

import '../../support/app_harness.dart';
import '../../support/fake_api_client.dart';
import 'virtual_field_trip_fixtures.dart';

/// Data-layer gates: that the 200 happy path posts the DTO body and decodes the
/// itinerary; that the benign 202 `still_generating` surfaces as the DISTINCT
/// [FieldTripStillGenerating] outcome (NOT an error, because it rides the
/// success path — the client's `validateStatus` accepts < 400); and that each
/// real error status (401 / 403 / 429 / 5xx / network / timeout) surfaces as the
/// typed [ApiException] the error view branches on. The real [ApiClient] opens a
/// socket, so every seam here is a double.
void main() {
  ProviderContainer containerWith(FakeApiClient client) {
    final container = ProviderContainer(overrides: [apiClientOverride(client)]);
    addTearDown(container.dispose);
    return container;
  }

  const request = VirtualFieldTripRequest(
    topic: 'The Amazon River',
    gradeLevel: 'Class 7',
    language: 'English',
  );

  group('VirtualFieldTripRepository.plan', () {
    test('a 200 decodes the itinerary and posts the DTO body', () async {
      final client = FakeApiClient(postResponse: virtualFieldTripJson());
      final container = containerWith(client);

      final outcome = await container
          .read(virtualFieldTripRepositoryProvider)
          .plan(request);

      expect(outcome, isA<FieldTripResult>());
      final trip = (outcome as FieldTripResult).trip;
      expect(trip.hasStops, isTrue);
      expect(trip.stops, hasLength(3));
      expect(trip.stops.first.name, startsWith('The Amazon River Basin'));

      expect(client.posts.single.path, '/api/ai/virtual-field-trip');
      final body = client.posts.single.data! as Map<String, dynamic>;
      expect(body['topic'], 'The Amazon River');
      expect(body['gradeLevel'], 'Class 7');
      expect(body['language'], 'English');
      expect(body.containsKey('userId'), isFalse);
    });

    test(
      'a 202 still_generating surfaces as the distinct outcome, not an error',
      () async {
        // The 202 rides the success path (status < 400), so it reaches `decode` like
        // a 200 — the repository must route it to FieldTripStillGenerating by shape.
        final client = FakeApiClient(postResponse: stillGeneratingJson());
        final container = containerWith(client);

        final outcome = await container
            .read(virtualFieldTripRepositoryProvider)
            .plan(request);

        expect(outcome, isA<FieldTripStillGenerating>());
        expect(
          (outcome as FieldTripStillGenerating).message,
          contains('still generating'),
        );
      },
    );

    test('a 401 surfaces as the typed unauthorized exception', () async {
      final client = FakeApiClient(
        postError: const ApiException(
          ApiErrorKind.unauthorized,
          'Please sign in again.',
          statusCode: 401,
        ),
      );
      final container = containerWith(client);

      await expectLater(
        container.read(virtualFieldTripRepositoryProvider).plan(request),
        throwsA(
          isA<ApiException>()
              .having((e) => e.kind, 'kind', ApiErrorKind.unauthorized)
              .having((e) => e.statusCode, 'statusCode', 401),
        ),
      );
    });

    test('a 403 plan gate surfaces as the typed forbidden exception', () async {
      final client = FakeApiClient(
        postError: const ApiException(
          ApiErrorKind.forbidden,
          'This feature requires a higher plan.',
          statusCode: 403,
          errorCode: 'PLAN_UPGRADE_REQUIRED',
        ),
      );
      final container = containerWith(client);

      await expectLater(
        container.read(virtualFieldTripRepositoryProvider).plan(request),
        throwsA(
          isA<ApiException>()
              .having((e) => e.kind, 'kind', ApiErrorKind.forbidden)
              .having((e) => e.statusCode, 'statusCode', 403),
        ),
      );
    });

    test(
      'a 429 rate-limit surfaces as the typed rate-limit exception',
      () async {
        final client = FakeApiClient(
          postError: const ApiException(
            ApiErrorKind.rateLimited,
            'Too many requests.',
            statusCode: 429,
          ),
        );
        final container = containerWith(client);

        await expectLater(
          container.read(virtualFieldTripRepositoryProvider).plan(request),
          throwsA(
            isA<ApiException>()
                .having((e) => e.kind, 'kind', ApiErrorKind.rateLimited)
                .having((e) => e.statusCode, 'statusCode', 429),
          ),
        );
      },
    );

    test('a 5xx surfaces as the typed server exception', () async {
      final client = FakeApiClient(
        postError: const ApiException(
          ApiErrorKind.server,
          'Something went wrong on our side.',
          statusCode: 500,
        ),
      );
      final container = containerWith(client);

      await expectLater(
        container.read(virtualFieldTripRepositoryProvider).plan(request),
        throwsA(
          isA<ApiException>().having(
            (e) => e.kind,
            'kind',
            ApiErrorKind.server,
          ),
        ),
      );
    });

    test(
      'an offline network error surfaces as the typed network exception',
      () async {
        final client = FakeApiClient(
          postError: const ApiException(ApiErrorKind.network, 'No internet.'),
        );
        final container = containerWith(client);

        await expectLater(
          container.read(virtualFieldTripRepositoryProvider).plan(request),
          throwsA(
            isA<ApiException>().having(
              (e) => e.kind,
              'kind',
              ApiErrorKind.network,
            ),
          ),
        );
      },
    );

    test('a timeout surfaces as the typed timeout exception', () async {
      final client = FakeApiClient(
        postError: const ApiException(ApiErrorKind.timeout, 'Too slow.'),
      );
      final container = containerWith(client);

      await expectLater(
        container.read(virtualFieldTripRepositoryProvider).plan(request),
        throwsA(
          isA<ApiException>().having(
            (e) => e.kind,
            'kind',
            ApiErrorKind.timeout,
          ),
        ),
      );
    });
  });

  group('VirtualFieldTripController', () {
    test('plan lands a decoded itinerary as data', () async {
      final client = FakeApiClient(postResponse: virtualFieldTripJson());
      final container = containerWith(client);

      await container
          .read(virtualFieldTripControllerProvider.notifier)
          .plan(request);

      final state = container.read(virtualFieldTripControllerProvider);
      expect(state.hasError, isFalse);
      expect(state.value, isA<FieldTripResult>());
    });

    test('plan lands the still-generating 202 as data, NOT an error', () async {
      final client = FakeApiClient(postResponse: stillGeneratingJson());
      final container = containerWith(client);

      await container
          .read(virtualFieldTripControllerProvider.notifier)
          .plan(request);

      final state = container.read(virtualFieldTripControllerProvider);
      expect(state.hasError, isFalse);
      expect(state.value, isA<FieldTripStillGenerating>());
    });

    test('an error is reported on the controller state', () async {
      final client = FakeApiClient(
        postError: const ApiException(ApiErrorKind.network, 'offline'),
      );
      final container = containerWith(client);

      await container
          .read(virtualFieldTripControllerProvider.notifier)
          .plan(request);

      final state = container.read(virtualFieldTripControllerProvider);
      expect(state.hasError, isTrue);
    });

    test('clear returns to the idle state', () {
      final container = containerWith(FakeApiClient());
      container.read(virtualFieldTripControllerProvider.notifier).clear();
      expect(container.read(virtualFieldTripControllerProvider).value, isNull);
    });
  });
}
