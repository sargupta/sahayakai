import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/video_storyteller/data/video_storyteller_repository.dart';
import 'package:sahayakai/features/video_storyteller/domain/video_storyteller.dart';
import 'package:sahayakai/features/video_storyteller/presentation/video_storyteller_controller.dart';

import '../../support/app_harness.dart';
import '../../support/fake_api_client.dart';
import 'video_storyteller_fixtures.dart';

/// Data-layer gates: that the 200 happy path posts the DTO body and decodes the
/// categorized videos, and that each error status the route can return (401 /
/// 429 / 400 / 5xx / network / timeout) surfaces as the typed [ApiException] the
/// error view branches on. The real [ApiClient] opens a socket, so an un-faked
/// call in a unit test fires a live request at production — every seam here is a
/// double.
void main() {
  ProviderContainer containerWith(FakeApiClient client) {
    final container = ProviderContainer(overrides: [apiClientOverride(client)]);
    addTearDown(container.dispose);
    return container;
  }

  const request = VideoStorytellerRequest(
    subject: 'Science',
    gradeLevel: 'Class 6',
    topic: 'The water cycle',
    language: 'English',
  );

  group('VideoStorytellerRepository.recommend', () {
    test('a 200 decodes the videos and posts the DTO body', () async {
      final client = FakeApiClient(postResponse: videoStorytellerJson());
      final container = containerWith(client);

      final recs = await container
          .read(videoStorytellerRepositoryProvider)
          .recommend(request);

      expect(recs.hasVideos, isTrue);
      expect(recs.sections, isNotEmpty);
      expect(recs.categorizedVideos[VideoCategory.topRecommended]!.first.id,
          'vid_top_1');

      expect(client.posts.single.path, '/api/ai/video-storyteller');
      final body = client.posts.single.data! as Map<String, dynamic>;
      expect(body['subject'], 'Science');
      expect(body['gradeLevel'], 'Class 6');
      expect(body['topic'], 'The water cycle');
      expect(body['language'], 'English');
      expect(body.containsKey('userId'), isFalse);
    });

    test('a blank browse posts an empty body', () async {
      final client = FakeApiClient(postResponse: videoStorytellerJson());
      final container = containerWith(client);

      await container
          .read(videoStorytellerRepositoryProvider)
          .recommend(const VideoStorytellerRequest());

      expect(client.posts.single.data, isEmpty);
    });

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
        container.read(videoStorytellerRepositoryProvider).recommend(request),
        throwsA(isA<ApiException>()
            .having((e) => e.kind, 'kind', ApiErrorKind.unauthorized)
            .having((e) => e.statusCode, 'statusCode', 401)),
      );
    });

    test('a 429 rate-limit surfaces as the typed rate-limit exception',
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
        container.read(videoStorytellerRepositoryProvider).recommend(request),
        throwsA(isA<ApiException>()
            .having((e) => e.kind, 'kind', ApiErrorKind.rateLimited)
            .having((e) => e.statusCode, 'statusCode', 429)),
      );
    });

    test('a 400 surfaces as the typed badResponse exception', () async {
      final client = FakeApiClient(
        postError: const ApiException(
          ApiErrorKind.badResponse,
          'Bad request.',
          statusCode: 400,
        ),
      );
      final container = containerWith(client);

      await expectLater(
        container.read(videoStorytellerRepositoryProvider).recommend(request),
        throwsA(isA<ApiException>()
            .having((e) => e.statusCode, 'statusCode', 400)),
      );
    });

    test('a 5xx surfaces as the typed server exception (INTERNAL_ERROR)',
        () async {
      // The route returns { error, code: INTERNAL_ERROR } with status 500.
      final client = FakeApiClient(
        postError: const ApiException(
          ApiErrorKind.server,
          'Something went wrong on our side.',
          statusCode: 500,
        ),
      );
      final container = containerWith(client);

      await expectLater(
        container.read(videoStorytellerRepositoryProvider).recommend(request),
        throwsA(isA<ApiException>()
            .having((e) => e.kind, 'kind', ApiErrorKind.server)),
      );
    });

    test('an offline network error surfaces as the typed network exception',
        () async {
      final client = FakeApiClient(
        postError: const ApiException(ApiErrorKind.network, 'No internet.'),
      );
      final container = containerWith(client);

      await expectLater(
        container.read(videoStorytellerRepositoryProvider).recommend(request),
        throwsA(isA<ApiException>()
            .having((e) => e.kind, 'kind', ApiErrorKind.network)),
      );
    });
  });

  group('VideoStorytellerController', () {
    test('find lands decoded recommendations as data', () async {
      final client = FakeApiClient(postResponse: videoStorytellerJson());
      final container = containerWith(client);

      await container
          .read(videoStorytellerControllerProvider.notifier)
          .find(request);

      final state = container.read(videoStorytellerControllerProvider);
      expect(state.hasError, isFalse);
      expect(state.value, isA<VideoRecommendations>());
      expect(state.value!.hasVideos, isTrue);
    });

    test('an error is reported on the controller state', () async {
      final client = FakeApiClient(
        postError: const ApiException(ApiErrorKind.network, 'offline'),
      );
      final container = containerWith(client);

      await container
          .read(videoStorytellerControllerProvider.notifier)
          .find(request);

      final state = container.read(videoStorytellerControllerProvider);
      expect(state.hasError, isTrue);
    });

    test('clear returns to the idle state', () {
      final container = containerWith(FakeApiClient());
      container.read(videoStorytellerControllerProvider.notifier).clear();
      expect(container.read(videoStorytellerControllerProvider).value, isNull);
    });
  });
}
