import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/feedback/data/feedback_repository.dart';
import '../helpers/mocks.dart';

void main() {
  late FeedbackRepository repo;
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    repo = FeedbackRepository(mocks.apiClient);
  });

  group('FeedbackRepository', () {
    group('submit', () {
      test('succeeds on 200 with required params only', () async {
        when(() => mockDio.post(
              '/feedback',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({'success': true}));

        await repo.submit(contentId: 'content-123', rating: 5);

        verify(() => mockDio.post(
              '/feedback',
              data: {
                'contentId': 'content-123',
                'rating': 5,
              },
            )).called(1);
      });

      test('succeeds on 200 with all params', () async {
        when(() => mockDio.post(
              '/feedback',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({'success': true}));

        await repo.submit(
          contentId: 'content-456',
          rating: 3,
          difficulty: 'hard',
          questionIndex: 2,
          comment: 'Question was ambiguous.',
        );

        verify(() => mockDio.post(
              '/feedback',
              data: {
                'contentId': 'content-456',
                'rating': 3,
                'difficulty': 'hard',
                'questionIndex': 2,
                'comment': 'Question was ambiguous.',
              },
            )).called(1);
      });

      test('sends partial optional params correctly', () async {
        when(() => mockDio.post(
              '/feedback',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({'success': true}));

        await repo.submit(
          contentId: 'c1',
          rating: 4,
          comment: 'Nice quiz!',
        );

        verify(() => mockDio.post(
              '/feedback',
              data: {
                'contentId': 'c1',
                'rating': 4,
                'comment': 'Nice quiz!',
              },
            )).called(1);
      });

      test('throws on non-200 status', () async {
        when(() => mockDio.post(
              '/feedback',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse(
              {'error': 'fail'},
              statusCode: 500,
            ));

        expect(
          () => repo.submit(contentId: 'c1', rating: 1),
          throwsException,
        );
      });

      test('throws on DioException', () async {
        when(() => mockDio.post(
              '/feedback',
              data: any(named: 'data'),
            )).thenThrow(dioError());

        expect(
          () => repo.submit(contentId: 'c1', rating: 1),
          throwsA(isA<DioException>()),
        );
      });
    });
  });
}
