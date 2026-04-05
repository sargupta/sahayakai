import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/video/data/video_repository.dart';
import '../helpers/mocks.dart';

void main() {
  late VideoRepository repo;
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    repo = VideoRepository(mocks.apiClient);
  });

  group('VideoRepository', () {
    group('getRecommendations', () {
      test('returns VideoOutput on 200 with all params', () async {
        when(() => mockDio.post(
              '/ai/video-storyteller',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({
              'categories': {
                'Concept Explainers': ['photosynthesis explained', 'plant biology'],
                'Fun Activities': ['leaf experiment'],
              },
              'personalizedMessage': 'Here are some great videos!',
            }));

        final result = await repo.getRecommendations(
          subject: 'Science',
          gradeLevel: 'Class 7',
          topic: 'Photosynthesis',
          language: 'English',
          state: 'Karnataka',
          educationBoard: 'CBSE',
        );

        expect(result, isA<VideoOutput>());
        expect(result.categories.length, 2);
        expect(result.categories['Concept Explainers'], hasLength(2));
        expect(result.personalizedMessage, 'Here are some great videos!');
      });

      test('sends only provided optional params', () async {
        when(() => mockDio.post(
              '/ai/video-storyteller',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse(<String, dynamic>{
              'categories': <String, dynamic>{},
              'personalizedMessage': '',
            }));

        await repo.getRecommendations(subject: 'Math', topic: 'Fractions');

        verify(() => mockDio.post(
              '/ai/video-storyteller',
              data: {
                'subject': 'Math',
                'topic': 'Fractions',
              },
            )).called(1);
      });

      test('sends empty data when no params provided', () async {
        when(() => mockDio.post(
              '/ai/video-storyteller',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse(<String, dynamic>{
              'categories': <String, dynamic>{},
              'personalizedMessage': '',
            }));

        await repo.getRecommendations();

        verify(() => mockDio.post(
              '/ai/video-storyteller',
              data: <String, dynamic>{},
            )).called(1);
      });

      test('handles missing categories gracefully', () async {
        when(() => mockDio.post(
              '/ai/video-storyteller',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({
              'personalizedMessage': 'No videos found.',
            }));

        final result = await repo.getRecommendations(topic: 'obscure');

        expect(result.categories, isEmpty);
        expect(result.personalizedMessage, 'No videos found.');
      });

      test('throws on non-200 status', () async {
        when(() => mockDio.post(
              '/ai/video-storyteller',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse(
              {'error': 'fail'},
              statusCode: 500,
            ));

        expect(
          () => repo.getRecommendations(topic: 'test'),
          throwsException,
        );
      });

      test('throws on DioException', () async {
        when(() => mockDio.post(
              '/ai/video-storyteller',
              data: any(named: 'data'),
            )).thenThrow(dioError());

        expect(
          () => repo.getRecommendations(topic: 'test'),
          throwsA(isA<DioException>()),
        );
      });
    });
  });
}
