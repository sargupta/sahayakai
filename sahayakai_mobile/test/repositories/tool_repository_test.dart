import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/tools/data/tool_repository.dart';
import '../helpers/mocks.dart';

void main() {
  late MockDio mockDio;
  late MockApiClient mockApiClient;
  late ToolRepository repo;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    mockApiClient = mocks.apiClient;
    repo = ToolRepository(mockApiClient);
  });

  group('ToolRepository - generateToolContent', () {
    test('returns answer on 200 success', () async {
      when(() => mockDio.post(
            any(),
            data: any(named: 'data'),
            queryParameters: any(named: 'queryParameters'),
            options: any(named: 'options'),
            cancelToken: any(named: 'cancelToken'),
            onSendProgress: any(named: 'onSendProgress'),
            onReceiveProgress: any(named: 'onReceiveProgress'),
          )).thenAnswer((_) async => successResponse({
            'answer': 'Generated lesson plan content here',
          }));

      final result = await repo.generateToolContent(
        toolName: 'Lesson Plan',
        prompt: 'Create a lesson plan for photosynthesis',
        language: 'English',
        gradeLevel: 'Class 7',
        subject: 'Science',
      );

      expect(result, 'Generated lesson plan content here');
    });

    test('returns default message when answer is null', () async {
      when(() => mockDio.post(
            any(),
            data: any(named: 'data'),
            queryParameters: any(named: 'queryParameters'),
            options: any(named: 'options'),
            cancelToken: any(named: 'cancelToken'),
            onSendProgress: any(named: 'onSendProgress'),
            onReceiveProgress: any(named: 'onReceiveProgress'),
          )).thenAnswer((_) async => successResponse({
            'answer': null,
          }));

      final result = await repo.generateToolContent(
        toolName: 'Quiz',
        prompt: 'Generate a quiz',
        language: 'Hindi',
      );

      expect(result, 'No response generated.');
    });

    test('throws on non-200 status code', () async {
      when(() => mockDio.post(
            any(),
            data: any(named: 'data'),
            queryParameters: any(named: 'queryParameters'),
            options: any(named: 'options'),
            cancelToken: any(named: 'cancelToken'),
            onSendProgress: any(named: 'onSendProgress'),
            onReceiveProgress: any(named: 'onReceiveProgress'),
          )).thenAnswer((_) async => Response(
            data: {'error': 'Server error'},
            statusCode: 500,
            requestOptions: RequestOptions(path: ''),
          ));

      expect(
        () => repo.generateToolContent(
          toolName: 'Quiz',
          prompt: 'Generate quiz',
          language: 'English',
        ),
        throwsA(isA<Exception>().having(
          (e) => e.toString(),
          'message',
          contains('Failed to generate content: 500'),
        )),
      );
    });

    test('wraps DioException in generic Exception', () async {
      when(() => mockDio.post(
            any(),
            data: any(named: 'data'),
            queryParameters: any(named: 'queryParameters'),
            options: any(named: 'options'),
            cancelToken: any(named: 'cancelToken'),
            onSendProgress: any(named: 'onSendProgress'),
            onReceiveProgress: any(named: 'onReceiveProgress'),
          )).thenThrow(dioError(statusCode: 503));

      expect(
        () => repo.generateToolContent(
          toolName: 'Rubric',
          prompt: 'Generate rubric',
          language: 'English',
        ),
        throwsA(isA<Exception>().having(
          (e) => e.toString(),
          'message',
          contains('Error generating content'),
        )),
      );
    });

    test('constructs correct request body with optional params', () async {
      Map<String, dynamic>? capturedData;

      when(() => mockDio.post(
            any(),
            data: any(named: 'data'),
            queryParameters: any(named: 'queryParameters'),
            options: any(named: 'options'),
            cancelToken: any(named: 'cancelToken'),
            onSendProgress: any(named: 'onSendProgress'),
            onReceiveProgress: any(named: 'onReceiveProgress'),
          )).thenAnswer((invocation) async {
        capturedData = invocation.namedArguments[#data] as Map<String, dynamic>?;
        return successResponse({'answer': 'ok'});
      });

      await repo.generateToolContent(
        toolName: 'Worksheet',
        prompt: 'Create worksheet',
        language: 'Tamil',
        gradeLevel: 'Class 5',
        subject: 'Mathematics',
      );

      expect(capturedData, isNotNull);
      final message = capturedData!['message'] as String;
      expect(message, contains('Worksheet'));
      expect(message, contains('Tamil'));
      expect(message, contains('Class 5'));
      expect(message, contains('Mathematics'));
      expect(message, contains('Create worksheet'));
    });

    test('uses General fallback when gradeLevel and subject are null', () async {
      Map<String, dynamic>? capturedData;

      when(() => mockDio.post(
            any(),
            data: any(named: 'data'),
            queryParameters: any(named: 'queryParameters'),
            options: any(named: 'options'),
            cancelToken: any(named: 'cancelToken'),
            onSendProgress: any(named: 'onSendProgress'),
            onReceiveProgress: any(named: 'onReceiveProgress'),
          )).thenAnswer((invocation) async {
        capturedData = invocation.namedArguments[#data] as Map<String, dynamic>?;
        return successResponse({'answer': 'ok'});
      });

      await repo.generateToolContent(
        toolName: 'Rubric',
        prompt: 'Create rubric',
        language: 'English',
      );

      final message = capturedData!['message'] as String;
      expect(message, contains('General'));
    });

    test('posts to /assistant endpoint', () async {
      String? capturedPath;

      when(() => mockDio.post(
            any(),
            data: any(named: 'data'),
            queryParameters: any(named: 'queryParameters'),
            options: any(named: 'options'),
            cancelToken: any(named: 'cancelToken'),
            onSendProgress: any(named: 'onSendProgress'),
            onReceiveProgress: any(named: 'onReceiveProgress'),
          )).thenAnswer((invocation) async {
        capturedPath = invocation.positionalArguments[0] as String;
        return successResponse({'answer': 'ok'});
      });

      await repo.generateToolContent(
        toolName: 'Tool',
        prompt: 'prompt',
        language: 'English',
      );

      expect(capturedPath, '/assistant');
    });
  });
}
