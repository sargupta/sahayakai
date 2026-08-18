import 'package:json_annotation/json_annotation.dart';

import '../domain/assessment.dart';

part 'assess_assignment_dtos.g.dart';

/// Serializes an [AssessAssignmentRequest] into the exact
/// `POST /api/ai/assess-assignment` body. `includeIfNull: false` drops the
/// optionals the teacher left blank so the server applies its own defaults.
///
/// Pinned against `AssessAssignmentInputSchema` in `sahayakai-main`. Fields the
/// server injects or strips are NEVER sent:
///   - `userId` / `teacherContext` are injected from the verified token.
///   - `studentName` is DELETED server-side before the model — and this client
///     never collects or sends a name (or a `studentId` handle) at all.
@JsonSerializable(includeIfNull: false, createFactory: false)
class AssessAssignmentRequestDto {
  const AssessAssignmentRequestDto({
    required this.imageDataUri,
    required this.mode,
    this.language,
    this.editedTranscript,
    this.rubricSnapshot,
  });

  factory AssessAssignmentRequestDto.fromDomain(AssessAssignmentRequest r) {
    final edited = r.editedTranscript?.trim();
    return AssessAssignmentRequestDto(
      // The data URI is sent verbatim: the server validates its exact length
      // and its `data:image/(jpeg|png|webp);base64,` prefix.
      imageDataUri: r.imageDataUri,
      mode: r.mode.wire,
      language: _blankToNull(r.language),
      // Only meaningful in `score` mode; a blank value is omitted.
      editedTranscript: (edited == null || edited.isEmpty) ? null : edited,
      rubricSnapshot: r.rubric?.toJson(),
    );
  }

  final String imageDataUri;
  final String mode;
  final String? language;
  final String? editedTranscript;

  /// The optional rubric object (full `RubricGeneratorOutput` shape). A raw
  /// map so the nested shape is serialized verbatim without a second DTO layer.
  final Map<String, dynamic>? rubricSnapshot;

  Map<String, dynamic> toJson() => _$AssessAssignmentRequestDtoToJson(this);
}

/// The `/api/ai/assess-assignment` 200 payload — the scorecard. Every field is
/// defensive because the assessment is model-generated; [toDomain] normalizes
/// it into the render model. Field names mirror `AssessAssignmentOutputSchema`
/// exactly. `studentName` is never present (the server strips it); `studentId`
/// is deliberately not modelled (the client neither sends nor renders it).
@JsonSerializable(createToJson: false)
class AssessAssignmentResponseDto {
  const AssessAssignmentResponseDto({
    this.rawTranscript,
    this.editedTranscript,
    this.language,
    this.overallScore,
    this.pointsEarned,
    this.pointsPossible,
    this.perCriterionScores,
    this.strengths,
    this.improvements,
    this.nextSteps,
    this.teacherNote,
    this.confidenceOverall,
    this.warnings,
    this.rubricSnapshot,
  });

  factory AssessAssignmentResponseDto.fromJson(Map<String, dynamic> json) =>
      _$AssessAssignmentResponseDtoFromJson(json);

  final String? rawTranscript;
  final String? editedTranscript;
  final String? language;
  final num? overallScore;
  final num? pointsEarned;
  final num? pointsPossible;
  final List<CriterionScoreDto>? perCriterionScores;
  final List<String>? strengths;
  final List<String>? improvements;
  final List<String>? nextSteps;
  final String? teacherNote;
  final num? confidenceOverall;
  final List<String>? warnings;
  final AssessmentRubricDto? rubricSnapshot;

