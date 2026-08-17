import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/assessment_scanner/data/assessment_scanner_repository.dart';
import 'package:sahayakai/features/assessment_scanner/domain/assessment_scan.dart';
import 'package:sahayakai/features/assessment_scanner/presentation/assessment_scanner_controller.dart';

import '../../support/app_harness.dart';
import '../../support/fake_api_client.dart';
import 'assessment_scanner_fixtures.dart';

/// Data-layer gates: that the 200 happy path posts the multi-page DTO body and
/// decodes the scorecard, and that each error status the route can return
/// (401 / 403 / 429 / 422 / 5xx) surfaces as the typed [ApiException] the error
/// view branches on. The real [ApiClient] opens a socket, so every seam here is
/// a double — the endpoint is Firebase-gated and 401s on the stub, so the wire
/// path is exercised through the fake, not live.
void main() {
  ProviderContainer containerWith(FakeApiClient client) {
    final container = ProviderContainer(overrides: [apiClientOverride(client)]);
    addTearDown(container.dispose);
    return container;
  }

  const request = AssessmentScanRequest(
    assessmentId: 'abcdef00-1111-4222-8333-444444444444',
    pageDataUris: ['data:image/jpeg;base64,AAAA', 'data:image/png;base64,BBBB'],
    subject: 'Mathematics',
    gradeLevel: 'Class 5',
    language: 'English',
  );

  group('AssessmentScannerRepository.grade', () {
    test('a 200 decodes the scorecard and posts the multi-page body', () async {
      final client = FakeApiClient(postResponse: scanJson());
      final container = containerWith(client);

      final result = await container
          .read(assessmentScannerRepositoryProvider)
          .grade(request);

      expect(result.scorePct, 58);
      expect(result.questions, hasLength(3));
      expect(result.questions.first.marksMax, 5);

      expect(client.posts.single.path, '/api/ai/assessment-scanner');
      final body = client.posts.single.data! as Map<String, dynamic>;
      expect(body['pageUrls'], [
        'data:image/jpeg;base64,AAAA',
        'data:image/png;base64,BBBB',
      ]);
      expect(body['subject'], 'Mathematics');
      expect(body['gradeLevel'], 'Class 5');
      expect(body.containsKey('userId'), isFalse);
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
        container.read(assessmentScannerRepositoryProvider).grade(request),
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
          container.read(assessmentScannerRepositoryProvider).grade(request),
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
        // This is an image tool, so the daily image budget matters — the day cap
        // arrives as a 429 the error view maps to the "come back tomorrow" state.
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
          container.read(assessmentScannerRepositoryProvider).grade(request),
          throwsA(
            isA<ApiException>()
                .having((e) => e.kind, 'kind', ApiErrorKind.rateLimited)
                .having((e) => e.statusCode, 'statusCode', 429),
          ),
        );
      },
    );

    test('a 422 unreadable/empty-extraction surfaces as the typed 422', () async {
      // PAGE_UNREADABLE / EMPTY_EXTRACTION / SCAN_OUTPUT_MALFORMED all come back
      // as a 422 the screen reads as "re-upload clearer pages".
      final client = FakeApiClient(
        postError: const ApiException(
          ApiErrorKind.badResponse,
          'We could not read any questions from the uploaded pages.',
          statusCode: 422,
          errorCode: 'EMPTY_EXTRACTION',
        ),
      );
      final container = containerWith(client);

      await expectLater(
        container.read(assessmentScannerRepositoryProvider).grade(request),
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
        container.read(assessmentScannerRepositoryProvider).grade(request),
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

  group('AssessmentScannerController', () {
    test('grade lands a decoded scorecard as data', () async {
      final client = FakeApiClient(postResponse: scanJson());
      final container = containerWith(client);

      await container
          .read(assessmentScannerControllerProvider.notifier)
          .grade(request);

      final state = container.read(assessmentScannerControllerProvider);
      expect(state.hasError, isFalse);
      expect(state.value, isA<AssessmentResult>());
      expect(state.value!.scorePct, 58);
    });

    test('an error is reported on the controller state', () async {
      final client = FakeApiClient(
        postError: const ApiException(ApiErrorKind.network, 'offline'),
      );
      final container = containerWith(client);

      await container
          .read(assessmentScannerControllerProvider.notifier)
          .grade(request);

      expect(
        container.read(assessmentScannerControllerProvider).hasError,
        isTrue,
      );
    });

    test('clear returns to the idle state', () {
      final container = containerWith(FakeApiClient());
      container.read(assessmentScannerControllerProvider.notifier).clear();
      expect(container.read(assessmentScannerControllerProvider).value, isNull);
    });
  });
}
