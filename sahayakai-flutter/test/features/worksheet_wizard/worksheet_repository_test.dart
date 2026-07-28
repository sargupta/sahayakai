import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/worksheet_wizard/data/worksheet_repository.dart';
import 'package:sahayakai/features/worksheet_wizard/domain/worksheet.dart';
import 'package:sahayakai/features/worksheet_wizard/presentation/worksheet_controller.dart';

import '../../support/app_harness.dart';
import '../../support/fake_api_client.dart';

/// Data-layer gates for the worksheet Save-to-Library action added in Unit 14:
/// the client must POST the exact `content/save` shape the backend
/// `dbAdapter.saveContent` call persists, and report success / failure through
/// the save controller. The `ApiClient` is a double — an un-faked call in a
/// unit test fires a live request at production.
void main() {
  ProviderContainer containerWith(FakeApiClient client) {
    final container = ProviderContainer(overrides: [apiClientOverride(client)]);
    addTearDown(container.dispose);
    return container;
  }

  // A generated worksheet carrying its verbatim server body in `raw`.
  const worksheet = Worksheet(
    title: 'Counting mangoes',
    gradeLevel: 'Class 2',
    subject: 'Mathematics',
    raw: <String, dynamic>{
      'title': 'Counting mangoes',
      'gradeLevel': 'Class 2',
      'subject': 'Mathematics',
      'learningObjectives': <String>['Count up to 20'],
      'activities': <Map<String, dynamic>>[
        {'type': 'question', 'content': '5 + 3 = ?', 'explanation': 'Adds.'},
      ],
      'answerKey': <Map<String, dynamic>>[
        {'activityIndex': 0, 'answer': '8'},
      ],
      'worksheetContent': '# Counting mangoes',
    },
  );

  group('WorksheetRepository.save', () {
    test('POSTs the worksheet shape to /api/content/save and returns the id',
        () async {
      final client = FakeApiClient(
        postResponse: <String, dynamic>{'success': true, 'id': 'ws-1'},
      );
      final container = containerWith(client);

      final id = await container.read(worksheetRepositoryProvider).save(
            worksheet: worksheet,
            prompt: 'Addition of two-digit numbers with regrouping',
            gradeLevel: 'Class 3',
            language: 'Bengali',
          );

      expect(id, 'ws-1');
      expect(client.posts.single.path, '/api/content/save');

      final body = client.posts.single.data! as Map<String, dynamic>;
      expect(body['type'], 'worksheet');
      // Title is derived from the prompt and clipped to 30 chars; topic is the
      // full prompt — matching the backend flow's dbAdapter.saveContent call.
      final title = body['title'] as String;
      expect(title, startsWith('Worksheet: '));
      expect(title.length - 'Worksheet: '.length, lessThanOrEqualTo(30));
      expect(body['topic'], 'Addition of two-digit numbers with regrouping');
      // The model's own grade/subject win over the request.
      expect(body['gradeLevel'], 'Class 2');
      expect(body['subject'], 'Mathematics');
      expect(body['language'], 'Bengali');
      expect(body['isPublic'], false);
      expect(body['isDraft'], false);
      // The saved data is the verbatim model output the Library reads back.
      expect(body['data'], worksheet.raw);
      // A valid v4 UUID id is minted client-side (content/save requires one).
      expect(
        body['id'],
        matches(RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
        )),
      );
    });

    test('falls back to request grade and flow defaults when output omits them',
        () async {
      final client = FakeApiClient(
        postResponse: <String, dynamic>{'success': true, 'id': 'ws-2'},
      );
      final container = containerWith(client);
      const bare = Worksheet(title: 'x', raw: <String, dynamic>{'title': 'x'});

      await container
          .read(worksheetRepositoryProvider)
          .save(worksheet: bare, prompt: 'short', gradeLevel: 'Class 4');

      final body = client.posts.single.data! as Map<String, dynamic>;
      expect(body['gradeLevel'], 'Class 4'); // from the request
      expect(body['subject'], 'General'); // flow default
      expect(body['language'], 'English'); // default when none passed
      expect(body['title'], 'Worksheet: short');
    });

    test('a failed save surfaces as the typed exception', () async {
      final client = FakeApiClient(
        postError: const ApiException(
          ApiErrorKind.server,
          'x',
          statusCode: 500,
        ),
      );
      final container = containerWith(client);

      await expectLater(
        container
            .read(worksheetRepositoryProvider)
            .save(worksheet: worksheet, prompt: 'p'),
        throwsA(isA<ApiException>()),
      );
    });
  });

  group('WorksheetSaveController', () {
    test('a successful save leaves the contentId in state', () async {
      final client = FakeApiClient(
        postResponse: <String, dynamic>{'success': true, 'id': 'abc'},
      );
      final container = containerWith(client);

      await container
          .read(worksheetSaveControllerProvider.notifier)
          .save(worksheet: worksheet, prompt: 'p');

      final state = container.read(worksheetSaveControllerProvider);
      expect(state.hasError, isFalse);
      expect(state.value, 'abc');
    });

    test('a failed save reports the error', () async {
      final client = FakeApiClient(
        postError: const ApiException(ApiErrorKind.network, 'offline'),
      );
      final container = containerWith(client);

      await container
          .read(worksheetSaveControllerProvider.notifier)
          .save(worksheet: worksheet, prompt: 'p');

      expect(container.read(worksheetSaveControllerProvider).hasError, isTrue);
    });

    test('reset returns to idle', () {
      final container = containerWith(FakeApiClient());
      container.read(worksheetSaveControllerProvider.notifier).reset();
      expect(container.read(worksheetSaveControllerProvider).value, isNull);
    });
  });
}