  /// [raw] is the verbatim response body. Pass it on the live assess path so a
  /// later Save persists the exact object the flow persists; omit it when
  /// decoding an already-saved item, which has nothing left to save.
  Assessment toDomain({Map<String, dynamic>? raw}) {
    return Assessment(
      rawTranscript: _clean(rawTranscript),
      editedTranscript: _clean(editedTranscript),
      language: _clean(language),
      overallScore: overallScore,
      pointsEarned: pointsEarned,
      pointsPossible: pointsPossible,
      perCriterionScores: (perCriterionScores ?? const <CriterionScoreDto>[])
          .map((c) => c.toDomain())
          .where((c) => c.criterionName.isNotEmpty)
          .toList(growable: false),
      strengths: _cleanList(strengths),
      improvements: _cleanList(improvements),
      nextSteps: _cleanList(nextSteps),
      teacherNote: _clean(teacherNote),
      confidenceOverall: _toUnit(confidenceOverall),
      warnings: _cleanList(warnings),
      rubric: rubricSnapshot?.toDomain(),
      raw: raw,
    );
  }
}

@JsonSerializable(createToJson: false)
class CriterionScoreDto {
  const CriterionScoreDto({
    this.criterionName,
    this.level,
    this.points,
    this.maxPoints,
    this.feedback,
    this.confidence,
  });

  factory CriterionScoreDto.fromJson(Map<String, dynamic> json) =>
      _$CriterionScoreDtoFromJson(json);

  final String? criterionName;
  final String? level;
  final num? points;
  final num? maxPoints;
  final String? feedback;
  final num? confidence;

  CriterionScore toDomain() => CriterionScore(
    criterionName: _clean(criterionName) ?? '',
    level: _clean(level),
    points: points,
    maxPoints: maxPoints,
    feedback: _clean(feedback),
    confidence: _toUnit(confidence),
  );
}

@JsonSerializable(createToJson: false)
class AssessmentRubricDto {
  const AssessmentRubricDto({
    this.title,
    this.description,
    this.criteria,
    this.gradeLevel,
    this.subject,
  });

  factory AssessmentRubricDto.fromJson(Map<String, dynamic> json) =>
      _$AssessmentRubricDtoFromJson(json);

  final String? title;
  final String? description;
  final List<AssessmentRubricCriterionDto>? criteria;
  final String? gradeLevel;
  final String? subject;

  AssessmentRubric toDomain() => AssessmentRubric(
    title: _clean(title) ?? '',
    description: _clean(description),
    criteria: (criteria ?? const <AssessmentRubricCriterionDto>[])
        .map((c) => c.toDomain())
        .where((c) => c.name.isNotEmpty)
        .toList(growable: false),
    gradeLevel: _clean(gradeLevel),
    subject: _clean(subject),
  );
}

@JsonSerializable(createToJson: false)
class AssessmentRubricCriterionDto {
  const AssessmentRubricCriterionDto({
    this.name,
    this.description,
    this.levels,
  });

  factory AssessmentRubricCriterionDto.fromJson(Map<String, dynamic> json) =>
      _$AssessmentRubricCriterionDtoFromJson(json);

  final String? name;
  final String? description;
  final List<AssessmentRubricLevelDto>? levels;

  AssessmentRubricCriterion toDomain() => AssessmentRubricCriterion(
    name: _clean(name) ?? '',
    description: _clean(description),
    levels: (levels ?? const <AssessmentRubricLevelDto>[])
        .map((l) => l.toDomain())
        .toList(growable: false),
  );
}

@JsonSerializable(createToJson: false)
class AssessmentRubricLevelDto {
  const AssessmentRubricLevelDto({this.name, this.description, this.points});

  factory AssessmentRubricLevelDto.fromJson(Map<String, dynamic> json) =>
      _$AssessmentRubricLevelDtoFromJson(json);

  final String? name;
  final String? description;
  final num? points;

  AssessmentRubricLevel toDomain() => AssessmentRubricLevel(
    name: _clean(name) ?? '',
    description: _clean(description),
    points: points,
  );
}

String? _clean(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}

List<String> _cleanList(List<String>? values) {
  if (values == null) return const <String>[];
  return values
      .map((v) => v.trim())
      .where((v) => v.isNotEmpty)
      .toList(growable: false);
}

String? _blankToNull(String? value) => _clean(value);

/// Clamps a model-supplied confidence into the 0.0–1.0 unit interval, dropping
/// a null. Defensive: the schema promises 0–1, but the model can drift.
double? _toUnit(num? value) {
  if (value == null) return null;
  return value.toDouble().clamp(0.0, 1.0);
}
