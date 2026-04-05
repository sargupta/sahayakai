import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/content/data/content_repository.dart';
import 'package:sahayakai_mobile/src/features/content/domain/content_models.dart';
import '../helpers/mocks.dart';

void main() {
  late ContentRepository repo;
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    repo = ContentRepository(mocks.apiClient);
  });

  group('ContentRepository', () {
    group('saveContent', () {
      test('returns content ID on success', () async {
        when(() => mockDio.post(
              '/content/save',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({'id': 'abc-123'}));

        final id = await repo.saveContent(
          type: 'lesson-plan',
          title: 'Test Plan',
          data: {'title': 'Test'},
        );

        expect(id, 'abc-123');
      });

      test('throws on server error', () async {
        when(() => mockDio.post(
              '/content/save',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse(null, statusCode: 500));

        expect(
          () => repo.saveContent(
              type: 'quiz', title: 'Q', data: {}),
          throwsException,
        );
      });
    });

    group('listContent', () {
      test('parses paginated response', () async {
        when(() => mockDio.get(
              '/content/list',
              queryParameters: any(named: 'queryParameters'),
            )).thenAnswer((_) async => successResponse({
              'items': [
                {'id': '1', 'type': 'quiz', 'title': 'Quiz 1', 'createdAt': '2026-01-01'},
                {'id': '2', 'type': 'lesson-plan', 'title': 'LP 1', 'createdAt': '2026-01-02'},
              ],
              'count': 2,
              'nextCursor': 'cursor-xyz',
            }));

        final result = await repo.listContent(limit: 10);

        expect(result.items.length, 2);
        expect(result.items[0].type, 'quiz');
        expect(result.items[1].title, 'LP 1');
        expect(result.nextCursor, 'cursor-xyz');
      });

      test('passes type filter correctly', () async {
        when(() => mockDio.get(
              '/content/list',
              queryParameters: any(named: 'queryParameters'),
            )).thenAnswer((_) async => successResponse({
              'items': [],
              'count': 0,
            }));

        await repo.listContent(type: 'worksheet', limit: 5);

        verify(() => mockDio.get(
              '/content/list',
              queryParameters: {
                'type': 'worksheet',
                'limit': 5,
              },
            )).called(1);
      });

      test('returns empty list on no results', () async {
        when(() => mockDio.get(
              '/content/list',
              queryParameters: any(named: 'queryParameters'),
            )).thenAnswer((_) async => successResponse({
              'items': [],
              'count': 0,
            }));

        final result = await repo.listContent();
        expect(result.items, isEmpty);
        expect(result.nextCursor, isNull);
      });
    });

    group('getContent', () {
      test('returns full content item', () async {
        when(() => mockDio.get(
              '/content/get',
              queryParameters: any(named: 'queryParameters'),
            )).thenAnswer((_) async => successResponse({
              'id': 'x',
              'type': 'rubric',
              'title': 'Math Rubric',
              'gradeLevel': 'Class 8',
              'data': {'criteria': []},
            }));

        final item = await repo.getContent('x');
        expect(item.type, 'rubric');
        expect(item.title, 'Math Rubric');
        expect(item.data, isNotNull);
      });
    });

    group('deleteContent', () {
      test('succeeds silently on 200', () async {
        when(() => mockDio.delete(
              '/content/delete',
              queryParameters: any(named: 'queryParameters'),
            )).thenAnswer((_) async => successResponse({'success': true}));

        await repo.deleteContent('x');
        // No exception = success
      });

      test('throws on 404', () async {
        when(() => mockDio.delete(
              '/content/delete',
              queryParameters: any(named: 'queryParameters'),
            )).thenAnswer((_) async => successResponse(null, statusCode: 404));

        expect(() => repo.deleteContent('missing'), throwsException);
      });
    });

    group('getDownloadUrl', () {
      test('returns signed URL', () async {
        when(() => mockDio.get(
              '/content/download',
              queryParameters: any(named: 'queryParameters'),
            )).thenAnswer((_) async => successResponse({
              'downloadUrl': 'https://storage.googleapis.com/signed-url',
            }));

        final url = await repo.getDownloadUrl('x');
        expect(url, contains('storage.googleapis.com'));
      });

      test('throws on non-200 status', () async {
        when(() => mockDio.get(
              '/content/download',
              queryParameters: any(named: 'queryParameters'),
            )).thenAnswer((_) async => successResponse(null, statusCode: 404));

        expect(() => repo.getDownloadUrl('missing'), throwsException);
      });

      test('throws on network error', () async {
        when(() => mockDio.get(
              '/content/download',
              queryParameters: any(named: 'queryParameters'),
            )).thenThrow(dioError(
          type: DioExceptionType.connectionTimeout,
        ));

        expect(
          () => repo.getDownloadUrl('x'),
          throwsA(isA<DioException>()),
        );
      });
    });

    group('listContent — cursor-based pagination', () {
      test('passes cursor parameter for pagination', () async {
        when(() => mockDio.get(
              '/content/list',
              queryParameters: any(named: 'queryParameters'),
            )).thenAnswer((_) async => successResponse({
              'items': [],
              'count': 0,
            }));

        await repo.listContent(cursor: 'abc-cursor', limit: 5);

        verify(() => mockDio.get(
              '/content/list',
              queryParameters: {
                'limit': 5,
                'cursor': 'abc-cursor',
              },
            )).called(1);
      });

      test('passes gradeLevels and subjects filters', () async {
        when(() => mockDio.get(
              '/content/list',
              queryParameters: any(named: 'queryParameters'),
            )).thenAnswer((_) async => successResponse({
              'items': [],
              'count': 0,
            }));

        await repo.listContent(
          gradeLevels: ['Class 7', 'Class 8'],
          subjects: ['Science', 'Math'],
        );

        verify(() => mockDio.get(
              '/content/list',
              queryParameters: {
                'limit': 10,
                'gradeLevels': 'Class 7,Class 8',
                'subjects': 'Science,Math',
              },
            )).called(1);
      });

      test('throws on non-200 status', () async {
        when(() => mockDio.get(
              '/content/list',
              queryParameters: any(named: 'queryParameters'),
            )).thenAnswer(
            (_) async => successResponse(null, statusCode: 500));

        expect(() => repo.listContent(), throwsException);
      });
    });

    group('getContent — error paths', () {
      test('throws on non-200 status', () async {
        when(() => mockDio.get(
              '/content/get',
              queryParameters: any(named: 'queryParameters'),
            )).thenAnswer(
            (_) async => successResponse(null, statusCode: 404));

        expect(() => repo.getContent('missing'), throwsException);
      });
    });

    group('publishToLibrary', () {
      test('succeeds on 200', () async {
        when(() => mockDio.post(
              '/content/publish',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({'ok': true}));

        await repo.publishToLibrary('x');
        // No exception = success
      });

      test('throws on non-200 status', () async {
        when(() => mockDio.post(
              '/content/publish',
              data: any(named: 'data'),
            )).thenAnswer(
            (_) async => successResponse(null, statusCode: 403));

        expect(() => repo.publishToLibrary('x'), throwsException);
      });
    });

    group('saveContent — optional fields', () {
      test('includes optional fields when provided', () async {
        when(() => mockDio.post(
              '/content/save',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({'id': 'new-id'}));

        await repo.saveContent(
          type: 'quiz',
          title: 'Science Quiz',
          data: {'questions': []},
          gradeLevel: 'Class 8',
          subject: 'Science',
          topic: 'Photosynthesis',
          language: 'Hindi',
          isPublic: true,
        );

        final captured = verify(() => mockDio.post(
              '/content/save',
              data: captureAny(named: 'data'),
            )).captured.single as Map<String, dynamic>;

        expect(captured['gradeLevel'], 'Class 8');
        expect(captured['subject'], 'Science');
        expect(captured['topic'], 'Photosynthesis');
        expect(captured['language'], 'Hindi');
        expect(captured['isPublic'], true);
      });
    });
  });
}
