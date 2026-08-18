import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/visual_aid/data/visual_aid_repository.dart';
import 'package:sahayakai/features/visual_aid/domain/visual_aid.dart';
import 'package:sahayakai/features/visual_aid/presentation/visual_aid_controller.dart';

import '../../support/app_harness.dart';
import '../../support/fake_api_client.dart';
import 'visual_aid_fixtures.dart';

/// Data-layer gates: that the 200 happy path posts the DTO body and decodes the
/// image, and that each error status the route can return (401 / 403 / 429 / 422
/// / 5xx) surfaces as the typed [ApiException] the error view branches on. The
/// real [ApiClient] opens a socket, so an un-faked call in a unit test fires a
/// live request at production — every seam here is a double.
void main() {
  ProviderContainer containerWith(FakeApiClient client) {
    final container = ProviderContainer(overrides: [apiClientOverride(client)]);
    addTearDown(container.dispose);
    return container;
  }

  const request = VisualAidRequest(
    prompt: 'Structure of a plant cell',
    gradeLevel: 'Class 6',
    subject: 'Science',
    language: 'English',
  );

  group('VisualAidRepository.generate', () {
    test('a 200 decodes the drawing and posts the DTO body', () async {
      final client = FakeApiClient(postResponse: visualAidJson());
      final container = containerWith(client);

      final aid = await container
          .read(visualAidRepositoryProvider)
          .generate(request);

      expect(aid.hasImage, isTrue);
      expect(aid.imageBytes.sublist(0, 4), [0x89, 0x50, 0x4E, 0x47]);
      expect(aid.subject, 'Science');

      expect(client.posts.single.path, '/api/ai/visual-aid');
      final body = client.posts.single.data! as Map<String, dynamic>;
      expect(body['prompt'], 'Structure of a plant cell');
      expect(body['gradeLevel'], 'Class 6');
      expect(body['subject'], 'Science');
      expect(body['language'], 'English');
      expect(body.containsKey('userId'), isFalse);
    });

    test(
      'a 200 with no image decodes to the empty state, not an error',
      () async {
        final client = FakeApiClient(
          postResponse: visualAidJson(withImage: false),
        );
        final container = containerWith(client);

        final aid = await container
            .read(visualAidRepositoryProvider)
            .generate(request);

        expect(aid.hasImage, isFalse);
        expect(aid.imageBytes, isEmpty);
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
        container.read(visualAidRepositoryProvider).generate(request),
        throwsA(
          isA<ApiException>()
              .having((e) => e.kind, 'kind', ApiErrorKind.unauthorized)
              .having((e) => e.statusCode, 'statusCode', 401),
        ),
      );
    });

    test(
      'a 403 plan-upgrade surfaces as the typed forbidden exception',
      () async {
        final client = FakeApiClient(
          postError: const ApiException(
            ApiErrorKind.forbidden,
            'PLAN_UPGRADE_REQUIRED',
            statusCode: 403,
            errorCode: 'PLAN_UPGRADE_REQUIRED',
          ),
        );
        final container = containerWith(client);

        await expectLater(
          container.read(visualAidRepositoryProvider).generate(request),
          throwsA(
            isA<ApiException>()
                .having((e) => e.kind, 'kind', ApiErrorKind.forbidden)
                .having((e) => e.statusCode, 'statusCode', 403),
          ),
        );
      },
    );

    test(
      'a 429 daily/monthly limit surfaces as the typed rate-limit exception',
      () async {
        final client = FakeApiClient(
          postError: const ApiException(
            ApiErrorKind.rateLimited,
            'DAILY_LIMIT_REACHED',
            statusCode: 429,
            errorCode: 'DAILY_LIMIT_REACHED',
          ),
        );
        final container = containerWith(client);

        await expectLater(
          container.read(visualAidRepositoryProvider).generate(request),
          throwsA(
            isA<ApiException>()
                .having((e) => e.kind, 'kind', ApiErrorKind.rateLimited)
                .having((e) => e.statusCode, 'statusCode', 429),
          ),
        );
      },
    );

    test('a 422 empty-generation surfaces as the typed 422 exception', () async {
      // IMAGE_GENERATION_EMPTY: the model ran but produced no image. The screen
      // branches on the 422 to say "fewer labels", not a generic failure.
      final client = FakeApiClient(
        postError: const ApiException(
          ApiErrorKind.badResponse,
          'Image generation returned empty.',
          statusCode: 422,
        ),
      );
      final container = containerWith(client);

      await expectLater(
        container.read(visualAidRepositoryProvider).generate(request),
        throwsA(
          isA<ApiException>().having((e) => e.statusCode, 'statusCode', 422),
        ),
      );
    });

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
        container.read(visualAidRepositoryProvider).generate(request),
        throwsA(
          isA<ApiException>().having(
            (e) => e.kind,
            'kind',
            ApiErrorKind.server,
          ),
        ),
      );
    });
  });

  group('VisualAidController', () {
    test('generate lands a decoded drawing as data', () async {
      final client = FakeApiClient(postResponse: visualAidJson());
      final container = containerWith(client);

      await container
          .read(visualAidControllerProvider.notifier)
          .generate(request);

      final state = container.read(visualAidControllerProvider);
      expect(state.hasError, isFalse);
      expect(state.value, isA<VisualAid>());
      expect(state.value!.hasImage, isTrue);
    });

    test('an error is reported on the controller state', () async {
      final client = FakeApiClient(
        postError: const ApiException(ApiErrorKind.network, 'offline'),
      );
      final container = containerWith(client);

      await container
          .read(visualAidControllerProvider.notifier)
          .generate(request);

      final state = container.read(visualAidControllerProvider);
      expect(state.hasError, isTrue);
    });

    test('clear returns to the idle state', () {
      final container = containerWith(FakeApiClient());
      container.read(visualAidControllerProvider.notifier).clear();
      expect(container.read(visualAidControllerProvider).value, isNull);
    });
  });
}
