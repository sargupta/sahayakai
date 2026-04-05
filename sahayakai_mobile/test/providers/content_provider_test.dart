import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/content/data/content_repository.dart';
import 'package:sahayakai_mobile/src/features/content/domain/content_models.dart';
import 'package:sahayakai_mobile/src/features/content/presentation/providers/content_provider.dart';
import '../helpers/mocks.dart';

void main() {
  late MockContentRepository mockRepo;

  setUp(() {
    mockRepo = MockContentRepository();
    registerFallbackValue(const ContentFilter());
  });

  ProviderContainer createContainer() {
    return ProviderContainer(
      overrides: [
        contentRepositoryProvider.overrideWithValue(mockRepo),
      ],
    );
  }

  group('contentListProvider', () {
    test('fetches content list with default filter', () async {
      when(() => mockRepo.listContent(
            type: any(named: 'type'),
            limit: any(named: 'limit'),
            cursor: any(named: 'cursor'),
            gradeLevels: any(named: 'gradeLevels'),
            subjects: any(named: 'subjects'),
          )).thenAnswer((_) async => const ContentListResponse(
            items: [
              ContentItem(id: '1', type: 'quiz', title: 'Quiz 1'),
            ],
            count: 1,
          ));

      final container = createContainer();
      addTearDown(container.dispose);

      final result = await container.read(
        contentListProvider(const ContentFilter()).future,
      );

      expect(result.items.length, 1);
      expect(result.items[0].type, 'quiz');
    });

    test('fetches content list with type filter', () async {
      when(() => mockRepo.listContent(
            type: 'lesson-plan',
            limit: 10,
            cursor: any(named: 'cursor'),
            gradeLevels: any(named: 'gradeLevels'),
            subjects: any(named: 'subjects'),
          )).thenAnswer((_) async => const ContentListResponse(
            items: [],
            count: 0,
          ));

      final container = createContainer();
      addTearDown(container.dispose);

      final result = await container.read(
        contentListProvider(const ContentFilter(type: 'lesson-plan')).future,
      );

      expect(result.items, isEmpty);
    });

    test('passes cursor for pagination', () async {
      when(() => mockRepo.listContent(
            type: any(named: 'type'),
            limit: any(named: 'limit'),
            cursor: 'next-page',
            gradeLevels: any(named: 'gradeLevels'),
            subjects: any(named: 'subjects'),
          )).thenAnswer((_) async => const ContentListResponse(
            items: [],
            count: 0,
          ));

      final container = createContainer();
      addTearDown(container.dispose);

      final result = await container.read(
        contentListProvider(
          const ContentFilter(cursor: 'next-page'),
        ).future,
      );

      expect(result.count, 0);
    });
  });

  group('contentItemProvider', () {
    test('fetches single content item by ID', () async {
      when(() => mockRepo.getContent('abc'))
          .thenAnswer((_) async => const ContentItem(
                id: 'abc',
                type: 'rubric',
                title: 'Math Rubric',
              ));

      final container = createContainer();
      addTearDown(container.dispose);

      final result = await container.read(
        contentItemProvider('abc').future,
      );

      expect(result.id, 'abc');
      expect(result.type, 'rubric');
      expect(result.title, 'Math Rubric');
    });

    test('propagates error from repository', () async {
      when(() => mockRepo.getContent('missing'))
          .thenThrow(Exception('Not found'));

      final container = createContainer();
      addTearDown(container.dispose);

      expect(
        () => container.read(contentItemProvider('missing').future),
        throwsException,
      );
    });
  });
}
