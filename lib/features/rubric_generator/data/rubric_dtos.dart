import 'package:json_annotation/json_annotation.dart';

import '../domain/rubric.dart';

part 'rubric_dtos.g.dart';

/// Serializes a [RubricRequest] into the exact `POST /api/ai/rubric` body.
/// `includeIfNull: false` drops the optional fields the teacher left blank so
/// the server applies its own defaults. `userId` and `teacherContext` are
/// injected server-side from the verified token and are never sent from the
/// client. Pinned against `RubricGeneratorInputSchema` in `sahayakai-main`.
@JsonSerializable(includeIfNull: false, createFactory: false)
class RubricRequestDto {
  const RubricRequestDto({
    required this.assignmentDescription,
    this.gradeLevel,
    this.subject,
    this.language,
  });

  factory RubricRequestDto.fromDomain(RubricRequest request) {
    return RubricRequestDto(
      assignmentDescription: request.assignmentDescription.trim(),
      gradeLevel: _blankToNull(request.gradeLevel),
      subject: _blankToNull(request.subject),
      language: _blankToNull(request.language),
    );
  }

  final String assignmentDescription;
  final String? gradeLevel;
  final String? subject;
  final String? language;

  Map<String, dynamic> toJson() => _$RubricRequestDtoToJson(this);
}

/// The `/api/ai/rubric` 200 payload. Every field is defensive because the
/// rubric is model-generated; [toDomain] normalizes it into the render model.
/// Field names mirror the route's returned object exactly:
/// `title`, `description`, `criteria`, `gradeLevel`, `subject`.
@JsonSerializable(createToJson: false)
class RubricResponseDto {
  const RubricResponseDto({
    this.title,
    this.description,
    this.criteria,
    this.gradeLevel,
    this.subject,
  });

  factory RubricResponseDto.fromJson(Map<String, dynamic> json) =>
      _$RubricResponseDtoFromJson(json);

  final String? title;
  final String? description;
  final List<RubricCriterionDto>? criteria;
  final String? gradeLevel;
  final String? subject;

  /// [raw] is the verbatim response body. Pass it on the live generate path so
  /// a later Save persists the exact object the flow persists; omit it when
  /// decoding an already-saved item, which has nothing left to save.
  Rubric toDomain({Map<String, dynamic>? raw}) {
    return Rubric(
      title: _clean(title) ?? '',
      description: _clean(description),
      criteria: (criteria ?? const <RubricCriterionDto>[])
          .map((c) => c.toDomain())
          .where((c) => c.name.isNotEmpty || c.levels.isNotEmpty)
          .toList(growable: false),
      gradeLevel: _clean(gradeLevel),
      subject: _clean(subject),
      raw: raw,
    );
  }
}

@JsonSerializable(createToJson: false)
class RubricCriterionDto {
  const RubricCriterionDto({this.name, this.description, this.levels});

  factory RubricCriterionDto.fromJson(Map<String, dynamic> json) =>
      _$RubricCriterionDtoFromJson(json);

  final String? name;
  final String? description;
  final List<RubricLevelDto>? levels;

  RubricCriterion toDomain() => RubricCriterion(
    name: _clean(name) ?? '',
    description: _clean(description),
    levels: (levels ?? const <RubricLevelDto>[])
        .map((l) => l.toDomain())
        // A level with no name AND no description carries nothing worth a
        // grid column; drop it so the row does not gain a blank cell.
        .where((l) => l.name.isNotEmpty || l.description.isNotEmpty)
        .toList(growable: false),
  );
}

@JsonSerializable(createToJson: false)
class RubricLevelDto {
  const RubricLevelDto({this.name, this.description, this.points});

  factory RubricLevelDto.fromJson(Map<String, dynamic> json) =>
      _$RubricLevelDtoFromJson(json);

  final String? name;
  final String? description;
  final num? points;

  RubricLevel toDomain() => RubricLevel(
    name: _clean(name) ?? '',
    description: _clean(description) ?? '',
    points: points,
  );
}

String? _clean(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}

String? _blankToNull(String? value) => _clean(value);
