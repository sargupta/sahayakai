import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/chat/data/chat_repository.dart';
import '../helpers/mocks.dart';

void main() {
  late ChatRepository repo;
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    repo = ChatRepository(mocks.apiClient);
  });

  group('ChatRepository', () {
    group('sendQuestion', () {
      test('returns response data on success', () async {
        when(() => mockDio.post(
              '/ai/instant-answer',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({
              'answer': 'The Earth revolves around the Sun.',
              'sources': ['NCERT Class 5'],
            }));

        final result = await repo.sendQuestion('Why does the Earth move?', 'English', 'Class 5');

        expect(result, isA<Map<String, dynamic>>());
        expect(result['answer'], 'The Earth revolves around the Sun.');
        expect(result['sources'], isA<List>());
      });

      test('sends correct payload', () async {
        when(() => mockDio.post(
              '/ai/instant-answer',
              data: any(named: 'data'),
            )).thenAnswer((_) async => successResponse({'answer': 'ok'}));

        await repo.sendQuestion('test question', 'Hindi', 'Class 8');

        verify(() => mockDio.post(
              '/ai/instant-answer',
              data: {
                'question': 'test question',
                'language': 'Hindi',
                'gradeLevel': 'Class 8',
              },
            )).called(1);
      });

      test('throws on DioException', () async {
        when(() => mockDio.post(
              '/ai/instant-answer',
              data: any(named: 'data'),
            )).thenThrow(dioError());

        expect(
          () => repo.sendQuestion('q', 'en', 'Class 5'),
          throwsA(isA<DioException>()),
        );
      });
    });
  });
}
