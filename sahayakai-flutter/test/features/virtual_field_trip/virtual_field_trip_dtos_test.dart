import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/features/virtual_field_trip/data/virtual_field_trip_dtos.dart';
import 'package:sahayakai/features/virtual_field_trip/domain/virtual_field_trip.dart';

import 'virtual_field_trip_fixtures.dart';

/// The wire contract for `POST /api/ai/virtual-field-trip`, pinned against the
/// backend's `VirtualFieldTripInputSchema` (topic required, language/gradeLevel
/// optional) and the route's response shape — `title`, `stops` (each with
/// `name`, `description`, `educationalFact`, `reflectionPrompt`, `googleEarthUrl`,
/// `culturalAnalogy`, `explanation`), `gradeLevel`, `subject`. The benign 202
/// `{ error: 'still_generating', message, budgetMs, elapsedMs }` is pinned too.
/// If the client ever drifts from those field names, these fail first.
void main() {
  group('VirtualFieldTripRequestDto', () {
    test('serializes topic + optional fields with the exact schema names', () {
      final json = VirtualFieldTripRequestDto.fromDomain(
        VirtualFieldTripRequest(
          topic: '  The Great Barrier Reef  ',
          gradeLevel: 'Class 7',
          language: AppLocale.kn.aiName,
        ),
      ).toJson();

      expect(json, {
        'topic': 'The Great Barrier Reef', // trimmed
        'gradeLevel': 'Class 7',
        'language': 'Kannada', // AppLocale.aiName, not the code
      });
    });

    test('never sends server-injected fields', () {
      // The route parses `{...json, userId}` with userId from the verified token.
      // A client that sent its own would be a trust-boundary hole.
      final json = VirtualFieldTripRequestDto.fromDomain(
        const VirtualFieldTripRequest(topic: 'Volcanoes'),
      ).toJson();

      for (final field in ['userId', 'user_id', 'state', 'educationBoard']) {
        expect(
          json.containsKey(field),
          isFalse,
          reason: '$field is server-injected/derived and must never be sent',
        );
      }
    });

    test('omits blank optional fields instead of sending explicit nulls', () {
      // Grade/language are optional; the endpoint back-fills absent keys from the
      // profile, so an explicit null is a different (and wrong) request.
      final json = VirtualFieldTripRequestDto.fromDomain(
        const VirtualFieldTripRequest(topic: 'Coral reefs', gradeLevel: '   '),
      ).toJson();

      expect(json, {'topic': 'Coral reefs'});
    });
  });

  group('VirtualFieldTripResponseDto — the itinerary', () {
    test('decodes the title, subject and grade', () {
      final trip = buildFieldTrip();
      expect(trip.title, contains('Great Rivers'));
      expect(trip.subject, 'Geography');
      expect(trip.gradeLevel, 'Class 7');
      expect(trip.hasStops, isTrue);
    });

    test('decodes every one of the seven stop fields', () {
      final first = buildFieldTrip().stops.first;

      expect(first.name, startsWith('The Amazon River Basin'));
      expect(first.description, contains('rainforest'));
      expect(first.educationalFact, contains('one-fifth'));
      expect(first.reflectionPrompt, contains('Ganga'));
      expect(first.culturalAnalogy, contains('Ganga basin'));
      expect(first.explanation, contains('river systems'));
      expect(first.googleEarthUrl.toString(), kAmazonEarthUrl);
    });

    test('parses a valid googleEarthUrl into an absolute https Uri', () {
      final first = buildFieldTrip().stops.first;
      expect(first.googleEarthUrl, isNotNull);
      expect(first.googleEarthUrl!.scheme, 'https');
      expect(first.googleEarthUrl!.host, 'earth.google.com');
    });

    test('drops an unsafe googleEarthUrl to null (launch action then hides)', () {
      // The Andes stop carried a javascript: url — unsafe. The stop survives (its
      // text is still valuable) but its URL is null so the card omits the action.
      final andes =
          buildFieldTrip().stops.firstWhere((s) => s.name == 'The Andes Mountains');
      expect(andes.googleEarthUrl, isNull);
    });

    test('drops a stop that arrived without a name', () {
      // The fixture carries four stops; the nameless junk entry must not survive.
      final trip = buildFieldTrip();
      expect(trip.stops, hasLength(3));
      expect(trip.stops.every((s) => s.name.isNotEmpty), isTrue);
    });

    test('a fully-empty payload decodes to no-stops, not a crash', () {
      final trip =
          VirtualFieldTripResponseDto.fromJson(const <String, dynamic>{})
              .toDomain();
      expect(trip.hasStops, isFalse);
      expect(trip.title, '');
      expect(trip.subject, '');
      expect(trip.stops, isEmpty);
    });

    test('a stop with sparse fields decodes without throwing', () {
      final trip = VirtualFieldTripResponseDto.fromJson(<String, dynamic>{
        'title': 'Bare trip',
        'stops': <Map<String, dynamic>>[
          <String, dynamic>{'name': 'Only a name'},
        ],
      }).toDomain();
      expect(trip.stops, hasLength(1));
      final stop = trip.stops.single;
      expect(stop.name, 'Only a name');
      expect(stop.description, '');
      expect(stop.googleEarthUrl, isNull);
    });
  });

  group('FieldTripStillGeneratingDto — the 202', () {
    test('decodes the still_generating body to the distinct outcome', () {
      final dto = FieldTripStillGeneratingDto.fromJson(stillGeneratingJson());

      expect(dto.error, kStillGeneratingCode);
      expect(dto.message, contains('My Library'));
      expect(dto.budgetMs, 45000);
      expect(dto.elapsedMs, 45231);

      final outcome = dto.toDomain();
      expect(outcome, isA<FieldTripStillGenerating>());
      expect(outcome.message, contains('still generating'));
    });
  });
}
