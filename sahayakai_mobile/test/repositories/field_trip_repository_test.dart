import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/virtual_field_trip/data/field_trip_repository.dart';
import '../helpers/mocks.dart';

void main() {
  late FieldTripRepository repo;
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    repo = FieldTripRepository(mocks.apiClient);
  });

  group('FieldTripRepository', () {
    group('generate', () {
      const fullResponse = {
        'title': 'Journey Through the Solar System',
        'stops': [
          {
            'name': 'Mercury',
            'description': 'Closest planet to the Sun',
            'educationalFact': 'Surface temperature reaches 430C',
            'reflectionPrompt': 'Why is Mercury so hot?',
            'googleEarthUrl': 'https://earth.google.com/mercury',
            'culturalAnalogy': 'Like a desert in Rajasthan',
            'explanation': 'First stop in our journey',
          },
          {
            'name': 'Mars',
            'description': 'The red planet',
            'educationalFact': 'Has the tallest volcano',
            'reflectionPrompt': 'Could humans live on Mars?',
          },
        ],
        'gradeLevel': 'Class 6',
        'subject': 'Science',
      };

      test('returns FieldTripOutput on success with all fields', () async {
        when(() => mockDio.post('/ai/virtual-field-trip',
                data: any(named: 'data')))
            .thenAnswer((_) async => successResponse(fullResponse));

        final result = await repo.generate(
          topic: 'Solar System',
          gradeLevel: 'Class 6',
          language: 'en',
        );

        expect(result.title, 'Journey Through the Solar System');
        expect(result.stops.length, 2);
        expect(result.stops[0].name, 'Mercury');
        expect(result.stops[0].googleEarthUrl, isNotNull);
        expect(result.stops[0].culturalAnalogy, 'Like a desert in Rajasthan');
        expect(result.stops[0].explanation, 'First stop in our journey');
        expect(result.stops[1].googleEarthUrl, isNull);
        expect(result.stops[1].culturalAnalogy, isNull);
        expect(result.gradeLevel, 'Class 6');
        expect(result.subject, 'Science');
      });

      test('sends only required field when optionals are absent', () async {
        when(() => mockDio.post('/ai/virtual-field-trip',
                data: any(named: 'data')))
            .thenAnswer((_) async => successResponse(fullResponse));

        await repo.generate(topic: 'Volcanoes');

        verify(() => mockDio.post('/ai/virtual-field-trip', data: {
              'topic': 'Volcanoes',
            })).called(1);
      });

      test('sends all optional fields when present', () async {
        when(() => mockDio.post('/ai/virtual-field-trip',
                data: any(named: 'data')))
            .thenAnswer((_) async => successResponse(fullResponse));

        await repo.generate(
          topic: 'Taj Mahal',
          gradeLevel: 'Class 7',
          language: 'hi',
        );

        verify(() => mockDio.post('/ai/virtual-field-trip', data: {
              'topic': 'Taj Mahal',
              'gradeLevel': 'Class 7',
              'language': 'hi',
            })).called(1);
      });

      test('handles response with empty stops', () async {
        when(() => mockDio.post('/ai/virtual-field-trip',
                data: any(named: 'data')))
            .thenAnswer((_) async => successResponse({
                  'title': 'Empty Trip',
                  'stops': [],
                }));

        final result = await repo.generate(topic: 'test');

        expect(result.stops, isEmpty);
        expect(result.gradeLevel, isNull);
        expect(result.subject, isNull);
      });

      test('handles null fields with defaults', () async {
        when(() => mockDio.post('/ai/virtual-field-trip',
                data: any(named: 'data')))
            .thenAnswer((_) async => successResponse(<String, dynamic>{}));

        final result = await repo.generate(topic: 'test');

        expect(result.title, '');
        expect(result.stops, isEmpty);
      });

      test('throws on non-200 status code', () async {
        when(() => mockDio.post('/ai/virtual-field-trip',
                data: any(named: 'data')))
            .thenAnswer((_) async => successResponse(null, statusCode: 500));

        expect(
          () => repo.generate(topic: 'test'),
          throwsException,
        );
      });

      test('throws on DioException', () async {
        when(() => mockDio.post('/ai/virtual-field-trip',
                data: any(named: 'data')))
            .thenThrow(dioError(statusCode: 503));

        expect(
          () => repo.generate(topic: 'test'),
          throwsA(isA<Exception>()),
        );
      });
    });
  });
}
