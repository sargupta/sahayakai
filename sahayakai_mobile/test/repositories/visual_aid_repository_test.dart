import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/visual_aid/data/visual_aid_repository.dart';
import '../helpers/mocks.dart';

void main() {
  late VisualAidRepository repo;
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    repo = VisualAidRepository(mocks.apiClient);
  });

  group('VisualAidRepository', () {
    group('generate', () {
      const fullResponse = {
        'imageDataUri': 'data:image/png;base64,iVBOR...',
        'pedagogicalContext': 'This diagram shows photosynthesis',
        'discussionSpark': 'What happens when plants lack sunlight?',
        'subject': 'Biology',
        'storagePath': 'visual-aids/abc-123.png',
      };

      test('returns VisualAidOutput on success with all fields', () async {
        when(() => mockDio.post(
              '/ai/visual-aid',
              data: any(named: 'data'),
              options: any(named: 'options'),
            )).thenAnswer((_) async => successResponse(fullResponse));

        final result = await repo.generate(
          prompt: 'Photosynthesis diagram',
          gradeLevel: 'Class 7',
          language: 'en',
          subject: 'Biology',
        );

        expect(result.imageDataUri, startsWith('data:image/png'));
        expect(result.pedagogicalContext, contains('photosynthesis'));
        expect(result.discussionSpark, isNotEmpty);
        expect(result.subject, 'Biology');
        expect(result.storagePath, 'visual-aids/abc-123.png');
      });

      test('sends only required field when optionals are absent', () async {
        when(() => mockDio.post(
              '/ai/visual-aid',
              data: any(named: 'data'),
              options: any(named: 'options'),
            )).thenAnswer((_) async => successResponse(fullResponse));

        await repo.generate(prompt: 'Water cycle');

        verify(() => mockDio.post(
              '/ai/visual-aid',
              data: {'prompt': 'Water cycle'},
              options: any(named: 'options'),
            )).called(1);
      });

      test('sends all optional fields when present', () async {
        when(() => mockDio.post(
              '/ai/visual-aid',
              data: any(named: 'data'),
              options: any(named: 'options'),
            )).thenAnswer((_) async => successResponse(fullResponse));

        await repo.generate(
          prompt: 'Cell diagram',
          gradeLevel: 'Class 9',
          language: 'hi',
          subject: 'Science',
        );

        verify(() => mockDio.post(
              '/ai/visual-aid',
              data: {
                'prompt': 'Cell diagram',
                'gradeLevel': 'Class 9',
                'language': 'hi',
                'subject': 'Science',
              },
              options: any(named: 'options'),
            )).called(1);
      });

      test('handles response with null optional fields', () async {
        when(() => mockDio.post(
              '/ai/visual-aid',
              data: any(named: 'data'),
              options: any(named: 'options'),
            )).thenAnswer((_) async => successResponse({
                  'pedagogicalContext': 'Context',
                  'discussionSpark': 'Spark',
                }));

        final result = await repo.generate(prompt: 'test');

        expect(result.imageDataUri, isNull);
        expect(result.subject, isNull);
        expect(result.storagePath, isNull);
        expect(result.pedagogicalContext, 'Context');
        expect(result.discussionSpark, 'Spark');
      });

      test('handles null fields with defaults', () async {
        when(() => mockDio.post(
              '/ai/visual-aid',
              data: any(named: 'data'),
              options: any(named: 'options'),
            )).thenAnswer((_) async => successResponse(<String, dynamic>{}));

        final result = await repo.generate(prompt: 'test');

        expect(result.pedagogicalContext, '');
        expect(result.discussionSpark, '');
      });

      test('passes Options with 120s receiveTimeout', () async {
        Options? capturedOptions;
        when(() => mockDio.post(
              '/ai/visual-aid',
              data: any(named: 'data'),
              options: any(named: 'options'),
            )).thenAnswer((invocation) async {
          capturedOptions =
              invocation.namedArguments[const Symbol('options')] as Options?;
          return successResponse(fullResponse);
        });

        await repo.generate(prompt: 'test');

        expect(capturedOptions, isNotNull);
        expect(capturedOptions!.receiveTimeout,
            const Duration(seconds: 120));
      });

      test('throws on non-200 status code', () async {
        when(() => mockDio.post(
              '/ai/visual-aid',
              data: any(named: 'data'),
              options: any(named: 'options'),
            )).thenAnswer((_) async => successResponse(null, statusCode: 500));

        expect(
          () => repo.generate(prompt: 'test'),
          throwsException,
        );
      });

      test('throws on DioException (e.g. 429 rate limit)', () async {
        when(() => mockDio.post(
              '/ai/visual-aid',
              data: any(named: 'data'),
              options: any(named: 'options'),
            )).thenThrow(dioError(statusCode: 429));

        expect(
          () => repo.generate(prompt: 'test'),
          throwsA(isA<DioException>()),
        );
      });
    });
  });
}
