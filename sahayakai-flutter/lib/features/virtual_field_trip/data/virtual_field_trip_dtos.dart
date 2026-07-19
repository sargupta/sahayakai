import 'package:json_annotation/json_annotation.dart';

import '../domain/virtual_field_trip.dart';

part 'virtual_field_trip_dtos.g.dart';

/// Serializes a [VirtualFieldTripRequest] into the exact
/// `POST /api/ai/virtual-field-trip` body. `includeIfNull: false` drops the
/// optional fields the teacher left blank so the endpoint applies its own
/// defaults (the flow back-fills language/grade from the profile). The web
/// composer sends `topic`, and optionally `gradeLevel` / `language`.
///
/// `userId` is injected server-side from the verified token and is never sent
/// from the client.
@JsonSerializable(includeIfNull: false, createFactory: false)
class VirtualFieldTripRequestDto {
  const VirtualFieldTripRequestDto({
    required this.topic,
    this.gradeLevel,
    this.language,
  });

  factory VirtualFieldTripRequestDto.fromDomain(VirtualFieldTripRequest r) {
    return VirtualFieldTripRequestDto(
      topic: r.topic.trim(),
      gradeLevel: _clean(r.gradeLevel),
      language: _clean(r.language),
    );
  }

  final String topic;
  final String? gradeLevel;
  final String? language;

  Map<String, dynamic> toJson() => _$VirtualFieldTripRequestDtoToJson(this);
}

/// One `stops[]` object from the 200 payload (`src/ai/flows/virtual-field-trip.ts`:
/// `name`, `description`, `educationalFact`, `reflectionPrompt`,
/// `googleEarthUrl`, `culturalAnalogy`, `explanation`). Every field is nullable
/// on decode so a sparse object never throws; [toDomain] normalizes and drops a
/// stop that cannot be titled.
@JsonSerializable(createToJson: false)
class FieldTripStopDto {
  const FieldTripStopDto({
    this.name,
    this.description,
    this.educationalFact,
    this.reflectionPrompt,
    this.googleEarthUrl,
    this.culturalAnalogy,
    this.explanation,
  });

  factory FieldTripStopDto.fromJson(Map<String, dynamic> json) =>
      _$FieldTripStopDtoFromJson(json);

  final String? name;
  final String? description;
  final String? educationalFact;
  final String? reflectionPrompt;
  final String? googleEarthUrl;
  final String? culturalAnalogy;
  final String? explanation;

  /// Normalizes this wire object to a domain [FieldTripStop], or null when it
  /// cannot be rendered. A stop with no name is dropped: the numbered card needs
  /// a title, and a nameless stop would be a headless block. The Google Earth
  /// URL is validated here (see [_safeEarthUri]) — an unsafe/unparseable URL
  /// becomes null so the card omits the launch action rather than dropping the
  /// stop's still-valuable text.
  FieldTripStop? toDomain() {
    final stopName = _clean(name);
    if (stopName == null) return null;

    return FieldTripStop(
      name: stopName,
      description: _clean(description) ?? '',
      educationalFact: _clean(educationalFact) ?? '',
      reflectionPrompt: _clean(reflectionPrompt) ?? '',
      culturalAnalogy: _clean(culturalAnalogy) ?? '',
      explanation: _clean(explanation) ?? '',
      googleEarthUrl: _safeEarthUri(googleEarthUrl),
    );
  }
}

/// The `/api/ai/virtual-field-trip` 200 payload. The route responds with exactly
/// these four keys (`title`, `stops`, `gradeLevel`, `subject`).
@JsonSerializable(createToJson: false)
class VirtualFieldTripResponseDto {
  const VirtualFieldTripResponseDto({
    this.title,
    this.stops,
    this.gradeLevel,
    this.subject,
  });

  factory VirtualFieldTripResponseDto.fromJson(Map<String, dynamic> json) =>
      _$VirtualFieldTripResponseDtoFromJson(json);

  final String? title;
  final List<FieldTripStopDto>? stops;
  final String? gradeLevel;
  final String? subject;

  FieldTrip toDomain() {
    final decoded = <FieldTripStop>[
      for (final dto in stops ?? const <FieldTripStopDto>[])
        if (dto.toDomain() case final FieldTripStop stop) stop,
    ];

    return FieldTrip(
      title: _clean(title) ?? '',
      stops: decoded,
      gradeLevel: _clean(gradeLevel) ?? '',
      subject: _clean(subject) ?? '',
    );
  }
}

/// The 202 `still_generating` body the dispatcher returns when its 45s budget
/// elapses (`{ error: 'still_generating', message, budgetMs, elapsedMs }`). This
/// is a SUCCESS-path response (status < 400), so Dio does not throw and the
/// repository decodes it here rather than in the error mapper — it must reach the
/// controller as a distinct outcome, not an exception.
@JsonSerializable(createToJson: false)
class FieldTripStillGeneratingDto {
  const FieldTripStillGeneratingDto({
    this.error,
    this.message,
    this.budgetMs,
    this.elapsedMs,
  });

  factory FieldTripStillGeneratingDto.fromJson(Map<String, dynamic> json) =>
      _$FieldTripStillGeneratingDtoFromJson(json);

  /// The machine code — always `still_generating` for this shape.
  final String? error;

  /// The server's human line ("Your field trip is still generating. Check My
  /// Library in a minute.").
  final String? message;

  /// The dispatcher's budget in ms (45000) — telemetry, tolerated as `num`.
  final num? budgetMs;

  /// How long had elapsed when the budget fired — telemetry, tolerated as `num`.
  final num? elapsedMs;

  FieldTripStillGenerating toDomain() =>
      FieldTripStillGenerating(message: _clean(message) ?? '');
}

/// The machine code the 202 body carries under `error`. The repository keys on
/// this to route a `still_generating` 2xx to the distinct outcome instead of the
/// normal itinerary decode.
const String kStillGeneratingCode = 'still_generating';

String? _clean(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}

/// Validates a model-authored Google Earth URL before it can ever reach the
/// launcher: it must parse to an absolute `http`/`https` URI with a host. Anything
/// else (a relative string, a `javascript:`/`file:` scheme, empty) returns null,
/// and the stop card then hides its launch action. Mirrors the video tool's
/// `_safeWatchUrl` guard so no unchecked model string reaches `linkOpener`.
Uri? _safeEarthUri(String? raw) {
  final value = _clean(raw);
  if (value == null) return null;
  final uri = Uri.tryParse(value);
  if (uri == null || !uri.isAbsolute || uri.host.isEmpty) return null;
  if (uri.scheme != 'http' && uri.scheme != 'https') return null;
  return uri;
}
