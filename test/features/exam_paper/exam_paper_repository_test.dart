import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/exam_paper/data/exam_paper_repository.dart';
import 'package:sahayakai/features/exam_paper/domain/exam_paper.dart';
import 'package:sahayakai/features/exam_paper/presentation/exam_paper_controller.dart';

import '../../support/app_harness.dart';
import '../../support/fake_api_client.dart';
import 'exam_paper_fixtures.dart';

/// Data-layer gates for the highest-risk screen so far: that the 200 / **202** /
/// **422** branches each map to the right outcome, and that the PUT-to-library
/// save posts the verbatim paper and reports success/failure. Both seams are
/// doubles — the real [ApiClient] opens a socket, so an un-faked call in a unit
/// test fires a live request at production.
void main() {
  ProviderContainer containerWith(FakeApiClient client) {
    final container = ProviderContainer(overrides: [apiClientOverride(client)]);
    addTearDown(container.dispose);
    return container;
  }

  const request = ExamPaperRequest(
    board: 'CBSE',
    gradeLevel: 'Class 10',
    subject: 'Mathematics',
    chapters: <String>['Quadratic Equations'],
  );

  group('ExamPaperRepository.generate', () {
    test('a 200 returns a READY paper and posts the DTO body', () async {
      final client = FakeApiClient(postResponse: examPaperJson());
      final container = containerWith(client);

      final result = await container
          .read(examPaperRepositoryProvider)
          .generate(request);

      expect(result, isA<ExamPaperReady>());
      expect((result as ExamPaperReady).paper.board, 'CBSE');

      expect(client.posts.single.path, '/api/ai/exam-paper');
      final body = client.posts.single.data! as Map<String, dynamic>;
      expect(body['board'], 'CBSE');
      expect(body['gradeLevel'], 'Class 10');
      expect(body['subject'], 'Mathematics');
      expect(body['chapters'], ['Quadratic Equations']);
      expect(body.containsKey('userId'), isFalse);
    });

    test(
      'a 202 body returns the distinct IN-PROGRESS state, not an error',
      () async {
        final client = FakeApiClient(postResponse: examPaperInProgressJson());
        final container = containerWith(client);

        final result = await container
            .read(examPaperRepositoryProvider)
            .generate(request);

        expect(result, isA<ExamPaperInProgress>());
        expect((result as ExamPaperInProgress).message, isNotNull);
      },
    );

    test(
      'a 422 surfaces as the typed 422 exception the screen branches on',
      () async {
        final client = FakeApiClient(
          postError: const ApiException(
            ApiErrorKind.badResponse,
            'exam_paper_unstructured',
            statusCode: 422,
            errorCode: 'exam_paper_unstructured',
          ),
        );
        final container = containerWith(client);

        await expectLater(
          container.read(examPaperRepositoryProvider).generate(request),
          throwsA(
            isA<ApiException>()
                .having((e) => e.statusCode, 'statusCode', 422)
                .having(
                  (e) => e.errorCode,
                  'errorCode',
                  'exam_paper_unstructured',
                ),
          ),
        );
      },
    );
  });

  group('ExamPaperRepository.save', () {
    test('PUTs the verbatim paper and returns the new contentId', () async {
      final client = FakeApiClient(
        putResponse: <String, dynamic>{
          'success': true,
          'contentId': 'content-42',
        },
      );
      final container = containerWith(client);
      final ready = buildReady();

      final id = await container.read(examPaperRepositoryProvider).save(ready);

      expect(id, 'content-42');
      expect(client.puts.single.path, '/api/ai/exam-paper');
      expect(client.puts.single.data, {'paper': ready.raw});
    });

    test('a failed save surfaces as the typed exception', () async {
      final client = FakeApiClient(
        putError: const ApiException(ApiErrorKind.server, 'x', statusCode: 500),
      );
      final container = containerWith(client);

      await expectLater(
        container.read(examPaperRepositoryProvider).save(buildReady()),
        throwsA(isA<ApiException>()),
      );
    });
  });

  group('ExamPaperController', () {
    test('generate lands a READY paper as data', () async {
      final client = FakeApiClient(postResponse: examPaperJson());
      final container = containerWith(client);

      await container
          .read(examPaperControllerProvider.notifier)
          .generate(request);

      final state = container.read(examPaperControllerProvider);
      expect(state.value, isA<ExamPaperReady>());
      expect(state.hasError, isFalse);
    });
  });
}
